import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';
import {build} from 'esbuild';import {Miniflare} from 'miniflare';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';import {laborImportScaleDataset} from './helpers/labor-import-scale-fixture.mjs';
import {root,migrate,records} from '../scripts/local/database.mjs';import {scanLaborImportSource} from '../scripts/local/labor-import-source.mjs';
test('bundled importer runs preview/apply/readback on workerd with 16197 records and over 40 MiB source', {timeout:170000},()=>dailyFixture(async c=>{
 const dir=mkdtempSync(join(tmpdir(),'labor-import-workerd-')),entry=join(dir,'worker.mjs');let runtime;
 try{
  await build({stdin:{contents:`import {importLaborReferenceSnapshot} from './scripts/local/production-labor-reference-import.mjs';export default {async fetch(request,env){try{let queries=0;const tick=n=>{queries+=n;if(queries>1000)throw Error('Synthetic D1 query budget exceeded');};const wrap=s=>({bind:(...args)=>wrap(s.bind(...args)),all:()=>{tick(1);return s.all();},first:()=>{tick(1);return s.first();},run:()=>{tick(1);return s.run();},raw:s});const db={prepare:sql=>wrap(env.DB.prepare(sql)),batch:s=>{tick(s.length);return env.DB.batch(s.map(x=>x.raw));}};const start=Date.now();const result=await importLaborReferenceSnapshot(db,await request.json(),{isAdmin:true,login:'SYNTHETIC-REVIEWER',grants:[]},{hostname:new URL(request.url).hostname});return Response.json({...result,syntheticMetrics:{queries,elapsedMs:Date.now()-start}});}catch(e){return Response.json({error:e.message},{status:e.status||500});}}};`,resolveDir:root,sourcefile:'synthetic-worker.mjs'},outfile:entry,bundle:true,format:'esm',platform:'browser',external:['node:*'],logLevel:'silent'});
  runtime=new Miniflare({rootPath:dir,modulesRoot:dir,host:'127.0.0.1',port:0,modules:true,scriptPath:entry,compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'synthetic-labor-scale'},d1Persist:false,outboundService:()=>new Response('External network blocked',{status:503})});
  const db=await runtime.getD1Database('DB');await migrate(db);
  const initial=await records(c.db);await db.batch(initial.map(r=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(r.entity,r.record_key,r.payload,r.updated_by,r.updated_at)));
  const fixture={...c,db,put:(entity,key,payload)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'SYNTHETIC','2026-11-01').run()};
  const body=await laborImportScaleDataset(fixture),before=await scanLaborImportSource(db);
  const call=async body=>{const r=await runtime.dispatchFetch('https://onspa-thu-nghiem.shintung-vn-4458.chatgpt.site/synthetic-import',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return data;};
  const preview=await call(body);assert.equal(preview.status,'preview-only');assert.equal(preview.sourceStats.count,16197);assert.ok(preview.sourceStats.bytes>40*1024*1024);
  const apply={...body,action:'apply',expectedSourceRevision:preview.sourceRevision,confirmDigest:body.manifest.digest};const saved=await call(apply);assert.equal(saved.status,'stored');assert.equal((await call(apply)).status,'already-present');
  assert.equal((await scanLaborImportSource(db)).revision,before.revision);assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_labor_reference_snapshot'").first()).n,1);
  console.log('SYNTHETIC WORKERD '+JSON.stringify({source:preview.sourceStats,preview:preview.syntheticMetrics,apply:saved.syntheticMetrics}));
 }finally{if(runtime)await runtime.dispose();rmSync(dir,{recursive:true,force:true});}
}));
