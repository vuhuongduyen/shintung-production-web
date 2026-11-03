import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {correctProduction} from '../scripts/local/production-corrections.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {correctionStaffing} from '../lib/production-correction-staffing.mjs';
import {correctionStageEvents} from '../lib/production-correction-orders.mjs';
const actor={login:'ADMIN',isAdmin:true},at=h=>`2026-09-25T${h}:00+07:00`;
async function fixture(){const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-correction-')));await migrate(c.db);const put=(e,k,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-20').run();
const days=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:i<5,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],cleaning:[]}));
await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:days}}]});
for(const id of ['N1','N2'])await put('employees',id,{id,name:id,line:'A',active:true});
await put('in_transit','O',{id:'O',planId:'O',lsxCode:'O',sku:'O',line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
return {...c,put,catalog:[{code:'O',processes:['CUT','FINAL']}]};}
const command=(e,count,employees)=>({stageWorkCorrection:true,action:'preview',orderId:'O',reason:'Sửa số nhân lực nhập nhầm',operations:[{eventId:e.id,version:e.version||0,operation:'adjust',changes:{effectiveAt:e.effectiveAt,count,employees}}]});
test('ERP manpower correction recalculates named stage hours only, preserves approval and audit, rejects stale and mismatch',async()=>{const c=await fixture();try{
for(const stage of ['CUT','FINAL']){const id='R'+stage,r={id,kind:'completion',erpStageImport:true,historicalImport:true,sourceVerified:true,transitId:'O',line:'A',stageName:'A-'+stage,startedAt:at('08:00'),actualStartedAt:at('08:00'),completedAt:at('10:00'),employees:['N1'],employeeDetails:[{id:'N1',name:'N1'}],count:1,sourceCount:1,stageQuantity:100,reportedQuantity:stage==='FINAL'?100:0,approvedQuantity:0,reviewStatus:'Chờ kiểm tra',hours:{hc:2,ot:0,total:2,perEmployee:[{id:'N1',hc:2,ot:0,total:2}]}};
await c.put('production_report',id,r);for(const [kind,h]of [['Nhập trạm','08:00'],['Xuất trạm','10:00']])await c.put('production_event',stage+kind,{id:stage+kind,kind:'source-time',sourceTimeLog:true,erpStageImport:true,sourceVerified:true,historicalImport:true,sourceId:'O',line:'A',stageName:'A-'+stage,sourceOperation:kind,effectiveAt:at(h),reportId:id});}
let state=await readProductionWorkflow(c.db,actor,c.catalog);const event=state.events.find(e=>e.id==='CUTNhập trạm'),body=command(event,2,['N1','N2']);
assert.equal(correctionStaffing(event,state.reports).count,1);
await c.put('employees','N3',{id:'N3',name:'Người Line C',line:'C',active:true});
await assert.rejects(()=>correctProduction(c.db,command(event,2,['N1','N3']),actor,c.catalog),/không thuộc lịch\/phân bổ hợp lệ/);
await assert.rejects(()=>correctProduction(c.db,command(event,2,['N1']),actor,c.catalog),/tích chọn đúng/);
await assert.rejects(()=>correctProduction(c.db,body,{login:'VIEW',grants:[]},c.catalog),/quyền/);
const p=await correctProduction(c.db,body,actor,c.catalog);assert.equal(p.reportImpacts.length,1);assert.equal(p.reportImpacts[0].after.hours.total,4);assert.equal(p.reportImpacts[0].after.hours.perEmployee.length,2);
await assert.rejects(()=>correctProduction(c.db,{...body,action:'apply',expectedRevision:'stale'},actor,c.catalog),{status:409});
await correctProduction(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,c.catalog);
state=await readProductionWorkflow(c.db,actor,c.catalog);const r=state.reports.find(r=>r.id==='RCUT');assert.equal(r.count,2);assert.equal(r.hours.total,4);assert.equal(r.reviewStatus,'Chờ kiểm tra');assert.equal(r.approvedQuantity,0);assert.equal(state.reports.find(r=>r.id==='RFINAL').hours.total,2);assert.ok(state.events.some(e=>e.kind==='report-correction'&&e.reportChanges[0].before.count===1&&e.reportChanges[0].after.count===2));
}finally{await c.close();}});
test('native stage manpower and time corrections recalculate segments and retain next staffing decision',async()=>{const c=await fixture();try{
const send=(action,h,entries)=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:entries,requestIdempotency:crypto.randomUUID()},actor,c.catalog);
await send('start','08:00',[{stage:'CUT',people:['N1']}]);await send('pause','09:00',[{stage:'CUT'}]);await send('resume','09:30',[{stage:'CUT'}]);await send('complete','10:00',[{stage:'CUT',quantity:100}]);
let s=await readProductionWorkflow(c.db,actor,c.catalog),start=s.events.find(e=>e.stageAction==='start');assert.equal(correctionStageEvents(s.events,'CUT').length,4);
const body=command(start,2,['N1','N2']);body.operations[0].changes.effectiveAt=at('08:30');const p=await correctProduction(c.db,body,actor,c.catalog);assert.equal(p.reportImpacts[0].after.hours.total,1.5);
await correctProduction(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,c.catalog);s=await readProductionWorkflow(c.db,actor,c.catalog);const r=s.reports[0];assert.equal(r.hours.total,1.5);assert.equal(r.hours.perEmployee.find(p=>p.id==='N2').total,.5);assert.equal(r.reviewStatus,'Chờ kiểm tra');
const next=s.events.find(e=>e.stageAction==='start');const invalid=command(next,2,['N1','N2']);invalid.operations[0].changes.effectiveAt=at('09:15');await assert.rejects(()=>correctProduction(c.db,invalid,actor,c.catalog),/đảo thứ tự/);
}finally{await c.close();}});

