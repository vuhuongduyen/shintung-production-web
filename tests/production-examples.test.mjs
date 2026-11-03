import {fakePassword} from './fixtures/review-fixtures.mjs';
import test from 'node:test';
import {assertRejectedRequestAudit,assertSnapshotWithReceipts} from './helpers/rejected-request-audit.mjs';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,openDatabase,migrate,records} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {assignedAt} from '../lib/production-hours.mjs';
import {exampleDatabase,createProductionExamples} from '../scripts/local/production-examples.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';

test('retired examples routes enforce auth, exact 410 response and no DB/R2 mutation',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});
 const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/examples-retired-')));
 try{
  await migrate(c.db);
  const cookies={};
  const receipts=[];
  const call=async(path,body,who)=>{
   const before=await records(c.db);
   const response=await siteApi(new Request(`https://test.invalid${path}`,{method:body?'POST':'GET',headers:{...(cookies[who]?{Cookie:cookies[who]}:{}),...(body?{origin:'https://test.invalid','content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})}),{DB:c.db,FILES:c.bucket});
   if(body&&cookies[who]&&response.status>=400){const row=await assertRejectedRequestAudit({before,after:await records(c.db),response,actorId:who,route:path.split('?')[0],body});receipts.push(row);}
   return {status:response.status,body:await response.json(),cookie:response.headers.get('set-cookie')};
  };
  for(const [login,role] of [['TEST_USER_016@example.test','Super Admin'],['viewer@example.test','USER']]){
   const p=await passwordRecord(fakePassword);
   await c.db.batch([
    c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,email:login,role,active:true}),login,'fixture'),
    c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,'fixture'),
   ]);
   const r=await call('/api/auth/login',{login,password:fakePassword},login);assert.equal(r.status,200);cookies[login]=r.cookie.split(';')[0];
  }
  const snapshot=async()=>({rows:await records(c.db),examples:(await c.db.prepare('SELECT * FROM production_example_records ORDER BY entity,record_key').all()).results,objects:(await c.bucket.list()).objects.map(o=>({key:o.key,size:o.size})).sort((a,b)=>a.key.localeCompare(b.key))});
  const before=await snapshot();
  const unchanged=async()=>{const after=await snapshot();assertSnapshotWithReceipts(before.rows,after.rows,receipts);assert.deepEqual(after.examples,before.examples);assert.deepEqual(after.objects,before.objects);};
  for(const route of ['/api/production-workflow?examples=1','/api/production-report?examples=1','/api/production-correction?examples=1','/api/production-examples']){
   const anonymous=await call(route,null,'anonymous');assert.equal(anonymous.status,401,route);assert.match(anonymous.body.error,/đăng nhập/i);
   const denied=await call(route,null,'viewer@example.test');assert.equal(denied.status,403,route);assert.match(denied.body.error,/admin/);
   const retired=await call(route,null,'TEST_USER_016@example.test');assert.equal(retired.status,410,route);
   assert.deepEqual(retired.body,{error:'Đã ngừng dữ liệu mẫu trong Quản lý sản xuất. Hãy tải lại để xem dữ liệu thực tế.'},route);
   assert.deepEqual(await snapshot(),before,`read ${route} must not write DB/R2`);
  }
  for(const route of ['/api/production-examples','/api/production-workflow?examples=1']){
   const denied=await call(route,{action:'create'},'viewer@example.test');assert.equal(denied.status,403);
   const retired=await call(route,{action:'create'},'TEST_USER_016@example.test');assert.equal(retired.status,410);
   assert.deepEqual(retired.body,{error:'Đã ngừng dữ liệu mẫu trong Quản lý sản xuất. Hãy tải lại để xem dữ liệu thực tế.'});
   await unchanged();
  }
  assert.equal((await call('/api/records?entity=users&examples=1',null,'TEST_USER_016@example.test')).status,400);
  await unchanged();
 }finally{await c.close();}
});

test('concurrent explicit example creation keeps one complete set and refuses to overwrite orphaned data',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const c=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/examples-race-')));
 try{
  await migrate(c.db);const db=exampleDatabase(c.db),actor={isAdmin:true,login:'TEST_USER_016@test'};
  const results=await Promise.all([createProductionExamples(db,actor),createProductionExamples(db,actor)]);
  assert.equal(results.filter(r=>r.created).length,1);
  assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='in_transit'").first()).n,8);
  const workflow=await readProductionWorkflow(db,{...actor,role:'Super Admin',authMode:'password'},[]);
  assert.equal(workflow.orders.length,8,'supported workflow service reads isolated synthetic orders');
  assert.equal(assignedAt(workflow.events,'TEST-LSX-A01',Date.parse(workflow.events.find(e=>e.sourceId==='TEST-LSX-A01').effectiveAt)+30000).count,10);
  await assert.rejects(()=>createProductionExamples(db,{...actor,line:'A'}),/admin/);
  const beforeEvents=(await db.prepare("SELECT payload FROM app_records WHERE entity='production_event' ORDER BY record_key").all()).results;
  const reference={employees:Object.fromEntries(['A','B'].map(line=>[line,Array.from({length:10},(_,i)=>({id:`NV-${line}${i}`,name:`Tên nguồn ${line} ${i}`}))])),products:Object.fromEntries(['A','B'].map(line=>[line,Array.from({length:4},(_,i)=>({code:`SKU-${line}${i}`,name:`Sản phẩm nguồn ${line} ${i}`,specification:'Quy cách nguồn'}))]))};
  const upgraded=await createProductionExamples(db,actor,new Date(),reference);assert.equal(upgraded.created,false);assert.equal(upgraded.examples.labelsVersion,2);
  const people=(await db.prepare("SELECT payload FROM app_records WHERE entity='employees'").all()).results.map(r=>JSON.parse(r.payload));assert.ok(people.every(p=>p.name.startsWith('Tên nguồn')));
  assert.deepEqual((await db.prepare("SELECT payload FROM app_records WHERE entity='production_event' ORDER BY record_key").all()).results,beforeEvents,'label upgrade preserves trial history');
  assert.equal((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='in_transit'").first()).n,8);
  await db.prepare("DELETE FROM app_records WHERE entity='example_set'").run();
  await assert.rejects(()=>createProductionExamples(db,actor),/Không ghi đè/);
 }finally{await c.close();}
});
