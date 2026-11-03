import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {correctProduction} from '../scripts/local/production-corrections.mjs';
import {projectLiveStages} from '../lib/production-stage-live.mjs';
const actor={login:'TEST_ADMIN',isAdmin:true},catalog=[{code:'X',processes:['ASSY','FINAL']},{code:'Y',processes:['PACKING','FINAL']}];
const at=t=>`2026-09-25T${t}:00+07:00`;
async function fixture(run){const c=await openDatabase(mkdtempSync(join(tmpdir(),'exit-restore-')));try{const db=c.db;await migrate(db);const put=(entity,id,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(entity,id,JSON.stringify(p),'TEST','2026-09-20').run();
 const days=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'}],cleaning:[]}));
 await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'A',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:3,dailySchedule:days}}]});
 for(const id of ['N','M','P'])await put('employees',id,{id,name:'TEST '+id,line:'A',active:true});
 for(const id of ['X','Y'])await put('in_transit',id,{id,planId:id,lsxCode:id,sku:id,line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const send=(orderId,stage,action,time,people=[],extra={})=>mutateProductionWorkflow(db,{action,orderId,effectiveAt:at(time),stageEntries:[{stage,people,quantity:100}],requestIdempotency:crypto.randomUUID(),...extra},actor,catalog);
 await send('X','ASSY','start','08:00',['N','P']);await send('Y','PACKING','start','08:00',['M']);const exit=await send('X','ASSY','complete','09:00');await send('Y','PACKING','add','09:00',['N']);
 const read=()=>readProductionWorkflow(db,actor,catalog),snap=async()=>(await db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results;
 const cancel=(restore,extra={},who=actor)=>correctProduction(db,{operation:'cancel-stage',action:'preview',orderId:'X',eventIds:[exit.event.id],reason:'TEST wrong exit',restore,...extra},who,catalog);
 const apply=async restore=>{const p=await cancel(restore);await cancel(restore,{action:'apply',expectedRevision:p.expectedRevision});return p;};
 await run({db,put,send,read,snap,cancel,apply,exit});
 }finally{await c.close();}}
test('continuous restores selected worker, preserves other allocations, atomic read-only preview and break-adjusted hours',()=>fixture(async({send,read,snap,cancel,apply})=>{
 const restore={mode:'continuous',employees:['N']},before=await snap(),p=await cancel(restore);assert.deepEqual(await snap(),before);assert.ok(p.allocationImpacts.every(i=>i.orderId==='X'));
 await apply(restore);const w=await read(),s=projectLiveStages(w.orders,w.reports,w.events);assert.deepEqual(s['["X","ASSY"]'].people,['N']);assert.deepEqual(s['["Y","PACKING"]'].people,['M','N']);assert.equal(w.reports.filter(r=>r.cancelled).length,1);
 const x=await send('X','ASSY','complete','11:00'),y=await send('Y','PACKING','complete','11:00');assert.equal(x.reports[0].hours.total,3.8333);assert.ok(Math.abs(y.reports[0].hours.total-4.6667)<.0001);assert.equal(x.reports[0].hours.perEmployee.find(p=>p.id==='P').total,1);
}));
test('return preserves real PACKING time and restores ASSY only at the chosen time',()=>fixture(async({send,read,apply})=>{
 await apply({mode:'return',employees:['N'],at:at('11:00')});const w=await read(),middle=projectLiveStages(w.orders,w.reports,w.events,Date.parse(at('10:30')));assert.deepEqual(middle['["X","ASSY"]'].people,[]);assert.ok(middle['["Y","PACKING"]'].people.includes('N'));
 const x=await send('X','ASSY','complete','12:00'),y=await send('Y','PACKING','complete','12:00');assert.equal(x.reports[0].hours.perEmployee.find(p=>p.id==='N').total,2);assert.equal(y.reports[0].hours.perEmployee.find(p=>p.id==='N').total,2.8333);
}));
test('preserves receiving reports and rejects invalid roster/time, permission and stale preview',()=>fixture(async({put,send,snap,cancel,apply,read})=>{
 const r={mode:'continuous',employees:['N']};await assert.rejects(()=>cancel({...r,employees:['UNKNOWN']}),/lịch/);await assert.rejects(()=>cancel({...r,mode:'return',at:at('08:00')}),/Giờ quay lại/);await assert.rejects(()=>cancel(r,{}, {login:'VIEW',grants:[]}),/quyền/);
 const p=await cancel(r);await put('employees','P',{id:'P',name:'Changed',line:'A',active:true});await assert.rejects(()=>cancel(r,{action:'apply',expectedRevision:p.expectedRevision}),/người khác sửa/);
 await send('Y','PACKING','complete','11:00');const before=await snap();const checked=await cancel(r);assert.deepEqual(await snap(),before);assert.equal(checked.reportImpacts.some(i=>i.before.transitId==='Y'),false);const old=(await read()).reports.filter(p=>p.transitId==='Y');await apply(r);assert.deepEqual((await read()).reports.filter(p=>p.transitId==='Y'),old);
}));
test('linked transfer on completion is corrected without deleting other workers; audit includes before/after and races are rejected',()=>fixture(async({db,read,cancel,exit,put})=>{
 // Model a completion-linked transfer using the same persisted snapshot format.
 const w=await read(),add=w.events.find(e=>e.sourceId==='Y'&&e.stageAction==='add');await put('production_event',add.id,{...add,stageAction:'transfer',recordedAt:exit.event.recordedAt});
 const r={mode:'continuous',employees:['N']},p=await cancel(r);const results=await Promise.allSettled([1,2].map(()=>cancel(r,{action:'apply',expectedRevision:p.expectedRevision})));assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 const changed=await read(),audit=changed.events.find(e=>e.kind==='report-cancel');assert.equal(audit.eventChanges.some(e=>e.before?.sourceId==='Y'),false);assert.equal(audit.restore.mode,'continuous');assert.equal(projectLiveStages(changed.orders,changed.reports,changed.events)['["Y","PACKING"]'].people.join(','),'M,N');
}));
test('blocks approved target but leaves unrelated incidents unchanged',()=>fixture(async({put,read,cancel,snap,exit})=>{
 const r={mode:'continuous',employees:['N']},w=await read(),report=w.reports.find(r=>r.id===exit.reports[0].id);await put('production_report',report.id,{...report,reviewStatus:'Đã xác nhận'});let before=await snap();await assert.rejects(()=>cancel(r),/đã xác nhận/);assert.deepEqual(await snap(),before);
 await put('production_report',report.id,report);await put('production_event','INC',{id:'INC',kind:'stage-incident',sourceId:'Y',line:'A',stages:['PACKING'],effectiveAt:at('09:30')});before=await snap();await cancel(r);assert.deepEqual(await snap(),before);
}));
test('previews multiple receiving orders together and protects foreign-line assignments',()=>fixture(async({put,read,cancel,snap})=>{
 await put('in_transit','Z',{id:'Z',planId:'Z',lsxCode:'Z',sku:'Y',line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});
 const event={id:'CHAIN',sourceId:'Z',line:'A',kind:'stage-work',stageReporting:true,stageAction:'start',stageName:'PACKING',effectiveAt:at('10:00'),recordedAt:at('10:00'),stageAfter:{orderId:'Z',stage:'PACKING',people:['N'],status:'running',at:at('10:00')}};await put('production_event','CHAIN',event);
 let before=await snap();const checked=await cancel({mode:'continuous',employees:['N']});assert.ok(checked.allocationImpacts.every(i=>i.orderId==='X'));assert.deepEqual(await snap(),before);
 await put('in_transit','Z',{id:'Z',planId:'Z',lsxCode:'Z',sku:'Y',line:'B',lsxQty:100,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});await put('production_event','CHAIN',{...event,line:'B'});
 before=await snap();await cancel({mode:'continuous',employees:['N']},{},{...actor,line:'A'});assert.deepEqual(await snap(),before);
}));
test('changing exit time allows overlap and preserves receiving assignments and reports',()=>fixture(async({db,exit,send,read,snap})=>{
 const body={stageWorkCorrection:true,action:'preview',orderId:'X',operations:[{eventId:exit.event.id,version:0,operation:'adjust',changes:{effectiveAt:at('10:00')}}]};
 const before=await snap(),p=await correctProduction(db,body,actor,catalog);assert.ok(!p.requiresAssignmentResolution);assert.deepEqual(await snap(),before);
 const other=(await read()).events.filter(e=>e.sourceId==='Y');
 await correctProduction(db,{...body,action:'apply',expectedRevision:p.expectedRevision},actor,catalog);
 const w=await read(),middle=projectLiveStages(w.orders,w.reports,w.events,Date.parse(at('09:30')));
 assert.ok(middle['["X","ASSY"]'].people.includes('N'));assert.deepEqual(middle['["Y","PACKING"]'].people,['M','N']);assert.deepEqual(w.events.filter(e=>e.sourceId==='Y'),other);
 const y=await send('Y','PACKING','complete','11:00');assert.ok(Math.abs(y.reports[0].hours.perEmployee.find(p=>p.id==='N').total-110/60)<.0001);
}));
