import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {correctProduction} from '../scripts/local/production-corrections.mjs';
import {projectLiveStages} from '../lib/production-stage-live.mjs';
const admin={login:'TEST_ADMIN',isAdmin:true},catalog=[{code:'O',processes:['FINAL']}];
async function fixture(run){const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-cancel-')));try{const db=c.db;await migrate(db);const put=(entity,id,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(entity,id,JSON.stringify(p),'TEST','2026-09-20').run();
 await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:1,dailySchedule:Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[],cleaning:[]}))}}]});
 await put('employees','N',{id:'N',name:'TEST ONLY',line:'A',active:true});await put('in_transit','O',{id:'O',planId:'O',lsxCode:'O',sku:'O',line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const send=(action,time)=>mutateProductionWorkflow(db,{action,orderId:'O',effectiveAt:`2026-09-25T${time}:00+07:00`,stageEntries:[{stage:'FINAL',people:['N'],quantity:100}],requestIdempotency:crypto.randomUUID()},admin,catalog);
 const read=()=>readProductionWorkflow(db,admin,catalog),snapshot=async()=>(await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const cancel=(eventIds,extra={},actor=admin)=>correctProduction(db,{operation:'cancel-stage',action:'preview',orderId:'O',eventIds,reason:'TEST incorrect action',...extra},actor,catalog);
 const apply=async ids=>{const p=await cancel(ids);return cancel(ids,{action:'apply',expectedRevision:p.expectedRevision});};
 await run({db,put,send,read,snapshot,cancel,apply});
 }finally{await c.close();}}
test('cancel complete, resume, pause, start in reverse restores each state; preview read only and cancelled output is excluded',()=>fixture(async({send,read,snapshot,cancel,apply})=>{
 const start=await send('start','08:00'),pause=await send('pause','09:00'),resume=await send('resume','09:30'),complete=await send('complete','10:00');
 const before=await snapshot(),p=await cancel([complete.event.id]);assert.deepEqual(await snapshot(),before);assert.equal(p.reportImpacts.length,1);
 const state=async()=>{const w=await read();return projectLiveStages(w.orders,w.reports,w.events)['["O","FINAL"]'];};
 await apply([complete.event.id]);assert.equal((await state()).status,'running');const w=await read();assert.equal(w.reports.find(r=>r.id===complete.reports[0].id).cancelled,true);assert.equal(w.orders[0].completedQty,0);
 await apply([resume.event.id]);assert.equal((await state()).status,'paused');await apply([pause.event.id]);assert.equal((await state()).status,'running');await apply([start.event.id]);assert.equal((await state()).status,'waiting');assert.deepEqual((await state()).people,[]);
 await assert.rejects(()=>cancel([start.event.id]),/Chọn thao tác/);assert.equal((await read()).events.filter(e=>e.kind==='report-cancel').length,4);
}));
test('dependent suffix must be explicit; permission, line scope, reason, stale revision and warehouse queue guard',()=>fixture(async({db,put,send,read,cancel,apply})=>{
 const start=await send('start','08:00'),pause=await send('pause','09:00'),resume=await send('resume','09:30'),complete=await send('complete','10:00');
 await assert.rejects(()=>cancel([start.event.id]),/phía sau/);await assert.rejects(()=>cancel([complete.event.id],{}, {login:'VIEW',grants:[]}),/quyền/);await assert.rejects(()=>cancel([complete.event.id],{}, {...admin,line:'B'}),/Line/);assert.equal((await cancel([complete.event.id],{reason:''})).ok,true);
 const p=await cancel([complete.event.id]);await put('production_event','concurrent',{id:'concurrent',kind:'test',sourceId:'O'});await assert.rejects(()=>cancel([complete.event.id],{action:'apply',expectedRevision:p.expectedRevision}),/người khác sửa/);
 await put('warehouse_in','SX:'+complete.reports[0].id,{reportId:complete.reports[0].id,status:'Chờ xác nhận',sheetSync:{status:'pending'}});await assert.rejects(()=>cancel([complete.event.id]),/Phiếu kho/);
 await put('warehouse_in','SX:'+complete.reports[0].id,{reportId:complete.reports[0].id,status:'Đã xác nhận',receivedQuantity:100});await assert.rejects(()=>cancel([complete.event.id]),/Phiếu kho/);
 await put('warehouse_in','SX:'+complete.reports[0].id,{reportId:complete.reports[0].id,status:'Chờ xác nhận'});
 await apply([start.event.id,pause.event.id,resume.event.id,complete.event.id]);const w=await read();assert.equal(projectLiveStages(w.orders,w.reports,w.events)['["O","FINAL"]'].status,'waiting');const receipt=await db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in'").first();assert.equal(JSON.parse(receipt.payload).cancelled,true);
}));
test('cancelled completion can be reported correctly again without double hours/output',()=>fixture(async({send,read,apply})=>{
 await send('start','08:00');const wrong=await send('complete','09:00');await apply([wrong.event.id]);const corrected=await send('complete','10:00');assert.equal(corrected.reports[0].hours.total,2);const active=(await read()).reports.filter(r=>!r.cancelled&&r.kind==='completion');assert.equal(active.length,1);assert.equal(active[0].reportedQuantity,100);
}));
test('concurrent cancellations have one winner; incidents are protected; lightweight warning read preserves stage state',()=>fixture(async({db,put,send,read,cancel})=>{
 const start=await send('start','08:00');const full=await read(),light=await readProductionWorkflow(db,admin,catalog,{includeDerivedHours:false});assert.deepEqual(projectLiveStages(light.orders,light.reports,light.events),projectLiveStages(full.orders,full.reports,full.events));assert.deepEqual(light.approvedSchedules,full.approvedSchedules);assert.deepEqual(light.employees,full.employees);assert.deepEqual(light.rights,full.rights);
 await put('production_event','incident',{id:'incident',kind:'stage-incident',sourceId:'O',line:'A',stages:['FINAL'],effectiveAt:'2026-09-25T08:30:00+07:00'});await assert.rejects(()=>cancel([start.event.id]),/phía sau/);await put('production_event','incident',{id:'incident',kind:'stage-incident',sourceId:'O',line:'A',stages:['FINAL'],effectiveAt:'2026-09-25T08:30:00+07:00',voided:true});
 const p=await cancel([start.event.id]);const results=await Promise.allSettled([1,2].map(()=>cancel([start.event.id],{action:'apply',expectedRevision:p.expectedRevision})));assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='admin_audit'").first()).n,1);
}));
