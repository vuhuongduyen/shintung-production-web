import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {productionHistoryImport} from '../scripts/local/production-history-import.mjs';
import {reconcileHistorySource} from '../lib/production-history-source.mjs';
const prior={id:'old',historicalImport:true,kind:'completion',transitId:'order',planId:'PLAN',sku:'SKU',line:'A',startedAt:'2026-10-12T08:00:00+07:00',completedAt:'2026-10-13T16:21:00+07:00',sourceCumulativeHours:31.67,sourceCount:12,reportedQuantity:2000,reviewStatus:'Lịch sử chờ đối chiếu',hours:{hc:1,ot:0,total:1,perEmployee:[]}};
const incoming={planId:'PLAN',sku:'SKU',line:'A',startedAt:'2026-10-13T16:21:00+07:00',completedAt:'2026-10-14T13:41:00+07:00',quantity:1000,count:10,cumulativeHours:37};
const actor={login:'TEST-ADMIN',isAdmin:true};
async function fixture(previous=prior){const c=await openDatabase(mkdtempSync(join(tmpdir(),'onspa-history-baseline-')));await migrate(c.db);const put=async(entity,key,value)=>c.db.prepare('INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'fixture','fixture').run();await put('in_transit','order',{id:'order',planId:'PLAN',sku:'SKU',line:'A',lsxCode:'LSX',lsxQty:5000,week:'2026-10-12',planStart:'2026-10-12',planEnd:'2026-10-16',syncStatus:'ĐÃ ĐỒNG BỘ',status:'Đang sản xuất'});if(previous)await put('production_history_import','prior',{reports:[previous]});return c;}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('verified source baseline is retained across save and reread without rewriting earlier confirmed hours',async()=>{
 const c=await fixture({...prior,sourceCumulativeHours:15.413,reviewStatus:'Đã xác nhận'});try{
  const sourceBaseline={cumulativeHours:31.67,completedAt:prior.completedAt,sourceReference:'SX_TIME_LOG!A591:L591',sourceEventId:'TIME-verified-original-0001'};
  const text=JSON.stringify([{...incoming,sourceBaseline}]);const preview=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);close(preview.batch.reports[0].hours.total,53.3);
  await productionHistoryImport(c.db,{action:'save',text,revision:preview.revision},actor,[]);
  const {readProductionWorkflow}=await import('../scripts/local/production-workflow.mjs');const state=await readProductionWorkflow(c.db,actor,[]);close(state.reports.find(r=>r.id!=='old').hours.total,53.3);assert.equal(state.reports.find(r=>r.id==='old').sourceCumulativeHours,15.413);
  for(const bad of [{...sourceBaseline,completedAt:incoming.completedAt},{...sourceBaseline,sourceReference:''},{...sourceBaseline,cumulativeHours:-1}])await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify([{...incoming,completedAt:'2026-10-15T13:41:00+07:00',sourceBaseline:bad}])},actor,[]));
 }finally{await c.close();}
});
test('cross-batch preview is read-only, preserves37, computes5.33×10 and save/retry stays idempotent',async()=>{
 const c=await fixture();try{const text=JSON.stringify([incoming]);const before=await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all();const preview=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);const r=preview.batch.reports[0];close(r.sourcePeriodHours,5.33);close(r.hours.total,53.3);assert.equal(r.sourceCumulativeHours,37);assert.equal(r.reportedQuantity,1000);assert.equal(r.sourceRow.cumulativeHours,37);assert.deepEqual((await c.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results,before.results);
 const saved=await productionHistoryImport(c.db,{action:'save',text,revision:preview.revision},actor,[]);close(saved.batch.reports[0].hours.total,53.3);
 const replay=await productionHistoryImport(c.db,{action:'save',text,revision:'stale'},actor,[]);assert.equal(replay.replayed,true);assert.deepEqual(replay.batch,JSON.parse(JSON.stringify(saved.batch)));
 await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify([{...incoming,note:'changed'}])},actor,[]),/đã có báo công cùng thời điểm/);
 }finally{await c.close();}
});
test('first report has zero baseline; an existing unstructured baseline fails rather than parsing notes',async()=>{
 for(const previous of [null,{...prior,sourceCumulativeHours:null,note:'cumulativeHours31.67'}]){const c=await fixture(previous);try{const run=()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify([incoming])},actor,[]);if(previous)await assert.rejects(run,/thiếu giờ lũy kế nguồn/);else close((await run()).batch.reports[0].hours.total,370);}finally{await c.close();}}
});
test('baseline respects timestamp ordering, excludes later/same-time/cancelled and other orders',()=>{
 const row={...prior,id:'new',sourceCumulativeHours:37,sourceCount:10,completedAt:'2026-10-14T06:41:00Z'};
 const irrelevant=[{...prior,completedAt:row.completedAt,sourceCumulativeHours:99},{...prior,completedAt:'2026-10-15T00:00:00Z',sourceCumulativeHours:99},{...prior,transitId:'other',sourceCumulativeHours:99},{...prior,cancelled:true,sourceCumulativeHours:99}];
 const [out]=reconcileHistorySource([row],[...irrelevant,prior]);close(out.sourcePeriodHours,5.33);assert.equal(out.sourceCumulativeHours,37);
 const rows=[row,{...prior,completedAt:'2026-10-13T09:21:00Z'}];close(reconcileHistorySource(rows)[0].hours.total,53.3);
});
test('decreasing cumulative and stale preview revisions are rejected without insertion',async()=>{
 const c=await fixture();try{await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify([{...incoming,cumulativeHours:30}])},actor,[]),/nhỏ hơn mốc/);await assert.rejects(()=>productionHistoryImport(c.db,{action:'save',text:JSON.stringify([incoming]),revision:'stale'},actor,[]),/vừa thay đổi/);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_history_import'").first()).n,1);}finally{await c.close();}
});
test('import preview explicitly reports unallocated source hours without rewriting source values',async()=>{
 const c=await fixture();try{const p=await productionHistoryImport(c.db,{action:'preview',text:JSON.stringify([incoming])},actor,[]);const r=p.batch.reports[0];assert.ok(p.batch.warnings.some(w=>w.includes('53.30')&&w.includes('chưa phân bổ')));assert.equal(r.sourceRow.cumulativeHours,37);close(r.unallocatedHours,53.3);close(r.hours.perEmployee.reduce((s,p)=>s+p.total,0),0);}finally{await c.close();}
});

