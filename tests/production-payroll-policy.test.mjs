import test from 'node:test';
import assert from 'node:assert/strict';
import {payrollEligibility,payrollPreview} from '../lib/production-payroll.mjs';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
import {payrollExportReport,payrollXlsx} from '../lib/production-payroll-export.mjs';
const person=(id,patch={})=>({id,name:id,line:'A',startDate:'2020-01-01',hc:100,ot:0,helper:0,include:true,...patch});
const calculate=(people,fund=6000000,earned=people.reduce((n,p)=>n+p.hc+p.ot-p.helper-(p.otherWork||0),0))=>payrollPreview(earned,people,fund,[],'2026-10');
test('employment thresholds, year rollover, and first non-working day',()=>{
 for(const [start,eligible] of [['2026-03-10','2026-04-01'],['2026-03-11','2026-05-01'],['2026-12-11','2027-02-01']])assert.equal(payrollEligibility(person('Quách Chanh Thảo',{startDate:start}),'2026-10').eligibleFrom,eligible);
 for(const end of ['2026-10-01','2026-10-20','2026-10-31'])assert.equal(payrollEligibility(person('Trần Quốc Việt',{endDate:end}),'2026-10').kind,'redistribute');
 assert.equal(payrollEligibility(person('Trần Quốc Việt',{endDate:'2026-11-01'}),'2026-10').kind,'eligible');
 for(const start of ['', '2026-02-30'])assert.equal(payrollEligibility(person('Huỳnh Vạn Tiền',{startDate:start}),'2026-10').kind,'missing');
});
test('new and departed staff keep efficiency hours; redistribution excludes C and conserves fund',()=>{
 const people=[person('Quách Chanh Thảo'),person('Trần Quốc Việt',{hc:50}),person('Huỳnh Vạn Tiền',{startDate:'2026-10-01',hc:50}),person('Đoàn Hữu Tín',{line:'C',hc:100}),person('Châu Minh Đúng',{endDate:'2026-10-20',hc:100})];
 const r=calculate(people);assert.deepEqual(r.issues,[]);assert.equal(r.production,400);assert.equal(r.score,100);assert.equal(r.returned,1500000);assert.equal(r.redistributed,2250000);assert.equal(r.paid,4500000);
 assert.equal(r.payments.get('Quách Chanh Thảo'),3000000);assert.equal(r.payments.get('Trần Quốc Việt'),1500000);
 for(const name of ['Huỳnh Vạn Tiền','Đoàn Hữu Tín','Châu Minh Đúng'])assert.equal(r.payments.get(name),0);
 assert.equal(r.paid+r.returned+r.unallocated,6000000);
});
test('direct contribution at each line; helper stays in share; other work reduces production only',()=>{
 const a=calculate([person('Quách Chanh Thảo',{hc:120,helper:20,otherWork:10}),person('Trần Quốc Việt',{hc:80})],2700000);
 assert.equal(a.actual,200);assert.equal(a.production,170);assert.equal(a.payments.get('Quách Chanh Thảo'),1620000);
 const b=calculate([person('Quách Chanh Thảo',{hc:60}),person('Huỳnh Vạn Tiền',{line:'B',hc:40})],1000000);
 assert.equal(a.payments.get('Quách Chanh Thảo')+b.payments.get('Quách Chanh Thảo'),2220000);
});
test('missing data, invalid work overlap, and no eligible recipient block payments; 0 coefficient remains zero',()=>{
 for(const people of [[person('Quách Chanh Thảo',{startDate:''})],[person('Quách Chanh Thảo',{line:''})],[person('Quách Chanh Thảo',{startDate:'2026-10-01'})],[person('Quách Chanh Thảo',{helper:80,otherWork:30})]]){const r=calculate(people);assert.ok(r.issues.length);assert.equal(r.paid,null);assert.equal(r.payments.size,0);}
 const zero=calculate([person('Quách Chanh Thảo',{startDate:'2026-10-01'})],1000,84.99);assert.deepEqual(zero.issues,[]);assert.equal(zero.paid,0);assert.equal(zero.unallocated,1000);
 const c=calculate([person('Đoàn Hữu Tín',{line:'C'})],1000);assert.equal(c.returned,1000);assert.equal(c.paid,0);
});
test('integer rounding including redistributed money never loses or creates VND',()=>{
 const people=[person('Quách Chanh Thảo',{hc:1}),person('Trần Quốc Việt',{hc:1}),person('Huỳnh Vạn Tiền',{hc:1,startDate:'2026-10-01'}),person('Đoàn Hữu Tín',{hc:1,line:'C'})];
 for(let fund=0;fund<200;fund++){const r=calculate(people,fund);assert.deepEqual(r.issues,[]);assert.equal([...r.payments.values()].reduce((a,b)=>a+b,0)+r.returned+r.unallocated,fund);assert.ok([...r.payments.values()].every(Number.isInteger));}
});
test('historical roster excludes employment boundaries and unions helper/other-work intervals',()=>{
 const days=Array.from({length:31},(_,i)=>({date:`2026-10-${String(i+1).padStart(2,'0')}`,working:i<3,ot:false}));
 const employee=person('Quách Chanh Thảo',{startDate:'2026-10-02',endDate:'2026-10-03',active:false});
 const schedules=[{line:'A',days,roster:days.map(d=>({date:d.date,hc:[employee.id],ot:[]})),input:{dailySchedule:days}}];
 const events=['Phụ kho','CV khác'].map((absenceType,i)=>({id:String(i),kind:'line-absence',line:'A',employees:[employee.id],absenceType,approved:true,effectiveAt:'2026-10-02T08:00:00+07:00',endsAt:'2026-10-02T09:00:00+07:00'}));
 const r=monthlyAttendance({month:'2026-10',line:'A',employees:[employee],schedules,events});assert.deepEqual(r.issues,[]);assert.equal(r.people.length,1);assert.ok(Math.abs(r.people[0].hc-23/3)<1e-9);assert.equal(r.people[0].helper,1);assert.equal(r.people[0].otherWork,0);
});
test('export displays actual payments, returned fund and eligibility using same calculation',()=>{
 const people=[person('Quách Chanh Thảo'),person('Đoàn Hữu Tín',{line:'C'})],result=calculate(people,1000);
 const overview={line:'A',people,selected:people,result,share:{allocated:1000,ratio:1},actual:200,support:0,production:200,earned:200,quantity:100};
 const report=payrollExportReport({month:'2026-10',baseFund:1000,overviews:[overview]});
 const sheet=report.sheets[1],header=sheet.rows.find(r=>r.kind==='header');const idx=header.values.findIndex(c=>c.v.startsWith('Tiền sản lượng'));
 assert.equal(sheet.rows.at(-1).values[idx].v,500);assert.ok(sheet.rows.some(r=>r.values.some(c=>c.v==='Line C: hoàn quỹ công ty')));assert.ok(payrollXlsx(report).length>1000);
});
