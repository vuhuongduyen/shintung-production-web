import test from 'node:test';
import assert from 'node:assert/strict';
import {workflowGetFixture} from './helpers/workflow-get-fixture.mjs';
import {records} from '../scripts/local/database.mjs';
import {dailyToday} from '../scripts/local/production-daily-output.mjs';
import {captureLegacySource} from '../scripts/local/production-legacy-snapshot.mjs';
import {prepareLegacyPublication,publishLegacyChunk,finalizeLegacyPublication} from '../scripts/local/production-legacy-publication.mjs';
import {inspectDailyActivation} from '../scripts/local/production-activation-readiness.mjs';

const actor={login:'SYNTHETIC-INSPECTOR',isAdmin:true},build={sourceId:'a'.repeat(64)},id='SYNTHETIC-READINESS-SNAPSHOT';
const input={snapshotId:id};
async function fixture(run){const c=await workflowGetFixture(2);try{
 await captureLegacySource(c.db,{...input,cutoverDate:dailyToday()},actor,build);
 const p=await prepareLegacyPublication(c.db,input,actor,build);
 for(let index=0;index<p.chunks.length;index++)await publishLegacyChunk(c.db,{...input,index,records:p.chunks[index]},actor,build);
 await finalizeLegacyPublication(c.db,input,actor,build);await run(c,p);
}finally{await c.close();}}
function readonly(db,onCheck=()=>{}){
 let reads=0;
 const view={
  prepare(sql){
   assert.match(sql,/^SELECT\b/);reads++;const prepared=db.prepare(sql);
   return {bind(...args){const bound=prepared.bind(...args);return {async first(){if(sql.includes('AS manifest_same'))await onCheck();return bound.first();}};}};
  },
  batch(){assert.fail('inspection must never batch or write');},
 };
 return {view,reads:()=>reads};
}

test('readiness reports technical proof in two SELECTs, returns no raw data and never authorizes activation',()=>fixture(async c=>{
 const before=await records(c.db),r=readonly(c.db),result=await inspectDailyActivation(r.view,input,actor,build);
 assert.equal(r.reads(),2);assert.equal(result.technicalChecksPassed,true);assert.deepEqual(result.blockers,[]);
 assert.equal(result.mayActivate,false);assert.equal(result.productionActivationAvailable,false);assert.equal(result.requiresAtomicRevalidation,true);
 assert.equal(result.cutoverDate,dailyToday());assert.ok(result.counts.source>0);assert.ok(result.counts.anchors>0);
 assert.deepEqual(Object.keys(result).sort(),['phase','snapshotId','sourceId','technicalChecksPassed','mayActivate','requiresAtomicRevalidation','productionActivationAvailable','blockers','cutoverDate','counts'].sort());
 assert.deepEqual(await records(c.db),before);
}));

test('readiness rejects missing server authority or invalid identifiers before accessing the DB',async()=>{
 const db={prepare(){assert.fail('unauthorized/invalid input must not query');}};
 for(const who of [{login:'HR'},{...actor,line:'A'},null])await assert.rejects(()=>inspectDailyActivation(db,input,who,build),{status:403});
 await assert.rejects(()=>inspectDailyActivation(db,input,actor),{status:503});
 await assert.rejects(()=>inspectDailyActivation(db,{snapshotId:"bad'key"},actor,build),{status:422});
});

test('readiness fails closed on missing, malformed, staging, wrong-build or oversized manifest without mutation',()=>fixture(async c=>{
 const row=await c.db.prepare("SELECT payload FROM app_records WHERE entity='production_legacy_manifest' AND record_key=?").bind(id).first(),manifest=JSON.parse(row.payload);
 for(const [payload,code] of [['{','manifest-ineligible'],[JSON.stringify({...manifest,status:'staging'}),'manifest-ineligible'],[JSON.stringify({...manifest,scope:{...manifest.scope,cutoverMonthAttendance:false}}),'manifest-ineligible'],[JSON.stringify({...manifest,sources:[]}), 'manifest-ineligible'],[JSON.stringify({...manifest,padding:'x'.repeat(256*1024)}),'manifest-over-budget']]){
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_legacy_manifest' AND record_key=?").bind(payload,id).run();
  const before=await records(c.db),r=readonly(c.db),out=await inspectDailyActivation(r.view,input,actor,build);
  assert.equal(out.technicalChecksPassed,false);assert.deepEqual(out.blockers,[code]);assert.equal(r.reads(),1);assert.deepEqual(await records(c.db),before);
 }
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='production_legacy_manifest' AND record_key=?").bind(row.payload,id).run();
 assert.deepEqual((await inspectDailyActivation(c.db,input,actor,{sourceId:'b'.repeat(64)})).blockers,['manifest-ineligible']);
 assert.deepEqual((await inspectDailyActivation(c.db,{snapshotId:'SYNTHETIC-MISSING-SNAPSHOT'},actor,build)).blockers,['manifest-missing']);
}));

