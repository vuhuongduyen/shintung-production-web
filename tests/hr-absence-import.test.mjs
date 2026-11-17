import test from 'node:test';
import assert from 'node:assert/strict';
import {dailyFixture} from './helpers/daily-output-fixture.mjs';
import {mutateProductionWorkflow} from '../scripts/local/production-workflow.mjs';
import {records} from '../scripts/local/database.mjs';
import {previewAbsences} from '../lib/hr-absence-import.mjs';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
import {siteApi} from '../worker/site-api.mjs';
import {passwordRecord} from '../worker/password-auth.mjs';
const hr={login:'TEST-HR',userId:'TEST-HR-ID',grants:['Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt']};
const person={id:'TEST-MINH-ANH',sourceEmployeeId:'TEST001',name:'Minh Anh (thử nghiệm)',line:'A',active:true};
const row={row:2,code:'TEST001',name:person.name,date:'2026-11-16',start:'08:00',end:'17:00',duration:'08:00',leaveCode:'PN',leaveName:'Phép năm',kind:'Nghỉ'};
const input=()=>({importId:crypto.randomUUID(),fileName:'TEST.xlsx',fileHash:'a'.repeat(64),month:'2026-11',rows:[row]});
const fixture=fn=>dailyFixture(async c=>{const before=Date.now;Date.now=()=>Date.parse('2026-11-17T01:00:00Z');try{await c.put('employees',person.id,person);await fn(c);}finally{Date.now=before;}});
const call=(db,action,body,actor=hr)=>mutateProductionWorkflow(db,{...body,action},actor);
async function save(db,body=input()){const preview=await call(db,'hr-import-preview',body);return {body:{...body,previewHash:preview.sourceHash},result:await call(db,'hr-import-save',{...body,previewHash:preview.sourceHash})};}
const eventList=async db=>(await records(db)).filter(r=>r.entity==='production_event').map(r=>JSON.parse(r.payload));
test('read-only preview, actual save, replay, duplicate file and cancel restore scheduled hours without touching manual events',()=>fixture(async c=>{
 const manual={id:'TEST-MANUAL',kind:'line-absence',line:'A',employees:[person.id],absenceType:'Đi trễ',approved:true,effectiveAt:'2026-11-17T01:00:00Z',endsAt:'2026-11-17T01:01:00Z'};await c.put('production_event',manual.id,manual);
 const before=await records(c.db),body=input(),preview=await call(c.db,'hr-import-preview',body);assert.deepEqual(await records(c.db),before);assert.equal(preview.results[0].status,'valid');
 const {result,body:saved}=await save(c.db,body);assert.equal(result.count,1);const after=await records(c.db);assert.equal((await call(c.db,'hr-import-save',saved)).replayed,true);assert.deepEqual(await records(c.db),after);
 assert.equal((await call(c.db,'hr-import-preview',input())).results[0].status,'duplicate');
 const day={date:row.date,working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false};
 const schedule={line:'A',days:[day],roster:[{date:row.date,hc:[person.id],ot:[]}]};
 const hours=async()=>monthlyAttendance({events:await eventList(c.db),schedules:[schedule],employees:[person],month:'2026-11',line:'A',dateFrom:row.date,dateUntil:'2026-11-17'}).people[0];
 assert.equal((await hours()).hc,0);assert.ok(Math.abs((await hours()).absentHc-23/3)<1e-9);
 const check=await call(c.db,'hr-import-cancel-preview',body);assert.equal(check.canCancel,true);assert.deepEqual(await records(c.db),after);
 const cancel=await call(c.db,'hr-import-cancel',{...body,reason:'Chọn nhầm file thử nghiệm'});assert.equal(cancel.count,1);assert.ok(Math.abs((await hours()).hc-23/3)<1e-9);assert.equal((await hours()).absentHc,0);
 assert.deepEqual((await eventList(c.db)).find(e=>e.id===manual.id),manual);
 for(const original of before.filter(r=>r.entity!=='production_cursor'))assert.deepEqual((await records(c.db)).find(r=>r.entity===original.entity&&r.record_key===original.record_key),original);
 const cancelled=await records(c.db);assert.equal((await call(c.db,'hr-import-cancel',{...body,reason:'retry'})).replayed,true);assert.deepEqual(await records(c.db),cancelled);
 assert.equal((await call(c.db,'hr-import-save',saved)).cancelled,true);assert.deepEqual(await records(c.db),cancelled);
 assert.equal((await call(c.db,'hr-import-history',{})).rows[0].status,'cancelled');
}));
test('edited row blocks entire cancellation, preserves edits and all other imported rows',()=>fixture(async c=>{
 const body={...input(),rows:[row,{...row,row:3,date:'2026-11-17'}]},saved=await save(c.db,body),original=saved.result.events[0];
 await c.put('production_event','TEST-EDIT',{...original,id:'TEST-EDIT',supersedes:original.id,endsAt:'2026-11-16T09:00:00Z'});
 const before=await records(c.db),preview=await call(c.db,'hr-import-cancel-preview',body);assert.equal(preview.canCancel,false);assert.equal(preview.issues.length,1);
 await assert.rejects(()=>call(c.db,'hr-import-cancel',{...body,reason:'test'}),{status:409});assert.deepEqual(await records(c.db),before);
}));
test('permission, changed source, invalid row, month close and same-file overlapping rows fail without writes',()=>fixture(async c=>{
 const body=input(),before=await records(c.db);
 for(const actor of [{login:'VIEW',grants:[]},{...hr,line:'A'},{login:'MANAGER',grants:['Quản lý sản xuất / Lịch SX thực tế / Sửa']}])await assert.rejects(()=>call(c.db,'hr-import-preview',body,actor),{status:403});
 const preview=await call(c.db,'hr-import-preview',body);await assert.rejects(()=>call(c.db,'hr-import-save',{...body,rows:[{...row,start:'09:00'}],previewHash:preview.sourceHash}),{status:409});
 for(const rows of [[{...row,code:'MISSING'}],[{...row,name:'Wrong'}],[{...row,date:'2026-10-16'}],[{...row,leaveCode:'NEW'}],[{...row,end:'07:00'}],[row,{...row,row:3}]])assert.ok((await call(c.db,'hr-import-preview',{...body,rows})).results.some(r=>r.status==='error'));
 assert.deepEqual(await records(c.db),before);
}));
test('concurrent production cursor, directory or policy mutation rejects atomic import',()=>fixture(async c=>{
 for(const fault of ['cursor','directory','policy']){
  const body=input(),p=await call(c.db,'hr-import-preview',body);let injected=false;
  const proxy=new Proxy(c.db,{get(target,key){if(key==='batch')return async statements=>{if(!injected){injected=true;if(fault==='cursor')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.version',999) WHERE entity='production_cursor'").run();if(fault==='directory')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.name','Changed') WHERE entity='employees'").run();if(fault==='policy')await target.prepare("UPDATE app_records SET payload=json_set(payload,'$.approved',0) WHERE entity='production_reporting_policy'").run();}return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
  await assert.rejects(()=>call(proxy,'hr-import-save',{...body,previewHash:p.sourceHash}));assert.equal((await records(c.db)).filter(r=>r.entity==='hr_absence_import').length,0);assert.equal((await eventList(c.db)).filter(e=>e.importId).length,0);
  if(fault==='directory')await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='employees'").bind(JSON.stringify(person)).run();
 }
}));
test('100-row transaction uses one commit and scoped employee event reads, no In Transit or report reads',()=>fixture(async c=>{
 await c.put('production_allocation_queue','global',{offers:[]});
 const rows=[];for(let i=0;i<100;i++){const p={...person,id:'TEST-'+i,sourceEmployeeId:'CODE'+i};await c.put('employees',p.id,p);rows.push({...row,row:i+2,code:p.sourceEmployeeId});}
 let batches=0,reads=0;const sqls=[];
 const db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{sqls.push(sql);reads++;return target.prepare(sql);};if(key==='batch')return statements=>{batches++;return target.batch(statements);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const body={...input(),rows},preview=await call(db,'hr-import-preview',body);const start=performance.now();const saved=await call(db,'hr-import-save',{...body,previewHash:preview.sourceHash});
 assert.equal(saved.count,100);assert.equal(batches,1);assert.ok(!sqls.some(sql=>/entity='in_transit'|entity='production_report'|entity IN \('production_event','employees'\)/.test(sql)));assert.ok(sqls.some(sql=>sql.includes('json_each(?)')));
 console.log(JSON.stringify({test:'synthetic_100_rows',saveMs:Math.round(performance.now()-start),preparedStatements:reads,batches}));
}));
test('manual daily HR stays compatible and skips unrelated orders/allocation timeline reads',()=>fixture(async c=>{
 await c.put('production_allocation_queue','global',{offers:[]});
 const sqls=[],db=new Proxy(c.db,{get(target,key){if(key==='prepare')return sql=>{sqls.push(sql);return target.prepare(sql);};const v=target[key];return typeof v==='function'?v.bind(target):v;}});
 const result=await mutateProductionWorkflow(db,{action:'line-absence',attendanceScope:'employee',absenceType:'Đi trễ',employees:[person.id],effectiveAt:'2026-11-16T01:00:00Z',endsAt:'2026-11-16T01:01:00Z',requestIdempotency:crypto.randomUUID()},hr);
 assert.equal(result.recordedDays,1);assert.equal(result.events[0].absenceType,'Đi trễ');
 assert.ok(!sqls.some(sql=>/entity='in_transit'|entity IN \('production_event','employees'\)/.test(sql)));
}));
test('validation keeps one minute 15P, requires explicit TRVS subtype and rejects invalid dates',()=>{
 const options={month:'2026-11',now:Date.parse('2026-11-17')};
 assert.equal(previewAbsences([{...row,leaveCode:'15P',kind:'Đi trễ',end:'08:01',duration:'00:01'}],[person],[],options)[0].status,'valid');
 for(const r of [{...row,leaveCode:'TRVS',kind:''},{...row,date:'2026-11-31'}])assert.equal(previewAbsences([r],[person],[],options)[0].status,'error');
});
test('scoped reads follow edits that move an old absence to another employee; cancellation still blocks edited imports',()=>fixture(async c=>{
 const {result,body}=await save(c.db),original=result.events[0];
 await c.put('production_event','TEST-REASSIGNED',{...original,id:'TEST-REASSIGNED',employees:['ANOTHER-TEST-PERSON'],supersedes:original.id});
 const preview=await call(c.db,'hr-import-preview',input());assert.equal(preview.results[0].status,'valid');
 assert.equal((await call(c.db,'hr-import-cancel-preview',body)).canCancel,false);
 await assert.rejects(()=>call(c.db,'hr-import-history',{},null),{status:403});
}));
test('cancellation uses current schedule and preserves other files; expired cancellation and empty reason cannot write',()=>fixture(async c=>{
 const first=await save(c.db),second=await save(c.db,{...input(),rows:[{...row,date:'2026-11-17'}]});
 const before=await records(c.db);await assert.rejects(()=>call(c.db,'hr-import-cancel',{...first.body,reason:''}));assert.deepEqual(await records(c.db),before);
 const originalNow=Date.now;Date.now=()=>Date.parse('2026-12-11');try{assert.equal((await call(c.db,'hr-import-cancel-preview',first.body)).canCancel,false);await assert.rejects(()=>call(c.db,'hr-import-cancel',{...first.body,reason:'test'}),{status:409});}finally{Date.now=originalNow;}
 assert.deepEqual(await records(c.db),before);
 await call(c.db,'hr-import-cancel',{...first.body,reason:'Nhầm file thử nghiệm'});
 const day={date:row.date,working:true,hcStart:'09:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false};
 const result=monthlyAttendance({events:await eventList(c.db),schedules:[{line:'A',days:[day],roster:[{date:row.date,hc:[person.id],ot:[]}]}],employees:[person],month:'2026-11',line:'A',dateFrom:row.date,dateUntil:'2026-11-17'}).people[0];
 assert.ok(Math.abs(result.hc-20/3)<1e-9,'current shorter schedule, not blind restore of 7h40');
 const all=await records(c.db);for(const original of before.filter(r=>r.entity==='production_report'||r.entity.startsWith('production_legacy')||r.entity==='in_transit'))assert.deepEqual(all.find(r=>r.entity===original.entity&&r.record_key===original.record_key),original);
 assert.equal((await call(c.db,'hr-import-cancel-preview',second.body)).canCancel,true);
}));
test('authenticated HTTP imports and cancels through existing session; viewer cannot forge HR and generic records cannot overwrite history',()=>fixture(async c=>{
 const cookies={};
 const post=async(path,body,login)=>siteApi(new Request('https://test.invalid'+path,{method:'POST',headers:{origin:'https://test.invalid','content-type':'application/json',...(login?{cookie:cookies[login]}:{})},body:JSON.stringify(body)}),{DB:c.db,FILES:c.bucket});
 for(const [login,role] of [['TEST-HR-HTTP','HR'],['TEST-VIEW-HTTP','viewer']]){
  await c.put('users',login,{login,role,active:true});const p=await passwordRecord('1234');await c.db.prepare('INSERT INTO auth_accounts VALUES(?,?,?,?,1,?)').bind(login,p.hash,p.salt,p.iterations,'fixture').run();
  if(role==='HR')await c.put('permissions',login,{login,active:true,permissions:'Quản lý sản xuất / Lịch SX thực tế / Ghi vắng mặt'});
  const r=await post('/api/auth/login',{login,password:'1234'});assert.equal(r.status,200);cookies[login]=r.headers.get('set-cookie').split(';')[0];
 }
 const b=input();assert.equal((await post('/api/production-workflow',{...b,action:'hr-import-preview',isAdmin:true},'TEST-VIEW-HTTP')).status,403);
 const p=await post('/api/production-workflow',{...b,action:'hr-import-preview'},'TEST-HR-HTTP');assert.equal(p.status,200);const preview=await p.json();
 const r=await post('/api/production-workflow',{...b,action:'hr-import-save',previewHash:preview.sourceHash},'TEST-HR-HTTP');assert.equal(r.status,200);assert.equal((await r.json()).count,1);
 assert.notEqual((await post('/api/records',{entity:'hr_absence_import',key:b.importId,payload:{status:'cancelled'}},'TEST-HR-HTTP')).status,200);
 const cancelled=await post('/api/production-workflow',{action:'hr-import-cancel',importId:b.importId,reason:'HTTP thử nghiệm'},'TEST-HR-HTTP');assert.equal(cancelled.status,200);assert.equal((await cancelled.json()).count,1);
}));
