import test from 'node:test';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {mkdirSync,mkdtempSync} from 'node:fs';
import {resolve} from 'node:path';
import {openDatabase,migrate,root} from '../scripts/local/database.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {previousSafetyGroup} from '../lib/safety-linked-pair.mjs';
import {recordRevision} from '../lib/record-revision.mjs';
import {vietnamDate} from '../lib/vietnam-calendar.mjs';
const now=new Date().toISOString(),today=vietnamDate(now),rows=[{id:'R',from:0,to:10,days:2,status:'Đang áp dụng'}];
const group=(id,status='Đang áp dụng')=>({id,group:'leadtime',rows,status,confirmedAt:now,effectiveFrom:today,effectiveTo:''});
const rule=g=>({id:g.id,status:g.status,leadTimeRules:g.rows,confirmedAt:g.confirmedAt,effectiveFrom:g.effectiveFrom,effectiveTo:g.effectiveTo});
async function fixture(){
 const dir=resolve(root,'.local-data/tests');mkdirSync(dir,{recursive:true});const c=await openDatabase(mkdtempSync(resolve(dir,'safety-pair-api-')));await migrate(c.db);
 const cookies={};const env={DB:c.db,FILES:c.bucket};
 const call=(body,who='admin')=>siteApi(new Request('https://test.invalid/api/linked-records',{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json',cookie:cookies[who]||''},body:JSON.stringify(body)}),env);
 const put=async(entity,p)=>c.db.prepare('INSERT OR REPLACE INTO app_records VALUES(?,?,?,?,?)').bind(entity,p.id,JSON.stringify(p),'fixture','fixture').run();
 for(const [login,role] of [['admin','Super Admin'],['viewer','viewer']]){
  await put('users',{id:login,login,role,active:true});const testPassword=randomUUID();const p=await passwordRecord(testPassword);await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,'fixture').run();
  const response=await siteApi(new Request('https://test.invalid/api/auth/login',{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json'},body:JSON.stringify({login,password:testPassword})}),env);assert.equal(response.status,200);cookies[login]=response.headers.get('set-cookie').split(';')[0];
 }
 const read=async(entity,id)=>{const r=await c.db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,id).first();return r?.payload??null;};
 const op=async(entity,p)=>({entity,key:p.id,payload:p,expectedRevision:await recordRevision(await read(entity,p.id)),audit:{type:'fixture transition'}});
 const snapshot=async()=> (await c.db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('safety_rule_groups','safety_rules','safety_rule_audit','linked_write_guard') ORDER BY entity,record_key").all()).results;
 return {...c,env,call,put,read,op,snapshot};
}
async function pair(c,g,r=rule(g)){await c.put('safety_rule_groups',g);await c.put('safety_rules',r);}
async function operations(c,g,r=rule(g)){return [await c.op('safety_rule_groups',g),await c.op('safety_rules',r)];}

test('HTTP rejects one-sided Safety cancellation, confirmation, replacement and mismatched states; paired cancellation is atomic',async()=>{
 const c=await fixture();try{
  const g=group('PAIR');await pair(c,g);const cancelled={...g,status:'Đã hủy'},cancelRule={...rule(g),status:'Đã hủy xác nhận'};
  await c.put('safety_rule_groups',{id:'DRAFT',group:'leadtime',rows,status:'Nháp',effectiveFrom:'',effectiveTo:''});
  await c.put('safety_rule_groups',group('BROKEN'));
  const before=await c.snapshot();
  for(const body of [
   {kind:'safety-rule',operations:[await c.op('safety_rules',rule(group('DRAFT')))]},
   {kind:'safety-group',operations:[await c.op('safety_rule_groups',cancelled)]},
   {kind:'safety-rule',operations:[await c.op('safety_rules',cancelRule)]},
   {kind:'safety-group',operations:await operations(c,cancelled,rule(g))},
   {kind:'safety-group',operations:await operations(c,g,cancelRule)},
   {kind:'safety-group',operations:[await c.op('safety_rule_groups',group('NEW'))]},
   {kind:'safety-group',operations:await operations(c,group('NEW'),{...rule(group('NEW')),leadTimeRules:[]})},
   {kind:'safety-group',operations:await operations(c,{...group('BROKEN'),status:'Đã hủy'},{...rule(group('BROKEN')),status:'Đã hủy xác nhận'})},
   {kind:'safety-group',operations:[await c.op('safety_rule_groups',{...g,status:'Hết hiệu lực',effectiveTo:today}),await c.op('safety_rule_groups',group('NEW')),await c.op('safety_rules',rule(group('NEW')))]},
  ]){const response=await c.call(body);assert.equal(response.status,409,await response.text());assert.deepEqual(await c.snapshot(),before);}
  const result=await c.call({kind:'safety-group',operations:await operations(c,cancelled,cancelRule)});assert.equal(result.status,200,await result.text());
  assert.equal(JSON.parse(await c.read('safety_rule_groups','PAIR')).status,'Đã hủy');assert.equal(JSON.parse(await c.read('safety_rules','PAIR')).status,'Đã hủy xác nhận');
  assert.equal((await c.snapshot()).filter(x=>x.entity==='safety_rule_audit').length,2);
 }finally{await c.close();}
});

test('HTTP confirms and replaces complete Safety pairs; denied permission and stale/concurrent counterpart leave no partial writes',async()=>{
 const c=await fixture();try{
  const g=group('OLD');
  const displayDefault=group('SD-LT-V1');
  assert.equal(previousSafetyGroup([displayDefault],{...g,sourceId:displayDefault.id},()=>false),undefined,'first confirmation must not expire display-only defaults');
  assert.equal(previousSafetyGroup([displayDefault],{...g,sourceId:displayDefault.id},()=>true),displayDefault);
  const body={kind:'safety-group',operations:await operations(c,g)};
  const empty=await c.snapshot();const denied=await c.call(body,'viewer');assert.equal(denied.status,403);assert.deepEqual(await c.snapshot(),empty);
  assert.equal((await c.call(body)).status,200);
  const next=group('NEW'),closed={...g,status:'Hết hiệu lực',effectiveTo:today};
  const replace={kind:'safety-group',operations:[...await operations(c,closed),...await operations(c,next)]};
  const original=await c.snapshot();replace.operations[1].expectedRevision='stale';assert.equal((await c.call(replace)).status,409);assert.deepEqual(await c.snapshot(),original);
  replace.operations[1]=await c.op('safety_rules',rule(closed));assert.equal((await c.call(replace)).status,200);
  const cancel={kind:'safety-group',operations:await operations(c,{...next,status:'Đã hủy'},{...rule(next),status:'Đã hủy xác nhận'})};
  const before=await c.snapshot();let ran=false;
  c.env.DB={prepare:sql=>c.db.prepare(sql),batch:async statements=>{
   if(!ran){ran=true;await c.put('safety_rules',{...rule(next),note:'concurrent edit'});}return c.db.batch(statements);
  }};
  assert.equal((await c.call(cancel)).status,409);assert.equal(ran,true);
  assert.equal(JSON.parse(await c.read('safety_rule_groups','NEW')).status,'Đang áp dụng');assert.equal(JSON.parse(await c.read('safety_rules','NEW')).status,'Đang áp dụng');
  assert.equal((await c.snapshot()).filter(x=>x.entity==='safety_rule_audit').length,before.filter(x=>x.entity==='safety_rule_audit').length);
  c.env.DB=c.db;const fresh={kind:'safety-group',operations:await operations(c,{...next,status:'Đã hủy'},{...JSON.parse(await c.read('safety_rules','NEW')),status:'Đã hủy xác nhận'})};
  const results=await Promise.all([c.call(fresh),c.call(fresh)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
 }finally{await c.close();}
});

test('HTTP leaves unmapped forecast/situation groups and standalone legacy rules independent',async()=>{
 const c=await fixture();try{
  for(const type of ['forecast','situation']){const g={...group(type),group:type};assert.equal((await c.call({kind:'safety-group',operations:[await c.op('safety_rule_groups',g)]})).status,200);}
  const legacyBody={kind:'safety-rule',operations:[await c.op('safety_rules',rule(group('LEGACY')))]};
  let raced=false;c.env.DB={prepare:sql=>c.db.prepare(sql),batch:async statements=>{if(!raced){raced=true;await c.put('safety_rule_groups',{id:'LEGACY',group:'leadtime',status:'Nháp',rows});}return c.db.batch(statements);}};
  assert.equal((await c.call(legacyBody)).status,409);assert.equal(raced,true);assert.equal(await c.read('safety_rules','LEGACY'),null);
  c.env.DB=c.db;assert.equal((await c.call({kind:'safety-rule',operations:[await c.op('safety_rules',rule(group('STANDALONE')))]})).status,200);
 }finally{await c.close();}
});