test('quantity correction splits confirmed output atomically without duplicating hours, and blocks warehouse/stale/overflow',async()=>{const c=await fixture();try{
 const send=(action,h,entries)=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:entries,requestIdempotency:crypto.randomUUID()},actor,c.catalog);
 await send('start','08:00',[{stage:'CUT',people:['N1'],quantity:100}]);await send('complete','10:00',[{stage:'CUT',quantity:100}]);
 let s=await readProductionWorkflow(c.db,actor,c.catalog),exit=s.events.find(e=>e.stageAction==='complete'),old=s.reports[0];
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify({...old,reviewStatus:'Đã xác nhận',approvedQuantity:0}),old.id).run();
 const body={stageWorkCorrection:true,action:'preview',orderId:'O',operations:[{eventId:exit.id,version:exit.version||0,operation:'adjust',changes:{effectiveAt:exit.effectiveAt,quantity:60}},{eventId:'new:split-test',operation:'insert',stageName:'CUT',stageAction:'complete',changes:{effectiveAt:at('09:00'),quantity:40}}]};
 const p=await correctProduction(c.db,body,actor,c.catalog);assert.equal(p.reportImpacts.length,2);assert.equal(p.reportImpacts.reduce((n,r)=>n+r.after.stageQuantity,0),100);assert.ok(Math.abs(p.reportImpacts.reduce((n,r)=>n+r.after.hours.total,0)-old.hours.total)<1e-8);assert.equal(p.reportImpacts.find(r=>r.reportId===old.id).after.reviewStatus,'Đã xác nhận');assert.equal(p.reportImpacts.find(r=>r.reportId!==old.id).after.reviewStatus,'Chờ kiểm tra');assert.equal((await readProductionWorkflow(c.db,actor,c.catalog)).reports.length,1);
 const overflow=structuredClone(body);overflow.operations[1].changes.quantity=41;await assert.rejects(()=>correctProduction(c.db,overflow,actor,c.catalog),/vượt/);
 await c.put('warehouse_in','SX:'+old.id,{id:'SX:'+old.id,reportId:old.id,status:'Đã xác nhận',receivedQuantity:100});await assert.rejects(()=>correctProduction(c.db,body,actor,c.catalog),/kho/);
 await c.db.prepare("DELETE FROM app_records WHERE entity='warehouse_in'").run();
 await assert.rejects(()=>correctProduction(c.db,{...body,action:'apply',expectedRevision:'bad'},actor,c.catalog),{status:409});
 await c.put('warehouse_in','SX:'+old.id,{id:'SX:'+old.id,reportId:old.id,status:'Chờ xác nhận',receivedQuantity:null});
 const checked=await correctProduction(c.db,body,actor,c.catalog);await correctProduction(c.db,{...body,action:'apply',expectedRevision:checked.expectedRevision},actor,c.catalog);
 const kept=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in' AND record_key=?").bind('SX:'+old.id).first()).payload);assert.equal(kept.status,'Chờ xác nhận');assert.equal(kept.sheetSync.status,'pending');assert.equal((await c.db.prepare("SELECT record_key FROM app_records WHERE entity='warehouse_in'").all()).results.length,1);
 s=await readProductionWorkflow(c.db,actor,c.catalog);assert.equal(s.reports.filter(r=>r.kind==='completion').length,2);assert.equal(s.reports.filter(r=>r.kind==='completion').reduce((n,r)=>n+r.stageQuantity,0),100);assert.ok(s.events.some(e=>e.kind==='report-correction'&&e.reportChanges.length===2));
 await assert.rejects(()=>correctProduction(c.db,{...body,action:'apply',expectedRevision:checked.expectedRevision},actor,c.catalog),{status:409});
}finally{await c.close();}});
test('quantity correction can add an admitted batch and second exit, validates personnel and admitted limit',async()=>{const c=await fixture();try{
 const send=(action,h,entries)=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:entries,requestIdempotency:crypto.randomUUID()},actor,c.catalog);
 await send('start','08:00',[{stage:'CUT',people:['N1'],quantity:100}]);await send('complete','10:00',[{stage:'CUT',quantity:100}]);let s=await readProductionWorkflow(c.db,actor,c.catalog),start=s.events.find(e=>e.stageAction==='start'),exit=s.events.find(e=>e.stageAction==='complete');
 const body={stageWorkCorrection:true,action:'preview',orderId:'O',operations:[{eventId:start.id,version:start.version||0,operation:'adjust',changes:{effectiveAt:start.effectiveAt,quantity:40}},{eventId:exit.id,version:exit.version||0,operation:'adjust',changes:{effectiveAt:at('09:00'),quantity:40}},{eventId:'new:batch-start',operation:'insert',stageName:'CUT',stageAction:'start',changes:{effectiveAt:at('09:15'),quantity:60,count:1,employees:['N2']}},{eventId:'new:batch-end',operation:'insert',stageName:'CUT',stageAction:'complete',changes:{effectiveAt:at('10:00'),quantity:60}}]};
 const p=await correctProduction(c.db,body,actor,c.catalog);assert.equal(p.reportImpacts.length,2);assert.equal(p.reportImpacts[1].after.hours.perEmployee.find(r=>r.id==='N2').total,.75);
 const bad=structuredClone(body);bad.operations[2].changes.quantity=61;await assert.rejects(()=>correctProduction(c.db,bad,actor,c.catalog),/vượt/);
 const staff=structuredClone(body);staff.operations[2].changes.employees=[];await assert.rejects(()=>correctProduction(c.db,staff,actor,c.catalog),/nhân viên/);
}finally{await c.close();}});

