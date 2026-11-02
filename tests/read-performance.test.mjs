import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,records,root} from '../scripts/local/database.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {observeReadDatabase,workflowReadSnapshot} from '../worker/read-performance.mjs';
import {siteApi,sitePrincipal} from '../worker/site-api.mjs';
import {tokenHash} from '../worker/password-auth.mjs';
import {siteCatalog} from '../lib/site-catalog.mjs';
import {recordRevision} from '../lib/record-revision.mjs';

test('GET request snapshots remove duplicate reads with identical workflow output, sorting and fresh next requests',async t=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});
 const c=await openDatabase(mkdtempSync(resolve(base,'read-performance-')));
 try{
  await migrate(c.db);
  const write=(entity,key,payload,at='2026-09-21T00:00:00Z')=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'fixture',at).run();
  await write('in_transit','ORDER',{id:'ORDER',planId:'PLAN',week:'2026-09-21',sku:'SKU-TEST',line:'A',lsxCode:'LSX-TEST',lsxQty:100,lsxOpenedAt:'2026-09-21',planStart:'2026-09-21',planEnd:'2026-09-26',syncStatus:'ĐÃ ĐỒNG BỘ'});
  for(const [key,at] of [['A','2026-09-21T02:00:00Z'],['Z','2026-09-21T00:00:00Z'],['\uE000','2026-09-21T02:00:00Z'],['😀','2026-09-21T02:00:00Z']]){
   await write('production_event',key,{id:key,kind:'note',voided:true,line:'A',sourceId:'ORDER',recordedAt:at,effectiveAt:at},at);
   await write('production_report',key,{id:key,kind:'note',transitId:'ORDER',line:'A',reviewStatus:'Đã xác nhận',recordedAt:at},at);
   await write('production_history_import',key,{id:key,reports:[]},at);
  }
  const actor={login:'fixture-admin',isAdmin:true,line:null};
  const before=await records(c.db),original=observeReadDatabase(c.db),optimized=observeReadDatabase(c.db);
  const expected=await readProductionWorkflow(original.database,actor);
  const actual=await readProductionWorkflow(workflowReadSnapshot(optimized.database),actor);
  assert.deepEqual(actual,expected);
  t.diagnostic(`Workflow DB calls: ${original.summary().calls} -> ${optimized.summary().calls}`);
  assert.ok(optimized.summary().calls<original.summary().calls,'pagination pages shared across workflow/transit remove duplicate reads');
  assert.deepEqual(await records(c.db),before,'the read path writes no data');

  const snapshot=workflowReadSnapshot(c.db);
  for(const entity of ['production_event','production_report','production_history_import'])for(const direction of ['',' DESC']){
   const sql=`SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=? ORDER BY updated_at${direction},record_key`;
   assert.deepEqual((await snapshot.prepare(sql).bind(entity).all()).results,(await c.db.prepare(sql).bind(entity).all()).results,'SQLite ordering, including non-BMP key ties, is preserved');
  }
  const sql='SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=? ORDER BY updated_at,record_key';
  const old=(await snapshot.prepare(sql).bind('production_event').all()).results;
  await write('production_event','NEW',{id:'NEW',kind:'note',voided:true,line:'A'},'2026-09-22T00:00:00Z');
  assert.deepEqual((await snapshot.prepare(sql).bind('production_event').all()).results,old,'one request reuses its first per-entity snapshot');
  assert.equal((await workflowReadSnapshot(c.db).prepare(sql).bind('production_event').all()).results.length,old.length+1,'the next request sees new data');
  const batchProbe=observeReadDatabase(c.db);
  const batch=await batchProbe.database.batch([batchProbe.database.prepare('SELECT count(*) AS total FROM app_records WHERE entity=?').bind('production_event')]);
  assert.equal(batch[0].results[0].total,old.length+1);
  assert.equal(batchProbe.summary().calls,1,'read batches accept original D1 statements and record one binding operation');
 }finally{await c.close();}
});

