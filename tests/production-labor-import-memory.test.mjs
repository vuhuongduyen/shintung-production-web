import test from 'node:test';import assert from 'node:assert/strict';import {Worker} from 'node:worker_threads';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {laborImportScaleDataset as dataset} from './helpers/labor-import-scale-fixture.mjs';
import {scanLaborImportSource} from '../scripts/local/labor-import-source.mjs';

function workerHarness(db){
 const worker=new Worker(new URL('./fixtures/labor-import-memory-worker.mjs',import.meta.url),{resourceLimits:{maxOldGenerationSizeMb:96,maxYoungGenerationSizeMb:16}});
 let waiter;worker.on('error',e=>waiter?.reject(e));worker.on('exit',code=>{if(code!==0)waiter?.reject(Error('Bounded worker exited '+code));});
 worker.on('message',async m=>{if(m.type==='result'){waiter.resolve(m);waiter=null;return;}if(m.type==='db')try{const value=m.op==='batch'?await db.batch(m.args.map(s=>db.prepare(s.sql).bind(...s.args))):await db.prepare(m.sql).bind(...m.args)[m.op]();worker.postMessage({type:'db-result',id:m.id,value});}catch(e){worker.postMessage({type:'db-result',id:m.id,error:e.message});}});
 return {run:body=>new Promise((resolve,reject)=>{waiter={resolve,reject};worker.postMessage({type:'run',body});}),close:()=>worker.terminate()};
}
test('16197 synthetic records: preview/apply retain exact guards within a 128 MiB measured budget and bounded V8 heap', {timeout:180000},()=>dailyFixture(async c=>{
 const body=await dataset(c),baseline=await scanLaborImportSource(c.db),h=workerHarness(c.db);
 try{
  const preview=await h.run(body);assert.ok(!preview.error,preview.error);assert.equal(preview.result.status,'preview-only');assert.equal(preview.result.sourceStats.count,16197);assert.ok(preview.result.sourceStats.bytes>32*1024*1024);assert.ok(preview.result.sourceStats.maxPageBytes<=128*1024);assert.equal(preview.exceeded,false);
  assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_labor_reference_snapshot'").first()).n,0);
  const apply={...body,action:'apply',expectedSourceRevision:preview.result.sourceRevision,confirmDigest:body.manifest.digest};
  const saved=await h.run(apply);assert.ok(!saved.error,saved.error);assert.equal(saved.result.status,'stored');assert.equal(saved.exceeded,false);
  const retry=await h.run(apply);assert.equal(retry.result.status,'already-present');
  const after=await scanLaborImportSource(c.db);assert.equal(after.revision,baseline.revision);assert.equal(after.count,baseline.count);
  assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_labor_reference_snapshot'").first()).n,1);
  console.log('SYNTHETIC MEMORY '+JSON.stringify({records:16197,sourceBytes:baseline.sourceBytes,guardBytes:baseline.guardBytes,previewPeakBytes:preview.peakBytes,applyPeakBytes:saved.peakBytes,limitBytes:128*1024*1024}));
 }finally{await h.close();}
}));
test('streamed digest covers unrelated source payload changes even without version/timestamp edits',()=>dailyFixture(async c=>{
 await c.put('website_action_audit','SYNTHETIC',{value:1});const before=await scanLaborImportSource(c.db);
 await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='website_action_audit'").bind(JSON.stringify({value:2})).run();
 const after=await scanLaborImportSource(c.db);assert.equal(before.count,after.count);assert.notEqual(before.revision,after.revision);
}));
test('oversized exact-guard set fails clearly before any write instead of dropping source checks',()=>dailyFixture(async c=>{
 for(let i=0;i<22;i++)await c.put('website_action_audit','SYNTHETIC-LARGE-'+i,{note:'x'.repeat(1000000)});
 await assert.rejects(scanLaborImportSource(c.db,{retainGuards:true}),e=>e.status===413&&/ngân sách bộ nhớ/.test(e.message));
 assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_labor_reference_snapshot'").first()).n,0);
}));
