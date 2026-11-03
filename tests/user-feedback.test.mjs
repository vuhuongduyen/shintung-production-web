import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {siteApi} from '../worker/site-api.mjs';
const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=';
test('feedback stores screenshots and identity, survives reopen, isolates senders and audits Admin replies',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const folder=mkdtempSync(resolve(base,'feedback-'));let c=await openDatabase(folder);
 const call=(path,body,cookie='',origin='https://test.invalid',env={DB:c.db,FILES:c.bucket})=>siteApi(new Request('https://test.invalid'+path,{method:body===undefined?'GET':'POST',headers:{cookie,origin,'content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),env);
 try{
 await migrate(c.db);const fixturePassword=crypto.randomUUID(),password=await passwordRecord(fixturePassword);
 for(const login of ['ADMIN_TEST','USER_A','USER_B']){const u={login,role:login==='ADMIN_TEST'?'SUPER_ADMIN':'USER',name:login,active:true,department:'QC'};await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify(u),'TEST','test'),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,password.hash,password.salt,password.iterations,'test')]);}
 const cookies={};for(const login of ['ADMIN_TEST','USER_A','USER_B'])cookies[login]=(await call('/api/auth/login',{login,password:fixturePassword})).headers.get('set-cookie').split(';')[0];
 assert.equal((await call('/api/feedback')).status,401);
 const id=crypto.randomUUID(),input={action:'create',id,title:'Sai số giờ',content:'Xuất trạm cần kiểm tra.',kind:'Báo lỗi',context:'SX báo công',images:[{name:'screen.png',base64:png}],senderId:'ADMIN_TEST',status:'Đã xử lý'};
 assert.equal((await call('/api/feedback',input,cookies.USER_A,'https://evil.invalid')).status,403);
 let result=await call('/api/feedback',input,cookies.USER_A);assert.equal(result.status,200);const created=await result.json();assert.equal(created.record.senderId,'USER_A');assert.equal(created.record.status,'Mới');assert.equal(created.record.images.length,1);
 assert.equal((await call('/api/feedback',input,cookies.USER_A)).status,200,'safe retry does not duplicate');
 assert.equal((await(await call('/api/feedback',undefined,cookies.USER_A)).json()).total,1);assert.equal((await(await call('/api/feedback',undefined,cookies.USER_B)).json()).total,0);
 assert.equal((await call('/api/feedback?id='+id,undefined,cookies.USER_B)).status,403);
 const imageUrl='/api/feedback-image?id='+created.record.images[0].file_id;
 assert.equal((await call(imageUrl,undefined,cookies.USER_B)).status,403);assert.equal((await call(imageUrl)).status,401);
 const image=await call(imageUrl,undefined,cookies.ADMIN_TEST);assert.equal(image.headers.get('content-type'),'image/png');assert.equal(new Uint8Array(await image.arrayBuffer()).length,Buffer.from(png,'base64').length);
 const update={action:'update',id,status:'Đang xử lý',response:'Đã tiếp nhận, đang kiểm tra.',expectedRevision:created.revision};
 assert.equal((await call('/api/feedback',update,cookies.USER_A)).status,403);const handled=await call('/api/feedback',update,cookies.ADMIN_TEST);assert.equal(handled.status,200);
 assert.equal((await call('/api/feedback',update,cookies.ADMIN_TEST)).status,409,'stale Admin edit rejected');
 assert.equal((await call('/api/feedback',{...input,id:crypto.randomUUID(),images:[{name:'bad.svg',base64:btoa('<svg/>')}]},cookies.USER_A)).status,400);
 assert.equal((await call('/api/feedback',{...input,id:crypto.randomUUID(),images:Array(4).fill(input.images[0])},cookies.USER_A)).status,400);
 const failedId=crypto.randomUUID();assert.equal((await call('/api/feedback',{...input,id:failedId},cookies.USER_A,'https://test.invalid',{DB:c.db,FILES:{put:async()=>{throw Error('TEST R2 unavailable')}}})).status,503);assert.equal((await call('/api/feedback?id='+failedId,undefined,cookies.ADMIN_TEST)).status,404);
 await c.close();c=await openDatabase(folder);await migrate(c.db);const reread=await(await call('/api/feedback?id='+id,undefined,cookies.USER_A)).json();assert.equal(reread.record.response,update.response);assert.equal(reread.record.history[0].actor,'ADMIN_TEST');assert.equal((await call(imageUrl,undefined,cookies.USER_A)).status,200);
 const audit=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").all()).results.map(r=>JSON.parse(r.payload));assert.equal(audit.filter(r=>r.action==='FEEDBACK_CREATED').length,1);assert.equal(audit.filter(r=>r.action==='FEEDBACK_UPDATED').length,1);
 await call('/api/auth/admin/line-users',{},cookies.ADMIN_TEST);const lineCookie=(await call('/api/auth/line-login',{line:'A'})).headers.get('set-cookie').split(';')[0];const lineSent=await call('/api/feedback',{...input,id:crypto.randomUUID()},lineCookie);assert.equal(lineSent.status,200);assert.equal((await lineSent.json()).record.senderId,'LINE_A');assert.equal((await call('/api/feedback?id='+id,undefined,lineCookie)).status,403);assert.equal((await call('/api/records?entity=user_feedback',undefined,cookies.USER_B)).status,400);
 }finally{await c.close();}
});
