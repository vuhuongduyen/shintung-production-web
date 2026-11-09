import test from 'node:test';import assert from 'node:assert/strict';import {dailyFixture,actor} from './helpers/daily-output-fixture.mjs';import {reviewer} from './helpers/daily-output-reviewer.mjs';import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {records} from '../scripts/local/database.mjs';
test('same-day publication adds a revision while preserving existing reports and earlier dates',()=>dailyFixture(async c=>{
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic SKU',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});
 const saved=await mutateProductionWorkflow(c.db,c.body(),actor),oldRaw=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report'").first()).payload,call=await reviewer(c);
 const input={mode:'edit',sku:c.order.sku,laborHour:.3,expectedVersion:2,effectiveFrom:'2026-11-04',reason:'Synthetic proven rate'};
 const result=await call('/api/labor-hours',input);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.payload.effectiveVersions.length,3);assert.equal(result.body.payload.effectiveVersions[1].value,.2);assert.equal(result.body.payload.effectiveVersions[1].validTo,'2026-11-04');assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_report'").first()).payload,oldRaw);
 const sameDayReport=await mutateProductionWorkflow(c.db,c.body({quantity:1,productionDate:'2026-11-04'}),actor);assert.equal(sameDayReport.report.rateBasis.value,.3);
 const before=await records(c.db),revision=await call('/api/labor-hours',{...input,laborHour:.4,expectedVersion:3});assert.equal(revision.status,200,JSON.stringify(revision.body));const after=await records(c.db);assert.deepEqual(after.filter(r=>r.entity==='production_report'),before.filter(r=>r.entity==='production_report'));
 assert.deepEqual(revision.body.payload.effectiveVersions.slice(0,3),result.body.payload.effectiveVersions);assert.equal(revision.body.payload.effectiveVersions.at(-1).supersedesVersionId,result.body.payload.effectiveVersions.at(-1).id);assert.equal(revision.body.history.oldLaborHour,.3);
 const nextReport=await mutateProductionWorkflow(c.db,c.body({quantity:1,productionDate:'2026-11-04'}),actor);assert.equal(nextReport.report.rateBasis.value,.4);assert.notEqual(nextReport.report.rateBasis.versionId,sameDayReport.report.rateBasis.versionId);
 const oldDay=await mutateProductionWorkflow(c.db,c.body({quantity:1}),actor);assert.equal(oldDay.report.rateBasis.value,.1);assert.equal(saved.report.rateBasis.value,.1);
}));
test('daily policy requires an explicit valid effective date; future publication does not immediately change current value',()=>dailyFixture(async c=>{
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic SKU',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});const call=await reviewer(c),base={mode:'edit',sku:c.order.sku,laborHour:.3,expectedVersion:2,reason:'Synthetic future rate'};
 for(const effectiveFrom of [undefined,'2026-02-30'])assert.equal((await call('/api/labor-hours',{...base,effectiveFrom})).status,422);
 const future=await call('/api/labor-hours',{...base,effectiveFrom:'2099-01-01'});assert.equal(future.status,200,JSON.stringify(future.body));assert.equal(future.body.payload.laborHour,.2);assert.equal(future.body.payload.effectiveVersions.at(-1).value,.3);
}));

test('a saved Plan-close rate never replaces the completion-day standard of actual output',()=>dailyFixture(async c=>{
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.planLaborBasis',json(?),'$.laborHour',0.2) WHERE entity='in_transit' AND record_key=?").bind(JSON.stringify({kind:'plan-close-labor-v2',status:'resolved',value:.2,businessDate:'2026-11-04'}),c.order.id).run();
 const order=await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(c.order.id).first();const {recordRevision}=await import('../lib/record-revision.mjs');const revision=await recordRevision(order.payload);
 const old=await mutateProductionWorkflow(c.db,c.body({quantity:1,expectedOrderRevision:revision}),actor),later=await mutateProductionWorkflow(c.db,c.body({quantity:1,productionDate:'2026-11-04',expectedOrderRevision:revision}),actor);
 assert.equal(old.report.rateBasis.value,.1);assert.equal(old.report.rateBasis.productionDate,'2026-11-02');assert.equal(later.report.rateBasis.value,.2);assert.equal(later.report.rateBasis.productionDate,'2026-11-04');assert.equal((await c.db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(c.order.id).first()).payload,order.payload);
}));


test('two stale same-day writers cannot lose a revision or append an extra labor audit',()=>dailyFixture(async c=>{
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});
 const call=await reviewer(c),input={mode:'edit',sku:c.order.sku,laborHour:.3,expectedVersion:2,effectiveFrom:'2026-11-03',reason:'Synthetic concurrent revision'};
 const results=await Promise.all([call('/api/labor-hours',input),call('/api/labor-hours',{...input,laborHour:.4})]);
 assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 const rows=await records(c.db),current=JSON.parse(rows.find(r=>r.entity==='labor_hours').payload);
 assert.equal(current.version,3);assert.equal(current.effectiveVersions.length,3);
 assert.equal(rows.filter(r=>r.entity==='labor_hours_history').length,1);
 assert.equal(rows.filter(r=>r.entity==='admin_audit'&&JSON.parse(r.payload).entity==='labor_hours').length,1);
 const before=rows.filter(r=>['labor_hours','labor_hours_history','production_report'].includes(r.entity));
 assert.equal((await call('/api/labor-hours',input)).status,409);
 assert.deepEqual((await records(c.db)).filter(r=>['labor_hours','labor_hours_history','production_report'].includes(r.entity)),before);
}));

test('historical PDF publication keeps current display at the active date and never manufactures earlier basis',()=>dailyFixture(async c=>{
 await c.put('sku',c.order.sku,{code:c.order.sku,name:'Synthetic',confirmation_status:'Đã xác nhận',usage_status:'Đang sử dụng'});
 const call=await reviewer(c),result=await call('/api/labor-hours',{mode:'edit',sku:c.order.sku,laborHour:.15,expectedVersion:2,effectiveFrom:'2026-11-02',reason:'Synthetic dated PDF',source:'PDF'});
 assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.payload.laborHour,.2);assert.equal(result.body.history.oldLaborHour,.1);assert.equal(result.body.history.source,'PDF');
 const read=await call('/api/records?entity=labor_hours');assert.equal(read.body.records.find(r=>r.key===c.order.sku).payload.laborHour,.2);
 const report=await mutateProductionWorkflow(c.db,c.body({quantity:1}),actor);assert.equal(report.report.rateBasis.value,.15);
 const {effectiveValueOn}=await import('../lib/effective-dated-value.mjs');assert.equal(effectiveValueOn(result.body.payload.effectiveVersions,'2026-10-31').reason,'missing');
}));
