import test from 'node:test';import assert from 'node:assert/strict';import {Miniflare} from 'miniflare';
import {createProductionIncident,updateProductionIncident} from '../worker/production-incidents.mjs';
import {changeRequests} from '../worker/change-requests.mjs';
import {incidentStages,projectIncidentStages} from '../lib/production-incidents.mjs';
import {requestPending} from '../lib/department-change-access.mjs';
const sx={login:'sx-a',permissionLogin:'sx-a',line:'A',grants:['Quản lý sản xuất / Báo công sản xuất / Lưu']},ql=login=>({permissionLogin:login}),order={id:'order-a',lsxCode:'LSX-A',line:'A',sku:'SKU-A',name:'TEST',lsxQty:100,processes:['CUT','ASSY 1','PACKING','FINAL']},workflow={orders:[order],reports:[]};
async function withDb(fn){const mf=new Miniflare({modules:true,script:'export default {fetch(){return new Response("TEST")}}',d1Databases:{DB:'incident-test'}});try{const db=await mf.getD1Database('DB');await db.prepare('CREATE TABLE app_records(entity TEXT,record_key TEXT,payload TEXT,updated_by TEXT,updated_at TEXT,PRIMARY KEY(entity,record_key))').run();await fn(db)}finally{await mf.dispose()}}
const body=()=>({id:crypto.randomUUID(),orderId:order.id,category:'Máy hư',reason:'Máy CUT dừng',estimatedHours:2,stages:['CUT'],action:'incident-create'});
test('ticket workflow, recipient isolation, all QLSX, retries, revision checks, audit, actual hours',()=>withDb(async db=>{
 const request=body(),created=await createProductionIncident(db,sx,request,workflow);const id=created.record.id;
 assert.equal(created.record.incident.estimatedHours,2);assert.equal('affectedQuantity' in created.record.incident,false);assert.deepEqual(requestPending(created.record),['QLSX']);
 assert.equal((await createProductionIncident(db,sx,request,workflow)).duplicate,true);
 assert.equal((await changeRequests(db,ql('htndiem'))).records.length,0);
 for(const login of ['cnphuong','ntnphung','dhtin']){const r=(await changeRequests(db,ql(login))).records[0];assert.equal(r.canConfirmIncident,true);assert.equal(r.pending,'QLSX');}
 for(const login of ['ltphong','httung','nttnghiem','tpnhi'])assert.equal((await changeRequests(db,ql(login))).records.length,0);
 await assert.rejects(()=>updateProductionIncident(db,ql('htndiem'),{action:'incident-confirm',id,revision:1}),{status:403});
 await assert.rejects(()=>changeRequests(db,ql('cnphuong'),{action:'send',id,revision:1,text:'Bypass'}),{status:403});
 await changeRequests(db,ql('ntnphung'),{action:'incident-confirm',id,revision:1});
 const kh=(await changeRequests(db,ql('htndiem'))).records[0];assert.equal(kh.canReplyIncident,true);assert.equal(kh.incident.confirmedBy,'ntnphung');
 await assert.rejects(()=>updateProductionIncident(db,ql('htndiem'),{action:'incident-reply',id,revision:1,text:'x'}),{status:409});
 await assert.rejects(()=>updateProductionIncident(db,ql('htndiem'),{action:'incident-reply',id,revision:2,text:'Chuyển lệnh B',delayRisk:true}),/ghi chú/i);
 await changeRequests(db,ql('htndiem'),{action:'incident-reply',id,revision:2,text:'Chuyển lệnh B',delayRisk:true,delayNote:'Chờ sửa máy 2 giờ'});
 const result=(await changeRequests(db,ql('dhtin'))).records[0];assert.equal(result.unreadReplyCount,1);assert.equal(result.incident.resolution,'Chuyển lệnh B');assert.equal(result.canResolveIncident,true);
 await changeRequests(db,ql('dhtin'),{action:'incident-resolve',id,revision:3,text:'Đã sửa xong',actualHours:1.5});
 const done=(await changeRequests(db,ql('cnphuong'))).records[0];assert.equal(done.incident.actualHours,1.5);assert.equal(done.messages.length,4);assert.equal(done.incident.status,'resolved');assert.deepEqual(done.pendingDepartments,[]);
 const events=(await db.prepare("SELECT payload FROM app_records WHERE entity='production_event'").all()).results.map(r=>JSON.parse(r.payload));assert.equal(events.length,1);assert.deepEqual(events[0].stages,['CUT']);assert.equal(events[0].actor,'sx-a');
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,4);
}));
test('line scope, server permissions, input validation, completed stage exclusion, admin and audit exception',()=>withDb(async db=>{
 await assert.rejects(()=>createProductionIncident(db,{...sx,line:'B'},body(),workflow),{status:403});
 await assert.rejects(()=>createProductionIncident(db,{...sx,grants:[]},body(),workflow),{status:403});
 for(const change of [{estimatedHours:0},{estimatedHours:-2},{estimatedHours:'abc'},{stages:[]},{stages:['UNKNOWN']},{reason:''},{category:'INVALID'}])await assert.rejects(()=>createProductionIncident(db,sx,{...body(),...change},workflow));
 assert.deepEqual(incidentStages(order,[{transitId:order.id,stageCode:'CUT',reportedQuantity:40},{transitId:order.id,stageName:'CUT',reportedQuantity:60}]),['ASSY','PACKING','FINAL']);
 await assert.rejects(()=>createProductionIncident(db,sx,body(),{...workflow,reports:[{transitId:order.id,stageCode:'CUT',reportedQuantity:100}]}));
 const admin={isAdmin:true,permissionLogin:'vthduyen'},r=await createProductionIncident(db,admin,body(),workflow);
 assert.equal((await changeRequests(db,admin)).records[0].canConfirmIncident,true);
 await updateProductionIncident(db,admin,{action:'incident-confirm',id:r.record.id,revision:1});
 assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,0);
}));
test('scoped stage pause survives reload and never stops other stages',()=>{
 const state={'["order-a","PACKING"]':{orderId:'order-a',stage:'PACKING',status:'running',people:['p1']}};
 const projected=projectIncidentStages(state,[{kind:'stage-incident',sourceId:'order-a',stages:['CUT','ASSY'],effectiveAt:'2026-10-23T01:00:00Z',incidentId:'ticket'}],[order]);
 assert.equal(projected['["order-a","CUT"]'].status,'paused');assert.equal(projected['["order-a","ASSY 1"]'].status,'paused');assert.deepEqual(projected['["order-a","PACKING"]'],state['["order-a","PACKING"]']);
});
test('replacement orders enforce same Line and opened status, persist instructions, optional selection',()=>withDb(async db=>{
 const {incidentReplacementOrders}=await import('../worker/production-incidents.mjs');
 const put=async(id,payload)=>db.prepare("INSERT INTO app_records VALUES('in_transit',?,?,?,?)").bind(id,JSON.stringify({id,sku:'TEST',name:'Sản phẩm thử',spec:'Quy cách thử',lsxQty:100,...payload}),'test',new Date().toISOString()).run();
 await put('order-a',{line:'A',lsxCode:'LSX-A'});await put('other-a',{line:'A',lsxCode:'LSX-A2'});await put('other-b',{line:'B',lsxCode:'LSX-B'});await put('unopened',{line:'A'});await put('cancelled',{line:'A',lsxCode:'LSX-C',cancelReason:'Hủy'});
 const {record}=await createProductionIncident(db,sx,body(),workflow);const id=record.id;
 await updateProductionIncident(db,ql('cnphuong'),{action:'incident-confirm',id,revision:1});
 const kh=ql('htndiem');assert.deepEqual((await incidentReplacementOrders(db,kh,id)).orders.map(o=>o.id),['other-a']);
 for(const actor of [ql('cnphuong'),ql('ltphong'),sx])await assert.rejects(()=>incidentReplacementOrders(db,actor,id),{status:403});
 assert.equal((await incidentReplacementOrders(db,{isAdmin:true},id)).orders.length,1);
 const reply={action:'incident-reply',id,revision:2,text:'',replaceOrders:true};
 for(const ids of [[],['other-b'],['unopened'],['cancelled'],['order-a'],['missing']])await assert.rejects(()=>updateProductionIncident(db,kh,{...reply,replacementOrderIds:ids}));
 const result=await updateProductionIncident(db,kh,{...reply,replacementOrderIds:['other-a']});assert.equal(result.record.incident.replacementOrders[0].lsxCode,'LSX-A2');assert.match(result.record.messages.at(-1).text,/LSX-A2/);
 const original=JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key='other-a'").first()).payload);assert.equal(original.productionState,undefined);
 const second=await createProductionIncident(db,sx,body(),workflow);await updateProductionIncident(db,ql('cnphuong'),{action:'incident-confirm',id:second.record.id,revision:1});
 const free=await updateProductionIncident(db,kh,{...reply,id:second.record.id,replaceOrders:false,replacementOrderIds:['other-b'],text:'Tiếp tục các lệnh không ảnh hưởng'});assert.deepEqual(free.record.incident.replacementOrders,[]);assert.equal(free.record.incident.resolution,'Tiếp tục các lệnh không ảnh hưởng');
}));

test('KHSX may submit empty instructions while preserving reply metadata and notifications',()=>withDb(async db=>{
 for(const text of ['', '   ', undefined]){
  const {record}=await createProductionIncident(db,sx,body(),workflow);
  await updateProductionIncident(db,ql('cnphuong'),{action:'incident-confirm',id:record.id,revision:1});
  await assert.rejects(()=>updateProductionIncident(db,ql('htndiem'),{action:'incident-reply',id:record.id,revision:2,text:'x'.repeat(12001)}),{status:422});
  await changeRequests(db,ql('htndiem'),{action:'incident-reply',id:record.id,revision:2,text});
  const result=(await changeRequests(db,ql('cnphuong'))).records.find(r=>r.id===record.id);
  assert.equal(result.incident.resolution,'');assert.equal(result.incident.status,'handling');assert.equal(result.unreadReplyCount,1);
  assert.equal(result.messages.at(-1).login,'htndiem');assert.ok(result.messages.at(-1).at);assert.equal(result.messages.at(-1).action,'incident-reply');
 }
}));
