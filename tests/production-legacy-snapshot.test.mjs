import test from 'node:test';import assert from 'node:assert/strict';
import {workflowGetFixture} from './helpers/workflow-get-fixture.mjs';import {records} from '../scripts/local/database.mjs';import {dailyToday} from '../scripts/local/production-daily-output.mjs';
import {captureLegacySource,legacySnapshotDatabase,legacySourceStillMatches,previewLegacyPreservation,legacySnapshotSources} from '../scripts/local/production-legacy-snapshot.mjs';
const actor={login:'SYNTHETIC-PREPARER',isAdmin:true},id='SYNTHETIC-SNAPSHOT-ATOMIC',build={sourceId:'a'.repeat(64)},input=()=>({snapshotId:id,cutoverDate:dailyToday()});
const original=rows=>rows.filter(r=>!r.entity.startsWith('production_legacy_'));
async function fixture(run){const c=await workflowGetFixture(6);try{await run(c);}finally{await c.close();}}
test('snapshot capture is atomic, byte-exact and idempotent; readonly view cannot mutate or read authentication tables',()=>fixture(async c=>{
 const before=await records(c.db),manifest=await captureLegacySource(c.db,input(),actor,build),frozen=legacySnapshotDatabase(c.db,id),copied=await records(frozen);
 assert.equal(manifest.status,'captured');assert.equal(manifest.scope.earned,false);assert.equal(manifest.sourceCount,before.filter(r=>legacySnapshotSources.includes(r.entity)).length);assert.deepEqual(copied,before.filter(r=>legacySnapshotSources.includes(r.entity)));assert.deepEqual(original(await records(c.db)),before);
 assert.equal((await captureLegacySource(c.db,input(),actor,build)).replayed,true);assert.equal((await records(frozen)).length,copied.length);assert.throws(()=>frozen.prepare("UPDATE app_records SET payload='{}'"),{status:403});assert.throws(()=>frozen.prepare('SELECT * FROM auth_accounts'),{status:403});assert.throws(()=>frozen.batch([]),{status:403});
 assert.equal(await legacySourceStillMatches(c.db,id,actor,build),true);await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.line','B') WHERE entity='employees' AND record_key='SYNTHETIC-NV0'").run();assert.deepEqual(await records(frozen),copied);assert.equal(await legacySourceStillMatches(c.db,id,actor,build),false);
}));
test('source guard detects phantom/replacement changes, ignores unrelated logs, and rejects another source build',()=>fixture(async c=>{
 await captureLegacySource(c.db,input(),actor,build);await c.db.prepare("INSERT INTO app_records VALUES('synthetic_unrelated_log','x','{}','SYNTHETIC','now')").run();assert.equal(await legacySourceStillMatches(c.db,id,actor,build),true);
 await c.db.prepare("INSERT INTO app_records VALUES('employees','SYNTHETIC-PHANTOM','{}','SYNTHETIC','now')").run();assert.equal(await legacySourceStillMatches(c.db,id,actor,build),false);await c.db.prepare("DELETE FROM app_records WHERE entity='employees' AND record_key='SYNTHETIC-NV0'").run();assert.equal(await legacySourceStillMatches(c.db,id,actor,build),false,'same count replacement is not fresh');await assert.rejects(()=>previewLegacyPreservation(c.db,input(),actor,{sourceId:'b'.repeat(64)}),{status:409});
}));
test('preview uses one frozen input set and matching static source; it never publishes anchors or activates policy',()=>fixture(async c=>{
 await c.db.prepare("INSERT INTO app_records VALUES('labor_hours','SYNTHETIC-SKU',?,'SYNTHETIC','now')").bind(JSON.stringify({sku:'SYNTHETIC-SKU',laborHour:.1})).run();const source=await captureLegacySource(c.db,input(),actor,build);await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.laborHour',9) WHERE entity='labor_hours'").run();const before=await records(c.db),preview=await previewLegacyPreservation(c.db,input(),actor,build);
 assert.equal(preview.manifest.status,'preview');assert.equal(preview.manifest.observedAt,source.capturedAt);assert.equal(preview.sourceStillMatches,false);assert.equal(preview.basis.find(b=>b.reportId==='SYNTHETIC-LSX3-report').earned,10);assert.deepEqual(await records(c.db),before);assert.equal(before.filter(r=>r.entity==='production_reporting_policy'||r.entity==='production_legacy_basis').length,0);
 await c.db.prepare("INSERT INTO app_records VALUES('production_reporting_policy','global',?,'SYNTHETIC','now')").bind(JSON.stringify({mode:'daily-finished-v1',approved:true,effectiveFrom:dailyToday(),legacySnapshotId:id})).run();const {readDailyOutputPolicy}=await import('../scripts/local/production-daily-output.mjs');assert.equal((await readDailyOutputPolicy(c.db)).policy.active,false,'captured/preview snapshots cannot activate reporting');
}));
test('unauthorized/missing provenance and failed batch leave all source and policy unchanged',()=>fixture(async c=>{
 const before=await records(c.db);for(const who of [{login:'HR'},{...actor,line:'A'}])await assert.rejects(()=>captureLegacySource(c.db,input(),who,build),{status:403});await assert.rejects(()=>captureLegacySource(c.db,input(),actor),{status:503});await assert.rejects(()=>captureLegacySource(c.db,{...input(),snapshotId:"bad'key"},actor,build),{status:422});
 const broken=new Proxy(c.db,{get(target,key){if(key==='batch')return statements=>target.batch([...statements,target.prepare('INSERT INTO synthetic_missing_table VALUES(1)')]);const v=target[key];return typeof v==='function'?v.bind(target):v;}});await assert.rejects(()=>captureLegacySource(broken,input(),actor,build));assert.deepEqual(await records(c.db),before);
}));

