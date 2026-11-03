import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,mkdirSync,writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assertLocal,validateBackup,configuration,openDatabase,migrate,records,importBackup,root } from '../scripts/local/database.mjs';
import { rejectSecrets,sourceFiles } from '../scripts/handoff/safety.mjs';
import { localTestPlugin } from '../scripts/local/server.mjs';
import { createServer, request as httpRequest } from 'node:http';
import { randomBytes } from 'node:crypto';

test('rejects remote bindings, production identifiers and injected credentials',()=>{
 const c=configuration();assert.doesNotThrow(()=>assertLocal(c,{}));
 assert.doesNotThrow(()=>assertLocal(c,{CLOUDFLARE_LOCATION:'WNAM'}));
 for(const patch of [{remote:true},{databaseId:'production-id'},{persistPath:'../LIVE'},{host:'0.0.0.0'},{remoteUrl:'https://example.com'}])assert.throws(()=>assertLocal({...c,...patch},{}));
 assert.throws(()=>assertLocal(c,{CLOUDFLARE_API_TOKEN:'dummy'}));
});
test('backup validation preserves raw payload and rejects duplicate keys',()=>{
 const record={entity:'sku',record_key:'TEST',payload:'{ "_deleted": true }',updated_by:'TEST',updated_at:'2026-09-15T00:00:00Z'};
 assert.equal(validateBackup({format:'ONSPA-TEST-v1',environment:'TEST',records:[record]})[0].payload,record.payload);
 assert.throws(()=>validateBackup({format:'ONSPA-TEST-v1',environment:'TEST',records:[record,record]}));
 assert.throws(()=>validateBackup({format:'ONSPA-TEST-v1',environment:'LIVE',records:[record]}));
});
test('handoff excludes databases, caches and embedded credentials',()=>{
 assert.throws(()=>rejectSecrets({nested:{password:'x'}}));
 assert.throws(()=>rejectSecrets({token:'x'}));
 const files=sourceFiles(root);assert.ok(files.includes('README.md'));assert.ok(!files.some(f=>/\.local-data|node_modules|\.sites-runtime|\.git\//.test(f)));
});
test('D1 survives restart; migrations are repeatable; restore preserves all columns',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const dir=mkdtempSync(resolve(root,'.local-data/tests/run-'));
 const sample={format:'ONSPA-TEST-v1',environment:'TEST',records:[{entity:'sku',record_key:'TEST-PERSIST',payload:'{ "_deleted": true, "name": "TEST" }',updated_by:'TEST',updated_at:'2026-09-15T00:00:00.000Z'}]};
 let c=await openDatabase(dir);try{await migrate(c.db);await importBackup(c.db,sample);}finally{await c.close();}
 c=await openDatabase(dir);try{await migrate(c.db);assert.deepEqual(await records(c.db),sample.records);await assert.rejects(()=>importBackup(c.db,sample));}finally{await c.close();}
 const second=await openDatabase(mkdtempSync(resolve(root,'.local-data/tests/restore-')));try{await migrate(second.db);await importBackup(second.db,sample);assert.deepEqual(await records(second.db),sample.records);}finally{await second.close();}
});

test('HTTP login, origin guard, durable writes and logout work without any LIVE binding',async()=>{
 mkdirSync(resolve(root,'.local-data/tests'),{recursive:true});const dir=mkdtempSync(resolve(root,'.local-data/tests/http-'));
 const options={persistPath:resolve(dir,'d1'),authFile:resolve(dir,'auth.json')};
 const password='0'+String(randomBytes(2).readUInt16BE(0)%1000).padStart(3,'0');
 async function start(){let middleware;const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end()}));await localTestPlugin(options).configureServer({httpServer:server,middlewares:{use:fn=>middleware=fn}});await new Promise(r=>server.listen(0,'127.0.0.1',r));return server;}
 let server=await start();
 const request=(path,body,cookie,origin='http://127.0.0.1:5173')=>new Promise((accept,reject)=>{
  const req=httpRequest(`http://127.0.0.1:${server.address().port}${path}`,{method:body?'POST':'GET',headers:{host:'127.0.0.1:5173',origin,'content-type':'application/json',...(cookie?{cookie}:{})}},res=>{const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('end',()=>accept(new Response(Buffer.concat(chunks),{status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([k,v])=>[k,Array.isArray(v)?v.join(','):v]))})));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
 });
 try{
  assert.equal((await request('/api/test-environment')).status,200);
  assert.equal((await request('/api/storage')).status,403);
  assert.equal((await request('/api/storage-export',{kind:'full'})).status,403);
  const entities=['users','permissions','departments','department_permissions','versions','sku','sku_history','leadtime','leadtime_versions','leadtime_audit','safety_days','safety_rules','safety_rule_groups','safety_rule_audit','labor_hours','labor_hours_history','production_engine_snapshot','inventory','warehouse_in','warehouse_out','warehouse_transfer','warehouse_docs','warehouse_count','inventory_snapshot','inventory_snapshot_audit','bom','bom_change','forecast','demand_event','production_engine','production_plan','in_transit','production_report','labor_adjustment','capacity'];
  assert.equal(new Set(entities).size,35);
  for(const entity of new Set(entities)){const response=await request(`/api/records?entity=${entity}`);assert.equal(response.status,entity==='production_report'?409:200,entity);if(entity==='production_report')continue;const rows=(await response.json()).records;if(entity==='labor_hours'||entity==='labor_hours_history')assert.equal(rows.length,340,entity);else assert.deepEqual(rows,[],entity);}
  const row={entity:'demand_event',key:'TEST-HTTP',expectedRevision:null,payload:{id:'TEST-HTTP',planningWeekStart:'2026-09-14',name:'TEST',_deleted:true,sku:'TEST-HTTP-SKU',qty:1,requestDate:'15/09/2026',delivery:'16/09/2026',type:'Phát sinh',priority:'Thường'},updatedBy:'spoofed'};
  assert.equal((await request('/api/records',row)).status,401);
  assert.equal((await request('/api/records',row,null,'https://example.com')).status,403);
  for(const invalid of ['123','12345','12a4'])assert.equal((await request('/api/test-session',{login:'test-account',password:invalid,setup:true})).status,400);
  const login=await request('/api/test-session',{login:'test-account',password,setup:true});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/storage',null,cookie)).status,403);
  assert.equal((await request('/api/records',{entity:'users',key:'test-account',payload:{login:'test-account',role:'Super Admin',active:true}},cookie)).status,403);
  assert.equal((await request('/api/records',row,cookie)).status,400);
  await request('/api/sku-request',{key:'TEST-HTTP-SKU',payload:{code:'TEST-HTTP-SKU',name:'TEST SKU'}},cookie);
  const pending=(await(await request('/api/records?entity=sku')).json()).records[0];
  assert.equal((await request('/api/records',row,cookie)).status,400);
  assert.equal((await request('/api/sku-confirm',{items:[{key:pending.key,updatedAt:pending.updatedAt}]},cookie)).status,200);
  for(const payload of [{...row.payload,qty:0},{...row.payload,delivery:'14/09/2026'},{...row.payload,delivery:'31/02/2026'}])assert.equal((await request('/api/records',{...row,payload},cookie)).status,400);
  assert.equal((await request('/api/records',{...row,createOnly:true},cookie)).status,200);
  const retry=await request('/api/records',{...row,createOnly:true,payload:{...row.payload,qty:99}},cookie);assert.equal(retry.status,409);
  await new Promise(r=>server.close(r));server=await start();
  const data=await(await request('/api/records?entity=demand_event')).json();assert.equal(data.records[0].payload._deleted,true);assert.ok(data.records[0].payload.createdAt);assert.equal(data.records[0].payload.updatedBy,'test-account');assert.equal(data.records[0].updatedBy,'test-account');
  assert.equal((await request('/api/records',row,cookie)).status,401);
  const again=await request('/api/test-session',{login:'test-account',password});assert.equal(again.status,200);const next=again.headers.get('set-cookie').split(';')[0];
  assert.equal((await request('/api/test-session',{logout:true},next)).status,200);
  assert.equal((await request('/api/records',row,next)).status,401);
 }finally{await new Promise(r=>server.close(r));}
});
