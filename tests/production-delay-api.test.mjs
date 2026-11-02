import {fakePassword} from './fixtures/review-fixtures.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {openDatabase,migrate} from '../scripts/local/database.mjs';import {readProductionWorkflow,mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';import {projectLiveStages,liveStageChoices} from '../lib/production-stage-live.mjs';
const admin={login:'ADMIN',isAdmin:true};
test('late final partial approval rejects blank reason without synchronizing',async()=>{
 const {siteApi}=await import('../worker/site-api.mjs'),{passwordRecord}=await import('../worker/password-auth.mjs');
 const c=await openDatabase(mkdtempSync(join(tmpdir(),'stage-approval-')));try{await migrate(c.db);const db=c.db,put=(e,k,p)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(e,k,JSON.stringify(p),'TEST','2026-09-20').run();
 await put('users','ADMIN',{login:'ADMIN',role:'Super Admin',active:true});const password=await passwordRecord(fakePassword);await db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind('ADMIN',password.hash,password.salt,password.iterations,'TEST').run();
 let cookie='';const call=async(path,body)=>{const r=await siteApi(new Request('https://test.invalid'+path,{method:'POST',headers:{cookie,origin:'https://test.invalid','content-type':'application/json'},body:JSON.stringify(body)}),{DB:db,FILES:c.bucket});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')};};
 const login=await call('/api/auth/login',{login:'ADMIN',password:fakePassword});assert.equal(login.status,200);cookie=login.cookie.split(';')[0];
 await put('in_transit','O',{id:'O',planId:'O',lsxCode:'O',sku:'O',line:'A',lsxQty:100,lsxOpenedAt:'2026-09-21',planEnd:'2026-09-24',delayReason:'old order reason',syncStatus:'ĐÃ ĐỒNG BỘ'});
 for(const [id,stage,qty] of [['cut','CUT',0],['final','FINAL',50]])await put('production_report',id,{id,kind:'completion',stageReporting:true,transitId:'O',planId:'O',lsxCode:'O',sku:'O',line:'A',lsxQty:100,stageName:stage,stageQuantity:100,reportedQuantity:qty,reviewStatus:'Chờ kiểm tra',startedAt:'2026-09-25T08:00:00+07:00',completedAt:'2026-09-25T12:00:00+07:00',hours:{hc:0,ot:0,total:0},version:1});
 const cut=await call('/api/production-report',{action:'review',reportId:'cut',approve:true,expectedVersion:1});assert.equal(cut.status,200,JSON.stringify(cut.body));assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
 const before=await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key='O'").first();
 for(const delayReason of ['', '   ']){
  const rejected=await call('/api/production-report',{action:'review',reportId:'final',approve:true,expectedVersion:1,delayReason});
  assert.equal(rejected.status,422,JSON.stringify(rejected.body));assert.match(rejected.body.error,/FINAL/);
  assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,0);
  assert.equal((await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key='O'").first()).payload,before.payload);
  assert.equal(JSON.parse((await db.prepare("SELECT payload FROM app_records WHERE entity='production_report' AND record_key='final'").first()).payload).reviewStatus,'Chờ kiểm tra');
 }
 const final=await call('/api/production-report',{action:'review',reportId:'final',approve:true,expectedVersion:1,delayReason:'Thiếu NVL'});assert.equal(final.status,200,JSON.stringify(final.body));
 assert.equal((await db.prepare("SELECT count(*) n FROM app_records WHERE entity='warehouse_in'").first()).n,1);
 }finally{await c.close();}
});
