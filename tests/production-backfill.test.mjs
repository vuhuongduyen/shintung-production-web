import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {projectLiveStages} from '../lib/production-stage-live.mjs';
const actor={login:'TEST',isAdmin:true},at=t=>`2026-09-25T${t}:00+07:00`,key='["O","PHAO"]';
async function fixture(run){const c=await openDatabase(mkdtempSync(join(tmpdir(),'partial-exit-')));try{await migrate(c.db);const put=(entity,id,p)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(p),'TEST','2026-09-20').run();
const days=Array.from({length:7},(_,i)=>({date:`2026-09-${21+i}`,working:true,ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],cleaning:[]}));await put('capacity','2026-09-21',{schemaVersion:1,rows:[{line:'B',status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{workers:2,dailySchedule:days}}]});for(const id of ['A','B'])await put('employees',id,{id,name:`TEST ${id}`,line:'B',active:true});for(const id of ['O','OTHER'])await put('in_transit',id,{id,planId:id,lsxCode:id,sku:id,line:'B',lsxQty:2000,lsxOpenedAt:'2026-09-21',syncStatus:'ĐÃ ĐỒNG BỘ'});const catalog=['O','OTHER'].map(code=>({code,processes:['PHAO','FINAL']}));
const send=(action,t,entry={},extra={})=>mutateProductionWorkflow(c.db,{action,orderId:'O',effectiveAt:at(t),stageEntries:[{stage:'PHAO',...entry}],requestIdempotency:crypto.randomUUID(),...extra},actor,catalog);const read=()=>readProductionWorkflow(c.db,actor,catalog);const state=async()=>{const w=await read();return projectLiveStages(w.orders,w.reports,w.events)};await run({send,read,state,db:c.db,put,catalog});}finally{await c.close();}}

