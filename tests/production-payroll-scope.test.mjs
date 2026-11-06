import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollMonth} from '../lib/production-payroll-month.mjs';
import {payrollPreview} from '../lib/production-payroll.mjs';
import {payrollFundHistory} from '../lib/production-fund-history.mjs';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
import {captureAttendancePrefix,checkAttendancePrefix} from '../lib/production-attendance-prefix.mjs';
import {fullPayrollFixture,scopedPayrollFixture,month} from './helpers/payroll-scope-fixture.mjs';
const permission='Cần quyền xem cả Line A và B để phân bổ quỹ chung';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);

test('Line A does not turn redacted Line B calendar/employment into named missing-data warnings',()=>{
 const input=scopedPayrollFixture('A'),before=structuredClone(input),[a]=payrollMonth(input);
 assert.deepEqual(a.result.issues,[permission]);
 assert.equal(a.people.find(p=>p.id==='SYNTHETIC-B').startDate,undefined);
 near(a.actual,11.5);near(a.production,11.5);assert.equal(a.earned,100);assert.equal(a.quantity,100);
 assert.equal(a.share,undefined);assert.equal(a.result.fund,null);assert.equal(a.result.paid,null);assert.equal(a.result.payments.size,0);
 assert.equal(a.result.eligibility.get('SYNTHETIC-B').kind,'restricted');
 assert.equal(a.people.find(p=>p.id==='SYNTHETIC-B').otherLineHours,null);
 assert.deepEqual(input,before);
});

test('Line B does not invent missing Line A calendar diagnostics or allocate the shared fund',()=>{
 const [b]=payrollMonth(scopedPayrollFixture('B'));
 assert.deepEqual(b.result.issues,[permission]);near(b.actual,11.5);
 assert.equal(b.result.paid,null);assert.equal(b.result.returned,null);assert.equal(b.result.payments.size,0);
 assert.equal(b.people.find(p=>p.id==='SYNTHETIC-B').otherLineHours,null);
});

test('a scoped calculation does not inspect another Line calendar or its invalid output dates',()=>{
 const input=scopedPayrollFixture();
 input.schedules.push({line:'B',get days(){throw Error('Unavailable Line B calendar must not be evaluated');}});
 input.orders.push({id:'SYNTHETIC-HIDDEN-B',line:'B',sku:'SYNTHETIC-SKU-B'});
 input.reports.push({id:'SYNTHETIC-HIDDEN-B-REPORT',kind:'completion',transitId:'SYNTHETIC-HIDDEN-B',line:'B',reviewStatus:'Đã xác nhận',approvedQuantity:1});
 assert.deepEqual(payrollMonth(input)[0].result.issues,[permission]);
});

test('real missing calendar and employment data on the permitted Line remain visible and block pay',()=>{
 const calendar=scopedPayrollFixture();calendar.schedules=[];
 assert.ok(payrollMonth(calendar)[0].result.issues.some(s=>s==='Line A: Chưa đủ lịch làm việc cả tháng'));
 const input=scopedPayrollFixture();input.employees=input.employees.map(p=>p.line==='A'?{...p,startDate:''}:p);
 const r=payrollMonth(input)[0];assert.ok(r.result.issues.includes('Thiếu ngày bắt đầu hợp lệ: Synthetic own A'));
 assert.ok(!r.result.issues.some(s=>s.includes('Synthetic related B')));assert.equal(r.result.paid,null);
 const invalidLine=scopedPayrollFixture();invalidLine.employees=invalidLine.employees.map(p=>p.id==='SYNTHETIC-A'?{...p,line:''}:p);
 assert.ok(payrollMonth(invalidLine)[0].result.issues.includes('Thiếu line gốc hợp lệ: Synthetic own A'));
});

test('full access preserves both-Line diagnostics, transfer hours and independent exact fund contributions',()=>{
 const input=fullPayrollFixture(),[a,b]=payrollMonth(input);
 assert.deepEqual(a.result.issues,[]);assert.deepEqual(b.result.issues,[]);
 near(a.actual,11.5);near(b.actual,11.5);near(b.people.find(p=>p.id==='SYNTHETIC-B').otherLineHours,23/6);
 assert.equal(a.share.allocated,3000000);assert.equal(b.share.allocated,3000000);
 assert.deepEqual([...a.result.payments].sort(),[['SYNTHETIC-A',2000000],['SYNTHETIC-B',1000000]]);
 assert.deepEqual([...b.result.payments].sort(),[['SYNTHETIC-B',1000000],['SYNTHETIC-B-UNRELATED',2000000]]);
 assert.equal(a.result.paid+b.result.paid+a.result.returned+b.result.returned+a.result.unallocated+b.result.unallocated,6000000);
 const incomplete=fullPayrollFixture();incomplete.schedules=incomplete.schedules.filter(s=>s.line==='A');
 for(const row of payrollMonth(incomplete)){assert.ok(row.result.issues.some(s=>s.includes('Line B: Chưa đủ lịch làm việc cả tháng')));assert.equal(row.result.paid,null);}
 const missing=fullPayrollFixture();missing.employees=missing.employees.map(p=>p.id==='SYNTHETIC-B'?{...p,startDate:''}:p);
 for(const row of payrollMonth(missing)){assert.ok(row.result.issues.some(s=>s==='Thiếu ngày bắt đầu hợp lệ: Synthetic related B'));assert.equal(row.result.paid,null);}
});

