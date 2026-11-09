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

test('new output resolves legacy menu revisions by update date without backdating the latest value or rewriting old reports',()=>dailyFixture(async c=>{
 const sku=c.order.sku;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,laborHour:.2,version:2,updatedAt:'2026-11-03T03:00:00Z'}),sku).run();
 await c.put('labor_hours_history','SYNTHETIC-H1',{id:'SYNTHETIC-H1',sku,version:1,newLaborHour:.1,at:'2026-11-01T03:00:00Z'});
 await c.put('labor_hours_history','SYNTHETIC-H2',{id:'SYNTHETIC-H2',sku,version:2,newLaborHour:.2,at:'2026-11-03T03:00:00Z'});
 const before=await records(c.db),earlier=await mutateProductionWorkflow(c.db,c.body({quantity:1}),actor),later=await mutateProductionWorkflow(c.db,c.body({quantity:1,productionDate:'2026-11-04'}),actor);
 assert.equal(earlier.report.rateBasis.value,.1);assert.equal(later.report.rateBasis.value,.2);assert.equal(earlier.report.rateBasis.dateBasis,'updated-date');
 assert.deepEqual((await records(c.db)).filter(r=>['labor_hours','labor_hours_history'].includes(r.entity)),before.filter(r=>['labor_hours','labor_hours_history'].includes(r.entity)));
}));

test('a concurrent change to fallback history aborts output without saving a mixed rate',()=>dailyFixture(async c=>{
 const sku=c.order.sku;await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,laborHour:.1,version:1,updatedAt:'2026-11-01T03:00:00Z'}),sku).run();
 await c.put('labor_hours_history','SYNTHETIC-RACE',{id:'SYNTHETIC-RACE',sku,version:1,newLaborHour:.1,at:'2026-11-01T03:00:00Z'});
 let injected=false;const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{if(!injected){injected=true;await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.newLaborHour',9) WHERE entity='labor_hours_history' AND record_key='SYNTHETIC-RACE'").run();}return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(()=>mutateProductionWorkflow(db,c.body({quantity:1}),actor),{status:409});assert.equal(injected,true);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_report'").first()).n,0);
}));

test('35 menu revisions save output within D1 variable limit and retain completion-day rate',()=>dailyFixture(async c=>{
 const sku=c.order.sku;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,laborHour:.35,version:35,updatedAt:'2026-11-04T03:00:00Z'}),sku).run();
 for(let i=1;i<=35;i++)await c.put('labor_hours_history','LONG-'+i,{sku,version:i,newLaborHour:i/100,at:new Date(Date.UTC(2026,9,i,3)).toISOString()});
 const r=await mutateProductionWorkflow(c.db,c.body({quantity:1}),actor);
 assert.equal(r.report.rateBasis.value,.33);assert.equal(r.report.rateBasis.revision,33);
}));
for(const change of ['insert','delete','replace','timestamp','master'])test('labor snapshot CAS rejects '+change+' without saving output',()=>dailyFixture(async c=>{
 const sku=c.order.sku;await c.put('labor_hours_history','CAS-H',{sku,version:1,newLaborHour:.1,at:'2026-11-01'});
 let injected=false;const db=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{if(!injected){injected=true;
 if(change==='insert')await c.put('labor_hours_history','CAS-NEW',{sku,version:3,newLaborHour:.3,at:'2026-11-04'});
 if(change==='delete')await target.prepare("DELETE FROM app_records WHERE entity='labor_hours_history' AND record_key='CAS-H'").run();
 if(change==='replace')await target.prepare("UPDATE app_records SET record_key='CAS-REPLACED' WHERE entity='labor_hours_history' AND record_key='CAS-H'").run();
 if(change==='timestamp')await target.prepare("UPDATE app_records SET updated_at='2026-11-09' WHERE entity='labor_hours_history' AND record_key='CAS-H'").run();
 if(change==='master')await target.prepare("UPDATE app_records SET updated_at='2026-11-09' WHERE entity='labor_hours'").run();
 }return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 await assert.rejects(()=>mutateProductionWorkflow(db,c.body({quantity:1}),actor),{status:409});assert.equal(injected,true);assert.equal((await c.db.prepare("SELECT count(*) n FROM app_records WHERE entity='production_report'").first()).n,0);
}));
test('test audit revision is never assigned to a new output even with an explicit publication',()=>dailyFixture(async c=>{
 const sku=c.order.sku;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,laborHour:16,version:2,updatedAt:'2026-11-03',effectiveVersions:[{id:'V1',revision:1,status:'published',value:.1,validFrom:'2026-11-01',validTo:'2026-11-03'},{id:'V2',revision:2,status:'published',value:16,validFrom:'2026-11-03'}]}),sku).run();
 await c.put('labor_hours_history','TEST-V2',{sku,version:2,newLaborHour:16,at:'2026-11-03',isTest:true});
 const r=await mutateProductionWorkflow(c.db,c.body({quantity:1,productionDate:'2026-11-04'}),actor);
 assert.equal(r.report.rateBasis??null,null);assert.equal(r.report.standardUnit??null,null);
}));
test('new output uses current V2 update date alongside explicit V1',()=>dailyFixture(async c=>{
 const sku=c.order.sku;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify({sku,laborHour:.2,version:2,updatedAt:'2026-11-03',effectiveVersions:[{id:'V1',revision:1,status:'published',value:.1,validFrom:'2026-11-01'}]}),sku).run();
 const before=await mutateProductionWorkflow(c.db,c.body({quantity:1}),actor),after=await mutateProductionWorkflow(c.db,c.body({quantity:1,productionDate:'2026-11-04'}),actor);
 assert.equal(before.report.rateBasis.value,.1);assert.equal(after.report.rateBasis.value,.2);assert.equal(after.report.rateBasis.dateBasis,'updated-date');
}));

for(const marker of ['audit','explicit','master'])test('menu API and output agree when sole revision is test-marked in '+marker,()=>dailyFixture(async c=>{
 const sku=c.order.sku,master={sku,version:1,laborHour:16,updatedAt:'2026-11-01',effectiveVersions:[{id:'ONLY',revision:1,status:'published',value:16,validFrom:'2026-11-01'}]},history={sku,version:1,newLaborHour:16,at:'2026-11-01'};
 if(marker==='audit')history.isTest=true;
 if(marker==='explicit')master.effectiveVersions[0].isTest=true;
 if(marker==='master')master.isTest=true;
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='labor_hours' AND record_key=?").bind(JSON.stringify(master),sku).run();
 await c.put('labor_hours_history','ONLY-H',history);
 const before=(await records(c.db)).filter(r=>['labor_hours','labor_hours_history'].includes(r.entity)),call=await reviewer(c),read=await call('/api/records?entity=labor_hours');
 assert.equal(read.status,200);const menu=read.body.records.find(r=>r.key===sku).payload;
 assert.equal(menu.laborHour,null);assert.equal(menu.currentRateIssue,'missing');assert.deepEqual(menu.resolvedRateVersions,[]);assert.ok(menu.rateTimelineIssues.some(x=>x.startsWith('excluded-test:')));
 const output=await mutateProductionWorkflow(c.db,c.body({quantity:1}),actor);assert.equal(output.report.rateBasis??null,null);assert.equal(output.report.standardUnit??null,null);
 assert.deepEqual((await records(c.db)).filter(r=>['labor_hours','labor_hours_history'].includes(r.entity)),before);
}));