test('corrections allow cross-order overlap, preserve other assignments, split totals and exit staff persist',async()=>{const c=await fixture();try{
 const send=(action,h,entries)=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:entries,requestIdempotency:crypto.randomUUID()},actor,c.catalog);
 await send('start','08:00',[{stage:'CUT',people:['N1'],quantity:100}]);await send('complete','10:00',[{stage:'CUT',quantity:100}]);
 await c.put('in_transit','OTHER',{id:'OTHER',planId:'OTHER',lsxCode:'OTHER',sku:'O',line:'A',lsxQty:100,syncStatus:'ĐÃ ĐỒNG BỘ'});
 const other={id:'other-start',kind:'stage-work',stageReporting:true,stageAction:'start',sourceId:'OTHER',line:'A',stageName:'CUT',effectiveAt:at('08:00'),stageAfter:{status:'running',people:['N2'],startedAt:at('08:00'),admittedQuantity:100}};await c.put('production_event',other.id,other);
 let s=await readProductionWorkflow(c.db,actor,c.catalog),exit=s.events.find(e=>e.sourceId==='O'&&e.stageAction==='complete');
 const body={stageWorkCorrection:true,action:'preview',orderId:'O',operations:[{eventId:exit.id,version:exit.version||0,operation:'adjust',stageName:'CUT',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:exit.effectiveAt,quantity:60,count:1,employees:['N2']}},{eventId:'new:overlap-split',operation:'insert',stageName:'CUT',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:at('09:00'),quantity:40,count:1,employees:['N1']}}]};
 const p=await correctProduction(c.db,body,actor,c.catalog);assert.equal(p.requiresAssignmentResolution,undefined);assert.equal(p.reportImpacts.find(r=>r.reportId===exit.reportId).after.hours.perEmployee[0].id,'N2');
 const invalid=structuredClone(body);invalid.operations[0].changes.quantity=59;await assert.rejects(()=>correctProduction(c.db,invalid,actor,c.catalog),/Tổng các dòng tách/);
 await correctProduction(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,c.catalog);
 assert.deepEqual(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_event' AND record_key='other-start'").first()).payload),other);
 s=await readProductionWorkflow(c.db,actor,c.catalog);const r=s.reports.find(r=>r.id===exit.reportId);assert.deepEqual(r.correctionEmployees,['N2']);assert.equal(r.hours.perEmployee[0].id,'N2');
 const ownStart=s.events.find(e=>e.sourceId==='O'&&e.stageAction==='start');const timeOnly=command(ownStart,1,['N2']);const checked=await correctProduction(c.db,timeOnly,actor,c.catalog);assert.equal(checked.requiresAssignmentResolution,undefined);await correctProduction(c.db,{...timeOnly,action:'apply',expectedRevision:checked.expectedRevision},actor,c.catalog);
 const cancel={operation:'cancel-stage',orderId:'O',eventIds:[exit.id],action:'preview'};const cp=await correctProduction(c.db,cancel,actor,c.catalog);await correctProduction(c.db,{...cancel,action:'apply',expectedRevision:cp.expectedRevision},actor,c.catalog);
 assert.deepEqual(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_event' AND record_key='other-start'").first()).payload),other);
 }finally{await c.close();}});

