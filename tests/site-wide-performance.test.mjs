import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root,records} from '../scripts/local/database.mjs';
import {siteApi,sitePrincipal} from '../worker/site-api.mjs';
import {sessionUser,tokenHash,isQuickLineUser} from '../worker/password-auth.mjs';
import {observeReadDatabase} from '../worker/read-performance.mjs';
import {readCapacity,capacityFromRecords,mutateCapacity} from '../scripts/local/capacity.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';

// Independent pre-optimization implementation for parity, never LIVE data.
async function legacySession(request,db){
 const token=request.headers.get('cookie')?.split('=')[1];if(!token)return null;
 const row=await db.prepare('SELECT login,credential_version FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL AND expires_at>?').bind(await tokenHash(token),Date.now()).first();if(!row)return null;
 const account=await db.prepare('SELECT credential_version,password_hash FROM auth_accounts WHERE login=?').bind(row.login).first();if(!account||Number(account.credential_version)!==Number(row.credential_version))return null;
 const record=await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='users' AND (lower(record_key)=lower(?) OR lower(json_extract(payload,'$.email'))=lower(?)) ORDER BY CASE WHEN lower(record_key)=lower(?) THEN 0 ELSE 1 END LIMIT 1").bind(row.login,row.login,row.login).first();
 const p=record?JSON.parse(record.payload):null,user=p&&p.active===true&&!p._deleted?{...p,login:p.login||record.record_key}:null;
 if(account.password_hash==='QUICK_LINE')return isQuickLineUser(user)?{...user,role:'USER',email:null,department:'QLSX',isSetupAdmin:false}:null;
 return user?.authMode==='quick_line'?null:user;
}
const fixture=async()=>{const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'whole-site-performance-')));await migrate(c.db);return c;};
const write=(db,entity,key,payload)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(entity,key,JSON.stringify(payload),'TEST','2026-10-17').run();
const request=(token,path='/api/site-session',body)=>new Request('https://test.invalid'+path,{method:body?'POST':'GET',headers:{cookie:`__Host-onspa_session=${token}`,origin:'https://test.invalid','content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});

test('one fresh session statement matches old identity checks and immediately observes each credential/account change',async()=>{
 const c=await fixture(),token='b'.repeat(64),req=request(token);const db=c.db;
 try{
  await db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind('TEST_USER','fixture','salt',100000,'TEST').run();
  await db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(token),'TEST_USER',1,Date.now()+600000,'TEST').run();
  // A conflicting email must never outrank the matching record key, even when
  // the preferred user was locked or deleted.
  await write(db,'users','OTHER',{login:'OTHER',email:'TEST_USER',active:true,role:'SUPER_ADMIN'});
  for(const payload of [{login:'TEST_USER',active:true,role:'USER'},{active:true,role:'USER'},{login:'TEST_USER',active:false},{login:'TEST_USER',active:true,_deleted:true},{login:'TEST_USER',active:true,authMode:'quick_line',line:'A'}]){
   await write(db,'users','test_user',payload);
   const before=await records(db),old=observeReadDatabase(db),fresh=observeReadDatabase(db);
   assert.deepEqual(await sessionUser(req,fresh.database),await legacySession(req,old.database));
   assert.equal(fresh.summary().calls,1);assert.equal(old.summary().calls,3);
   assert.deepEqual(await records(db),before);
  }
  await db.prepare("DELETE FROM app_records WHERE entity='users' AND record_key='test_user'").run();
  assert.deepEqual(await sessionUser(req,db),await legacySession(req,db),'legacy email fallback is preserved');
  await db.prepare('UPDATE auth_accounts SET credential_version=2').run();assert.equal(await sessionUser(req,db),null);
  await db.prepare('UPDATE auth_accounts SET credential_version=1').run();assert.equal((await sessionUser(req,db)).login,'OTHER');
  await db.prepare('UPDATE auth_sessions SET revoked_at=1').run();assert.equal(await sessionUser(req,db),null);
  await db.prepare('UPDATE auth_sessions SET revoked_at=NULL,expires_at=0').run();assert.equal(await sessionUser(req,db),null);
  await db.prepare('UPDATE auth_sessions SET expires_at=?').bind(Date.now()+600000).run();await db.prepare('DELETE FROM auth_accounts').run();assert.equal(await sessionUser(req,db),null);
 }finally{await c.close();}
});

test('normal account uses two fresh principal reads; calendar GET one snapshot and successful save two operations with unchanged conflict guards',async()=>{
 const c=await fixture(),db=c.db,token='c'.repeat(64),week='2030-04-01';
 try{
  await write(db,'users','TEST_MANAGER',{login:'TEST_MANAGER',active:true,role:'SUPER_ADMIN',department:'TEST_DEPT'});
  await db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind('TEST_MANAGER','fixture','salt',100000,'TEST').run();
  await db.prepare('INSERT INTO auth_sessions VALUES(?,?,?,?,NULL,?)').bind(await tokenHash(token),'TEST_MANAGER',1,Date.now()+600000,'TEST').run();
  await write(db,'permissions','TEST_MANAGER',{login:'TEST_MANAGER',active:true,permissionMode:'DEPARTMENT'});
  await write(db,'department_permissions','TEST_DEPT',{active:true,permissions:'Quản lý sản xuất / Capacity tuần / Xem · Quản lý sản xuất / Capacity tuần / Sửa'});
  const observed=observeReadDatabase(db),actor=await sitePrincipal(request(token),{DB:observed.database});assert.equal(observed.summary().calls,2);
  assert.ok(actor.grants.includes('Quản lý sản xuất / Capacity tuần / Sửa'));
  await write(db,'employees','TEST_A',{name:'Synthetic A',line:'A',active:true});await write(db,'employees','TEST_B',{name:'Synthetic B',line:'B',active:true});
  await write(db,'capacity','legacy',{week, line:'C',_deleted:true});
  let all=await records(db),expected=capacityFromRecords(all.filter(r=>r.entity==='capacity').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)})),all.filter(r=>r.entity==='employees').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)})),week,actor);
  const get=observeReadDatabase(db);assert.deepEqual(await readCapacity(get.database,week,actor),expected);assert.equal(get.summary().calls,1);assert.deepEqual(await records(db),all);
  const body={action:'save',week,revision:0,lines:['A','B'],inputs:Object.fromEntries(['A','B'].map(line=>[line,newDailyCapacity(week,line).input]))};
  const save=observeReadDatabase(db),saved=await mutateCapacity(save.database,body,actor);assert.equal(save.summary().calls,2,'one consistent read then existing guarded write, formerly five operations');assert.equal(saved.revision,1);
  await assert.rejects(()=>mutateCapacity(db,body,actor),{status:409});
  const post=await siteApi(request(token,'/api/capacity',{...body,revision:1}),{DB:db,FILES:c.bucket});assert.equal(post.status,200);
  await db.prepare('UPDATE auth_sessions SET revoked_at=1').run();const before=await records(db);
  assert.equal((await siteApi(request(token,'/api/capacity',{...body,revision:2}),{DB:db,FILES:c.bucket})).status,401);assert.deepEqual(await records(db),before);
  await assert.rejects(()=>mutateCapacity(db,{...body,revision:2},{login:'edit-without-view',grants:['Quản lý sản xuất / Capacity tuần / Sửa']}),{status:403});
  const malformedWeek='2030-04-08';await write(db,'capacity',malformedWeek,{oldFormat:true});const retained=await records(db);
  await assert.rejects(()=>mutateCapacity(db,{...body,week:malformedWeek},actor),{status:409});assert.deepEqual(await records(db),retained,'legacy envelope cannot be replaced by a fresh calendar');
 }finally{await c.close();}
});
