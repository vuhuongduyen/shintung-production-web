import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';
test('Plan GET and POST share legacy SKU projection; rejected batches retain exact reasons and audit input',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'plan-api-')));
 try{
 await migrate(c.db);const login='admin@example.test',fixturePassword=crypto.randomUUID(),p=await passwordRecord(fixturePassword);
 const put=(entity,key,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),login,'fixture').run();
 await put('users',login,{login,email:login,role:'Super Admin',active:true});
 await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,'fixture').run();
 let cookie='';
 const call=(path,body)=>siteApi(new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{cookie,origin:'https://test.invalid','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB:c.db,FILES:c.bucket});
 const auth=await call('/api/auth/login',{login,password:fixturePassword});assert.equal(auth.status,200);cookie=auth.headers.get('set-cookie').split(';')[0];
 const week='2026-10-26';await put('sku','TEST-LEGACY',{code:'TEST-LEGACY',status:'Đang sử dụng'});
 await put('production_engine','source',{week,rows:[{id:'legacy',sku:'TEST-LEGACY',suggested:10,line:'A',priority:'CAO - ROP'},{id:'missing',sku:'TEST-MISSING',suggested:20,line:'A',priority:'CAO - ROP'}]});
 const state=await(await call('/api/production-plan?week='+week)).json();assert.equal(state.sources[0].rows[0].skuPending,false);
 const rejected=await call('/api/production-plan',{action:'receive',week,sourceKey:'source',revision:0,ids:['legacy','missing']});assert.equal(rejected.status,422);
 assert.deepEqual((await rejected.json()).details,[{id:'missing',sku:'TEST-MISSING',reason:'skuMissing'}]);
 const audit=await c.db.prepare("SELECT payload FROM app_records WHERE entity='website_action_audit'").all();
 const failure=audit.results.map(r=>JSON.parse(r.payload)).find(p=>p.httpStatus===422);assert.equal(failure.failureDetails[0].sku,'TEST-MISSING');assert.deepEqual(failure.submittedInput.fields.ids,['legacy','missing']);
 const accepted=await call('/api/production-plan',{action:'receive',week,sourceKey:'source',revision:0,ids:['legacy']});assert.equal(accepted.status,200);assert.equal((await accepted.json()).added,1);
 }finally{await c.close();}
});