test('approved FINAL split updates sent pending receipts in place, keeps totals, audits, queues sync and guards warehouse races',async()=>{const c=await fixture();try{
 const send=(action,h,stage,people=[],quantity=100)=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:[{stage,people,quantity}],requestIdempotency:crypto.randomUUID()},actor,c.catalog);
 await send('start','08:00','CUT',['N1']);await send('complete','09:00','CUT');await send('start','09:00','FINAL',['N1']);const out=await send('complete','11:00','FINAL');
 const old=out.reports[0],key='SX:'+old.id,approved={...old,reviewStatus:'Đã xác nhận',approvedQuantity:100,reviewedBy:'QLSX',reviewedAt:at('11:01')};
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify(approved),old.id).run();
 const receipt={id:key,source:'Sản xuất',reportId:old.id,sku:'O',lsxCode:'O',status:'Chờ xác nhận',proposedQuantity:100,receivedQuantity:null,sourceCompletedAt:old.completedAt,sheetSync:{status:'sent',exportedCompletedAt:old.completedAt}};await c.put('warehouse_in',key,receipt);
 const exit=out.event,body={stageWorkCorrection:true,action:'preview',orderId:'O',operations:[{eventId:exit.id,version:exit.version||0,operation:'adjust',stageName:'FINAL',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:exit.effectiveAt,quantity:60}},{eventId:'new:approved-final-split',operation:'insert',stageName:'FINAL',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:at('10:00'),quantity:40,count:1,employees:['N1']}}]};
 const p=await correctProduction(c.db,body,actor,c.catalog);assert.equal(p.requiresReconfirmation,false);assert.ok(p.reportImpacts.every(x=>x.after.reviewStatus==='Đã xác nhận'));
 const setReceipt=w=>c.db.prepare("UPDATE app_records SET payload=? WHERE entity='warehouse_in' AND record_key=?").bind(JSON.stringify(w),key).run();
 await setReceipt({...receipt,status:'Đã xác nhận',confirmedAt:at('11:02'),receivedQuantity:100});
 await assert.rejects(()=>correctProduction(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,c.catalog),{status:409});await assert.rejects(()=>correctProduction(c.db,body,actor,c.catalog),/kho đã xác nhận/);
 await setReceipt({...receipt,confirmationStatus:'Đã xác nhận',receivedQuantity:0});await assert.rejects(()=>correctProduction(c.db,body,actor,c.catalog),/kho đã xác nhận/);
 await setReceipt(receipt);const p2=await correctProduction(c.db,body,actor,c.catalog);await correctProduction(c.db,{...body,action:'apply',expectedRevision:p2.expectedRevision},actor,c.catalog);
 const ws=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in'").all()).results.map(x=>JSON.parse(x.payload));assert.equal(ws.length,2);assert.equal(ws.reduce((n,w)=>n+w.proposedQuantity,0),100);assert.equal(ws.find(w=>w.id===key).proposedQuantity,60);assert.ok(ws.find(w=>w.id===key).sheetSync.correctionRevision);assert.ok(ws.every(w=>w.status==='Chờ xác nhận'&&w.sheetSync.status==='pending'&&w.receivedQuantity===null));
 const transit=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key='O'").first()).payload);assert.equal(transit.completedQty,100);assert.equal(transit.actualCompletedAt,new Date(at('11:00')).toISOString());
 const state=await readProductionWorkflow(c.db,actor,c.catalog),audit=state.events.find(e=>e.kind==='report-correction');assert.ok(audit.reportChanges.every(x=>x.after.completedQty===100));assert.deepEqual(audit.warehouseChanges.find(x=>x.id===key).before,receipt);
 await assert.rejects(()=>correctProduction(c.db,{...body,action:'apply',expectedRevision:p2.expectedRevision},actor,c.catalog),{status:409});
 }finally{await c.close();}});

