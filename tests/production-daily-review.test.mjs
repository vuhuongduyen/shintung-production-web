import {reviewer} from './helpers/daily-output-reviewer.mjs';
import test from 'node:test';import assert from 'node:assert/strict';
import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {reportReviewBlocker} from '../lib/production-progress-review.mjs';
import {reviewSnapshot} from '../lib/production-review-selection.mjs';
import {records} from '../scripts/local/database.mjs';
test('QLSX confirms quantity without station hours, creates one warehouse proposal, replay cannot double approve',()=>dailyFixture(async c=>{
 const saved=await mutateProductionWorkflow(c.db,c.body(),actor),call=await reviewer(c);assert.equal(reportReviewBlocker(saved.report),'');
 const input={action:'review',reportId:saved.report.id,approve:true,expectedVersion:1},result=await call('/api/production-report',input);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.payload.approvedQuantity,200);assert.equal(result.body.payload.hours,undefined);assert.equal(result.body.payload.confirmationBasis.productionDate,'2026-11-02');
 const warehouse=JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='warehouse_in'").first()).payload);assert.equal(warehouse.proposedQuantity,200);assert.equal(warehouse.sourceProductionDate,'2026-11-02');
 assert.equal((await call('/api/production-report',input)).status,409);assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='warehouse_in'").first()).n,1);
}));
test('missing rate does not block quantity/warehouse review, but remains missing and legacy hour guards remain',()=>dailyFixture(async c=>{
 await c.db.prepare("DELETE FROM app_records WHERE entity='labor_hours'").run();const saved=await mutateProductionWorkflow(c.db,c.body(),actor),call=await reviewer(c);
 const result=await call('/api/production-report',{action:'review',reportId:saved.report.id,approve:true,expectedVersion:1});assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.payload.rateStatus,'missing');assert.equal(result.body.payload.earnedStandardHours,null);assert.equal(result.body.payload.hours,undefined);
 assert.notEqual(reportReviewBlocker({...saved.report,reportingModel:undefined,quantityOnly:undefined}),'');
}));
test('approval preserves legacy imported quantity/date and keeps split sibling independent',()=>dailyFixture(async c=>{
 const old={id:'SYNTHETIC-LEGACY',kind:'completion',transitId:c.order.id,reviewStatus:'Đã xác nhận',reportedQuantity:800,approvedQuantity:800,startedAt:'2026-11-01T01:00:00Z',completedAt:'2026-11-03T03:00:00Z',hours:{hc:4,ot:0,total:4}};await c.put('production_history_import','LEGACY-IMPORT',{reports:[old]});
 const legacyBefore=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_history_import'").first()).payload;
 const saved=await mutateProductionWorkflow(c.db,c.body(),actor),call=await reviewer(c),result=await call('/api/production-report',{action:'review',reportId:saved.report.id,approve:true,expectedVersion:1});assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.payload.completedQty,1000);assert.equal(result.body.payload.actualCompletedAt,'2026-11-03T03:00:00Z');
 assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_history_import'").first()).payload,legacyBefore);
 assert.equal(JSON.parse((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key='OTHER-LSX'").first()).payload).completedQty,undefined);
}));
test('selection snapshot includes rate/model changes and cannot approve a stale review',()=>dailyFixture(async c=>{
 const saved=await mutateProductionWorkflow(c.db,c.body(),actor),call=await reviewer(c),workflow=(await call('/api/production-workflow')).body,order=workflow.orders.find(o=>o.id===c.order.id),report=workflow.reports.find(r=>r.id===saved.report.id),snapshot=reviewSnapshot(order,report);
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.rateBasis.value',0.4) WHERE entity='production_report' AND record_key=?").bind(report.id).run();const result=await call('/api/production-report',{action:'review',reportId:report.id,approve:true,expectedVersion:1,expectedReview:snapshot});assert.equal(result.status,409);assert.equal((await records(c.db)).filter(r=>r.entity==='warehouse_in').length,0);
}));

test('actual Worker work profile exposes policy/order revision and accepts quantity/date/time without a stage',()=>dailyFixture(async c=>{
 const call=await reviewer(c),work=await call('/api/production-workflow?view=work');assert.equal(work.status,200);assert.equal(work.body.dailyOutputPolicy.active,true);const order=work.body.orders.find(o=>o.id===c.order.id);assert.ok(order.revision);
 const body={action:'daily-output',orderId:order.id,expectedOrderRevision:order.revision,quantity:200,productionDate:'2026-11-02',productionLocalDateTime:'2026-11-02T09:00',requestIdempotency:crypto.randomUUID()},saved=await call('/api/production-workflow',body);assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.body.report.reportedQuantity,200);assert.equal(saved.body.report.productionAt,'2026-11-02T02:00:00.000Z');assert.equal(saved.body.report.hours,undefined);assert.equal(saved.body.report.stageName,undefined);
 const retry=await call('/api/production-workflow',body);assert.equal(retry.status,200);assert.equal(retry.body.replayed,true);assert.equal(retry.body.report.id,saved.body.report.id);
 const blocked=await call('/api/production-workflow',{action:'complete',orderId:order.id,requestIdempotency:crypto.randomUUID()});assert.equal(blocked.status,409);assert.match(blocked.body.error,/báo sản lượng/);
}));