test('scoped employment preview fails closed without fabricating dates, while ordinary missing dates stay errors',()=>{
 const person={id:'SYNTHETIC-B',name:'Synthetic related B',line:'B',hc:8,ot:0,helper:0};
 const scoped=payrollPreview(100,[person],3000000,[],month,{employmentLine:'A'});
 assert.deepEqual(scoped.issues,[permission]);assert.equal(scoped.paid,null);assert.equal(scoped.payments.size,0);
 const ordinary=payrollPreview(100,[person],3000000,[],month);
 assert.ok(ordinary.issues.includes('Thiếu ngày bắt đầu hợp lệ: Synthetic related B'));assert.equal(ordinary.paid,null);
});

test('fund history retains the shared-access blocker without false other-Line names and full history still balances',()=>{
 const scoped=payrollFundHistory({from:month,to:month,calculate:()=>payrollMonth(scopedPayrollFixture())});
 assert.equal(scoped.completeMonths,0);assert.equal(scoped.totals.paid,null);assert.ok(scoped.rows[0].issues.includes(permission));
 assert.ok(!scoped.rows[0].issues.some(s=>/Line B:|Synthetic related B/.test(s)));
 const full=payrollFundHistory({from:month,to:month,calculate:()=>payrollMonth(fullPayrollFixture())});
 assert.equal(full.completeMonths,1);assert.equal(full.totals.paid,6000000);assert.equal(full.totals.returned,0);
});

test('a scoped protected month uses its own observed attendance without requiring a hidden Line anchor',()=>{
 const full=fullPayrollFixture(),before=payrollMonth(full),snapshotId='SYNTHETIC-SCOPED-HISTORY';
 const saved={snapshotId,month,lines:Object.fromEntries(['A','B'].map(line=>[line,monthlyAttendance({...full,line})]))};
 const historyProtection={requiredBeforeMonth:'2026-11',snapshotId};
 const input={...scopedPayrollFixture(),schedules:[],events:[],attendanceBaselines:[{...saved,lines:{A:saved.lines.A}}],historyProtection};
 const original=structuredClone(input),[a]=payrollMonth(input);
 assert.deepEqual(a.result.issues,[permission]);near(a.actual,before[0].actual);assert.equal(a.result.paid,null);
 assert.deepEqual(a.people.map(({otherLineHours,...p})=>p),before[0].people.map(({otherLineHours,...p})=>p));
 assert.deepEqual(input,original,'read-only use of observed history');
 const missing=payrollMonth({...input,attendanceBaselines:[]})[0];
 assert.ok(missing.result.issues.some(s=>s.includes('Thiếu mốc bảo toàn giờ/nhân sự tháng cũ')));assert.equal(missing.actual,null);
 const after=payrollMonth({...full,schedules:[],events:[],attendanceBaselines:[saved],historyProtection});
 assert.deepEqual(after,before,'both-Line historic calculation, money and people remain identical');
});

test('cutover prefix respects scoped historical attendance and never treats hidden employment dates as changed eligibility',()=>{
 const full=fullPayrollFixture(),snapshotId='SYNTHETIC-SCOPED-PREFIX',cutoverDate=month+'-02';
 for(const s of full.schedules)s.days[1].working=true;
 const captured=captureAttendancePrefix({...full,cutoverDate,snapshotId,observedAt:month+'-02T01:00:00Z'});
 const checked=checkAttendancePrefix(captured,{...full,currentEmployees:full.employees});
 assert.deepEqual(checked.integrity,{A:'matched',B:'matched'});
 const before=payrollMonth(full),historyProtection={requiredBeforeMonth:month,cutoverDate,snapshotId};
 const projectedPeople=captured.lines.A.people.map(p=>p.line==='A'?p:Object.fromEntries(Object.entries(p).filter(([k])=>!['startDate','endDate','productionBonusStartDate'].includes(k))));
 const scoped={...scopedPayrollFixture(),schedules:full.schedules.filter(s=>s.line==='A')};
 for(const liveMatches of [true,false]){
  const prefix={...captured,lines:{A:{...captured.lines.A,people:projectedPeople}},integrity:{A:'matched'},livePrefixMatches:{A:liveMatches}};
  const input={...scoped,attendanceBaselines:[prefix],historyProtection},original=structuredClone(input),[a]=payrollMonth(input);
  assert.deepEqual(a.result.issues,[permission]);near(a.actual,before[0].actual);assert.equal(a.result.paid,null);
  assert.deepEqual(a.people.map(p=>p.id),before[0].people.map(p=>p.id));
  for(const p of a.people){const old=before[0].people.find(o=>o.id===p.id);for(const key of ['hc','ot','helper'])near(p[key],old[key]);}
  assert.deepEqual(input,original);
 }
 const complete=payrollMonth({...full,attendanceBaselines:[{...captured,...checked}],historyProtection});
 assert.deepEqual(complete,before,'whole-month accumulation, eligibility and money stay unchanged for full access');
 const missing=payrollMonth({...scoped,attendanceBaselines:[],historyProtection})[0];
 assert.ok(missing.result.issues.some(s=>s.includes('Thiếu mốc bảo toàn giờ trước mốc chuyển đổi')));assert.equal(missing.result.paid,null);
});
