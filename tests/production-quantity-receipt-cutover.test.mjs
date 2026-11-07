import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';
import {activateQuantityCutover,frozenPendingReport,quantityCutoverModel} from '../scripts/local/production-quantity-cutover.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {readDailyOutputPolicy} from '../scripts/local/production-daily-output.mjs';
import {dailyOutputTotals} from '../lib/production-daily-output.mjs';
import {quantityCompletion} from '../lib/production-quantity-intake.mjs';
import {records} from '../scripts/local/database.mjs';
import {progressReviewSummary} from '../lib/production-progress-review.mjs';
import {siteApi} from '../worker/site-api.mjs';
const admin={login:'SYNTHETIC-CUTOVER-ADMIN',isAdmin:true},sourceId='a'.repeat(64),snapshotId='SYNTHETIC-QUANTITY-CUTOVER';
async function activate(c){await c.db.prepare("DELETE FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation')").run();return activateQuantityCutover(c.db,{snapshotId},admin,{sourceId});}
test('receipt marker atomically freezes bytes without recalculating history; replay and authority are guarded',()=>dailyFixture(async c=>{
 const before=(await records(c.db)).filter(r=>['in_transit','production_report','production_history_import','warehouse_in'].includes(r.entity));
 const a=await activate(c);assert.equal(a.intakeModel,quantityCutoverModel);
 const policy=(await readDailyOutputPolicy(c.db)).policy;assert.equal(policy.active,true);assert.equal(policy.receivedAt,a.receivedAt);
 const rows=await records(c.db);assert.deepEqual(rows.filter(r=>before.some(b=>b.entity===r.entity&&b.record_key===r.record_key)),before);
 const frozen=rows.filter(r=>r.entity==='production_quantity_source');assert.equal(frozen.length,before.length);for(const row of frozen){const [,entity,key]=JSON.parse(row.record_key);const original=before.find(r=>r.entity===entity&&r.record_key===key);assert.equal(row.payload,original.payload);}
 assert.equal((await activateQuantityCutover(c.db,{snapshotId},admin,{sourceId})).replayed,true);assert.deepEqual(await records(c.db),rows);
 await assert.rejects(()=>activateQuantityCutover(c.db,{snapshotId},actor,{sourceId}),{status:403});
 await assert.rejects(()=>activateQuantityCutover(c.db,{snapshotId:'SYNTHETIC-OTHER-CUTOVER'},admin,{sourceId}),{status:409});
}));
test('new receipt accepts old production dates; 200 plus 300 are two reports, same-day and sibling independent',()=>dailyFixture(async c=>{
 await activate(c);const first=await mutateProductionWorkflow(c.db,c.body(),actor),second=await mutateProductionWorkflow(c.db,c.body({quantity:300}),actor);
 assert.notEqual(first.report.id,second.report.id);assert.equal(first.report.productionDate,'2026-11-02');assert.ok(first.report.intake.receivedAt>first.report.productionAt);assert.equal(first.report.intake.snapshotId,snapshotId);
 const totals=dailyOutputTotals(c.order,[first.report,second.report]);assert.equal(totals.reported,500);assert.equal(totals.reported/c.order.lsxQty,.5);assert.equal(totals.approved,0);
 assert.equal(dailyOutputTotals({...c.order,id:'OTHER-LSX',lsxCode:'OTHER-LSX'},[first.report,second.report]).reported,0);
 const retry=await mutateProductionWorkflow(c.db,c.body({requestIdempotency:first.event.requestIdempotency}),actor);assert.equal(retry.report.id,first.report.id);
 assert.equal((await records(c.db)).filter(r=>r.entity==='production_report').length,2);
}));
test('legacy completion is normalized at server receipt, ignores stage/people/hours, and keeps stable replay',()=>dailyFixture(async c=>{
 await activate(c);const input={action:'complete',orderId:c.order.id,stageEntries:[{stage:'ASSY',quantity:200,people:['SYNTHETIC-NOBODY']}],effectiveAt:'2026-10-31T09:20:00+07:00',requestIdempotency:crypto.randomUUID()};
 const saved=await mutateProductionWorkflow(c.db,input,actor);assert.equal(saved.report.reportedQuantity,200);assert.equal(saved.report.productionDate,'2026-10-31');assert.equal(saved.report.intake.legacySubmission,true);
 for(const key of ['stageEntries','stageName','stageReporting','employees','hours'])assert.equal(saved.report[key],undefined);
 assert.equal((await mutateProductionWorkflow(c.db,input,actor)).report.id,saved.report.id);
 const before=await records(c.db);await assert.rejects(()=>mutateProductionWorkflow(c.db,{...input,requestIdempotency:crypto.randomUUID(),stageEntries:[{stage:'CUT',quantity:200},{stage:'ASSY',quantity:200}]},actor),{status:422});assert.deepEqual(await records(c.db),before);
}));
test('legacy FINAL partial, intermediate zeros and frozen pending remain separate from new output',()=>dailyFixture(async c=>{
 const common={kind:'completion',transitId:c.order.id,lsxCode:c.order.lsxCode,sku:c.order.sku,line:'A',version:1,stageReporting:true,completedAt:'2026-11-02T03:00:00Z',hours:{hc:2,ot:0,total:2}};
 await c.put('production_report','SYNTHETIC-FINAL',{...common,id:'SYNTHETIC-FINAL',stageName:'FINAL',reviewStatus:'Đã xác nhận',reportedQuantity:400,approvedQuantity:400});
 await c.put('production_report','SYNTHETIC-ASSY',{...common,id:'SYNTHETIC-ASSY',stageName:'ASSY',stageQuantity:1000,reviewStatus:'Đã xác nhận',reportedQuantity:0,approvedQuantity:0});
 await c.put('production_report','SYNTHETIC-PENDING',{...common,id:'SYNTHETIC-PENDING',stageName:'FINAL',reviewStatus:'Chờ kiểm tra',reportedQuantity:200,approvedQuantity:0});
 const before=(await records(c.db)).filter(r=>r.entity==='production_report');await activate(c);
 const policy=(await readDailyOutputPolicy(c.db)).policy;assert.equal(await frozenPendingReport(c.db,policy,'SYNTHETIC-PENDING'),true);
 const saved=await mutateProductionWorkflow(c.db,c.body({quantity:300}),actor);const own=(await records(c.db)).filter(r=>r.entity==='production_report').map(r=>JSON.parse(r.payload));
 assert.equal(dailyOutputTotals(c.order,own).approved,400);assert.equal(dailyOutputTotals(c.order,own).pending,500);assert.equal(dailyOutputTotals(c.order,own).reported,900);
 assert.deepEqual((await records(c.db)).filter(r=>before.some(b=>b.entity===r.entity&&b.record_key===r.record_key)),before);
 await assert.rejects(()=>mutateProductionWorkflow(c.db,c.body({quantity:101}),actor),{status:409});assert.equal(saved.report.hours,undefined);
 const call=await reviewer(c);const noVersion=await call('/api/production-report',{action:'review',reportId:'SYNTHETIC-PENDING',approve:true});assert.equal(noVersion.status,409);
 const reviewed=await call('/api/production-report',{action:'review',reportId:'SYNTHETIC-PENDING',approve:true,expectedVersion:1});assert.equal(reviewed.status,200,JSON.stringify(reviewed.body));assert.equal(reviewed.body.payload.approvedQuantity,200);
 assert.equal((await call('/api/production-report',{action:'review',reportId:'SYNTHETIC-PENDING',approve:true,expectedVersion:1})).status,409);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='warehouse_in'").first()).n,1);
}));
test('activation failure and concurrent activation cannot leave a partial policy; deleting policy never reopens legacy',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();const before=await records(c.db);
 const broken=new Proxy(c.db,{get(db,key){if(key==='batch')return statements=>db.batch([...statements,db.prepare("INSERT INTO app_records VALUES('SYNTHETIC',NULL,'{}','SYNTHETIC','SYNTHETIC')")]);const v=db[key];return typeof v==='function'?v.bind(db):v;}});
 await assert.rejects(()=>activateQuantityCutover(broken,{snapshotId},admin,{sourceId}));assert.deepEqual(await records(c.db),before);
 const results=await Promise.allSettled([activateQuantityCutover(c.db,{snapshotId},admin,{sourceId}),activateQuantityCutover(c.db,{snapshotId:'SYNTHETIC-CONCURRENT-CUTOVER'},admin,{sourceId})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();assert.equal((await readDailyOutputPolicy(c.db)).policy.active,false);
 await assert.rejects(()=>mutateProductionWorkflow(c.db,c.body(),actor),{status:409});
}));
test('legacy adapters reject ambiguous malformed lists instead of silently summing stages',()=>{
 assert.throws(()=>quantityCompletion({stageEntries:{}}),{status:422});assert.throws(()=>quantityCompletion({quantity:0,effectiveAt:new Date().toISOString()}),{status:422});
});
test('a legacy closed backfill submitted after cutover is one quantity receipt, not old station labor',()=>dailyFixture(async c=>{
 await activate(c);const body={action:'start',orderId:c.order.id,requestIdempotency:crypto.randomUUID(),backfill:{mode:'apply',stage:'FINAL',from:'2026-10-30T01:00:00Z',to:'2026-10-31T02:20:00Z',quantity:200,people:['SYNTHETIC-EMPLOYEE'],expectedRevision:'OLD-STAGE-REVISION'}};
 const saved=await mutateProductionWorkflow(c.db,body,actor);assert.equal(saved.report.productionDate,'2026-10-31');assert.equal(saved.report.productionAt,'2026-10-31T02:20:00.000Z');assert.equal(saved.report.reportedQuantity,200);assert.equal(saved.report.hours,undefined);assert.equal(saved.report.backfillBatch,undefined);
 assert.equal((await mutateProductionWorkflow(c.db,body,actor)).report.id,saved.report.id);
}));
test('rejected full output never completes an order; missing frozen sources block writes',()=>dailyFixture(async c=>{
 await activate(c);const saved=await mutateProductionWorkflow(c.db,c.body({quantity:1000}),actor),call=await reviewer(c);
 const rejected=await call('/api/production-report',{action:'review',reportId:saved.report.id,approve:false,expectedVersion:1,reason:'Synthetic rejection'});assert.equal(rejected.status,200,JSON.stringify(rejected.body));
 const summary=progressReviewSummary(c.order,[rejected.body.payload]);assert.equal(summary.completedAt,'');assert.equal(summary.pendingQty,0);assert.equal(summary.qty,0);assert.equal(dailyOutputTotals(c.order,[rejected.body.payload]).reported,0);
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_quantity_source' AND record_key=(SELECT min(record_key) FROM app_records WHERE entity='production_quantity_source')").run();assert.equal((await readDailyOutputPolicy(c.db)).policy.active,false);
 const before=await records(c.db);await assert.rejects(()=>activateQuantityCutover(c.db,{snapshotId},admin,{sourceId}),{status:409});await assert.rejects(()=>mutateProductionWorkflow(c.db,c.body(),actor),{status:409});assert.deepEqual(await records(c.db),before);
}));
test('large synthetic activation is set-based, byte-exact and never reads or recalculates labor history',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();
 const payload=JSON.stringify({kind:'completion',reviewStatus:'Đã xác nhận',reportedQuantity:0,sourceSnapshot:{evidence:'SYNTHETIC '.repeat(120)}});
 await c.db.prepare("INSERT INTO app_records SELECT 'production_report','SYNTHETIC-BULK-'||value,?,'SYNTHETIC','SYNTHETIC' FROM json_each(?)").bind(payload,JSON.stringify(Array.from({length:6000},(_,i)=>i))).run();
 let batches=0;const observed=new Proxy(c.db,{get(db,key){if(key==='prepare')return sql=>{assert.doesNotMatch(sql,/entity\s*=\s*'(capacity|production_schedule|employees|labor_hours)'/);return db.prepare(sql);};if(key==='batch')return statements=>{batches++;return db.batch(statements);};const v=db[key];return typeof v==='function'?v.bind(db):v;}});
 await activateQuantityCutover(observed,{snapshotId},admin,{sourceId});assert.equal(batches,1);
 const count=await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_quantity_source' AND json_extract(record_key,'$[1]')='production_report' AND payload=?").bind(payload).first();assert.equal(count.n,6000);assert.equal((await readDailyOutputPolicy(c.db)).policy.active,true);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_report' AND payload=?").bind(payload).first()).n,6000);
}));
test('a legacy review started before cutover cannot commit across the new receipt marker',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='production_reporting_policy'").run();
 const report={id:'SYNTHETIC-RACE-PENDING',transitId:c.order.id,kind:'completion',lsxCode:c.order.lsxCode,sku:c.order.sku,line:'A',reportedQuantity:200,reviewStatus:'Chờ kiểm tra',version:1,startedAt:'2026-11-02T01:00:00Z',completedAt:'2026-11-02T03:00:00Z',hours:{hc:2,ot:0,total:2}};
 await c.put('production_report',report.id,report);let armed=false;
 const wrapped=new Proxy(c.db,{get(db,key){if(key==='batch')return async statements=>{if(armed){armed=false;await activateQuantityCutover(c.db,{snapshotId},admin,{sourceId});}return db.batch(statements);};const v=db[key];return typeof v==='function'?v.bind(db):v;}});
 const call=await reviewer(c,(request,env)=>siteApi(request,{...env,DB:wrapped}));armed=true;
 const result=await call('/api/production-report',{action:'review',reportId:report.id,approve:true,expectedVersion:1});assert.equal(result.status,409,JSON.stringify(result.body));
 assert.deepEqual(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key=?").bind(report.id).first()).payload),report);
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='warehouse_in'").first()).n,0);assert.equal((await readDailyOutputPolicy(c.db)).policy.active,true);
}));
test('a frozen legacy row without an embedded ID retains its source key in review, audit and warehouse links',()=>dailyFixture(async c=>{
 const key='SYNTHETIC-SOURCE-KEY';await c.put('production_report',key,{kind:'completion',transitId:c.order.id,lsxCode:c.order.lsxCode,sku:c.order.sku,line:'A',reportedQuantity:200,reviewStatus:'Chờ kiểm tra',version:1,startedAt:'2026-11-02T01:00:00Z',completedAt:'2026-11-02T03:00:00Z',hours:{hc:2,ot:0,total:2}});
 await activate(c);const call=await reviewer(c),result=await call('/api/production-report',{action:'review',reportId:key,approve:true,expectedVersion:1});
 assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.payload.id,key);
 const rows=await records(c.db),approval=rows.filter(r=>r.entity==='production_event').map(r=>JSON.parse(r.payload)).find(r=>r.kind==='report-approval');assert.equal(approval.reportId,key);
 const warehouse=JSON.parse(rows.find(r=>r.entity==='warehouse_in').payload);assert.equal(warehouse.reportId,key);
}));
