import test from 'node:test';import assert from 'node:assert/strict';
import {workflowGetFixture} from './helpers/workflow-get-fixture.mjs';
import {readProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {workflowReadSnapshot,observeReadDatabase} from '../worker/read-performance.mjs';
import {records} from '../scripts/local/database.mjs';
import {scheduleHeadcount} from '../lib/production-schedule-headcount.mjs';
const admin={login:'SYNTHETIC',isAdmin:true};
const fields=['orders','employees','payrollEmployees','actualSchedules','approvedSchedules','rights'];
test('compact schedule read preserves every calendar, employee, history, Line boundary and headcount while avoiding repeated scans',async t=>{
 const c=await workflowGetFixture(80);try{
  const raw=await records(c.db);
  for(const actor of [admin,{...admin,line:'A'},{...admin,line:'B'}]){
   const slow=observeReadDatabase(c.db),fast=observeReadDatabase(c.db);
   const options={includeDerivedHours:false,includeJournalHours:false,stageValidation:true,observationAt:'2026-11-02T09:00:00+07:00'};
   const before=await readProductionWorkflow(workflowReadSnapshot(slow.database),actor,[],options);
   const after=await readProductionWorkflow(workflowReadSnapshot(fast.database),actor,[],{...options,compactAudit:true});
   for(const key of fields)assert.deepEqual(after[key],before[key],key);
   const withoutSource=events=>events.map(({sourceSnapshot,...event})=>event);assert.deepEqual(withoutSource(after.events),withoutSource(before.events));
   for(const reference of before.approvedSchedules)for(const day of reference.days){const input={reference,line:reference.line,day,employees:before.payrollEmployees,restrictedLine:!!actor.line};assert.deepEqual(scheduleHeadcount({...input,events:after.events}),scheduleHeadcount({...input,events:before.events}));}
   assert.deepEqual(await records(c.db),raw);
   t.diagnostic(JSON.stringify({synthetic:true,line:actor.line||'all',beforeCalls:slow.summary().calls,afterCalls:fast.summary().calls}));
   assert.ok(fast.summary().calls<slow.summary().calls);
  }
 }finally{await c.close();}
});

test('Worker schedule profile matches work calendar and preserves stored records, including activated legacy mode',async()=>{
 const c=await workflowGetFixture(12);try{
  const {reviewer}=await import('./helpers/daily-output-reviewer.mjs'),{activateDailyPolicy}=await import('./helpers/activate-daily-policy.mjs');
  const put=(entity,key,value)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(value),'SYNTHETIC','2026-11-02').run();const call=await reviewer({...c,put});
  for(const activated of [false,true]){
   if(activated)await activateDailyPolicy(c.db,{effectiveFrom:'2026-11-02'});
   const raw=await records(c.db),before=await call('/api/production-workflow?view=work'),after=await call('/api/production-workflow?view=schedule');
   assert.equal(before.status,200);assert.equal(after.status,200);
   for(const key of fields)assert.deepEqual(after.body[key],before.body[key],key);
   const events=rows=>rows.map(({sourceSnapshot,...row})=>row);assert.deepEqual(events(after.body.events),events(before.body.events));
   assert.deepEqual(after.body.dailyOutputPolicy,before.body.dailyOutputPolicy);assert.deepEqual(await records(c.db),raw);
  }
 }finally{await c.close();}
});

test('authenticated Quick Line A/B schedule profile remains own-Line only and unauthenticated reads fail',async()=>{
 const {dailyFixture}=await import('./helpers/daily-output-fixture.mjs'),{siteApi}=await import('../worker/site-api.mjs');
 await dailyFixture(async c=>{
  const origin='https://test.invalid',env={DB:c.db,FILES:c.bucket};
  const call=(path,cookie='',body)=>siteApi(new Request(origin+path,{method:body?'POST':'GET',headers:{cookie,origin,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}),env);
  await c.put('in_transit','SYNTHETIC-B',{...c.order,id:'SYNTHETIC-B',lsxCode:'SYNTHETIC-B',line:'B'});
  assert.equal((await call('/api/production-workflow?view=schedule')).status,401);
  for(const line of ['A','B']){
   await c.put('users','LINE_'+line,{login:'LINE_'+line,line,authMode:'quick_line',active:true,role:'USER'});
   await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,?,?)').bind('LINE_'+line,'QUICK_LINE','',0,1,'SYNTHETIC').run();
   const login=await call('/api/auth/line-login','',{line});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0];
   const read=await call('/api/production-workflow?view=schedule&line=all',cookie);assert.equal(read.status,200);const data=await read.json();assert.equal(data.rights.line,line);assert.ok(data.orders.length);assert.ok(data.orders.every(row=>row.line===line));assert.ok(data.approvedSchedules.every(row=>row.line===line));
  }
 });
});
