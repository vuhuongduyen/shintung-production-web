import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {mutateProductionWorkflow,readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {records} from '../scripts/local/database.mjs';
test('scoped daily save records 200 then 300 with historical rate snapshots and no full workflow/attendance read',()=>dailyFixture(async({db,body})=>{
 const before=await records(db);const observed=new Proxy(db,{get(target,key){if(key==='prepare')return sql=>{assert.doesNotMatch(sql,/entity\s*=\s*'(employees|capacity|production_schedule|production_allocation_queue)'/,'quantity-only command must not load or validate unrelated staffing');return target.prepare(sql);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const first=await mutateProductionWorkflow(observed,body(),actor),second=await mutateProductionWorkflow(observed,body({quantity:300,productionDate:'2026-11-03'}),actor);
 assert.equal(first.report.earnedStandardHours,20);assert.equal(second.report.earnedStandardHours,60);assert.equal(first.report.rateBasis.value,.1);assert.equal(first.report.reportedQuantity+second.report.reportedQuantity,500);
 for(const report of [first.report,second.report])for(const field of ['hours','stageName','employees','startedAt','completedAt'])assert.equal(field in report,false);
 const after=await records(db);for(const row of before.filter(r=>r.entity!=='production_cursor'))assert.deepEqual(after.find(r=>r.entity===row.entity&&r.record_key===row.record_key),row);
 const full=await readProductionWorkflow(db,{login:'SYNTHETIC-ADMIN',isAdmin:true});assert.equal(full.reports.length,2);assert.ok(full.reports.every(r=>r.quantityOnly&&!r.hours));
}));
test('lost-response replay uses same key once; changed content/actor or Line never reuses acknowledgement',()=>dailyFixture(async({db,body})=>{
 const input=body(),first=await mutateProductionWorkflow(db,input,actor),after=await records(db),retry=await mutateProductionWorkflow(db,input,actor);assert.equal(retry.replayed,true);assert.equal(retry.report.id,first.report.id);assert.deepEqual(await records(db),after);
 await assert.rejects(()=>mutateProductionWorkflow(db,{...input,quantity:300},actor),{status:409});await assert.rejects(()=>mutateProductionWorkflow(db,input,{...actor,login:'LINE_B',line:'B'}));assert.deepEqual(await records(db),after);
}));
test('concurrent quantities cannot exceed LSX and never partially insert a losing event/report',()=>dailyFixture(async({db,body})=>{
 const result=await Promise.allSettled([1,2].map(()=>mutateProductionWorkflow(db,body({quantity:600}),actor)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);assert.equal(result.filter(r=>r.status==='rejected').length,1);
 const all=await records(db),reports=all.filter(r=>r.entity==='production_report');assert.equal(reports.length,1);assert.equal(JSON.parse(reports[0].payload).reportedQuantity,600);assert.equal(all.filter(r=>r.entity==='production_event').length,1);
}));
for(const change of ['rate','policy','activation','manifest','order','history-phantom'])test(`CAS rejects concurrent ${change} change without a daily write`,()=>dailyFixture(async({db,put,order,body})=>{
 let injected=false;const wrapped=new Proxy(db,{get(target,key){if(key==='batch')return async statements=>{if(!injected){injected=true;if(change==='rate')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.effectiveVersions[0].value',8) WHERE entity='labor_hours'").run();if(change==='policy')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.approved',0) WHERE entity='production_reporting_policy'").run();if(change==='activation')await put('production_reporting_activation','global',{legacySnapshotId:'SYNTHETIC-CONCURRENT',effectiveFrom:'2026-11-01'});if(change==='manifest')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.concurrentProbe',1) WHERE entity='production_legacy_manifest'").run();if(change==='order')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.lsxQty',100) WHERE entity='in_transit' AND record_key=?").bind(order.id).run();if(change==='history-phantom')await put('production_history_import','SYNTHETIC-IMPORT',{reports:[{id:'OLD-REPORT',kind:'completion',transitId:order.id,reviewStatus:'Đã xác nhận',reportedQuantity:900,approvedQuantity:900}]});}return target.batch(statements);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 await assert.rejects(()=>mutateProductionWorkflow(wrapped,body(),actor),{status:409});const all=await records(db);assert.equal(all.filter(r=>r.entity==='production_report').length,0);assert.equal(all.filter(r=>r.entity==='production_event').length,0);assert.equal(JSON.parse(all.find(r=>r.entity==='production_cursor').payload).version,0);
}));
test('legacy/imported duplicates are deduplicated by report ID; another split LSX stays independent',()=>dailyFixture(async({db,put,order,body})=>{
 const old={id:'OLD',transitId:order.id,kind:'completion',reviewStatus:'Đã xác nhận',reportedQuantity:400,approvedQuantity:400,hours:{total:9}};await put('production_history_import','SYNTHETIC-OLD',{reports:[old,{...old,id:'OTHER-REPORT',transitId:'OTHER-LSX',approvedQuantity:900}]});await put('production_report','OLD',old);
 const input=body({quantity:500});await mutateProductionWorkflow(db,input,actor);await assert.rejects(()=>mutateProductionWorkflow(db,body({quantity:101}),actor),{status:409});assert.deepEqual(JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key='OLD'").first()).payload),old);
}));
test('missing rate still saves quantity, while absent activation/stale order/HR permission cannot write',()=>dailyFixture(async({db,body})=>{
 await db.prepare("DELETE FROM app_records WHERE entity='labor_hours'").run();const saved=await mutateProductionWorkflow(db,body(),actor);assert.equal(saved.report.rateStatus,'missing');assert.equal(saved.report.earnedStandardHours,null);
 await assert.rejects(()=>mutateProductionWorkflow(db,body(),{login:'SYNTHETIC-HR',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']}),{status:403});await assert.rejects(()=>mutateProductionWorkflow(db,body({expectedOrderRevision:'stale'}),actor),{status:409});
 await db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();await assert.rejects(()=>mutateProductionWorkflow(db,body(),actor),{status:409});
 assert.equal((await records(db)).filter(r=>r.entity==='production_report').length,1);
}));

test('production time is saved separately from audit time and changing it cannot replay the same key',()=>dailyFixture(async({db,body})=>{
 const input=body({productionLocalDateTime:'2026-11-02T09:15'}),saved=await mutateProductionWorkflow(db,input,actor);
 assert.equal(saved.report.productionAt,'2026-11-02T02:15:00.000Z');assert.equal(saved.report.productionDate,'2026-11-02');assert.notEqual(saved.event.recordedAt,saved.report.productionAt);
 const before=await records(db);await assert.rejects(()=>mutateProductionWorkflow(db,{...input,productionLocalDateTime:'2026-11-02T10:15'},actor),{status:409});assert.deepEqual(await records(db),before);
}));

test('daily save consolidates request reads without dropping cursor, quantity and rate guards',()=>dailyFixture(async c=>{
 let reads=0,batches=0;const observed=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{if(/^SELECT\b/i.test(sql))reads++;return target.prepare(sql);};if(key==='batch')return async statements=>{batches++;return target.batch(statements);};const value=target[key];return typeof value==='function'?value.bind(target):value;}});
 const input=c.body(),saved=await mutateProductionWorkflow(observed,input,actor);assert.equal(saved.report.reportedQuantity,200);assert.equal(reads,4,'policy/manifest/order/replay/cursor share one snapshot; empty scopes plus rate stay bounded');assert.equal(batches,1);assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_cursor'").first()).payload).version,1);
 const before=await records(c.db);const retry=await mutateProductionWorkflow(observed,input,actor);assert.equal(retry.report.id,saved.report.id);assert.deepEqual(await records(c.db),before);
}));

test('first daily write initializes a missing cursor atomically and simultaneous first writes keep one winner',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_cursor'").run();const outcomes=await Promise.allSettled([1,2].map(()=>mutateProductionWorkflow(c.db,c.body({quantity:600}),actor)));assert.equal(outcomes.filter(r=>r.status==='fulfilled').length,1);const all=await records(c.db);assert.equal(all.filter(r=>r.entity==='production_report').length,1);assert.equal(all.filter(r=>r.entity==='production_event').length,1);assert.equal(JSON.parse(all.find(r=>r.entity==='production_cursor').payload).version,1);
}));