test('Site GET timing and SKU dedup preserve catalog, stored view and live session revocation; POST is unwrapped',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});
 const c=await openDatabase(mkdtempSync(resolve(base,'read-routes-')));
 try{
  await migrate(c.db);
  const login='performance-fixture',token='a'.repeat(64),cookie=`__Host-onspa_session=${token}`,at='2026-09-21T00:00:00Z';
  await c.db.batch([
   c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,role:'SUPER_ADMIN',active:true}),login,at),
   c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,'fixture-hash','fixture-salt',100000,at),
   c.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(token),login,1,Date.now()+60000,at),
   c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('sku','SKU-TEST',JSON.stringify({code:'SKU-TEST',name:'Fixture SKU'}),login,at),
  ]);
  const request=(route,method='GET')=>new Request('https://test.invalid'+route,{method,headers:{cookie,...(method==='POST'?{origin:'https://test.invalid','content-type':'application/json'}:{})},...(method==='POST'?{body:'{}'}:{})});
  const observed=observeReadDatabase(c.db),env={DB:observed.database,FILES:c.bucket};
  const before=await records(c.db),response=await siteApi(request('/api/records?entity=sku'),env);
  assert.equal(response.status,200);
  assert.match(response.headers.get('Server-Timing'),/principal;dur=[\d.]+/);
  assert.match(response.headers.get('Server-Timing'),/db_calls;desc="4"/);
  assert.equal(observed.summary().calls,4,'fresh principal reads plus byte-bounded SKU pages');
  const stored=(await c.db.prepare("SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity='sku'").all()).results;
  const expected=siteCatalog(await Promise.all(stored.map(async r=>({key:r.record_key,payload:JSON.parse(r.payload),updatedBy:r.updated_by,updatedAt:r.updated_at,revision:await recordRevision(r.payload)}))));
  assert.deepEqual((await response.json()).records,expected);
  const storedResponse=await siteApi(request('/api/records?entity=sku&view=stored'),{DB:c.db,FILES:c.bucket});
  assert.equal(storedResponse.status,200);assert.equal((await storedResponse.json()).records.length,1,'stored view must not merge legacy catalog');
  const principal=await sitePrincipal(request('/api/site-session'),{DB:c.db,FILES:c.bucket});
  const workflowBaseline=await readProductionWorkflow(c.db,principal,expected);
  const workflow=await siteApi(request('/api/production-workflow'),{DB:c.db,FILES:c.bucket});
  assert.equal(workflow.status,200);
  assert.match(workflow.headers.get('Server-Timing'),/db_calls;desc="[0-9]+"/);
  assert.deepEqual(await workflow.json(),{...workflowBaseline,rights:{...workflowBaseline.rights,examples:true},reportingHold:null,canCancelReportingDay:true,examples:null});
  const light=await siteApi(request('/api/production-workflow?view=work'),{DB:c.db,FILES:c.bucket});assert.equal(light.status,200);const lightBody=await light.json();assert.deepEqual(lightBody.rights,workflowBaseline.rights.examples===undefined?{...workflowBaseline.rights,examples:true}:workflowBaseline.rights);assert.deepEqual(lightBody.orders,workflowBaseline.orders);
  assert.deepEqual(await records(c.db),before);
  const post=await siteApi(request('/api/auth/logout','POST'),{DB:c.db,FILES:c.bucket});
  assert.equal(post.status,200);assert.equal(post.headers.get('Server-Timing'),null,'mutation route does not use timing or cache wrappers');
  const denied=await siteApi(request('/api/records?entity=sku'),{DB:c.db,FILES:c.bucket});
  assert.equal(denied.status,401,'revocation takes effect immediately despite earlier successful reads');
 }finally{await c.close();}
});

test('request snapshot never shares failed reads or authentication queries',async()=>{
 let calls=0;
 const db={prepare(){return {bind(){return this;},async all(){calls++;if(calls===1)throw new Error('fixture failure');return {results:[]};}};}};
 const snapshot=workflowReadSnapshot(db),sql='SELECT record_key,payload,updated_by,updated_at FROM app_records WHERE entity=? ORDER BY updated_at,record_key';
 await assert.rejects(()=>snapshot.prepare(sql).bind('production_event').all(),/fixture failure/);
 await snapshot.prepare(sql).bind('production_event').all();assert.equal(calls,2);
 await snapshot.prepare('SELECT login FROM auth_sessions WHERE token_hash=?').bind('fixture').all();
 await snapshot.prepare('SELECT login FROM auth_sessions WHERE token_hash=?').bind('fixture').all();assert.equal(calls,4);
});
