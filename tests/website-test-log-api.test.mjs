import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,records,root} from '../scripts/local/database.mjs';
import {adminReadResponse} from '../lib/admin-readonly.mjs';
import {commitRecordWithAudit} from '../lib/record-mutation-audit.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
const at='2026-10-16T03:00:00.000Z';
async function fixture(){const base=resolve(root,'.local-data/tests');mkdirSync(base,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(base,'test-log-')));await migrate(c.db);return c;}
test('new administrative log denies non-admins and writes before touching the database',async()=>{
 const db={prepare(){throw Error('Unexpected database access');}};
 assert.equal((await adminReadResponse({path:'/api/website-test-log',method:'GET',authorized:false,db})).status,403);
 assert.equal((await adminReadResponse({path:'/api/website-test-log',method:'POST',authorized:true,db})).status,405);
});
test('local record audit commits atomically, trusts server actor, excludes identical writes, and rejects failed CAS',async()=>{
 const c=await fixture();try{
  const entity='departments',key='TEST',actor={login:'trusted-user'},after={name:'A',password:'DO-NOT-LOG',nested:{token:'DO-NOT-LOG'}};
  const write=c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(after),actor.login,at);
  assert.equal((await commitRecordWithAudit(c.db,write,{entity,key,before:null,after,actor,at})).meta.changes,1);
  let logs=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").all()).results;
  assert.equal(logs.length,1);assert.equal(JSON.parse(logs[0].payload).actor,'trusted-user');assert.equal(logs[0].payload.includes('DO-NOT-LOG'),false);
  const unchanged=c.db.prepare('UPDATE app_records SET payload=? WHERE entity=? AND record_key=?').bind(JSON.stringify(after),entity,key);
  await commitRecordWithAudit(c.db,unchanged,{entity,key,before:after,after,actor,at});
  const stale=c.db.prepare('UPDATE app_records SET payload=? WHERE entity=? AND record_key=? AND payload=?').bind('{"name":"B"}',entity,key,'stale');
  assert.equal((await commitRecordWithAudit(c.db,stale,{entity,key,before:after,after:{name:'B'},actor,at})).meta.changes,0);
  logs=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='admin_audit'").all()).results;assert.equal(logs.length,1);
  await c.db.prepare("CREATE TRIGGER audit_failure BEFORE INSERT ON app_records WHEN NEW.entity='admin_audit' BEGIN SELECT RAISE(ABORT,'test audit failure'); END").run();
  const change=c.db.prepare('UPDATE app_records SET payload=? WHERE entity=? AND record_key=?').bind('{"name":"C"}',entity,key);
  await assert.rejects(()=>commitRecordWithAudit(c.db,change,{entity,key,before:after,after:{name:'C'},actor,at}));
  const saved=await c.db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();assert.deepEqual(JSON.parse(saved.payload),after,'failed audit must roll back business change');
 }finally{await c.close();}
});
test('Site route uses admin gate, passes filters, and creates no log for repeated reads/searches',async()=>{
 const c=await fixture();try{
  const cookies={};for(const [login,role]of[['admin-log','Super Admin'],['viewer-log','USER']]){
   const p=await passwordRecord('1234');await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,name:login,active:true,role}),login,at),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,at)]);
   const response=await siteApi(new Request('https://test.invalid/api/auth/login',{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json'},body:JSON.stringify({login,password:'1234'})}),{DB:c.db,FILES:c.bucket});assert.equal(response.status,200);cookies[login]=response.headers.get('set-cookie').split(';')[0];
  }
  await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit','change-1',JSON.stringify({entity:'departments',key:'D1',actor:'admin-log',at,before:null,after:{name:'Test',password:'NEVER-SHOW'}}),'admin-log',at).run();
  const read=async(user,suffix='')=>siteApi(new Request('https://test.invalid/api/website-test-log'+suffix,{headers:user?{cookie:cookies[user]}:{}}),{DB:c.db,FILES:c.bucket});
  assert.equal((await read(null)).status,401);assert.equal((await read('viewer-log')).status,403);
  const before=await records(c.db);
  const response=await read('admin-log','?actor=admin-log&entity=departments&action=add&from=2026-10-16&to=2026-10-16');assert.equal(response.status,200);const result=await response.json();assert.equal(result.entries.length,1);assert.equal(result.entries[0].record,'D1');assert.equal(JSON.stringify(result).includes('NEVER-SHOW'),false);assert.equal(result.entries.some(e=>e.operation==='LOGIN'),false);
  assert.equal((await(await read('admin-log','?actor=viewer-log')).json()).total,0);
  await read('admin-log','?q=does-not-match');assert.deepEqual(await records(c.db),before,'audit reading/filtering must never mutate storage');
 }finally{await c.close();}
});
test('cutoff is server-enforced for earlier filters, while older and invalid histories remain unchanged in storage',async()=>{
 const c=await fixture();try{
  const events=[['older','2026-10-15T16:59:59.999Z'],['boundary','2026-10-16T00:00:00+07:00'],['later','2026-10-17T01:00:00+07:00'],['invalid','2026-10-32T01:00:00Z']];
  for(const [id,time]of events)await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',id,JSON.stringify({entity:'departments',key:id,actor:id,at:time,before:null,after:{name:id}}),'fixture',time).run();
  const before=await records(c.db);const result=await adminReadResponse({path:'/api/website-test-log',method:'GET',authorized:true,db:c.db,searchParams:new URLSearchParams({from:'2000-01-01'})});
  assert.equal(result.body.total,2);assert.deepEqual(result.body.entries.map(e=>e.record).sort(),['boundary','later']);assert.equal(result.body.actors.some(a=>a.id==='older'||a.id==='invalid'),false);assert.equal(result.body.startsAt,'2026-10-15T17:00:00.000Z');
  const later=await adminReadResponse({path:'/api/website-test-log',method:'GET',authorized:true,db:c.db,searchParams:new URLSearchParams({from:'2026-10-17'})});assert.equal(later.body.total,1);assert.equal(later.body.entries[0].record,'later');assert.deepEqual(await records(c.db),before);
 }finally{await c.close();}
});
test('history hydration is capped by bytes before transport and discloses omitted payloads',async()=>{
 const c=await fixture();try{
  const text='x'.repeat(1024*1024);for(let i=0;i<9;i++)await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit',String(i),JSON.stringify({entity:'forecast',key:String(i),actor:'u',at,before:null,after:{text}}),'u',at).run();
  const result=await adminReadResponse({path:'/api/website-test-log',method:'GET',authorized:true,db:c.db});assert.equal(result.body.truncated,true);assert.ok(result.body.entries.length>0&&result.body.entries.length<9);assert.ok(JSON.stringify(result.body).length<100000);assert.equal((await c.db.prepare("SELECT COUNT(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,9);
 }finally{await c.close();}
});
test('warning analysis uses deduplicated cutoff history before pagination and never logs reads',async()=>{
 const c=await fixture();try{
  const start=Date.parse('2026-10-15T17:00:00Z');
  for(let i=-1;i<20;i++){const time=new Date(start+i*1000).toISOString();await c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('admin_audit','warning-'+i,JSON.stringify({entity:'sku',key:'S'+i,actor:'test-user',at:time,action:'update',before:{name:'old'},after:{name:'new'}}),'test-user',time).run();}
  const response=await adminReadResponse({path:'/api/website-test-log',method:'GET',authorized:true,db:c.db,searchParams:new URLSearchParams('limit=1')});const result=response.body;
  assert.equal(result.total,20);assert.equal(result.entries.length,1);assert.equal(result.entries[0].warnings[0].code,'rapid_updates');assert.equal(result.entries[0].warnings[0].evidence.count,20);assert.equal(result.entries[0].warnings[0].evidence.eventIds.includes('admin_audit:warning--1'),false);
  assert.equal((await c.db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='admin_audit'").first()).n,21);
 }finally{await c.close();}
});

test('authenticated business rejection and client permission denial both persist without modifying business data',async()=>{
 const c=await fixture();try{
 const login='audit-denied-user',p=await passwordRecord('1234');await c.db.batch([c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind('users',login,JSON.stringify({login,name:login,active:true,role:'USER'}),login,at),c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,at)]);
 const env={DB:c.db,FILES:c.bucket};const make=(path,body,cookie='')=>new Request('https://test.invalid'+path,{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json',cookie},body:JSON.stringify(body)});
 const auth=await siteApi(make('/api/auth/login',{login,password:'1234'}),env),cookie=auth.headers.get('set-cookie').split(';')[0];
 const rejected=await siteApi(make('/api/production-report',{action:'review',reportId:'TEST-MISSING',approve:true},cookie),env);assert.equal(rejected.status,403);
 let rows=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='website_action_audit'").all()).results;assert.equal(rows.length,1);const server=JSON.parse(rows[0].payload);assert.equal(server.outcome,'denied');assert.equal(server.actorId,login);assert.equal(server.record,'TEST-MISSING');
 const report=await siteApi(make('/api/action-audit',{id:'12345678-12345678',outcome:'ui-blocked',operation:'Lưu ghi nhận',menu:'Lịch SX thực tế',reasonCode:'permission',actorId:'forged'},cookie),env);assert.equal(report.status,200);
 rows=(await c.db.prepare("SELECT payload FROM app_records WHERE entity='website_action_audit'").all()).results;assert.equal(rows.length,2);const client=rows.map(r=>JSON.parse(r.payload)).find(p=>p.evidence==='client');assert.equal(client.actorId,login);assert.match(client.reason,/quyền/);
 assert.equal((await c.db.prepare("SELECT COUNT(*) n FROM app_records WHERE entity='production_report'").first()).n,0);
 const result=await adminReadResponse({path:'/api/website-test-log',method:'GET',authorized:true,db:c.db,searchParams:new URLSearchParams({from:'2026-99-99',outcome:'denied'})});assert.equal(result.body.total,1);
 }finally{await c.close();}
});
