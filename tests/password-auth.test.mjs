import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root,records} from '../scripts/local/database.mjs';
import {passwordAuth,passwordRecord,tokenHash} from '../worker/password-auth.mjs';
test('Production password activation, persistent HttpOnly sessions, revocation and abuse limits',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const path=mkdtempSync(resolve(base,'auth-'));let c=await openDatabase(path);
 const setup={login:'fixture-admin',token:crypto.randomUUID(),expiresAt:Date.now()+3600000};
 const call=(route,body,cookie='',origin='https://test.invalid')=>passwordAuth(new Request('https://test.invalid/api/auth/'+route,{method:body?'POST':'GET',headers:{cookie,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),{DB:c.db,ONSPA_INITIAL_ADMIN:JSON.stringify(setup)});
 try{
  await migrate(c.db);
  assert.equal((await(await call('session')).json()).authenticated,false);
  assert.equal((await call('activate',{token:'wrong',password:'1234',passwordConfirm:'1234'})).status,403);
  assert.equal((await records(c.db)).length,0);
  const activation={token:setup.token,password:'1234',passwordConfirm:'1234'};
  assert.equal((await call('activate',activation)).status,200);
  assert.equal((await call('activate',activation)).status,409,'single use; cannot overwrite');
  assert.equal((await records(c.db)).length,2,'only new account and audit');
  assert.equal((await call('login',{login:setup.login,password:'4321'})).status,401);
  assert.equal((await call('login',{login:setup.login,password:'1234'},'','https://evil.invalid')).status,403);
  const login=await call('login',{login:setup.login,password:'1234'});assert.equal(login.status,200);
  const header=login.headers.get('set-cookie');for(const flag of ['HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(header.includes(flag));
  const cookie=header.split(';')[0];
  const adminLogin=await call('login',{login:setup.login,password:'1234',loginMode:'admin'});assert.equal(adminLogin.status,200);
  for(let i=0;i<7;i++)assert.equal((await call('login',{login:setup.login,password:'1234',loginMode:'admin'})).status,200,'normal Admin sign-ins must not consume failure allowance');
  for(let i=0;i<5;i++)assert.equal((await call('login',{login:setup.login,password:'0000',loginMode:'admin'})).status,401);
  assert.equal((await call('login',{login:setup.login,password:'0000',loginMode:'admin'})).status,429,'failed passwords still have a limit');
  assert.equal((await call('login',{login:setup.login,password:'1234',loginMode:'admin'})).status,200,'correct password recovers from old counters');
  assert.equal((await call('login',{login:setup.login,password:'0000',loginMode:'admin'})).status,401,'valid sign-in resets the failure counter');
  const viewerPassword=await passwordRecord('5678');
  await c.db.batch([
   c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users','fixture-user',JSON.stringify({login:'fixture-user',email:'user@example.test',active:true,role:'USER'}),setup.login,'fixture'),
   c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind('fixture-user',viewerPassword.hash,viewerPassword.salt,viewerPassword.iterations,'fixture')
  ]);
  const deniedAdmin=await call('login',{login:'user@example.test',password:'5678',loginMode:'admin'});assert.equal(deniedAdmin.status,403);assert.equal((await deniedAdmin.json()).error,'Tài khoản không có quyền quản trị. Vui lòng đăng nhập bằng quyền người dùng phù hợp.');
  const viewerLogin=await call('login',{login:'user@example.test',password:'5678',loginMode:'user'});assert.equal(viewerLogin.status,200,'email login works');
  const viewerCookie=viewerLogin.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('admin/password',{login:'fixture-user',password:'new-pass',passwordConfirm:'new-pass'},viewerCookie)).status,403,'regular user cannot reset passwords');
  assert.equal((await call('admin/password',{login:'fixture-user',password:'new-pass',passwordConfirm:'new-pass'},cookie)).status,200,'admin resets password without storing plaintext');
  assert.equal((await call('login',{login:'user@example.test',password:'new-pass',loginMode:'user'})).status,200,'new password works');
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='users' AND record_key='fixture-user'").bind(JSON.stringify({login:'fixture-user',email:'user@example.test',active:false,role:'USER'})).run();
  assert.equal((await call('login',{login:'fixture-user',password:'new-pass',loginMode:'user'})).status,401,'locked account denied');
  assert.equal((await(await call('session',null,cookie)).json()).user.login,setup.login);
  await c.close();c=await openDatabase(path);await migrate(c.db);
  assert.equal((await(await call('session',null,cookie)).json()).authenticated,true,'survives runtime restart');
  assert.equal((await call('logout',{},cookie)).status,200);
  assert.equal((await(await call('session',null,cookie)).json()).authenticated,false,'old token revoked');
  assert.ok((await records(c.db)).filter(row=>row.entity==='admin_audit').some(row=>JSON.parse(row.payload).action==='LOGOUT'),'logout is audited');
  const next=await call('login',{login:setup.login,password:'1234'});const nextCookie=next.headers.get('set-cookie').split(';')[0];
  await c.db.prepare('UPDATE auth_sessions SET expires_at=0 WHERE token_hash=?').bind(await tokenHash(nextCookie.split('=')[1])).run();
  assert.equal((await(await call('session',null,nextCookie)).json()).authenticated,false,'expired token denied');
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='users' AND record_key=?").bind(JSON.stringify({login:setup.login,active:true,_deleted:true}),setup.login).run();
  assert.equal((await call('login',{login:setup.login,password:'1234'})).status,401,'deleted account remains deleted');
  for(let i=0;i<5;i++)assert.equal((await call('login',{login:'missing',password:'0000'})).status,401);
  assert.equal((await call('login',{login:'missing',password:'0000'})).status,429);
 }finally{await c.close();}
});

test('14-day setup Admin requires private device activation and is disabled server-side',async()=>{
 const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const path=mkdtempSync(resolve(base,'setup-admin-'));const c=await openDatabase(path);
 const activationToken='activation-'+crypto.randomUUID()+crypto.randomUUID(),cookieSecret='cookie-'+crypto.randomUUID()+crypto.randomUUID(),expiresAt=new Date(Date.now()+14*24*3600*1000).toISOString();
 const env={DB:c.db,SETUP_ADMIN_AUTO_LOGIN:'true',SETUP_ADMIN_ACTIVATION_TOKEN:activationToken,SETUP_ADMIN_COOKIE_SECRET:cookieSecret,SETUP_ADMIN_EXPIRES_AT:expiresAt};
 const call=(route,body,cookies='',targetEnv=env)=>passwordAuth(new Request('https://test.invalid/api/auth/'+route,{method:body===undefined?'GET':'POST',headers:{cookie:cookies,origin:'https://test.invalid','content-type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)})}),targetEnv);
 try{
  await migrate(c.db);
  const initial=await(await call('setup-admin/status')).json();assert.equal(initial.enabled,true);assert.equal(initial.authorized,false);
  assert.equal((await call('setup-admin/activate',{token:'wrong'})).status,403);
  assert.equal((await call('setup-admin',{})).status,403,'public button cannot self-elevate');
  const activated=await call('setup-admin/activate',{token:activationToken});assert.equal(activated.status,200);
  const entitlement=activated.headers.get('set-cookie');for(const flag of ['__Host-onspa_setup=','HttpOnly','Secure','SameSite=Strict','Path=/'])assert.ok(entitlement.includes(flag));
  const setupCookie=entitlement.split(';')[0],status=await(await call('setup-admin/status',undefined,setupCookie)).json();assert.equal(status.authorized,true);assert.equal(status.expiresAt,expiresAt);
  const login=await call('setup-admin',{},setupCookie);assert.equal(login.status,200);const sessionCookie=login.headers.get('set-cookie').split(';')[0];
  const session=await(await call('session',undefined,sessionCookie)).json();assert.equal(session.authenticated,true);assert.equal(session.user.login,'SETUP_ADMIN');assert.equal(session.user.role,'SUPER_ADMIN');assert.equal(session.user.isSetupAdmin,true);
  const audits=(await records(c.db)).filter(row=>row.entity==='admin_audit').map(row=>JSON.parse(row.payload));assert.ok(audits.some(row=>row.action==='SETUP_ADMIN_DEVICE_ACTIVATED'&&row.actor==='SETUP_ADMIN'));assert.ok(audits.some(row=>row.action==='LOGIN'&&row.loginMethod==='SETUP_ADMIN_AUTO_LOGIN'));
  assert.equal((await call('logout',{},sessionCookie)).status,200);assert.equal((await(await call('session',undefined,sessionCookie)).json()).authenticated,false);
  assert.equal((await call('setup-admin',{},setupCookie)).status,200,'activated device may sign in again during setup window');
  const disabled={...env,SETUP_ADMIN_AUTO_LOGIN:'false'};assert.equal((await call('setup-admin',{},setupCookie,disabled)).status,403);assert.equal((await(await call('session',undefined,sessionCookie,disabled)).json()).authenticated,false,'disabled flag invalidates setup sessions immediately');
 }finally{await c.close();}
});
