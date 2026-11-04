import test from 'node:test';import assert from 'node:assert/strict';import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';import {reviewer} from './helpers/daily-output-reviewer.mjs';import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {records} from '../scripts/local/database.mjs';
test('publishing a proven effective date preserves old report snapshots and never overwrites same-day history',()=>dailyFixture(async c=>{
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic SKU',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});
 const saved=await mutateProductionWorkflow(c.db,c.body(),actor),oldRaw=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report'").first()).payload,call=await reviewer(c);
 const input={mode:'edit',sku:c.order.sku,laborHour:.3,expectedVersion:2,effectiveFrom:'2026-11-04',reason:'Synthetic proven rate'};
 const result=await call('/api/labor-hours',input);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.payload.effectiveVersions.length,3);assert.equal(result.body.payload.effectiveVersions[1].value,.2);assert.equal(result.body.payload.effectiveVersions[1].validTo,'2026-11-04');assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report'").first()).payload,oldRaw);
 const before=await records(c.db),duplicate=await call('/api/labor-hours',{...input,expectedVersion:3});assert.equal(duplicate.status,409);const after=await records(c.db);assert.deepEqual(after.filter(r=>r.entity==='labor_hours'||r.entity==='production_report'),before.filter(r=>r.entity==='labor_hours'||r.entity==='production_report'));
 const oldDay=await mutateProductionWorkflow(c.db,c.body({quantity:1}),actor);assert.equal(oldDay.report.rateBasis.value,.1);assert.equal(saved.report.rateBasis.value,.1);
}));
test('daily policy requires an explicit valid effective date; future publication does not immediately change current value',()=>dailyFixture(async c=>{
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic SKU',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});const call=await reviewer(c),base={mode:'edit',sku:c.order.sku,laborHour:.3,expectedVersion:2,reason:'Synthetic future rate'};
 for(const effectiveFrom of [undefined,'2026-02-30'])assert.equal((await call('/api/labor-hours',{...base,effectiveFrom})).status,422);
 const future=await call('/api/labor-hours',{...base,effectiveFrom:'2099-01-01'});assert.equal(future.status,200,JSON.stringify(future.body));assert.equal(future.body.payload.laborHour,.2);assert.equal(future.body.payload.effectiveVersions.at(-1).value,.3);
}));