test('source time log preserves every operation and timestamp without production events, reports, or duplicate retries',async()=>{
 const c=await fixture();try{
  const row={sourceEventId:'TIME-source-BAT_DAU-test-0001',planId:'PLAN',lsxCode:'LSX',sku:'SKU',line:'A',operation:'BẮT ĐẦU',effectiveAt:'2026-10-14T08:00:12+07:00',recordedAt:'2026-10-14T08:00:13+07:00',cumulativeHours:0,source:'TỰ ĐỘNG',actor:'source@test.invalid',note:''};
  const input={timeLog:[row,{...row,sourceEventId:'TIME-source-test-0002',operation:'TẠM NGƯNG',effectiveAt:'2026-10-14T10:00:12+07:00',recordedAt:'2026-10-14T10:00:13+07:00',cumulativeHours:2}]},text=JSON.stringify(input);
  const count=async entity=>(await c.db.prepare('SELECT count(*) n FROM app_records WHERE entity=?').bind(entity).first()).n;
  const before=await count('production_history_import'),preview=await productionHistoryImport(c.db,{action:'preview',text},actor,[]);assert.equal(preview.batch.timeEvents.length,2);assert.equal(await count('production_history_import'),before);assert.equal(preview.batch.timeEvents[0].effectiveAt,'2026-10-14T01:00:12.000Z');assert.equal(preview.batch.timeEvents[0].recordedAt,'2026-10-14T01:00:13.000Z');assert.equal(preview.batch.timeEvents[1].sourceCumulativeHours,2);assert.equal(preview.batch.timeEvents[1].cumulativeLaborHours,null);
  await assert.rejects(()=>productionHistoryImport(c.db,{action:'save',text,revision:'stale'},actor,[]),{status:409});
  const saved=await productionHistoryImport(c.db,{action:'save',text,revision:preview.revision},actor,[]);assert.equal(saved.saved,true);assert.equal(await count('production_event'),0);assert.equal(await count('production_report'),0);
  assert.equal((await productionHistoryImport(c.db,{action:'save',text,revision:'old'},actor,[])).replayed,true);assert.equal(await count('production_history_import'),before+1);
  const changed=JSON.stringify({timeLog:[{...row,note:'Changed original'}]});await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:changed},actor,[]),{status:409});
  await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify({timeLog:[{...row,sourceEventId:'TIME-source-test-0003',sku:'WRONG'}]})},actor,[]),/LSX\/SKU\/Line/);
  await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text},{...actor,isAdmin:false},[]),{status:403});
  const {readProductionWorkflow}=await import('../scripts/local/production-workflow.mjs');const state=await readProductionWorkflow(c.db,actor,[]);assert.equal(state.events.filter(e=>e.sourceTimeLog).length,2);assert.equal(state.reports.length,1);const other=await readProductionWorkflow(c.db,{...actor,line:'B'},[]);assert.equal(other.events.filter(e=>e.sourceTimeLog).length,0);assert.ok(state.events.filter(e=>e.sourceTimeLog).every(e=>e.historicalImport&&e.kind==='source-time'));
 }finally{await c.close();}
});