test('closed backfill previews without business writes, transfers only window and preserves current assignment',()=>fixture(async({send,read,state,db,catalog})=>{
 await send('start','08:00',{people:['A','B']},{orderId:'OTHER'});
 const requestIdempotency=crypto.randomUUID(),input={stage:'PHAO',from:'2026-09-25T14:00:00+07:00',to:'2026-09-26T08:30:00+07:00',people:['A'],quantity:1000};
 const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency,backfill:{...input,mode,...extra}},actor,catalog);
 const original=JSON.stringify(await read());const inspect=await call('inspect');assert.ok(inspect.candidates.find(p=>p.id==='A').eligible);
 const preview=await call('preview');assert.equal(JSON.stringify(await read()),original);assert.ok(Math.abs(preview.report.hours.total-3.3333)<0.0001,JSON.stringify(preview.report.hours));
 await assert.rejects(()=>call('apply',{expectedRevision:preview.expectedRevision}),/Chưa xác nhận/);
 await call('apply',{expectedRevision:preview.expectedRevision,resolveAssignments:true});
 const s=await state();assert.deepEqual(s['["OTHER","PHAO"]'].people,['A','B']);assert.deepEqual(s[key].people,[]);assert.equal(s[key].completed,1000);
 const w=await read(),during=projectLiveStages(w.orders,w.reports,w.events,Date.parse('2026-09-25T16:00:00+07:00'));
 assert.deepEqual(during['["OTHER","PHAO"]'].people,['B']);assert.deepEqual(during[key].people,['A']);
 assert.equal((await call('apply',{expectedRevision:preview.expectedRevision,resolveAssignments:true})).replayed,true);
 assert.equal((await read()).reports.length,1);
}));
test('stale preview is rejected and no report created',()=>fixture(async({db,catalog,put,read})=>{
 const input={stage:'PHAO',from:at('08:00'),to:at('09:00'),people:['A'],quantity:100};const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:crypto.randomUUID(),backfill:{...input,mode,...extra}},actor,catalog);
 const p=await call('preview');await put('employees','C',{id:'C',name:'TEST C',line:'B',active:true});await assert.rejects(()=>call('apply',{expectedRevision:p.expectedRevision}),/vừa thay đổi/);assert.equal((await read()).reports.length,0);
}));
test('add before entry and duplicate add cannot create event',()=>fixture(async({send,read})=>{
 await assert.rejects(()=>send('add','08:00',{people:['A']}),/Công đoạn/);assert.equal((await read()).events.length,0);
 await send('start','08:00',{people:['A']});const count=(await read()).events.length;await assert.rejects(()=>send('add','09:00',{people:['A']},{confirmed:true}),/đã ở/);assert.equal((await read()).events.length,count);
 await send('add','09:00',{people:['B']});assert.equal((await read()).events.length,count+1);
}));
test('backfill reduces pending donor hours, preserves unrelated crew and blocks locked donor report',()=>fixture(async({send,read,db,catalog})=>{
 await send('start','08:00',{people:['A','B']},{orderId:'OTHER'});const exited=await send('complete','12:00',{quantity:500},{orderId:'OTHER'});
 const input={stage:'PHAO',from:at('09:00'),to:at('11:00'),people:['A'],quantity:100};const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:crypto.randomUUID(),backfill:{...input,mode,...extra}},actor,catalog);
 const p=await call('preview');assert.equal(p.reportImpacts.length,1);assert.ok(p.reportImpacts[0].afterHours<p.reportImpacts[0].beforeHours);
 const r=exited.reports[0];await db.prepare("UPDATE app_records SET payload=? WHERE entity='production_report' AND record_key=?").bind(JSON.stringify({...r,reviewStatus:'Đã xác nhận'}),r.id).run();await assert.rejects(()=>call('preview'),/đã xác nhận/);assert.equal((await read()).reports.length,1);
}));
test('historical closed backfill does not steal current assignment on another stage',()=>fixture(async({send,read,db,catalog})=>{
 await send('start','08:00',{people:['A']},{orderId:'OTHER'});await send('complete','10:00',{quantity:2000},{orderId:'OTHER'});await send('start','11:00',{stage:'FINAL',people:['A']},{orderId:'OTHER'});
 const input={stage:'PHAO',from:at('08:30'),to:at('09:30'),people:['A'],quantity:100},id=crypto.randomUUID();const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:id,backfill:{...input,mode,...extra}},actor,catalog);
 const p=await call('preview');await call('apply',{expectedRevision:p.expectedRevision,resolveAssignments:true});const w=await read(),s=projectLiveStages(w.orders,w.reports,w.events);assert.deepEqual(s['["OTHER","FINAL"]'].people,['A']);
}));
test('open backfill starts current assignment and leaves no fabricated exit report',async t=>{t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-09-25T11:00:00+07:00')});await fixture(async({send,read,db,catalog})=>{
 await send('start','08:00',{people:['A']},{orderId:'OTHER'});const input={stage:'PHAO',from:at('09:00'),people:['A']},id=crypto.randomUUID();const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:id,backfill:{...input,mode,...extra}},actor,catalog);
 const p=await call('preview');await call('apply',{through:p.checkedThrough,expectedRevision:p.expectedRevision,resolveAssignments:true});const w=await read(),s=projectLiveStages(w.orders,w.reports,w.events);assert.deepEqual(s[key].people,['A']);assert.equal(s[key].status,'running');assert.deepEqual(s['["OTHER","PHAO"]'].people,[]);assert.equal(w.reports.length,0);
});});
test('backfill exposes remaining 1000 after earlier 1000 exit, rejects 1001 and accepts remaining',()=>fixture(async({send,db,catalog})=>{
 await send('start','08:00',{people:['A'],quantity:1000});await send('complete','09:00',{quantity:1000});
 const input={stage:'PHAO',from:at('10:00'),to:at('11:00'),people:['A']};const call=(mode,quantity)=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:crypto.randomUUID(),backfill:{...input,mode,quantity}},actor,catalog);
 assert.equal((await call('inspect')).remainingQuantity,1000);await assert.rejects(()=>call('preview',1001),/1 đến 1000/);assert.equal((await call('preview',1000)).report.stageQuantity,1000);
}));
test('Line work permission can backfill its own line, viewer and other Line cannot',()=>fixture(async({db,catalog,read})=>{
 const line={login:'TEST_LINE_B',line:'B',grants:['Quản lý sản xuất / Báo công sản xuất / Thêm']},input={stage:'PHAO',from:at('08:00'),to:at('09:00'),people:['A'],quantity:100},id=crypto.randomUUID();
 const call=(actor,mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:id,backfill:{...input,mode,...extra}},actor,catalog);
 assert.equal((await call(line,'inspect')).remainingQuantity,2000);
 assert.equal((await db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='_onspa_correction_compare'").first()).n,0);
 await assert.rejects(()=>call({...line,line:'A'},'inspect'),/không thuộc Line/);
 await assert.rejects(()=>call({...line,grants:['Quản lý sản xuất / Báo công sản xuất / Xem']},'inspect'),/quyền/);
 const p=await call(line,'preview');await call(line,'apply',{expectedRevision:p.expectedRevision});assert.equal((await read()).reports.length,1);
}));

test('legacy add after partial exit is repaired by one admission without duplicating allocation or earlier output',()=>fixture(async({send,read,state,db,catalog,put})=>{
 await send('start','08:00',{people:['A'],quantity:1000});await send('complete','09:00',{quantity:1000});const before=(await state())[key];
 const old={id:'OLD-ADD',kind:'stage-work',stageReporting:true,stageAction:'add',sourceId:'O',line:'B',stageName:'PHAO',effectiveAt:at('10:00'),recordedAt:at('10:00'),stageBefore:before,stageAfter:{...before,people:['A'],at:at('10:00')},employees:['A']};await put('production_event',old.id,old);
 const input={stage:'PHAO',from:at('10:00'),to:at('11:00'),people:['A'],quantity:1000},id=crypto.randomUUID();const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:id,backfill:{...input,mode,...extra}},actor,catalog);
 const inspect=await call('inspect');assert.equal(inspect.blockingMessage,'');assert.deepEqual(inspect.repairAllocation.people,['A']);assert.equal(inspect.remainingQuantity,1000);
 const preview=await call('preview');assert.equal(preview.allocationImpacts.length,0);assert.equal(preview.report.stageQuantity,1000);assert.equal(preview.report.hours.total,0.8333);
 await call('apply',{expectedRevision:preview.expectedRevision});const w=await read(),s=await state();assert.equal(w.reports.length,2);assert.equal(s[key].completed,2000);assert.deepEqual(s[key].people,[]);assert.equal(s[key].status,'done');
 assert.deepEqual(JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='production_event' AND record_key='OLD-ADD'").first()).payload),old);
 assert.equal(w.events.filter(e=>e.repairsAllocationEventId==='OLD-ADD').length,1);
}));
test('genuine admission remains blocked at inspection and preview; no orphan bypass',()=>fixture(async({send,db,catalog})=>{
 await send('start','08:00',{people:['A']});const input={stage:'PHAO',from:at('09:00'),to:at('11:00'),people:['A'],quantity:1000};const call=mode=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:crypto.randomUUID(),backfill:{...input,mode}},actor,catalog);
 const inspect=await call('inspect');assert.match(inspect.blockingMessage,/đã phân công TEST A/);assert.equal(inspect.repairAllocation,null);await assert.rejects(()=>call('preview'),/không tạo lần nhập trùng/);
}));
test('open repair establishes actual entry for old add and preserves original event',async t=>{t.mock.timers.enable({apis:['Date'],now:Date.parse(at('11:00'))});await fixture(async({db,catalog,put,state,read})=>{
 const before={orderId:'O',stage:'PHAO',people:[],completed:0,status:'waiting'},old={id:'ORPHAN',stageReporting:true,stageAction:'add',kind:'stage-work',sourceId:'O',stageName:'PHAO',line:'B',effectiveAt:at('09:00'),recordedAt:at('09:00'),stageBefore:before,stageAfter:{...before,people:['A'],at:at('09:00')}};await put('production_event',old.id,old);
 const input={stage:'PHAO',from:at('09:00'),people:['A']},id=crypto.randomUUID();const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:id,backfill:{...input,mode,...extra}},actor,catalog);const p=await call('preview');await call('apply',{expectedRevision:p.expectedRevision,through:p.checkedThrough});const s=(await state())[key];assert.equal(s.status,'running');assert.equal(s.admittedQuantity,2000);assert.deepEqual(s.people,['A']);assert.equal((await read()).reports.length,0);
 });});