test('combined correction cancels obsolete resume and splits entry/output across days atomically',async()=>{const c=await fixture();try{
 const send=(action,h,people=[])=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:[{stage:'CUT',people,quantity:100}],requestIdempotency:crypto.randomUUID()},actor,c.catalog);
 await send('start','08:00',['N1']);const exit=await send('complete','10:00');const state=await readProductionWorkflow(c.db,actor,c.catalog),start=state.events.find(e=>e.stageAction==='start');
 const resume={id:'mistaken-resume',kind:'stage-work',stageReporting:true,stageName:'CUT',stageAction:'resume',sourceId:'O',line:'A',effectiveAt:at('09:59'),recordedAt:at('09:59'),stageBefore:{...start.stageAfter,status:'paused'},stageAfter:{...start.stageAfter,status:'running'}};await c.put('production_event',resume.id,resume);
 const yesterday=h=>`2026-09-24T${h}:00+07:00`;
 const body={stageWorkCorrection:true,action:'preview',orderId:'O',operations:[
 {eventId:start.id,operation:'adjust',version:start.version||0,stageName:'CUT',stageAction:'start',splitFrom:start.id,changes:{effectiveAt:yesterday('08:00'),quantity:40,count:1,employees:['N1']}},
 {eventId:'new:entry-day-two',operation:'insert',stageName:'CUT',stageAction:'start',splitFrom:start.id,changes:{effectiveAt:at('08:00'),quantity:60,count:2,employees:['N1','N2']}},
 {eventId:exit.event.id,operation:'adjust',version:exit.event.version||0,stageName:'CUT',stageAction:'complete',splitFrom:exit.event.id,changes:{effectiveAt:yesterday('10:00'),quantity:40}},
 {eventId:'new:exit-day-two',operation:'insert',stageName:'CUT',stageAction:'complete',splitFrom:exit.event.id,changes:{effectiveAt:at('10:00'),quantity:60}},
 {eventId:resume.id,operation:'cancel',version:0,stageName:'CUT',stageAction:'resume'}]};
 const all=async()=>(await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const before=await all(),p=await correctProduction(c.db,body,actor,c.catalog);assert.deepEqual(await all(),before);assert.equal(p.eventChanges.find(e=>e.eventId===resume.id).operation,'cancel');assert.equal(p.reportImpacts.reduce((n,r)=>n+r.after.stageQuantity,0),100);
 const bad=structuredClone(body);bad.operations=bad.operations.filter(o=>o.operation!=='cancel');await assert.rejects(()=>correctProduction(c.db,bad,actor,c.catalog),/Tiếp tục phải sau/);assert.deepEqual(await all(),before);
 await correctProduction(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,c.catalog);
 const row=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_event' AND record_key=?").bind(resume.id).first()).payload);assert.equal(row.voided,true);
 const after=await readProductionWorkflow(c.db,actor,c.catalog);assert.equal(after.reports.filter(r=>r.kind==='completion').reduce((n,r)=>n+r.stageQuantity,0),100);assert.ok(after.events.some(e=>e.kind==='report-correction'&&e.eventChanges.some(x=>x.operation==='cancel')));
 await assert.rejects(()=>correctProduction(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,c.catalog),{status:409});
 }finally{await c.close();}});

