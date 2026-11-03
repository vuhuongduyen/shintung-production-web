import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {productionHistoryImport} from '../scripts/local/production-history-import.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {sheetNumber,sheetDay} from '../lib/production-sheet-source.mjs';
import {productionEntryActorId} from '../lib/production-actor.mjs';
const actor={login:'TEST-ADMIN',isAdmin:true};
const refs=['https://docs.google.com/spreadsheets/d/sx-source','https://docs.google.com/spreadsheets/d/transit-source'];
test('verified original reporter takes precedence over a legacy importer account',()=>{assert.equal(productionEntryActorId({sourceVerified:true,sourceActor:'line@test.invalid',actorId:'old-admin',reportedById:'line@test.invalid'}),'line@test.invalid');assert.equal(productionEntryActorId({actorId:'old-admin'}),'old-admin');});
test('source reporters and operations display verified web users without changing source email',()=>{
 for(const [email,login]of [['linea.shintungvn@gmail.com','LINE_A'],['khaosat.shintung@gmail.com','LINE_B'],['ngocphuong020479@gmail.com','cnphuong'],['phung8681bt@gmail.com','ntnphung'],['huongduyenxy@gmail.com','vthduyen']]){const report={sourceVerified:true,sourceActor:email,actorId:'old-importer'};assert.equal(productionEntryActorId(report),login);assert.equal(productionEntryActorId({sourceTimeLog:true,actorId:email}),login);assert.equal(report.sourceActor,email);}
 assert.equal(productionEntryActorId({actorId:'new.email@test.invalid'},[{id:'uuid',login:'web-user',email:'new.email@test.invalid'}]),'web-user');
 assert.equal(productionEntryActorId({actorId:'unknown@test.invalid'}),'unknown@test.invalid');
});
function input(){const order=['PLAN','SKU','Sản phẩm','Quy cách','A',0,46309,46310,'Nhóm','Phát sinh đột xuất','Thường',1,'LSX',1000,1000,46309,'ĐÃ MỞ LSX',1,'',1000,46309,46309];
 const report=['15/10/2026 16:26:54','e8d5a4dc-0bab-4799-9c31-d055b0f46676','PLAN','LSX','SKU','Sản phẩm','Quy cách','A','15/10/2026','15/10/2026','1.000,00','line@test.invalid','Phụ kho',10,'0,0000','30,0000','37,0000','5,3333','53,3330','23,3330','','','TẠM TÍNH','KHO ĐÃ XÁC NHẬN','1.000,00'];report[33]='KHÔNG';report[36]='0,00';
 const times=[['15/10/2026 13:20:26','TIME-original-start-0001','PLAN','LSX','SKU','A','BẮT ĐẦU','15/10/2026 13:20:26','0,00','TỰ ĐỘNG','line@test.invalid'],['15/10/2026 16:26:55','TIME-original-report-0002','PLAN','LSX','SKU','A','BÁO CÔNG','15/10/2026 16:26:00','37,00','TỰ ĐỘNG','line@test.invalid'],['15/10/2026 16:26:56','TIME-original-finish-0003','PLAN','LSX','SKU','A','HOÀN THÀNH','15/10/2026 16:26:00','37,00','TỰ ĐỘNG','line@test.invalid']];
 return {confirmSourceReports:true,reconcileSource:{references:refs,sxRows:[report],timeRows:times,transitRows:[order]}};}