test('quick save repairs duplicate orphan snapshots after exit and keeps later other-order assignment; no preview needed',()=>fixture(async({send,state,db,catalog,put,read})=>{
 await send('start','08:00',{people:['A'],quantity:1000});await send('complete','09:00',{quantity:1000});const before=(await state())[key],orphan={...before,people:['A'],at:at('10:00')};
 const old={id:'ORPHAN',kind:'stage-work',stageReporting:true,stageAction:'add',sourceId:'O',line:'B',stageName:'PHAO',effectiveAt:at('10:00'),recordedAt:at('10:00'),stageBefore:before,stageAfter:orphan,employees:['A']};await put('production_event','ORPHAN',old);
 await put('production_event','DUP',{...old,id:'DUP',effectiveAt:at('12:00'),recordedAt:at('12:00'),stageBefore:orphan,stageAfter:{...orphan,at:at('12:00')}});
 await send('start','13:00',{people:['A']},{orderId:'OTHER',confirmed:true});
 const id=crypto.randomUUID(),body={action:'start',orderId:'O',requestIdempotency:id,backfill:{mode:'save',stage:'PHAO',from:at('10:00'),to:at('11:00'),quantity:1000,people:['A'],confirmedAllocations:[]}};
 await mutateProductionWorkflow(db,body,actor,catalog);const w=await read(),s=await state();assert.equal(s[key].completed,2000);assert.equal(s[key].status,'done');assert.deepEqual(s[key].people,[]);assert.deepEqual(s['["OTHER","PHAO"]'].people,['A']);assert.equal(w.reports.length,2);assert.ok(w.events.find(e=>e.id==='DUP').backfillAllocationRepair);assert.ok(w.events.some(e=>e.kind==='report-correction'&&e.eventChanges?.some(c=>c.eventId==='DUP'&&c.before.stageAfter.people.includes('A'))));assert.equal((await mutateProductionWorkflow(db,body,actor,catalog)).replayed,true);
}));
test('quick save demands exact donor consent and rejects changed allocation without writes',()=>fixture(async({send,db,catalog,read})=>{
 await send('start','08:00',{people:['A']},{orderId:'OTHER'});const base={stage:'PHAO',from:at('09:00'),to:at('10:00'),people:['A'],quantity:1000};const call=(mode,extra={})=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:crypto.randomUUID(),backfill:{...base,mode,...extra}},actor,catalog);await assert.rejects(()=>call('save',{confirmedAllocations:[]}),/Phân công vừa thay đổi/);const i=await call('inspect'),confirmedAllocations=i.candidates.filter(p=>p.id==='A').flatMap(p=>p.assignments.map(a=>({...a,employeeId:p.id})));await assert.rejects(()=>call('save',{confirmedAllocations}),/Chưa xác nhận/);assert.equal((await read()).reports.length,0);await call('save',{confirmedAllocations,resolveAssignments:true});assert.equal((await read()).reports.length,1);
}));
test('orphan carry repair never erases a new employee assignment or genuine restart',async()=>{
 const {repairOrphanCarry}=await import('../lib/production-orphan-allocation.mjs');const before={people:['A'],completed:1000,status:'partial'},base={stageAction:'add',stageBefore:before,stageAfter:{...before}};
 assert.deepEqual(repairOrphanCarry(base,['A']).stageAfter.people,[]);
 assert.equal(repairOrphanCarry({...base,stageAfter:{...before,people:['A','B']}},['A']),null);
 assert.equal(repairOrphanCarry({...base,stageBefore:{...before,people:[]}},['A']),null);
 assert.equal(repairOrphanCarry({...base,stageAction:'resume',stageAfter:{...before,status:'running'}},['A']),null);
});
for(const finish of ['08:30','08:39','08:40'])test(`legacy B PHAO repair exits at ${finish} before/at 08:40 ASSY handoff without changing ASSY`,()=>fixture(async({send,state,db,catalog,put,read})=>{
 for(const item of catalog)item.processes=['PHAO','ASSY','FINAL'];
 await send('start','08:00',{people:['A'],quantity:1000});await send('complete','09:00',{quantity:1000});const before=(await state())[key];const from='2026-09-25T14:00:00+07:00',to=`2026-09-26T${finish}:00+07:00`,handoff='2026-09-26T08:40:00+07:00';
 await put('production_event','ORPHAN',{id:'ORPHAN',kind:'stage-work',stageReporting:true,stageAction:'add',sourceId:'O',line:'B',stageName:'PHAO',effectiveAt:'2026-09-25T13:59:00+07:00',recordedAt:at('13:59'),stageBefore:before,stageAfter:{...before,people:['A'],at:at('13:59')},employees:['A']});
 const orphanState=(await state())[key];await put('production_event','DUP-0839',{id:'DUP-0839',kind:'stage-work',stageReporting:true,stageAction:'add',sourceId:'O',line:'B',stageName:'PHAO',effectiveAt:'2026-09-26T08:39:00+07:00',recordedAt:'2026-09-26T08:39:00+07:00',stageBefore:orphanState,stageAfter:{...orphanState,at:'2026-09-26T08:39:00+07:00'},employees:['A']});
 await send('start','14:00',{stage:'ASSY',people:['B']});
 await mutateProductionWorkflow(db,{action:'add',orderId:'O',effectiveAt:handoff,stageEntries:[{stage:'ASSY',people:['A']}],confirmed:true,requestIdempotency:crypto.randomUUID()},actor,catalog);
 const w0=await read(),destination=w0.events.filter(e=>e.stageName==='ASSY');
 await mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:crypto.randomUUID(),backfill:{mode:'save',stage:'PHAO',from,to,people:['A'],quantity:1000,confirmedAllocations:[]}},actor,catalog);
 const w=await read(),s=await state();assert.equal(s[key].status,'done');assert.deepEqual(s[key].people,[]);assert.deepEqual(s['["O","ASSY"]'].people,['B','A']);assert.deepEqual(w.events.filter(e=>e.stageName==='ASSY'),destination);
 const r=w.reports.find(r=>r.backfillBatch);assert.equal(r.completedAt,new Date(to).toISOString());assert.equal(r.stageQuantity,1000);assert.ok(Math.abs(r.hours.total-(170+Number(finish.slice(3)))/60)<0.0001);
 const atExit=projectLiveStages(w.orders,w.reports,w.events,Date.parse(to));assert.deepEqual(atExit[key].people,[]);if(finish!=='08:40')assert.deepEqual(atExit['["O","ASSY"]'].people,['B']);
}));

