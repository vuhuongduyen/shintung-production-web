import test from 'node:test';import assert from 'node:assert/strict';
import {workflowGetFixture} from './helpers/workflow-get-fixture.mjs';import {records} from '../scripts/local/database.mjs';
import {captureLegacySource} from '../scripts/local/production-legacy-snapshot.mjs';
import {prepareLegacyPublication,publishLegacyChunk,finalizeLegacyPublication} from '../scripts/local/production-legacy-publication.mjs';
import {activatePreparedTestPolicy} from './helpers/activate-prepared-daily-policy.mjs';import {dailyToday} from '../scripts/local/production-daily-output.mjs';
import {reviewer} from './helpers/daily-output-reviewer.mjs';import {payrollMonth} from '../lib/production-payroll-month.mjs';
import {activateDailyPolicy} from './helpers/activate-daily-policy.mjs';
import {permissionProfiles} from '../lib/user-permission-profiles.mjs';
const actor={login:'SYNTHETIC-PUBLISHER',isAdmin:true},build={sourceId:'a'.repeat(64)};
test('HR can enter a prior-month new-period absence on the fifth before payout without rewriting frozen hours or reports',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-04T03:00:00Z')});
 const c=await workflowGetFixture(2),put=(entity,key,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?) ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload').bind(entity,key,JSON.stringify(payload),'SYNTHETIC',new Date().toISOString()).run();
 try{
  await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.startDate','2026-01-01') WHERE entity='employees'").run();
  await activateDailyPolicy(c.db,{effectiveFrom:'2026-11-04'});
  t.mock.timers.tick(31*86400000);assert.equal(dailyToday(),'2026-12-05');
  const call=await reviewer({...c,put});await put('users','SYNTHETIC-REVIEWER',{login:'SYNTHETIC-REVIEWER',role:'USER',department:'HR',active:true});await put('department_permissions','HR',{department:'HR',active:true,permissions:permissionProfiles.HR.grants.join(' · ')});
  const before=await call('/api/production-workflow');assert.equal(before.status,200,JSON.stringify(before.body));
  const calc=view=>payrollMonth({orders:view.orders,reports:view.reports,events:view.events,schedules:view.approvedSchedules,employees:view.payrollEmployees,month:'2026-11',standards:new Map(),attendanceBaselines:view.payrollBaselines,historyProtection:view.payrollHistoryProtection});
  const original=calc(before.body)[0].people.find(p=>p.id==='SYNTHETIC-NV0'),raw=(await records(c.db)).filter(r=>['production_report','production_legacy_month'].includes(r.entity));assert.ok(original.hc>1);
  const saved=await call('/api/production-workflow',{action:'line-absence',line:'A',absenceType:'Đi trễ',employees:['SYNTHETIC-NV0'],effectiveAt:'2026-11-05T01:00:00Z',endsAt:'2026-11-05T02:00:00Z',reason:'Synthetic late HR entry before payout',lateReason:'Synthetic December entry for November',requestIdempotency:crypto.randomUUID()});assert.equal(saved.status,200,JSON.stringify(saved.body));
  const after=await call('/api/production-workflow');assert.equal(after.status,200);assert.equal(after.body.payrollBaselines.find(b=>b.until).integrity.A,'matched');
  assert.ok(Math.abs(calc(after.body)[0].people.find(p=>p.id==='SYNTHETIC-NV0').hc-(original.hc-1))<1e-9);assert.deepEqual((await records(c.db)).filter(r=>['production_report','production_legacy_month'].includes(r.entity)),raw);
 }finally{await c.close();t.mock.timers.reset();}
});
test('authenticated activated workflow protects cutover-prefix hours, retains explicit HR saves, and does not expose another Line baseline',async t=>{
 t.mock.timers.enable({apis:['Date'],now:Date.parse('2026-11-04T03:00:00Z')});
 const c=await workflowGetFixture(6),put=(entity,key,payload)=>c.db.prepare('INSERT INTO app_records VALUES(?,?,?,?,?)').bind(entity,key,JSON.stringify(payload),'SYNTHETIC','now').run();
 try{
  const cutoverDate=dailyToday();assert.equal(cutoverDate,'2026-11-04');
  await c.db.prepare("UPDATE app_records SET payload=json_set(payload,'$.startDate','2026-01-01') WHERE entity='employees'").run();
  await put('production_event','SYNTHETIC-LOAN',{id:'SYNTHETIC-LOAN',kind:'line-movement',line:'B',destinationLine:'A',employees:['SYNTHETIC-B'],effectiveAt:'2026-11-02T01:00:00Z',endsAt:'2026-11-02T05:00:00Z'});
  const input={snapshotId:'SYNTHETIC-CUTOVER-API-SNAPSHOT',cutoverDate};await captureLegacySource(c.db,input,actor,build);const p=await prepareLegacyPublication(c.db,input,actor,build);for(let index=0;index<p.chunks.length;index++)await publishLegacyChunk(c.db,{snapshotId:input.snapshotId,index,records:p.chunks[index]},actor,build);await finalizeLegacyPublication(c.db,input,actor,build);await put('production_test_environment','isolated',{isolated:true});await activatePreparedTestPolicy(c.db,input,actor,{...build,simulation:true});
  const call=await reviewer({...c,put}),first=await call('/api/production-workflow');assert.equal(first.status,200);const prefix=first.body.payrollBaselines.find(b=>b.until===cutoverDate);assert.ok(prefix);assert.deepEqual(prefix.integrity,{A:'matched',B:'matched'});const oldHours=prefix.lines.A.people.find(p=>p.id==='SYNTHETIC-NV0').hc;assert.ok(oldHours>0);const originals=(await records(c.db)).filter(r=>r.entity==='production_report'||r.entity==='production_legacy_month');
  const employeeEdit=await call('/api/employees',{id:'SYNTHETIC-NV0',version:0,name:'Synthetic later master',line:'C',startDate:'2026-12-01',endDate:''});assert.equal(employeeEdit.status,200,JSON.stringify(employeeEdit.body));assert.equal(employeeEdit.body.employee.history.at(-1).before.startDate,'2026-01-01');
  const changed=await call('/api/production-workflow');assert.equal(changed.status,200);const preserved=changed.body.payrollBaselines.find(b=>b.until);assert.deepEqual(preserved.lines,prefix.lines);assert.deepEqual(preserved.integrity,{A:'matched',B:'matched'});assert.equal(preserved.livePrefixMatches.A,false);
  const calculate=view=>payrollMonth({orders:view.orders,reports:view.reports,events:view.events,schedules:view.approvedSchedules,employees:view.payrollEmployees,month:cutoverDate.slice(0,7),standards:new Map(),attendanceBaselines:view.payrollBaselines,historyProtection:view.payrollHistoryProtection});
  assert.equal(calculate(changed.body)[0].people.find(p=>p.id==='SYNTHETIC-NV0').hc,oldHours);
  const hr=await call('/api/production-workflow',{action:'line-absence',line:'A',absenceType:'Đi trễ',employees:['SYNTHETIC-NV2'],effectiveAt:'2026-11-02T01:00:00Z',endsAt:'2026-11-02T02:00:00Z',reason:'Synthetic explicit historical correction',lateReason:'Synthetic late evidence',requestIdempotency:crypto.randomUUID()});assert.equal(hr.status,200,JSON.stringify(hr.body));assert.ok(hr.body.event||hr.body.events?.length,'do not disable the existing HR write permission');
  const reviewed=await call('/api/production-workflow');assert.equal(reviewed.body.payrollBaselines.find(b=>b.until).integrity.A,'changed');assert.deepEqual(reviewed.body.payrollBaselines.find(b=>b.until).lines,prefix.lines);assert.equal(calculate(reviewed.body)[0].result.fund,null);assert.match(calculate(reviewed.body)[0].result.issues.join(),/trước mốc chuyển đổi/);assert.deepEqual((await records(c.db)).filter(r=>r.entity==='production_report'||r.entity==='production_legacy_month'),originals);
  await c.db.prepare("UPDATE app_records SET payload=? WHERE entity='users' AND record_key='SYNTHETIC-REVIEWER'").bind(JSON.stringify({login:'SYNTHETIC-REVIEWER',role:'USER',line:'A',active:true,grants:['Quản lý sản xuất / Báo công sản xuất / Xem']})).run();const scoped=await call('/api/production-workflow');assert.equal(scoped.status,200,JSON.stringify(scoped.body));for(const b of scoped.body.payrollBaselines){assert.deepEqual(Object.keys(b.lines),['A']);if(b.until){assert.deepEqual(Object.keys(b.integrity),['A']);assert.deepEqual(Object.keys(b.livePrefixMatches),['A']);}}assert.equal(scoped.body.attendancePrefix,undefined);const borrowed=scoped.body.payrollBaselines.find(b=>b.until).lines.A.people.find(p=>p.id==='SYNTHETIC-B');assert.ok(borrowed.hc>0,'receiving Line retains the permitted borrowed hours');assert.equal(borrowed.startDate,undefined);assert.equal(borrowed.endDate,undefined);assert.equal(borrowed.history,undefined);assert.equal(borrowed.version,undefined);
 }finally{await c.close();}
});