async function fixture(){const c=await openDatabase(mkdtempSync(join(tmpdir(),'onspa-sheet-reconcile-')));await migrate(c.db);return c;}
test('source precision, direct hours, all operations, confirmation, audit, retries and Line scope',async()=>{
 const c=await fixture();try{const text=JSON.stringify(input()),before=(await c.db.prepare('SELECT * FROM app_records').all()).results;const preview=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);assert.deepEqual((await c.db.prepare('SELECT * FROM app_records').all()).results,before);assert.equal(preview.batch.reports[0].hours.total,23.333);assert.equal(preview.batch.reports[0].sourceBasicLaborHours,53.333);assert.equal(preview.batch.reports[0].reviewStatus,'Đã xác nhận');assert.equal(preview.batch.reports[0].completedAt,'2026-10-15T16:26:00+07:00');
 await assert.rejects(()=>productionHistoryImport(c.db,{action:'save',text,revision:'stale'},actor,[]),{status:409});
 const saved=await productionHistoryImport(c.db,{action:'save',text,revision:preview.revision},actor,[]);assert.equal(saved.batch.summary.reports,1);assert.equal((await productionHistoryImport(c.db,{action:'save',text},actor,[])).replayed,true);
 const state=await readProductionWorkflow(c.db,actor,[]);assert.equal(state.reports.length,1);assert.equal(state.reports[0].hours.total,23.333);assert.deepEqual(state.reports[0].hours.perEmployee,[]);assert.equal(state.events.filter(e=>e.sourceTimeLog).length,3);assert.equal(state.orders[0].completedQty,1000);assert.equal(state.orders[0].actualCompletedAt,'2026-10-15');assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='admin_audit'").first()).n,1);assert.equal((await readProductionWorkflow(c.db,{...actor,line:'B'},[])).reports.length,0);
 await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text},{...actor,isAdmin:false},[]),{status:403});
 }finally{await c.close();}
});
test('existing confirmed report is corrected in place, warehouse untouched, before/after retained',async()=>{
 const c=await fixture();try{const d=input(),o={id:'old-order',planId:'PLAN',sku:'SKU',lsxCode:'LSX',line:'A',lsxQty:1000,planStart:'2026-10-15',planEnd:'2026-10-16',lsxOpenedAt:'2026-10-15',week:'2026-10-12',syncStatus:'ĐÃ ĐỒNG BỘ'},r={id:'old-report',kind:'completion',historicalImport:true,transitId:'old-order',planId:'PLAN',sku:'SKU',lsxCode:'LSX',line:'A',reportedQuantity:1000,approvedQuantity:1000,completedAt:'2026-10-16T09:00:00+07:00',reviewStatus:'Đã xác nhận',hours:{hc:50,ot:0,total:50},version:3};
 for(const [entity,key,payload]of [['in_transit',o.id,o],['production_report',r.id,r],['warehouse_in','SX:old-report',{receivedQuantity:1000,status:'Đã xác nhận'}]])await c.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'fixture','fixture').run();
 const warehouse=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in'").first()).payload,text=JSON.stringify(d),p=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);assert.equal(p.batch.summary.newReports,0);await productionHistoryImport(c.db,{action:'save',text,revision:p.revision},actor,[]);const out=(await readProductionWorkflow(c.db,actor,[])).reports[0];assert.equal(out.id,'old-report');assert.equal(out.version,4);assert.equal(out.hours.total,23.333);assert.equal(out.productionDate,'2026-10-15');assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in'").first()).payload,warehouse);const audit=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").first()).payload);assert.equal(audit.before.hours.total,50);assert.equal(audit.after.hours.total,23.333);
 }finally{await c.close();}
});
test('missing source hours stay unknown and mismatching plans/overproduction fail without writes',async()=>{
 const c=await fixture();try{const d=input();d.reconcileSource.sxRows[0][19]='';const p=await productionHistoryImport(c.db,{action:'preview',text:JSON.stringify(d)},actor,[]);assert.equal(p.batch.reports[0].hours.total,null);assert.equal(p.batch.summary.sourceHoursMissing,1);assert.equal(p.batch.warnings.length,1);
 for(const mutate of [d=>d.reconcileSource.transitRows[0][1]='WRONG',d=>d.reconcileSource.transitRows[0][14]=1,d=>d.reconcileSource.timeRows[0][4]='WRONG']){const bad=input();mutate(bad);await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify(bad)},actor,[]));}assert.equal((await c.db.prepare('SELECT count(*) n FROM app_records').first()).n,0);
 }finally{await c.close();}
});
test('Vietnam source numbers and unformatted Sheets dates preserve units',()=>{assert.equal(sheetNumber('1.000,00'),1000);assert.equal(sheetNumber('138,7503'),138.7503);assert.equal(sheetNumber(1000),1000);assert.equal(sheetDay(46310),'2026-10-15');assert.equal(sheetDay('25/008/2026'),'2026-08-25');assert.equal(sheetDay('03/09/2026 08:00 :08'),'2026-09-03');assert.equal(sheetDay('31/02/2026'),'');});
test('archived Plan IDs stay archived; multiple LSX are resolved by the exact source LSX',async()=>{
 const c=await fixture();try{for(const [id,extra]of [['deleted-one',{_deleted:true}],['deleted-two',{_deleted:true}],['active-other',{lsxCode:'OTHER'}],['active-exact',{}]])await c.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind('in_transit',id,JSON.stringify({id,planId:'PLAN',sku:'SKU',line:'A',lsxCode:'LSX',lsxQty:1000,...extra}),'fixture','fixture').run();
 const before=(await c.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='in_transit' ORDER BY record_key").all()).results,text=JSON.stringify(input()),p=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);assert.equal(p.batch.reports[0].transitId,'active-exact');await productionHistoryImport(c.db,{action:'save',text,revision:p.revision},actor,[]);for(const old of before.filter(r=>r.record_key!=='active-exact'))assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(old.record_key).first()).payload,old.payload);
 }finally{await c.close();}
});

test('pending source import keeps exact hours and operations without approval or warehouse writes',async()=>{
 const c=await fixture();try{
  const d=input();d.confirmSourceReports=false;d.reconcileSource.sxRows[0][23]='CHỜ KHO XÁC NHẬN';
  d.reconcileSource.sxRowNumbers=[237];
  const text=JSON.stringify(d),p=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);
  assert.equal(p.batch.pendingReview,true);assert.equal(p.batch.reports[0].reviewStatus,'Chờ kiểm tra');
  await productionHistoryImport(c.db,{action:'save',text,revision:p.revision},actor,[]);
  const state=await readProductionWorkflow(c.db,actor,[]),r=state.reports[0];
  assert.equal(r.approvedQuantity,0);assert.equal(r.reviewedAt,null);assert.equal(r.reviewedById,null);assert.equal(r.confirmationBasis,null);
  assert.equal(r.hours.total,23.333);assert.equal(r.sourceCount,10);assert.match(r.sourceReference,/A237:AL237/);
  assert.equal(state.events.filter(e=>e.sourceTimeLog).length,3);assert.equal(state.orders[0].completedQty,0);
  assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
  assert.equal((await productionHistoryImport(c.db,{action:'save',text},actor,[])).replayed,true);
  const bad=structuredClone(d);bad.reconcileSource.transitRows[0][14]=999;
  await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify(bad)},actor,[]));
 }finally{await c.close();}
});
test('pending mode cannot overwrite a report already confirmed',async()=>{
 const c=await fixture();try{
  const d=input(),text=JSON.stringify(d),p=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);
  await productionHistoryImport(c.db,{action:'save',text,revision:p.revision},actor,[]);
  const before=(await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
  d.confirmSourceReports=false;
  await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify(d)},actor,[]),{status:409});
  assert.deepEqual((await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results,before);
 }finally{await c.close();}
});

