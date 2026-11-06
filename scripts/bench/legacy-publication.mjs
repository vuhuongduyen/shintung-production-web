// Isolated synthetic DB only. Run: node --test scripts/bench/legacy-publication.mjs
// Measures cold preparation/publication wall time, not production Worker CPU, memory or a p95.
import test from 'node:test';import assert from 'node:assert/strict';
import {workflowGetFixture} from '../../tests/helpers/workflow-get-fixture.mjs';
import {captureLegacySource} from '../local/production-legacy-snapshot.mjs';
import {prepareLegacyPublication,publishLegacyChunk,finalizeLegacyPublication} from '../local/production-legacy-publication.mjs';
import {activatePreparedTestPolicy} from '../../tests/helpers/activate-prepared-daily-policy.mjs';
import {dailyToday,readDailyOutputPolicy} from '../local/production-daily-output.mjs';
import {reviewer} from '../../tests/helpers/daily-output-reviewer.mjs';
import {readLegacyPreservation} from '../local/production-legacy-preservation.mjs';
import {records as databaseRecords} from '../local/database.mjs';
test('synthetic legacy preservation prepares once and writes bounded chunks without rereading the business workflow',async t=>{
 for(const count of [50,500]){const c=await workflowGetFixture(count);try{
  const actor={isAdmin:true,login:'SYNTHETIC-BENCH'},build={sourceId:'a'.repeat(64)},input={snapshotId:'SYNTHETIC-PUBLICATION-BENCH-'+count,cutoverDate:dailyToday()};
  await c.db.prepare("INSERT INTO app_records VALUES('production_test_environment','isolated','{\"isolated\":true}','SYNTHETIC','now')").run();
  let start=performance.now();await captureLegacySource(c.db,input,actor,build);const captureMs=performance.now()-start;
  start=performance.now();const prepared=await prepareLegacyPublication(c.db,input,actor,build),prepareMs=performance.now()-start;let reads=0,batches=0;const sql=[];
  const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return statement=>{const prepared=target.prepare(statement);if(!/^\s*SELECT/i.test(statement))return prepared;reads++;const item={text:statement,args:[]};sql.push(item);return new Proxy(prepared,{get(stmt,k){if(k==='bind')return (...args)=>{item.args=args;return stmt.bind(...args);};const method=stmt[k];return typeof method==='function'?method.bind(stmt):method;}});};if(key==='batch')return statements=>{batches++;return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
  start=performance.now();for(let index=0;index<prepared.chunks.length;index++)await publishLegacyChunk(db,{snapshotId:input.snapshotId,index,records:prepared.chunks[index]},actor,build);const chunksMs=performance.now()-start;
  assert.equal(reads,prepared.chunks.length);assert.equal(batches,prepared.chunks.length);assert.ok(sql.every(s=>s.text==='SELECT payload FROM app_records WHERE entity=? AND record_key=?'&&s.args[0]==='production_legacy_manifest'&&s.args[1]===input.snapshotId));
  start=performance.now();const complete=await finalizeLegacyPublication(c.db,input,actor,build),finalizeMs=performance.now()-start;assert.equal(complete.counts.reports,count);assert.equal((await readDailyOutputPolicy(c.db)).policy,null);
  start=performance.now();await activatePreparedTestPolicy(c.db,input,actor,{...build,simulation:true});const activateMs=performance.now()-start;assert.equal((await readDailyOutputPolicy(c.db)).policy.active,true);
  t.diagnostic(JSON.stringify({orders:count,records:prepared.manifest.publication.recordCount,chunks:prepared.chunks.length,maxChunkRecords:Math.max(...prepared.chunks.map(r=>r.length)),captureMs,prepareMs,chunksMs,finalizeMs,activateMs,chunkReads:reads,chunkBatches:batches}));
  const anchored=await readLegacyPreservation(c.db,(await readDailyOutputPolicy(c.db)).policy,actor),expected=new Map(anchored.basis.map(b=>[b.reportId,b]));
  const call=await reviewer({...c,db,put:(entity,key,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'SYNTHETIC','now').run()}),beforeRecords=(await databaseRecords(c.db)).filter(r=>r.entity.startsWith('production_')||r.entity==='in_transit');
  for(const view of ['full','work']){
   reads=0;batches=0;start=performance.now();const response=await call('/api/production-workflow'+(view==='work'?'?view=work':'')),elapsedMs=performance.now()-start;
   assert.equal(response.status,200,JSON.stringify(response.body));assert.equal(response.body.reports.length,count);assert.equal(response.body.orders.length,count);
   if(view==='full')for(const report of response.body.reports){const basis=expected.get(report.id);assert.ok(basis,report.id);assert.equal(report.legacyEarnedBasis.status,basis.status);assert.deepEqual(report.hours,basis.presentation.hours);assert.equal(report.legacyEarnedBasis.earned,basis.earned);}
   assert.deepEqual((await databaseRecords(c.db)).filter(r=>r.entity.startsWith('production_')||r.entity==='in_transit'),beforeRecords,'GET cannot rewrite business history');
   t.diagnostic(JSON.stringify({phase:'authenticated-activated-workflow',orders:count,view,elapsedMs,selects:reads,batches,responseBytes:Buffer.byteLength(JSON.stringify(response.body)),limits:'One local synthetic sample; HTTP Request/Response/session/JSON included, no network/browser/Google or production CPU/peak-memory'}));
  }
 }finally{await c.close();}}
});
