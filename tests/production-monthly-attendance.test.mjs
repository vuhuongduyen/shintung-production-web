import test from 'node:test';
import assert from 'node:assert/strict';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
import {payrollPreview} from '../lib/production-payroll.mjs';
const day={date:'2026-10-01',working:true,ot:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',preOtStart:'17:00',preOtEnd:'17:30',otStart:'17:30',otEnd:'21:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}]};
const schedules=[{key:'2026-09-28:A',days:Array.from({length:31},(_,i)=>({...day,date:`2026-10-${String(i+1).padStart(2,'0')}`,working:i===0,ot:i===0})),roster:[{date:day.date,hc:['NV1'],ot:['NV1']}],input:{dailySchedule:[day]}}];
const base={month:'2026-10',line:'A',employees:[{id:'NV1',name:'Nhân viên kiểm thử',line:'A'}],schedules};
const event=(id,type,start,end,extra={})=>({id,kind:'line-absence',line:'A',employees:['NV1'],absenceType:type,effectiveAt:`2026-10-01T${start}:00+07:00`,endsAt:`2026-10-01T${end}:00+07:00`,approved:true,...extra});
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-9,`${a} != ${b}`);
test('calendar excludes lunch, breaks, pre-OT; HR HC/OT overlaps deducted once; helper preserves bonus share',()=>{
 const r=monthlyAttendance({...base,events:[event('a','Nghỉ','09:00','11:00'),event('b','Đi trễ','10:30','12:30'),event('c','Về sớm','20:00','21:00'),event('d','Phụ kho','13:00','14:00'),event('e','Phụ kho','13:30','14:30')]});
 assert.deepEqual(r.issues,[]);const p=r.people[0];near(p.calendarHc,23/3);near(p.calendarOt,3.5);near(p.absentHc,17/6);near(p.absentOt,1);near(p.helper,1.5);near(p.hc,29/6);near(p.ot,2.5);
 const pay=payrollPreview(100,r.people,3000000,r.issues);near(pay.actual,22/3);near(pay.production,35/6);assert.equal(pay.payments.get('NV1'),3000000);
});
test('superseded absence uses corrected interval and survives serializing persisted data',()=>{
 const events=[event('a','Đi trễ','08:00','10:00'),event('b','Đi trễ','08:00','09:00',{supersedes:'a'})];
 const r=monthlyAttendance(JSON.parse(JSON.stringify({...base,events})));near(r.people[0].absentHc,1);
});
test('pending corrections block money, missing calendar or employee roster never becomes full attendance',()=>{
 const r=monthlyAttendance({...base,events:[event('a','Nghỉ','08:00','17:00',{approved:false})]});assert.match(r.issues.join(),/chờ QLSX/);assert.equal(payrollPreview(100,r.people,3000000,r.issues).fund,null);
 const missing=monthlyAttendance({...base,schedules:[]});assert.equal(missing.people[0].hc,null);assert.match(missing.issues.join(),/Chưa đủ lịch/);
 const unnamed=monthlyAttendance({...base,schedules:[{...schedules[0],roster:[]}]});assert.match(unnamed.issues.join(),/danh sách nhân viên theo ca/);
});
test('planned leave reconstructs scheduled hours but HR is actual absence source; absent helper is not double-subtracted',()=>{
 const s={...schedules[0],roster:[{date:day.date,hc:[],ot:['NV1']}],input:{dailySchedule:[day],dailyHcLeave:[{date:day.date,mode:'full',employees:['NV1']}]}};
 const r=monthlyAttendance({...base,schedules:[s],events:[event('a','Nghỉ','08:00','17:00'),event('b','Phụ kho','08:00','12:00')]});near(r.people[0].calendarHc,23/3);near(r.people[0].hc,0);near(r.people[0].helper,0);near(r.people[0].ot,3.5);
});
test('cross-line transfer allocates time once to each line',()=>{
 const moved={id:'t',kind:'transfer',line:'A',destinationLine:'B',employees:['NV1'],effectiveAt:'2026-10-01T13:00:00+07:00'};
 const all=[...schedules,{...schedules[0],key:'2026-09-28:B',roster:[{date:day.date,hc:[],ot:[]}]}];
 const a=monthlyAttendance({...base,schedules:all,events:[moved]}),b=monthlyAttendance({...base,line:'B',schedules:all,events:[moved]});
 near(a.people[0].hc,23/6);near(a.people[0].ot,0);near(b.people[0].hc,23/6);near(b.people[0].ot,3.5);
});
test('bounded loan C to B returns staff after end and cancelled absence restores monthly presence',()=>{
 const moved={id:'loan',kind:'line-movement',line:'C',destinationLine:'B',employees:['NV1'],effectiveAt:'2026-10-01T08:00:00+07:00',endsAt:'2026-10-01T12:00:00+07:00'};
 const all=[{...schedules[0],key:'2026-09-28:C'},{...schedules[0],key:'2026-09-28:B',roster:[{date:day.date,hc:[],ot:[]}]}];
 const data={...base,employees:[{id:'NV1',line:'C'}],schedules:all,events:[moved]};
 const c=monthlyAttendance({...data,line:'C'}),b=monthlyAttendance({...data,line:'B'});
 near(c.people[0].hc,23/6);near(b.people[0].hc,23/6);near(c.people[0].ot,3.5);near(b.people[0].ot,0);
 const absent=event('absence','Nghỉ','08:00','17:00'),cancel={...absent,id:'cancel',kind:'attendance-cancel',supersedes:'absence'};
 near(monthlyAttendance({...base,events:[absent,cancel]}).people[0].absentHc,0);
});
test('only explicit cross-line work contributes transfer hours; helper remains in its own column',()=>{
 const moved={id:'move',kind:'line-movement',line:'A',destinationLine:'B',employees:['NV1'],effectiveAt:'2026-10-01T08:00:00+07:00',endsAt:null};
 const all=[...schedules,{...schedules[0],key:'2026-09-28:B',roster:[{date:day.date,hc:[],ot:[]}]}];
 const helper=event('help','Phụ kho','08:00','09:00',{line:'B'});
 const r=monthlyAttendance({...base,line:'B',schedules:all,events:[moved,helper]});near(r.people[0].helper,1);near(r.people[0].transferFromHours.A,23/3+3.5-1);
 const plain=monthlyAttendance(base);assert.deepEqual(plain.people[0].transferFromHours,{});
});

test('other work is paid presence, separate from warehouse and absent hours',()=>{const r=monthlyAttendance({...base,events:[event('other','CV khác','13:00','14:00')]});const p=r.people[0];near(p.absentHc,0);near(p.helper,0);near(p.otherWork,1);near(p.hc,23/3);const pay=payrollPreview(100,r.people,3000000,r.issues);near(pay.actual-pay.production,1);});
