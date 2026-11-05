import test from 'node:test';
import assert from 'node:assert/strict';
import {request as httpRequest} from 'node:http';
import {spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {codespacePrivatePreview,previewTarget,previewHeaders,previewOrigin} from '../scripts/verification/codespace-private-preview.mjs';
import {records} from '../scripts/local/database.mjs';
import {assertRequestAudit} from './helpers/rejected-request-audit.mjs';
const host=new URL(previewOrigin).host;
function incoming({method='GET',path='/api/auth/session',headers={},address='127.0.0.1',rawHeaders}={}){
 const all={host,...headers};return {method,url:path,headers:all,socket:{remoteAddress:address},rawHeaders:rawHeaders||Object.entries(all).flat()};
}
test('only the one exact Codespace Host and same HTTPS Origin reach Worker; forwarding claims never override them',()=>{
 for(const method of ['GET','HEAD','POST','PUT','PATCH','DELETE'])assert.equal(previewTarget(incoming({method,headers:{origin:previewOrigin}})).origin,previewOrigin);
 assert.equal(previewTarget(incoming()).href,previewOrigin+'/api/auth/session');
 for(const badHost of ['localhost:5173','127.0.0.1:5173',host+':443',host+'.','evil.app.github.dev',host+'.evil.test',host.toUpperCase()])assert.throws(()=>previewTarget(incoming({headers:{host:badHost,'x-forwarded-host':host,'x-forwarded-proto':'https'}})),{status:403});
 for(const origin of ['null','http://'+host,'https://evil.test',previewOrigin+'/',previewOrigin+':443',previewOrigin+', '+previewOrigin])for(const method of ['GET','POST'])assert.throws(()=>previewTarget(incoming({method,headers:{origin,'x-forwarded-host':host,'x-forwarded-proto':'https'}})),{status:403});
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.throws(()=>previewTarget(incoming({method})),{status:403});
 for(const address of ['192.0.2.1',undefined,''])assert.throws(()=>previewTarget({...incoming(),socket:{remoteAddress:address}}),{status:403});
 for(const path of ['https://evil.test/api','//evil.test/api','/\\evil.test/api','/api#fragment','/api\n/auth','/api auth'])assert.throws(()=>previewTarget(incoming({path})),{status:403});
 for(const rawHeaders of [['Host',host,'Host',host],['Host',host,'Origin',previewOrigin,'Origin',previewOrigin]])assert.throws(()=>previewTarget(incoming({rawHeaders})),{status:403});
 for(const headers of [{'content-length':'1'},{'transfer-encoding':'chunked'}])assert.throws(()=>previewTarget(incoming({headers})),{status:403});
 for(const method of ['OPTIONS','TRACE','CONNECT'])assert.throws(()=>previewTarget(incoming({method})),{status:405});
});
test('transport drops proxy credentials and forwarded authority, preserving Origin and cookie bytes without adding actors',()=>{
 const cookie='__Host-onspa_session=synthetic; unrelated=unchanged',req=incoming({headers:{origin:previewOrigin,cookie,authorization:'Bearer SYNTHETIC-NOT-A-TOKEN','proxy-authorization':'SYNTHETIC','x-forwarded-host':'evil.test','x-forwarded-proto':'http',forwarded:'host=evil.test','x-github-token':'SYNTHETIC','cf-access-jwt-assertion':'SYNTHETIC','cf-connecting-ip':'192.0.2.1','content-type':'application/json'}}),before=structuredClone(req),headers=previewHeaders(req);
 assert.equal(headers.get('cookie'),cookie);assert.equal(headers.get('origin'),previewOrigin);assert.equal(headers.get('content-type'),'application/json');
 for(const key of ['host','authorization','proxy-authorization','forwarded','x-forwarded-host','x-forwarded-proto','x-github-token','cf-access-jwt-assertion','cf-connecting-ip'])assert.equal(headers.get(key),null,key);
 assert.deepEqual(req,before);assert.equal(headers.get('x-onspa-actor'),null);
});
test('manual CLI is opt-in and tied to the existing Codespace, with no production import or changes to Vite/security',()=>{
 const r=spawnSync(process.execPath,['scripts/verification/codespace-private-preview.mjs','--synthetic-codespace-private'],{env:{...process.env,CODESPACE_NAME:'different-not-approved'},encoding:'utf8'});assert.notEqual(r.status,0);assert.match(r.stderr,/existing approved Codespace is required/);assert.doesNotMatch(r.stdout,/Build|password/);
 for(const file of ['worker/index.ts','worker/site-api.mjs','vite.config.ts','app/page.tsx','package.json'])assert.doesNotMatch(readFileSync(file,'utf8'),/codespace-private-preview/);
 assert.match(readFileSync('vite.config.ts','utf8'),/allowedHosts: \["localhost", "127.0.0.1", "terminal.local"\]/);
});
function send(qa,path,{method='GET',headers={},body}={}){
 const data=body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body);
 return new Promise((accept,reject)=>{
  const req=httpRequest(qa.url+path,{method,headers:{host,...(data===undefined?{}:{'content-type':'application/json'}),...headers}},res=>{
   const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>{const bytes=Buffer.concat(chunks),response=new Response(method==='HEAD'||[204,304].includes(res.statusCode)?null:bytes,{status:res.statusCode,headers:Object.fromEntries(Object.entries(res.headers).map(([key,value])=>[key,Array.isArray(value)?value.join(', '):value]))});accept({response,status:res.statusCode,text:bytes.toString(),bytes,cookies:res.headers['set-cookie']||[]});});
  });req.on('error',error=>{error.message=method+' '+path+': '+error.message;reject(error);});req.setTimeout(30000,()=>req.destroy(Error('Synthetic HTTP test timed out')));req.end(data);
 });
}
test('built full Worker through private-origin adapter retains ordinary synthetic auth, roles, reload and JSON writes',async()=>{
 const qa=await codespacePrivatePreview();try{
  assert.match(qa.url,/^http:\/\/127\.0\.0\.1:/);assert.equal(qa.server.address().address,'127.0.0.1');assert.equal(qa.externalAccessVerified,false);
  const before=await records(qa.db),sessions=(await qa.db.prepare('SELECT * FROM auth_sessions').all()).results,accounts=(await qa.db.prepare('SELECT * FROM auth_accounts ORDER BY login').all()).results,limits=(await qa.db.prepare('SELECT * FROM auth_login_limits ORDER BY bucket').all()).results;
  for(const options of [{headers:{host:'evil.test',origin:previewOrigin}},{method:'POST',headers:{origin:'https://evil.test'},body:{login:'QA_KHSX',password:qa.password}},{method:'POST',body:{login:'QA_KHSX',password:qa.password}},{headers:{origin:'null'}},{method:'OPTIONS'}]){
   const result=await send(qa,'/api/auth/login',options);assert.ok([403,405].includes(result.status));assert.equal(result.response.headers.get('access-control-allow-origin'),null);assert.equal(result.cookies.length,0);assert.doesNotMatch(result.text,/__Host-onspa_session|Synthetic QA_KHSX/);
  }
  assert.deepEqual(await records(qa.db),before);assert.deepEqual((await qa.db.prepare('SELECT * FROM auth_sessions').all()).results,sessions);assert.deepEqual((await qa.db.prepare('SELECT * FROM auth_accounts ORDER BY login').all()).results,accounts);assert.deepEqual((await qa.db.prepare('SELECT * FROM auth_login_limits ORDER BY bucket').all()).results,limits);
  const home=await send(qa,'/');assert.equal(home.status,200);assert.match(home.text,/ONSPA/);assert.match(home.text,/Đăng nhập/);assert.match(home.response.headers.get('x-onspa-preview'),/SYNTHETIC/);
  const asset=home.text.match(/(?:src|href)="(\/assets\/[^"?]+\.js)/)?.[1];assert.ok(asset);
  const streamed=await send(qa,asset),direct=await qa.runtime.dispatchFetch(previewOrigin+asset);assert.equal(streamed.status,200);assert.deepEqual(streamed.bytes,Buffer.from(await direct.arrayBuffer()));
  assert.equal((await send(qa,asset,{method:'HEAD'})).bytes.length,0);
  const tooLargeBefore=await records(qa.db),tooLarge=await send(qa,'/api/auth/login',{method:'POST',headers:{origin:previewOrigin,'content-length':String(16*1024*1024+1)}});assert.equal(tooLarge.status,413);assert.deepEqual(await records(qa.db),tooLargeBefore);
  const anonymous=await send(qa,'/api/auth/session',{headers:{'x-onspa-actor':'QA_ADMIN','x-onspa-is-admin':'true'}});assert.equal(JSON.parse(anonymous.text).authenticated,false);
  assert.equal((await send(qa,'/api/production-plan',{method:'POST',headers:{origin:previewOrigin},body:{action:'close',week:'2026-11-02',revision:0,ids:['SYNTHETIC-QA-PLAN']}})).status,401);
  assert.equal((await send(qa,'/api/auth/login',{method:'POST',headers:{origin:previewOrigin},body:{login:'QA_KHSX',password:qa.password+'!'}})).status,401);
  const cookies={};for(const login of ['QA_KHSX','QA_HR']){
   const result=await send(qa,'/api/auth/login',{method:'POST',headers:{origin:previewOrigin},body:{login,password:qa.password}});assert.equal(result.status,200,result.text);assert.equal(result.cookies.length,1);assert.match(result.cookies[0],/^__Host-onspa_session=/);assert.match(result.cookies[0],/; Secure; HttpOnly; SameSite=Strict;/);assert.doesNotMatch(result.cookies[0],/Domain=/);cookies[login]=result.cookies[0].split(';')[0];
   const principal=JSON.parse((await send(qa,'/api/site-session',{headers:{cookie:cookies[login]}})).text);assert.equal(principal.user.login,login);assert.equal(principal.user.isAdmin,false);
  }
  await send(qa,'/',{headers:{cookie:cookies.QA_KHSX}});const restored=JSON.parse((await send(qa,'/api/auth/session',{headers:{cookie:cookies.QA_KHSX}})).text);assert.equal(restored.authenticated,true);assert.equal(restored.user.login,'QA_KHSX');assert.equal(restored.user.isAdmin,false);
  const plan=JSON.parse((await send(qa,'/api/production-plan?week=2026-11-02',{headers:{cookie:cookies.QA_KHSX}})).text);assert.equal(plan.rows[0].id,'SYNTHETIC-QA-PLAN');assert.equal(plan.rows[0].laborHour,.2);
  const body={action:'close',week:'2026-11-02',revision:plan.revision,ids:['SYNTHETIC-QA-PLAN']},prior=await records(qa.db),denied=await send(qa,'/api/production-plan',{method:'POST',headers:{cookie:cookies.QA_HR,origin:previewOrigin},body});assert.equal(denied.status,403);await assertRequestAudit({before:prior,after:await records(qa.db),response:denied.response,actorId:'QA_HR',route:'/api/production-plan',body});
  const post=input=>send(qa,'/api/production-plan',{method:'POST',headers:{cookie:cookies.QA_KHSX,origin:previewOrigin},body:input});let saved=await post(body);
  if(saved.status===409&&JSON.parse(saved.text).error==='dailyCapacityConfirmation'){const detail=JSON.parse(JSON.parse(saved.text).details.find(d=>d.id==='dailyCapacity').reason);saved=await post({...body,dailyCapacityAck:detail.token});}
  assert.equal(saved.status,200,saved.text);const closed=JSON.parse(saved.text).rows[0];assert.equal(closed.closedBy,'QA_KHSX');assert.equal(closed.status,'ĐÃ CHỐT');assert.equal(closed.end,'2026-11-06');assert.equal(closed.planLaborBasis.value,.2);assert.equal(closed.planLaborBasis.closedBy,'QA_KHSX');
  const next=JSON.parse((await send(qa,'/api/production-plan?week=2026-11-02',{headers:{cookie:cookies.QA_KHSX}})).text);assert.deepEqual(next.rows[0].planLaborBasis,closed.planLaborBasis);
  const after=await records(qa.db),badOrigin=await send(qa,'/api/production-plan',{method:'POST',headers:{cookie:cookies.QA_KHSX,origin:'http://'+host,'x-forwarded-proto':'https'},body:{...body,action:'reopen',revision:next.revision}});assert.equal(badOrigin.status,403);assert.deepEqual(await records(qa.db),after);
  const lineLogin=await send(qa,'/api/auth/line-login',{method:'POST',headers:{origin:previewOrigin},body:{line:'A'}});assert.equal(lineLogin.status,200);const lineCookie=lineLogin.cookies[0].split(';')[0],workflow=JSON.parse((await send(qa,'/api/production-workflow',{headers:{cookie:lineCookie}})).text);assert.ok(workflow.orders.length>0);assert.ok(workflow.orders.every(o=>o.line==='A'));const order=workflow.orders.find(o=>o.id==='SYNTHETIC-DAILY-A'),input={action:'daily-output',orderId:order.id,expectedOrderRevision:order.revision,quantity:25,productionDate:'2026-11-04',productionLocalDateTime:'2026-11-04T09:00',requestIdempotency:crypto.randomUUID()},oldReports=(await qa.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='production_report' ORDER BY record_key").all()).results;
  const output=async()=>send(qa,'/api/production-workflow',{method:'POST',headers:{origin:previewOrigin,cookie:lineCookie},body:input}),savedOutput=await output();assert.equal(savedOutput.status,200,savedOutput.text);const report=JSON.parse(savedOutput.text).report;assert.equal(report.reportedQuantity,25);assert.equal(report.rateBasis.value,.2);assert.equal(report.stageName,undefined);const retried=await output();assert.equal(retried.status,200);assert.equal(JSON.parse(retried.text).replayed,true);assert.equal(JSON.parse(retried.text).report.id,report.id);const reportRows=(await qa.db.prepare("SELECT record_key,payload FROM app_records WHERE entity='production_report' ORDER BY record_key").all()).results;assert.equal(reportRows.length,oldReports.length+1);assert.deepEqual(reportRows.filter(r=>r.record_key!==report.id),oldReports);
  const logout=await send(qa,'/api/auth/logout',{method:'POST',headers:{cookie:cookies.QA_KHSX,origin:previewOrigin},body:{}});assert.equal(logout.status,200);assert.match(logout.cookies[0],/Max-Age=0/);assert.equal(JSON.parse((await send(qa,'/api/auth/session',{headers:{cookie:cookies.QA_KHSX}})).text).authenticated,false);
  assert.equal(qa.outboundBlocked(),0);assert.deepEqual((await qa.db.prepare("SELECT entity FROM app_records WHERE entity LIKE '%sheet%' OR entity LIKE '%credential%'").all()).results,[]);
 }finally{await qa.close();}
});