for(const mode of ['apply','save'])test(`committed closed backfill replays after quantity activation without reopening station writes (${mode})`,()=>fixture(async({db,catalog})=>{
 const {activateQuantityCutover}=await import('../scripts/local/production-quantity-cutover.mjs'),{records}=await import('../scripts/local/database.mjs');
 for(const item of catalog)item.processes=['FINAL'];
 const requestIdempotency=crypto.randomUUID(),input={stage:'FINAL',from:at('08:00'),to:at('09:00'),people:['A'],quantity:200,resolveAssignments:true,confirmedAllocations:[]};
 const preview=await mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency,backfill:{...input,mode:'preview'}},actor,catalog),body={action:'start',orderId:'O',requestIdempotency,backfill:{...input,mode,expectedRevision:preview.expectedRevision}};
 const first=await mutateProductionWorkflow(db,body,actor,catalog);assert.equal(first.report.reportedQuantity,200);assert.equal((await mutateProductionWorkflow(db,body,actor,catalog)).replayed,true);
 await activateQuantityCutover(db,{snapshotId:'SYNTHETIC-CLOSED-BACKFILL-REPLAY'},actor,{sourceId:'a'.repeat(64)});const before=await records(db);
 const replay=await mutateProductionWorkflow(db,body,actor,catalog);assert.equal(replay.replayed,true);assert.equal(replay.event.id,first.event.id);assert.equal(replay.report.id,first.report.id);assert.equal(replay.report.reportedQuantity,200);assert.equal(replay.closed,true);assert.deepEqual(await records(db),before);
 await assert.rejects(()=>mutateProductionWorkflow(db,{action:'start',orderId:'O',requestIdempotency:crypto.randomUUID(),effectiveAt:at('10:00'),stageEntries:[{stage:'FINAL',people:['A']}]},actor,catalog),{status:409});
 await assert.rejects(()=>mutateProductionWorkflow(db,{...body,requestIdempotency:crypto.randomUUID(),backfill:{...body.backfill,to:undefined}},actor,catalog),{status:409});
 await assert.rejects(()=>mutateProductionWorkflow(db,{...body,backfill:{...body.backfill,quantity:201}},actor,catalog),{status:409});
 await assert.rejects(()=>mutateProductionWorkflow(db,body,{...actor,login:'SYNTHETIC-OTHER-ACTOR'},catalog),{status:409});assert.deepEqual(await records(db),before);
}));