test('missing order can be linked to a validated source snapshot without creating or changing In Transit',async()=>{
 const c=await fixture();try{
  const catalog=[{code:'SKU',name:'Bộ tưới kiểm thử',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'}];
  const sourceOrder={planId:'SOURCE-PLAN',lsxCode:'SOURCE-LSX',sku:'SKU',line:'A',lsxQty:2,week:'2026-10-12',planStart:'2026-10-15',planEnd:'2026-10-16',name:'Bộ tưới kiểm thử',spec:'15m',sourceReference:'SX_KE_HOACH!A231:AJ231'};
  const input={...incoming,planId:'SOURCE-PLAN',lsxCode:'SOURCE-LSX',startedAt:'2026-10-15T13:20:26+07:00',completedAt:'2026-10-15T16:26:00+07:00',quantity:2,count:1,cumulativeHours:3.1,sourceOrder};
  const text=JSON.stringify([input]),before=(await c.db.prepare("SELECT * FROM app_records WHERE entity='in_transit'").all()).results;
  const preview=await productionHistoryImport(c.db,{action:'preview',text},actor,catalog);assert.equal(preview.batch.reports[0].orderSnapshot.historicalOnly,true);assert.equal(preview.batch.reports[0].orderSnapshot.sourceReference,sourceOrder.sourceReference);
  await productionHistoryImport(c.db,{action:'save',text,revision:preview.revision},actor,catalog);assert.deepEqual((await c.db.prepare("SELECT * FROM app_records WHERE entity='in_transit'").all()).results,before);
  const {readProductionWorkflow}=await import('../scripts/local/production-workflow.mjs');const state=await readProductionWorkflow(c.db,actor,catalog);assert.equal(state.reports.find(r=>r.planId==='SOURCE-PLAN').reportedQuantity,2);assert.ok(state.orders.some(o=>o.planId==='SOURCE-PLAN'&&o.historicalOnly));
  await assert.rejects(()=>productionHistoryImport(c.db,{action:'preview',text:JSON.stringify([{...input,planId:'BAD',sourceOrder:{...sourceOrder,planId:'BAD',sku:'WRONG'}}])},actor,catalog));
 }finally{await c.close();}
});