test('each adapter has isolated volatile accounts/data and rejects old cookies after restart',async()=>{
 let first=await codespacePrivatePreview(),second;try{
  const logged=await send(first,'/api/auth/login',{method:'POST',headers:{origin:previewOrigin},body:{login:'QA_KHSX',password:first.password}});assert.equal(logged.status,200);const cookie=logged.cookies[0].split(';')[0],firstPassword=first.password;
  await first.db.prepare("INSERT INTO app_records VALUES('synthetic_preview_marker','SYNTHETIC-MARKER','{}','SYNTHETIC-QA','now')").run();assert.equal((await first.db.prepare("SELECT count(*) n FROM app_records WHERE entity='synthetic_preview_marker'").first()).n,1);await first.close();first=null;
  second=await codespacePrivatePreview();assert.notEqual(second.password,firstPassword);assert.equal(JSON.parse((await send(second,'/api/auth/session',{headers:{cookie}})).text).authenticated,false);assert.equal((await second.db.prepare("SELECT json_extract(payload,'$.rows[0].plan') qty FROM app_records WHERE entity='production_plan' AND record_key='2026-11-02'").first()).qty,100);assert.equal((await second.db.prepare("SELECT count(*) n FROM app_records WHERE entity='synthetic_preview_marker'").first()).n,0);assert.equal(second.outboundBlocked(),0);
 }finally{await first?.close();await second?.close();}
});
