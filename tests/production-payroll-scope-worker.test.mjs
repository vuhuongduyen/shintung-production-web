import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {Miniflare} from 'miniflare';
import {migrate,root,records} from '../scripts/local/database.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
import {newDailyCapacity} from '../lib/capacity.mjs';
import {payrollMonth} from '../lib/production-payroll-month.mjs';
import {fullPayrollFixture,month} from './helpers/payroll-scope-fixture.mjs';

test('compiled Worker keeps Line scope/minimal transfer identity and produces only supported payroll diagnostics without writes',async()=>{
 const base=resolve(root,'dist/server'),entry=resolve(base,'index.js');
 const paths=readdirSync(base,{recursive:true}).filter(p=>p.endsWith('.js')).map(p=>resolve(base,p));
 const runtime=new Miniflare({modules:[entry,...paths.filter(p=>p!==entry)].map(path=>({type:'ESModule',path})),compatibilityDate:'2026-05-15',compatibilityFlags:['nodejs_compat'],cf:false,d1Databases:{DB:'synthetic-payroll-scope'},d1Persist:false,r2Buckets:{FILES:'synthetic-payroll-scope-files'},r2Persist:false,assets:{directory:resolve(root,'dist/client'),binding:'ASSETS',routerConfig:{has_user_worker:true}},outboundService:()=>new Response('Synthetic test blocks external services',{status:503})});
 try{
  const db=await runtime.getD1Database('DB');await migrate(db);const fixture=fullPayrollFixture(),now='2026-10-01T00:00:00Z';
  const put=(entity,id,value)=>db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,id,JSON.stringify(value),'SYNTHETIC',now).run();
  for(const employee of fixture.employees)await put('employees',employee.id,{...employee,privateContact:'SYNTHETIC-PRIVATE-'+employee.id});
  for(const source of fixture.orders){const order={...source,week:'2026-09-28',planId:'SYNTHETIC-PLAN-'+source.line,lsxQty:1000,planQty:1000,planStart:'2026-10-01',planEnd:'2026-10-02',lsxOpenedAt:'2026-10-01',syncStatus:'ĐÃ ĐỒNG BỘ',status:'MỞ'};await put('in_transit',order.id,order);}
  for(const report of fixture.reports)await put('production_report',report.id,{...report,startedAt:month+'-01T08:00:00+07:00',completedAt:month+'-01T17:00:00+07:00',reportedQuantity:100,hours:{hc:1,ot:0,total:1},manualHours:true});
  await put('production_event',fixture.events[0].id,{...fixture.events[0],recordedAt:now});
  for(let i=0;i<5;i++){
   const first=new Date('2026-09-28T00:00:00Z');first.setUTCDate(first.getUTCDate()+i*7);const week=first.toISOString().slice(0,10);
   const days=Array.from({length:7},(_,n)=>{const d=new Date(first);d.setUTCDate(d.getUTCDate()+n);const date=d.toISOString().slice(0,10);return {date,working:date===month+'-01',ot:false,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00'};});
   await put('capacity',week,{schemaVersion:1,week,rows:['A','B'].map(line=>({line,status:'Đã xác nhận',reviewStatus:'approved',version:1,input:{...newDailyCapacity(week,line,100).input,workers:line==='A'?1:2,dailySchedule:days,dailyRoster:days.map(d=>({date:d.date,hc:line==='A'?['SYNTHETIC-A']:['SYNTHETIC-B','SYNTHETIC-B-UNRELATED'],ot:[]}))}}))});
  }
  const password=crypto.randomUUID(),hash=await passwordRecord(password);
  for(const [login,role,line] of [['SYNTHETIC_LINE_A','USER','A'],['SYNTHETIC_FULL','SUPER_ADMIN',null]]){
   await put('users',login,{login,role,line,active:true});
   if(line)await put('permissions',login,{login,active:true,permissions:'Quản lý sản xuất / Hiệu suất / Xem'});
   await db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,hash.hash,hash.salt,hash.iterations,now).run();
  }
  const call=(path,body,cookie='')=>runtime.dispatchFetch('https://synthetic-payroll.invalid'+path,{method:body?'POST':'GET',headers:{origin:'https://synthetic-payroll.invalid',cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  assert.equal((await call('/api/production-workflow')).status,401);
  const login=async id=>{const r=await call('/api/auth/login',{login:id,password,loginMode:id==='SYNTHETIC_FULL'?'admin':'user'});assert.equal(r.status,200);return r.headers.get('set-cookie').split(';')[0];};
  const limitedCookie=await login('SYNTHETIC_LINE_A'),fullCookie=await login('SYNTHETIC_FULL'),before=await records(db);
  const limitedResponse=await call('/api/production-workflow?line=B',null,limitedCookie);assert.equal(limitedResponse.status,200);const limited=await limitedResponse.json();
  assert.equal(limited.rights.line,'A');assert.equal(limited.rights.manager,false);assert.equal(limited.rights.crossLineView,false);
  assert.ok(limited.orders.length&&limited.orders.every(o=>o.line==='A'));assert.ok(limited.approvedSchedules.length&&limited.approvedSchedules.every(s=>s.key.endsWith(':A')));
  assert.deepEqual(Object.keys(limited.payrollEmployees.find(p=>p.id==='SYNTHETIC-B')).sort(),['active','id','line','name']);
  assert.ok(!limited.payrollEmployees.some(p=>p.id==='SYNTHETIC-B-UNRELATED'));assert.ok(!JSON.stringify(limited).includes('SYNTHETIC-PRIVATE-SYNTHETIC-B'));
  const [a]=payrollMonth({...fixture,...limited,schedules:limited.approvedSchedules,employees:limited.payrollEmployees,sessionLine:limited.rights.line});
  assert.deepEqual(a.result.issues,['Cần quyền xem cả Line A và B để phân bổ quỹ chung']);assert.equal(a.result.paid,null);assert.equal(a.result.payments.size,0);assert.ok(Math.abs(a.actual-11.5)<1e-9);
  const fullResponse=await call('/api/production-workflow',null,fullCookie);assert.equal(fullResponse.status,200);const full=await fullResponse.json();
  assert.equal(full.rights.line,null);assert.equal(full.payrollEmployees.find(p=>p.id==='SYNTHETIC-B').startDate,'2020-01-01');
  const both=payrollMonth({...fixture,...full,schedules:full.approvedSchedules,employees:full.payrollEmployees});
  assert.deepEqual(both.map(r=>r.result.issues),[[],[]]);assert.equal(both.reduce((n,r)=>n+r.result.paid+r.result.returned+r.result.unallocated,0),6000000);
  assert.deepEqual(await records(db),before,'reads/calculation do not rewrite data, permissions, fund or existing audit');
 }finally{await runtime.dispose();}
});
