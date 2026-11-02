import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';
import {passwordAuth} from '../worker/password-auth.mjs';
import {environmentRefresh,refreshGuard,LIVE,TEST,businessEntity} from '../worker/environment-refresh.mjs';
import {createHash} from 'node:crypto';
test('complete refresh: private backup, exact business rows/files, auth preserved, production unchanged, invalid token/CSRF blocked',async()=>{
 const a=await openDatabase(mkdtempSync(join(tmpdir(),'refresh-live-'))),b=await openDatabase(mkdtempSync(join(tmpdir(),'refresh-test-'))),originalFetch=globalThis.fetch;
 const envs=[{DB:a.db,FILES:a.bucket},{DB:b.db,FILES:b.bucket}],cookies=[];
 const req=(host,body,cookie='',origin=host,path='/api/environment-refresh')=>new Request('https://'+host+path,{method:'POST',headers:{cookie,origin:'https://'+origin,'content-type':'application/json'},body:JSON.stringify(body)});
 const call=(i,body,cookie=cookies[i],origin=[LIVE,TEST][i])=>environmentRefresh(req([LIVE,TEST][i],body,cookie,origin),envs[i]);
 const put=(db,e,k,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'fixture','2026-10-26').run();
 try{
 for(let i=0;i<2;i++){
  await migrate(envs[i].DB);const setup={login:i?'trial-admin':'real-admin',token:crypto.randomUUID(),expiresAt:Date.now()+3600000};envs[i].ONSPA_INITIAL_ADMIN=JSON.stringify(setup);
  const auth=(route,body)=>passwordAuth(req([LIVE,TEST][i],body,'',[LIVE,TEST][i],'/api/auth/'+route),envs[i]);
  assert.equal((await auth('activate',{token:setup.token,password:'1234',passwordConfirm:'1234'})).status,200);
  const r=await auth('login',{login:setup.login,password:'1234'});assert.equal(r.status,200);cookies[i]=r.headers.get('set-cookie').split(';')[0];
 }
 for(let i=0;i<130;i++)await put(a.db,'sku','SKU'+i,{code:'SKU'+i,note:'Sản phẩm '+i});
 await put(a.db,'production_report','R1',{stage:'ASSY',hours:15});await put(a.db,'warehouse_sheet_config','connection',{enabled:true,tokenHash:'REAL-SECRET'});await put(a.db,'source_sync_device','secret',{token:'KEEP_PRIVATE'});
 await put(b.db,'sku','OLD',{old:true});await put(b.db,'warehouse_sheet_config','connection',{enabled:true,tokenHash:'TRIAL-SECRET'});await put(b.db,'training_import_state','READY',{});
 await a.bucket.put('attachments/sample.txt','new-data');await b.bucket.put('attachments/sample.txt','old-data');await b.bucket.put('attachments/old.txt','training-only');
 const hash=createHash('sha256').update('new-data').digest('hex');await a.db.prepare('INSERT INTO file_objects VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind('file','attachments/sample.txt','sample.txt','text/plain',8,'attachments','SKU1','fixture','2026-10-26',hash,'ready').run();
 const before=await a.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all();
 assert.equal((await call(0,{action:'export'},'')).status,403);assert.equal((await call(0,{action:'export'},cookies[0],'evil.invalid')).status,403);
 const exported=await(await call(0,{action:'export'})).json();assert.ok(exported.code,JSON.stringify(exported));const code=JSON.parse(exported.code);
 assert.equal((await environmentRefresh(req(LIVE,{id:code.id,token:'wrong',action:'manifest'},'',LIVE,'/api/environment-refresh/read'),envs[0])).status,403);
 globalThis.fetch=async(url,init)=>{assert.equal(url,'https://'+LIVE+'/api/environment-refresh/read');return environmentRefresh(new Request(url,init),envs[0]);};
 const start=await(await call(1,{action:'start',code:exported.code})).json();assert.ok(start.id,JSON.stringify(start));
 assert.equal((await refreshGuard(new Request('https://'+TEST+'/api/records'),envs[1])).status,423);assert.equal(await refreshGuard(new Request('https://'+LIVE+'/api/records'),envs[0]),null);
 const status=await(await call(1,{action:'status'})).json();assert.equal(status.id,start.id);
 const key='_onspa_environment_refresh/'+start.id+'/import.json',s=await(await b.bucket.get(key)).json();s.startedAt=new Date(Date.now()-20000).toISOString();await b.bucket.put(key,JSON.stringify(s));
 let last;for(let i=0;i<60;i++){const r=await call(1,{action:'step'});last=await r.json();assert.equal(r.status,200,JSON.stringify(last));if(last.phase==='done')break;}
 assert.equal(last.phase,'done',JSON.stringify(last));assert.equal(last.result.files,1);
 const actual=await b.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all();assert.deepEqual(actual.results.filter(r=>businessEntity(r.entity)),before.results.filter(r=>businessEntity(r.entity)));
 assert.equal((await a.db.prepare('SELECT * FROM app_records ORDER BY entity,record_key').all()).results.length,before.results.length);
 assert.ok(actual.results.some(r=>r.entity==='users'&&r.record_key==='trial-admin'));assert.ok(!actual.results.some(r=>r.entity==='users'&&r.record_key==='real-admin'));
 const config=JSON.parse(actual.results.find(r=>r.entity==='warehouse_sheet_config').payload);assert.equal(config.enabled,false);assert.equal(config.tokenHash,'TRIAL-SECRET');
 assert.equal(await(await b.bucket.get('attachments/sample.txt')).text(),'new-data');assert.equal(await(await b.bucket.get('attachments/old.txt')).text(),'training-only');
 const manifest=await(await b.bucket.get(last.result.backup)).json();assert.equal(manifest.files.length,2);assert.ok((await(await b.bucket.get('_onspa_environment_refresh/'+start.id+'/backup/database.sql')).text()).includes('OLD'));
 const original=manifest.files.find(f=>f.key==='attachments/sample.txt');assert.equal(await(await b.bucket.get(original.backupKey)).text(),'old-data');
 assert.equal(await refreshGuard(new Request('https://'+TEST+'/api/records'),envs[1]),null);
 assert.equal((await(await call(1,{action:'status'})).json()).last.id,start.id);
 }finally{globalThis.fetch=originalFetch;await a.close();await b.close();}
});