test('observed In Transit leadtime is captured from its real reader, not replaced by null or a later master',()=>fixture(async c=>{
 const {getTransit}=await import('../scripts/local/in-transit.mjs');
 await c.db.prepare("INSERT INTO app_records VALUES('leadtime','SYNTHETIC-SKU',?,'SYNTHETIC','now')").bind(JSON.stringify({sku:'SYNTHETIC-SKU',leadTime:4})).run();
 const before=await getTransit(c.db,{},[],{includeHistory:false}),saved=await captureLegacySource(c.db,input(),actor,build);assert.equal(before.rows[0].standardLeadtime,4);
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.leadTime',9) WHERE entity='leadtime'").run();
 const preview=await previewLegacyPreservation(c.db,input(),actor,build);assert.equal(preview.sourceStillMatches,false);assert.equal(preview.manifest.status,'preview');assert.equal(preview.orders.find(o=>o.orderId===before.rows[0].id).display.standardLeadtime,4);
 const after=await getTransit(c.db,{},[],{includeHistory:false,preservedOrders:preview.orders});for(const old of before.rows){const row=after.rows.find(r=>r.id===old.id);assert.equal(row.standardLeadtime,old.standardLeadtime);assert.equal(row.leadtimeVariance,old.leadtimeVariance);}
 const same=await previewLegacyPreservation(c.db,input(),actor,build);assert.deepEqual(same.orders,preview.orders);assert.equal(saved.capturedAt,preview.manifest.observedAt);
}));

test('snapshot preview uses the captured observation time when a future Leadtime version becomes effective later',async t=>fixture(async c=>{
 const observed=Date.now(),future=new Date(observed+3600000).toISOString();
 await c.db.batch([c.db.prepare("INSERT INTO app_records VALUES('leadtime','SYNTHETIC-SKU',?,'SYNTHETIC','now')").bind(JSON.stringify({sku:'SYNTHETIC-SKU',leadTime:4})),c.db.prepare("INSERT INTO app_records VALUES('leadtime_versions','SYNTHETIC-FUTURE-LEAD',?,'SYNTHETIC','now')").bind(JSON.stringify({sku:'SYNTHETIC-SKU',leadTime:9,status:'Đang áp dụng',validFrom:future}))]);
 await captureLegacySource(c.db,input(),actor,build);const before=await previewLegacyPreservation(c.db,input(),actor,build);assert.equal(before.orders[0].display.standardLeadtime,4);
 t.mock.timers.enable({apis:['Date'],now:observed+7200000});try{const later=await previewLegacyPreservation(c.db,input(),actor,build);assert.deepEqual(later,before);assert.equal(later.sourceStillMatches,true);}finally{t.mock.timers.reset();}
}));

test('frozen reader keeps employee presence at observation day across an employment end boundary; live reader still follows today',async t=>fixture(async c=>{
 const {readProductionWorkflow}=await import('../scripts/local/production-workflow.mjs'),now=Date.now(),observationAt=new Date(now).toISOString(),endDate=new Date(now+86400000+25200000).toISOString().slice(0,10);
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.employmentDatesManaged',json('true'),'$.startDate','2026-01-01','$.endDate',?) WHERE entity='employees' AND record_key='SYNTHETIC-NV0'").bind(endDate).run();await captureLegacySource(c.db,input(),actor,build);const frozen=legacySnapshotDatabase(c.db,id),before=await readProductionWorkflow(frozen,actor,[],{observationAt});assert.ok(before.employees.some(e=>e.id==='SYNTHETIC-NV0'));
 t.mock.timers.enable({apis:['Date'],now:now+172800000});try{const old=await readProductionWorkflow(frozen,actor,[],{observationAt}),live=await readProductionWorkflow(c.db,actor);assert.deepEqual(old.employees,before.employees);assert.equal(live.employees.some(e=>e.id==='SYNTHETIC-NV0'),false);}finally{t.mock.timers.reset();}
}));
