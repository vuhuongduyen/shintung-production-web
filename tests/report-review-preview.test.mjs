import test from 'node:test';import assert from 'node:assert/strict';
import {createReportReviewPreview,reviewPreviewHost,reviewPreviewEnabled} from '../scripts/local/report-review-preview.mjs';
import {reviewSnapshot} from '../lib/production-review-selection.mjs';
const config={environment:'TEST',remote:false},env={ONSPA_TEST_REVIEW_PREVIEW:'1'},session={login:'SYNTHETIC-TEST'};
test('full-app provider is explicit TEST-only; exact Codespace host never wildcard',()=>{
 for(const [c,e] of [[config,{}],[config,{...env,NODE_ENV:'production'}],[{...config,remote:true},env],[{environment:'SITE',remote:false},env]]){assert.equal(reviewPreviewEnabled(c,e),false);assert.equal(createReportReviewPreview(c,e),null);assert.equal(reviewPreviewHost(c,e),null);}
 assert.equal(reviewPreviewHost(config,env),null);const codespace={...env,CODESPACES:'true',CODESPACE_NAME:'test-space',GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:'app.github.dev'};assert.equal(reviewPreviewHost(config,codespace),'test-space-5173.app.github.dev');assert.equal(reviewPreviewHost(config,{...codespace,GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN:'evil.invalid'}),null);
});
test('full-app preview requires existing session, uses memory only, blocks other APIs and isolates sessions',()=>{
 const provider=createReportReviewPreview(config,env),call=(path,method='GET',body,s=session)=>provider.handle({path,method,body,session:s});
 assert.equal(call('/api/production-workflow','GET',null,null).status,401);const read=()=>call('/api/production-workflow').data,initial=structuredClone(read());assert.equal(initial.reports.length,4);assert.equal(initial.orders[0].lsxCode,'510-26102404');
 const report=initial.reports[0],body={action:'review',approve:true,reportId:report.id,expectedVersion:report.version,expectedReview:reviewSnapshot(initial.orders[0],report)};
 for(const path of ['/api/records','/api/warehouse-confirm','/api/production-workflow','/api/storage-upload'])assert.equal(call(path,'POST',{}).status,403);
 assert.equal(call('/api/records').data.records.length,0);assert.equal(call('/api/unknown').status,404);
 const result=call('/api/production-report','POST',body);assert.equal(result.status,200);assert.equal(result.data.persistentWrites,false);assert.equal(result.data.warehouseOperations,false);assert.equal(read().reports.filter(r=>r.reviewStatus==='Đã xác nhận').length,1);assert.equal(read().orders[0].completedQty,0);assert.equal(call('/api/production-report','POST',body).status,409);
 assert.equal(call('/api/production-workflow','GET',null,{login:'OTHER-TEST'}).data.reports.filter(r=>r.reviewStatus==='Đã xác nhận').length,0);
});

test('real TEST middleware uses existing auth but never opens a DB in preview mode',async()=>{
 const {localTestPlugin}=await import('../scripts/local/server.mjs');const {createServer,request}=await import('node:http');const {mkdtempSync,writeFileSync,readFileSync,existsSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {scryptSync}=await import('node:crypto');
 const tmp=mkdtempSync(join(tmpdir(),'onspa-preview-auth-')),authFile=join(tmp,'auth.json'),dbPath=join(tmp,'must-not-exist'),salt='synthetic-salt',auth=JSON.stringify({login:'TEST-DEMO',salt,hash:scryptSync('1234',salt,64).toString('hex')});writeFileSync(authFile,auth,{mode:0o600});const previous=process.env.ONSPA_TEST_REVIEW_PREVIEW;process.env.ONSPA_TEST_REVIEW_PREVIEW='1';let middleware;
 const server=createServer((req,res)=>middleware(req,res,()=>{res.statusCode=404;res.end();}));
 try{await localTestPlugin({authFile,persistPath:dbPath}).configureServer({httpServer:server,middlewares:{use(fn){middleware=fn;}}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const call=(path,body,cookie='')=>new Promise((resolve,reject)=>{const req=request(base+path,{method:body?'POST':'GET',headers:{host:'127.0.0.1:5173',origin:'http://127.0.0.1:5173','content-type':'application/json',cookie}},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:{get:name=>Array.isArray(res.headers[name])?res.headers[name][0]:res.headers[name]},json:async()=>JSON.parse(text)}));});req.on('error',reject);req.end(body?JSON.stringify(body):undefined);});
  const info=await call('/api/test-environment').then(r=>r.json());assert.equal(info.database,null,JSON.stringify(info));assert.equal((await call('/api/production-workflow')).status,401);
  const login=await call('/api/test-session',{login:'TEST-DEMO',password:'1234'});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
  // Reload and a fresh tab both ask the server again using the same HttpOnly cookie.
  for(let i=0;i<2;i++){const restored=await call('/api/test-session',null,cookie).then(r=>r.json());assert.deepEqual(restored,{reviewPreview:true,authenticated:true,name:'TEST-DEMO'});}
  assert.equal((await call('/api/test-session').then(r=>r.json())).authenticated,false);
  assert.equal((await call('/api/test-session',null,'onspa_test=synthetic-invalid').then(r=>r.json())).authenticated,false);
  const workflow=await call('/api/production-workflow',null,cookie).then(r=>r.json());assert.equal(workflow.reports.length,4);const r=workflow.reports[0];const result=await call('/api/production-report',{action:'review',approve:true,reportId:r.id,expectedVersion:r.version,expectedReview:reviewSnapshot(workflow.orders[0],r)},cookie);assert.equal(result.status,200);assert.equal((await result.json()).persistentWrites,false);
  assert.equal((await call('/api/warehouse-confirm',{},cookie)).status,403);assert.equal((await call('/api/records',{},cookie)).status,403);assert.equal(existsSync(dbPath),false);assert.equal(readFileSync(authFile,'utf8'),auth);
  await call('/api/test-session',{logout:true},cookie);assert.deepEqual(await call('/api/test-session',null,cookie).then(r=>r.json()),{reviewPreview:true,authenticated:false,name:null});
 }finally{await new Promise(resolve=>server.close(resolve));if(previous===undefined)delete process.env.ONSPA_TEST_REVIEW_PREVIEW;else process.env.ONSPA_TEST_REVIEW_PREVIEW=previous;rmSync(tmp,{recursive:true,force:true});}
});

test('client restoration accepts only a server-validated preview session and never uses local identity storage',async()=>{
 const {readTestPreviewSession}=await import('../lib/test-preview-session.mjs');let request;
 const name=await readTestPreviewSession(async(path,options)=>{request={path,options};return {ok:true,json:async()=>({reviewPreview:true,authenticated:true,name:'TEST-DEMO'})};});assert.equal(name,'TEST-DEMO');assert.deepEqual(request,{path:'/api/test-session',options:{method:'GET',cache:'no-store',credentials:'same-origin'}});
 for(const data of [{reviewPreview:true,authenticated:false,name:'TEST-DEMO'},{reviewPreview:false,authenticated:true,name:'TEST-DEMO'},{authenticated:true,name:'TEST-DEMO'},{reviewPreview:true,authenticated:true,name:''}])assert.equal(await readTestPreviewSession(async()=>({ok:true,json:async()=>data})),null);
 assert.equal(await readTestPreviewSession(async()=>({ok:false})),null);
});
