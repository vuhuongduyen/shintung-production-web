import test from 'node:test';
import assert from 'node:assert/strict';
import {newDailyCapacity,calculateCapacity} from '../lib/capacity.mjs';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
const week='2026-10-12';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
function input(workers=1){const p=newDailyCapacity(week,'A').input;p.workers=workers;p.dailySchedule=p.dailySchedule.map((d,i)=>({...d,working:i===0}));return p;}
test('partial leave and break union is deducted once, with headcount and capacity factor',()=>{
 for(const [start,end,loss,remaining] of [['08:00','10:30',140,320],['14:30','17:00',140,320],['10:00','10:10',0,460],['08:00','09:00',60,400]])for(const people of [1,3]){
  const p=input(people);p.dailyHcLeave=[{date:week,mode:'hours',people,start,end}];const r=calculateCapacity(p,week),d=r.days[0];
  near(d.hcLeave,people*loss/60);near(d.breakHours,people*20/60);near(d.hcNet,people*remaining/60);near(r.availableHours,people*remaining/60*.95);
  near(d.hcGross-d.hcLeave-d.breakHours,d.hcNet);
 }
});
test('full-day leave retains gross HC display, zero break deduction and zero remaining capacity',()=>{
 const p=input(3);p.dailyHcLeave=[{date:week,mode:'full',people:3}];const r=calculateCapacity(p,week),d=r.days[0];near(d.hcLeave,24);near(d.breakHours,0);near(d.hcNet,0);near(r.availableHours,0);
});
test('separate morning and afternoon leave groups each exclude their overlapping break once',()=>{
 const p=input(2);p.dailyHcLeave=[{date:week,mode:'hours',people:1,start:'08:00',end:'10:30'},{date:week,mode:'hours',people:1,start:'14:30',end:'17:00'}];const d=calculateCapacity(p,week).days[0];near(d.hcLeave,280/60);near(d.breakHours,40/60);near(d.hcNet,640/60);
 // Keep the existing planned-leave validation: a single hourly row cannot span lunch.
 p.dailyHcLeave=[{date:week,mode:'hours',people:1,start:'11:30',end:'13:30'}];assert.throws(()=>calculateCapacity(p,week),/khung làm việc/);
});
test('named assignment windows undo both break and net absence deductions outside assignment',()=>{
 for(const [windows,remaining] of [[[[660,1020]],290],[[[540,660]],30]]){
  const p=input();p.dailyRoster=p.dailySchedule.map(d=>({date:d.date,hc:d.working?['N']:[],ot:[],...(d.working?{hcWindows:{N:windows}}:{})}));p.dailyHcLeave=[{date:week,mode:'hours',people:1,employees:['N'],start:'08:00',end:'10:30'}];
  const d=calculateCapacity(p,week).days[0];near(d.hcNet,remaining/60);near(d.hcGross-d.hcLeave-d.breakHours,d.hcNet);
 }
});
test('monthly actual attendance clips lunch and both breaks and unions duplicate absences',()=>{
 const p=input(),events=[['08:00','17:00'],['08:00','10:30']].map(([start,end],i)=>({id:`absence-${i}`,kind:'line-absence',line:'A',employees:['N'],absenceType:'Nghỉ',effectiveAt:`${week}T${start}:00+07:00`,endsAt:`${week}T${end}:00+07:00`}));
 const base={month:'2026-10',line:'A',employees:[{id:'N',line:'A'}],schedules:[{key:week+':A',days:p.dailySchedule,roster:[{date:week,hc:['N'],ot:[]}],input:p}]};
 let row=monthlyAttendance({...base,events}).people[0];near(row.absentHc,460/60);near(row.hc,0);
 row=monthlyAttendance({...base,events:[{...events[0],effectiveAt:`${week}T11:30:00+07:00`,endsAt:`${week}T13:30:00+07:00`}]}).people[0];near(row.absentHc,1);near(row.hc,400/60);
});
