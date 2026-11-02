import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root,records} from '../scripts/local/database.mjs';
import {readPermissionSetup,applyPermissionSetup} from '../scripts/local/user-permission-setup.mjs';
import {withBusinessViews} from '../lib/user-permission-profiles.mjs';
import {siteApi,sitePrincipal} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {normalizeTestLog} from '../lib/website-test-log.mjs';
const grant='Quản lý sản xuất / Hiệu suất và tính sản lượng / Xem',old='Dữ liệu cơ bản / Leadtime / Sửa',dep='Quản lý kho / Tồn kho ERP / Xem';
async function fixture(){
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const folder=mkdtempSync(resolve(base,'permissions-'));const c=await openDatabase(folder);await migrate(c.db);
 const put=(entity,key,payload)=>c.db.prepare('INSERT OR REPLACE INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'TEST','test').run();
 const get=async(entity,key)=>{const row=await c.db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();return row?JSON.parse(row.payload):null;};
 for(const user of [{login:'admin',role:'SUPER_ADMIN',active:true},{login:'custom',active:true,department:'KHO'},{login:'department',active:true,department:'KHO'},{login:'untouched',active:true,department:'KHO'},{login:'inactive',active:false,department:'KHO'},{login:'revoked',active:true,department:'KHO'},{login:'LINE_A',active:true,authMode:'quick_line',line:'A'},{login:'deleted',active:true,_deleted:true}])await put('users',user.login,{role:'USER',...user});
 await put('permissions','custom',{login:'custom',active:true,permissionMode:'CUSTOM',permissions:old,other:'preserve'});
 await put('permissions','revoked',{login:'revoked',active:false,permissionMode:'CUSTOM',permissions:old});
 await put('department_permissions','KHO',{department:'KHO',active:true,permissions:dep});
 return {...c,folder,put,get};
}
const actor={isAdmin:true,userId:'admin'};
const request=(plan,extra={})=>({action:'preview',expectedRevision:plan.revision,selectedLogins:['custom','department'],grants:[grant],...extra});
test('selected additive setup previews without writes; preserves grants/users/templates and persists exact audit',async()=>{
 const c=await fixture();try{
 const before=await records(c.db),plan=await readPermissionSetup(c.db,actor),preview=await applyPermissionSetup(c.db,request(plan),actor);
 assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='permission_preview'),before);assert.equal(preview.changedUsers,2);assert.deepEqual(preview.users.find(u=>u.login==='custom').after,[old,grant]);assert.deepEqual(preview.users.find(u=>u.login==='department').after,[dep,grant]);
 assert.ok(!JSON.stringify(plan).includes('_personal'));assert.ok(!plan.users.find(u=>u.login==='inactive').eligible);assert.ok(!plan.users.find(u=>u.login==='admin').eligible);assert.ok(!plan.users.find(u=>u.login==='LINE_A').eligible);
 for(const login of ['custom','department','untouched'])await c.db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(login,login,1,9999999999999,0).run();
 const result=await applyPermissionSetup(c.db,{...request(plan),action:'apply',previewToken:preview.previewToken,confirmed:true},actor);
 assert.equal(result.ok,true);assert.equal((await c.get('permissions','custom')).permissions,[old,grant].join(' · '));assert.equal((await c.get('permissions','custom')).other,'preserve');assert.equal((await c.get('permissions','department')).permissionMode,'CUSTOM');
 const saved=await records(c.db);assert.deepEqual(saved.filter(r=>!['permissions','admin_audit','permission_preview'].includes(r.entity)),before.filter(r=>!['permissions','admin_audit','permission_preview'].includes(r.entity)));
 assert.equal(await c.get('permissions','untouched'),null);assert.equal((await c.get('permissions','revoked')).active,false);
 const audit=await c.get('admin_audit',result.auditId);assert.equal(audit.action,'USER_PERMISSION_ADD');assert.equal(audit.actor,'admin');assert.deepEqual(audit.changes.map(c=>c.key).sort(),['custom','department']);assert.equal(audit.changes[0].before.permissions,old);assert.deepEqual(audit.grants,[grant]);
 const log=normalizeTestLog([{entity:'admin_audit',record_key:result.auditId,payload:audit}]);assert.equal(log[0].menu,'Phân quyền');
 const sessions=(await c.db.prepare('SELECT login,revoked_at FROM auth_sessions ORDER BY login').all()).results;assert.ok(sessions.find(s=>s.login==='custom').revoked_at);assert.equal(sessions.find(s=>s.login==='untouched').revoked_at,null);
 await assert.rejects(applyPermissionSetup(c.db,{...request(plan),action:'apply',previewToken:preview.previewToken,confirmed:true},actor),e=>e.status===409);
 const fresh=await readPermissionSetup(c.db,actor),noop=await applyPermissionSetup(c.db,request(fresh),actor);const snapshot=await records(c.db);assert.equal(noop.changedUsers,0);await applyPermissionSetup(c.db,{...request(fresh),action:'apply',previewToken:noop.previewToken,confirmed:true},actor);assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='permission_preview'),snapshot.filter(r=>r.entity!=='permission_preview'));
 }finally{await c.close();}
});
test('denies reset legacy calls, protected users, forged grants/tokens, stale state, unauthorised callers, without writes',async()=>{
 const c=await fixture();try{
 const before=await records(c.db),plan=await readPermissionSetup(c.db,actor),preview=await applyPermissionSetup(c.db,request(plan),actor);
 await assert.rejects(readPermissionSetup(c.db,{isAdmin:false}),e=>e.status===403);
 for(const body of [{expectedRevision:plan.revision},request(plan,{selectedLogins:[]}),request(plan,{selectedLogins:['custom','custom']}),request(plan,{grants:[]}),request(plan,{grants:['Quản trị hệ thống / Phân quyền / Sửa']}),request(plan,{grants:[grant,grant]}),...['inactive','revoked','LINE_A','admin','deleted','missing'].map(login=>request(plan,{selectedLogins:[login]})),request(plan,{action:'apply'}),request(plan,{action:'apply',previewToken:preview.previewToken,confirmed:true,grants:[dep]})])await assert.rejects(applyPermissionSetup(c.db,body,actor),e=>e.status===400);
 await assert.rejects(applyPermissionSetup(c.db,request(plan),{isAdmin:false}),e=>e.status===403);await assert.rejects(applyPermissionSetup(c.db,request(plan),{isAdmin:true,line:'A'}),e=>e.status===403);assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='permission_preview'),before);
 await c.put('department_permissions','KHO',{active:true,permissions:dep+' · '+old});const changed=await records(c.db);await assert.rejects(applyPermissionSetup(c.db,{...request(plan),action:'apply',previewToken:preview.previewToken,confirmed:true},actor),e=>e.status===409);assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='permission_preview'),changed.filter(r=>r.entity!=='permission_preview'));
 }finally{await c.close();}
});
test('HTTP route authenticates Admin, enforces origin, supports preview/apply, and next session reads persisted grants',async()=>{
 const c=await fixture();try{
 const p=await passwordRecord('1234');for(const login of ['admin','untouched','custom'])await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,'test').run();
 const env={DB:c.db,FILES:c.bucket};const call=(body,cookie='',origin='https://test.invalid')=>siteApi(new Request('https://test.invalid/api/user-permission-setup',{method:body?'POST':'GET',headers:{cookie,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
 const login=async who=>{const r=await siteApi(new Request('https://test.invalid/api/auth/login',{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json'},body:JSON.stringify({login:who,password:'1234'})}),env);assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
 const cookie=await login('admin'),viewer=await login('untouched');assert.equal((await call()).status,401);assert.equal((await call(null,viewer)).status,403);assert.equal((await call({},cookie,'https://elsewhere.test')).status,403);
 const plan=await(await call(null,cookie)).json();const preview=await(await call(request(plan),cookie)).json();assert.equal(preview.changedUsers,2);
 const saved=await call({...request(plan),action:'apply',confirmed:true,previewToken:preview.previewToken},cookie);assert.equal(saved.status,200);assert.equal((await saved.json()).ok,true);
 const userCookie=await login('untouched');const principal=await sitePrincipal(new Request('https://test.invalid/api/site-session',{headers:{cookie:userCookie}}),env);assert.deepEqual(principal.grants,withBusinessViews([dep]));const customCookie=await login('custom');const changedPrincipal=await sitePrincipal(new Request('https://test.invalid/api/site-session',{headers:{cookie:customCookie}}),env);assert.deepEqual(changedPrincipal.grants,withBusinessViews([old,grant]));
 assert.deepEqual((await(await call(null,cookie)).json()).users.find(u=>u.login==='custom').before,[old,grant]);
 }finally{await c.close();}
});
test('CAS race cannot write audit or grants; failed batch rolls back all selected users',async()=>{
 const c=await fixture();try{
 let plan=await readPermissionSetup(c.db,actor),preview=await applyPermissionSetup(c.db,request(plan),actor);
 const raceDb={prepare:sql=>c.db.prepare(sql),batch:async statements=>{await c.put('users','untouched',{login:'untouched',active:true,department:'KHO',name:'Concurrent edit'});return c.db.batch(statements);}};
 await assert.rejects(applyPermissionSetup(raceDb,{...request(plan),action:'apply',previewToken:preview.previewToken,confirmed:true},actor),e=>e.status===409);
 assert.equal((await c.get('permissions','custom')).permissions,old);assert.equal(await c.get('permissions','department'),null);assert.equal((await c.db.prepare("SELECT COUNT(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,0);
 plan=await readPermissionSetup(c.db,actor);preview=await applyPermissionSetup(c.db,request(plan),actor);
 await c.db.prepare("CREATE TRIGGER block_second_permission BEFORE INSERT ON app_records WHEN NEW.entity='permissions' AND NEW.record_key='department' BEGIN SELECT RAISE(ABORT,'TEST rollback'); END").run();
 const before=await records(c.db);await assert.rejects(applyPermissionSetup(c.db,{...request(plan),action:'apply',previewToken:preview.previewToken,confirmed:true},actor));assert.deepEqual((await records(c.db)).filter(r=>r.entity!=='permission_preview'),before.filter(r=>r.entity!=='permission_preview'));
 }finally{await c.close();}
});

test('rejects case-fold duplicate identities, mismatched user and personal record keys before writes',async()=>{
 for(const [entity,key,payload] of [
  ['users','CUSTOM',{login:'CUSTOM',active:true,department:'KHO'}],
  ['users','different',{login:'another',active:true,department:'KHO'}],
  ['permissions','custom',{login:'untouched',active:true,permissionMode:'CUSTOM',permissions:old}],
 ]){const c=await fixture();try{await c.put(entity,key,payload);await assert.rejects(readPermissionSetup(c.db,actor),e=>e.status===409);assert.equal((await c.db.prepare("SELECT COUNT(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,0);}finally{await c.close();}}
});
test('preview receipt is opaque, actor-bound, required and cannot be reused',async()=>{
 const c=await fixture();try{const plan=await readPermissionSetup(c.db,actor),body=request(plan);
 const forged=await (await import('../worker/password-auth.mjs')).tokenHash(JSON.stringify({revision:plan.revision,selectedLogins:[...body.selectedLogins].sort(),grants:[...body.grants].sort()}));
 await assert.rejects(applyPermissionSetup(c.db,{...body,action:'apply',previewToken:forged,confirmed:true},actor),e=>e.status===400);
 const preview=await applyPermissionSetup(c.db,body,actor);assert.notEqual(preview.previewToken,forged);
 await assert.rejects(applyPermissionSetup(c.db,{...body,action:'apply',previewToken:preview.previewToken,confirmed:true},{isAdmin:true,userId:'another-admin'}),e=>e.status===400);
 const saved=await applyPermissionSetup(c.db,{...body,action:'apply',previewToken:preview.previewToken,confirmed:true},actor);assert.equal(saved.ok,true);
 await assert.rejects(applyPermissionSetup(c.db,{...body,action:'apply',previewToken:preview.previewToken,confirmed:true},actor));
 }finally{await c.close();}
});