test('mixed ERP start and native continuation splits output without replacing historical source',async()=>{const c=await fixture();try{
 const send=(action,h,entries)=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:entries,requestIdempotency:crypto.randomUUID()},actor,c.catalog);
 await send('start','08:00',[{stage:'CUT',people:['N1'],quantity:100}]);await send('pause','09:00',[{stage:'CUT'}]);await send('resume','09:15',[{stage:'CUT'}]);await send('complete','11:00',[{stage:'CUT',quantity:100}]);
 let s=await readProductionWorkflow(c.db,actor,c.catalog),start=s.events.find(e=>e.stageAction==='start'),exit=s.events.find(e=>e.stageAction==='complete'),report=s.reports[0];
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_event' AND record_key=?").bind(JSON.stringify({...start,kind:'source-time',stageReporting:false,erpStageImport:true,historicalImport:true,sourceVerified:true,sourceTimeLog:true,sourceOperation:'Nhập trạm'}),start.id).run();
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify({...report,importedStageTimeline:[{...start,importedStageProjection:true}]}),report.id).run();
 for(const e of s.events.filter(e=>e.stageAction==='pause')){const value=structuredClone(e);delete value.stageBefore.startedAt;await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_event' AND record_key=?").bind(JSON.stringify(value),e.id).run();}
 const baseline={...structuredClone(start),id:'cutover-baseline',stageAction:'cutover',cutover:{source:'fixture'},stageBefore:{status:'waiting'},stageAfter:structuredClone(start.stageAfter)};await c.put('production_event',baseline.id,baseline);
 const body={stageWorkCorrection:true,action:'preview',orderId:'O',operations:[{eventId:exit.id,version:exit.version||0,operation:'adjust',stageName:'CUT',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:at('11:00'),quantity:60}},{eventId:'new:mixed-split',operation:'insert',stageName:'CUT',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:'2026-09-25T10:00:15+07:00',quantity:40}}]};
 const preview=await correctProduction(c.db,body,actor,c.catalog);assert.equal(preview.reportImpacts.reduce((n,r)=>n+r.after.stageQuantity,0),100);assert.ok(preview.reportImpacts.every(r=>r.after.importedStageTimeline.length===1));assert.ok(Math.abs(preview.reportImpacts.reduce((n,r)=>n+r.after.hours.total,0)-report.hours.total)<1e-8);
 await correctProduction(c.db,{...body,action:'apply',expectedRevision:preview.expectedRevision},actor,c.catalog);
 s=await readProductionWorkflow(c.db,actor,c.catalog);assert.equal(s.reports.reduce((n,r)=>n+r.stageQuantity,0),100);assert.ok(s.events.find(e=>e.id===start.id).sourceTimeLog);assert.ok(s.reports.some(r=>r.completedAt==='2026-09-25T03:00:15.000Z'));
}finally{await c.close();}});

test('cutover-only baseline can move to ERP entry time and split without an extra admission',async()=>{const c=await fixture();try{
 const send=(action,h,entries)=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(h),stageEntries:entries,requestIdempotency:crypto.randomUUID()},actor,c.catalog);
 await send('start','09:00',[{stage:'CUT',people:['N1'],quantity:100}]);await send('complete','11:00',[{stage:'CUT',quantity:100}]);const state=await readProductionWorkflow(c.db,actor,c.catalog),start=state.events.find(e=>e.stageAction==='start'),exit=state.events.find(e=>e.stageAction==='complete');
 const baseline={...start,stageAction:'cutover',cutover:{source:'fixture'},stageBefore:{status:'waiting'}};await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_event' AND record_key=?").bind(JSON.stringify(baseline),start.id).run();
 const body={stageWorkCorrection:true,action:'preview',orderId:'O',operations:[{eventId:start.id,version:start.version||0,operation:'adjust',stageName:'CUT',stageAction:'cutover',changes:{effectiveAt:at('08:30')}},{eventId:exit.id,version:exit.version||0,operation:'adjust',stageName:'CUT',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:at('11:00'),quantity:60}},{eventId:'new:cutover-output',operation:'insert',stageName:'CUT',stageAction:'complete',splitFrom:exit.id,changes:{effectiveAt:at('10:00'),quantity:40}}]};
 const p=await correctProduction(c.db,body,actor,c.catalog);assert.equal(p.reportImpacts.reduce((n,r)=>n+r.after.stageQuantity,0),100);assert.ok(p.reportImpacts.every(r=>r.after.actualStartedAt===new Date(at('08:30')).toISOString()));assert.equal(p.reportImpacts.reduce((n,r)=>n+r.after.hours.total,0),2.3333);await correctProduction(c.db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,c.catalog);
}finally{await c.close();}});