for(const fault of ['manifest','source','copy','anchor','activation','policy'])test(`readiness detects concurrent ${fault} change at its final read without writing`,()=>fixture(async(c,p)=>{
 let expected,checked=false;
 const r=readonly(c.db,async()=>{
  assert.equal(checked,false);checked=true;
  if(fault==='manifest')await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.status','staging') WHERE entity='production_legacy_manifest' AND record_key=?").bind(id).run();
  if(fault==='source')await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.name','SYNTHETIC-CHANGED') WHERE entity='employees' AND record_key='SYNTHETIC-NV0'").run();
  if(fault==='copy'){const row=await c.db.prepare("SELECT record_key FROM app_records WHERE entity='production_legacy_source' LIMIT 1").first();await c.db.prepare("DELETE FROM app_records WHERE entity='production_legacy_source' AND record_key=?").bind(row.record_key).run();}
  if(fault==='anchor'){const row=p.chunks[0][0];await c.db.prepare('UPDATE app_records SET payload=? WHERE entity=? AND record_key=?').bind('{}',row.entity,row.key).run();}
  if(fault==='activation'||fault==='policy')await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(fault==='activation'?'production_reporting_activation':'production_reporting_policy','global','{}','SYNTHETIC','now').run();
  expected=await records(c.db);
 });
 const result=await inspectDailyActivation(r.view,input,actor,build),codes={manifest:'manifest-changed',source:'source-changed',copy:'source-copy-incomplete',anchor:'anchors-changed',activation:'activation-already-exists',policy:'policy-already-exists'};
 assert.equal(checked,true);assert.equal(result.technicalChecksPassed,false);assert.ok(result.blockers.includes(codes[fault]));assert.equal(result.mayActivate,false);assert.deepEqual(await records(c.db),expected);
}));

test('a stale readiness result is not a commit permit; the isolated TEST driver still revalidates source',()=>fixture(async c=>{
 const ready=await inspectDailyActivation(c.db,input,actor,build);assert.equal(ready.technicalChecksPassed,true);
 await c.db.prepare("INSERT INTO app_records VALUES('production_test_environment','isolated','{\"isolated\":true}','SYNTHETIC','now')").run();
 await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.name','SYNTHETIC-LATE-CHANGE') WHERE entity='employees' AND record_key='SYNTHETIC-NV0'").run();
 const before=await records(c.db),{activatePreparedTestPolicy}=await import('./helpers/activate-prepared-daily-policy.mjs');
 await assert.rejects(()=>activatePreparedTestPolicy(c.db,input,actor,{...build,simulation:true}),{status:409});assert.deepEqual(await records(c.db),before);
}));

test('a passing preflight cannot bypass isolation; an authorized isolated fixture still uses the existing atomic driver',()=>fixture(async c=>{
 const {activatePreparedTestPolicy}=await import('./helpers/activate-prepared-daily-policy.mjs'),before=await records(c.db);
 assert.equal((await inspectDailyActivation(c.db,input,actor,build)).technicalChecksPassed,true);
 await assert.rejects(()=>activatePreparedTestPolicy(c.db,input,actor,{...build,simulation:true}),{status:403});assert.deepEqual(await records(c.db),before);
 await c.db.prepare("INSERT INTO app_records VALUES('production_test_environment','isolated','{\"isolated\":true}','SYNTHETIC','now')").run();
 const ready=await inspectDailyActivation(c.db,input,actor,build);assert.equal(ready.technicalChecksPassed,true);assert.equal(ready.mayActivate,false);
 const saved=await activatePreparedTestPolicy(c.db,input,actor,{...build,simulation:true});assert.equal(saved.replayed,false);assert.equal(saved.activation.effectiveFrom,ready.cutoverDate);
 const after=await inspectDailyActivation(c.db,input,actor,build);assert.equal(after.technicalChecksPassed,false);assert.ok(after.blockers.includes('activation-already-exists'));assert.ok(after.blockers.includes('policy-already-exists'));
 assert.deepEqual((await records(c.db)).filter(r=>!['production_test_environment','production_reporting_activation','production_reporting_policy'].includes(r.entity)),before);
}));

test('readiness uses the deployment business day in GMT+7 and blocks a completed snapshot on another day',async t=>fixture(async c=>{
 const before=await records(c.db);t.mock.timers.enable({apis:['Date'],now:Date.now()+86400000});
 try{const result=await inspectDailyActivation(c.db,input,actor,build);assert.equal(result.technicalChecksPassed,false);assert.deepEqual(result.blockers,['manifest-ineligible']);assert.deepEqual(await records(c.db),before);}finally{t.mock.timers.reset();}
}));