test('progress includes unopened and unsynced In Transit while work orders stay restricted by readiness and Line',async()=>{
 const c=await fixture();try{
  for(const [id,line,lsxCode,syncStatus]of [['open','A','LSX-OPEN','ĐÃ ĐỒNG BỘ'],['planned','A','','CHƯA ĐỒNG BỘ'],['unsynced','A','LSX-UNSYNCED','CHƯA ĐỒNG BỘ'],['other-line','B','','CHƯA ĐỒNG BỘ']]){
   const payload={id,planId:id,sku:'SKU',line,lsxCode,syncStatus,planQty:100,lsxQty:lsxCode?100:null,week:'2026-10-19',planStart:'2026-10-19',planEnd:'2026-10-24',lsxOpenedAt:lsxCode?'2026-10-19':null};
   await c.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind('in_transit',id,JSON.stringify(payload),'fixture','fixture').run();
  }
  const all=await readProductionWorkflow(c.db,actor,[]);
  assert.deepEqual(all.progressOrders.map(r=>r.id).sort(),['open','other-line','planned','unsynced']);
  assert.deepEqual(all.orders.map(r=>r.id),['open']);
  const scoped=await readProductionWorkflow(c.db,{...actor,line:'A'},[]);
  assert.equal(scoped.progressOrders.length,3);assert.ok(scoped.progressOrders.every(r=>r.line==='A'));
 }finally{await c.close();}
});
