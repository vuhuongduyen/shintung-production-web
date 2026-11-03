import test from 'node:test';
import assert from 'node:assert/strict';
import {projectPersonalHr} from '../lib/hr-attendance-scope.mjs';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
import {canEditAttendance} from '../lib/production-attendance-controls.mjs';
const date='2026-10-16',at=time=>`${date}T${time}:00+07:00`,iso=time=>new Date(at(time)).toISOString();
const employees=[{id:'C1',line:'C',active:true},{id:'C2',line:'C',active:true}];
const absence={id:'hr',kind:'line-absence',attendanceScope:'employee',line:'C',sourceId:null,employees:['C1'],absenceType:'Nghỉ',effectiveAt:at('07:00'),endsAt:at('18:00'),approved:true,reason:'PRIVATE',before:{secret:'PRIVATE'},after:{secret:'PRIVATE'}};
const loan={id:'loan',kind:'line-movement',line:'C',destinationLine:'B',employees:['C1'],effectiveAt:at('08:00'),endsAt:at('17:00'),approved:true};
const onward={...loan,id:'child',line:'B',destinationLine:'A',effectiveAt:at('09:00'),endsAt:at('12:00'),parentMovementIds:['loan']};
const day={date,working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false};
const schedules=['A','B'].map(line=>({line,days:[day],input:{dailySchedule:[day]},roster:[{date,hc:[],ot:[]}]}));
test('personal HR does not enroll unused C employees in A/B; monthly deductions intersect actual chain once',()=>{
 for(const line of ['A','B']){assert.deepEqual(projectPersonalHr([absence],{line,employees,references:schedules}),[]);assert.equal(monthlyAttendance({events:[absence],schedules,employees,month:'2026-10',line}).people.length,0);}
 const events=[loan,onward,{...absence,effectiveAt:at('08:30'),endsAt:at('10:00')}];
 const a=monthlyAttendance({events,schedules,employees,month:'2026-10',line:'A'}).people[0],b=monthlyAttendance({events,schedules,employees,month:'2026-10',line:'B'}).people[0];
 assert.equal(a.absentHc,1);assert.equal(b.absentHc,0.5);assert.ok(Math.abs(a.hc-11/6)<1e-9);assert.ok(Math.abs(b.hc-13/3)<1e-9);assert.ok(Math.abs(a.hc+b.hc-37/6)<1e-9);
 for(const line of ['A','B']){const scopedEvents=[loan,onward,...projectPersonalHr(events,{line,employees,references:schedules})];const scoped=monthlyAttendance({events:scopedEvents,schedules,employees,month:'2026-10',line}).people[0];assert.equal(scoped.hc,line==='A'?a.hc:b.hc);}
});
test('Line read clips personal facts to loan ownership, removes raw note/audit and remains read-only',()=>{
 const history=[absence,loan,onward],a=projectPersonalHr(history,{line:'A',employees}),b=projectPersonalHr(history,{line:'B',employees});
 assert.deepEqual(a.map(e=>[e.effectiveAt,e.endsAt]),[[iso('09:00'),iso('12:00')]]);assert.deepEqual(b.map(e=>[e.effectiveAt,e.endsAt]),[[iso('08:00'),iso('09:00')],[iso('12:00'),iso('17:00')]]);
 for(const e of [...a,...b]){assert.equal(e.hrScopeProjection,true);assert.equal(canEditAttendance(e,{hr:true,manager:true}),false);assert.ok(!JSON.stringify(e).includes('PRIVATE'));assert.deepEqual(e.employees,['C1']);}
 const expiredStart={id:'station',kind:'start',sourceId:'JOB-A',line:'A',count:1,employees:['C1'],effectiveAt:at('09:00')};assert.deepEqual(projectPersonalHr([...history,expiredStart],{line:'A',employees,orders:[{id:'JOB-A',line:'A'}]}),a,'station cannot extend expired borrowing');
});
test('approved named roster is restricted to its working shift and employee windows',()=>{
 const refs=[{...schedules[0],roster:[{date,hc:['C1'],ot:[],hcWindows:{C1:[[540,720]]}}]}];
 const a=projectPersonalHr([absence],{line:'A',employees,references:refs});assert.deepEqual(a.map(e=>[e.effectiveAt,e.endsAt]),[[iso('09:00'),iso('12:00')]]);
 assert.deepEqual(projectPersonalHr([absence],{line:'A',employees,references:[{...refs[0],days:[{...day,working:false}]}]}),[]);
});
test('edit and cancel use current facts only; old scope records remain untouched',()=>{
 const corrected={...absence,id:'edit',supersedes:'hr',effectiveAt:at('11:00'),endsAt:at('14:00')};
 assert.deepEqual(projectPersonalHr([absence,corrected,loan,onward],{line:'A',employees}).map(e=>[e.effectiveAt,e.endsAt]),[[iso('11:00'),iso('12:00')]]);
 assert.deepEqual(projectPersonalHr([absence,corrected,loan,onward,{id:'cancel',kind:'attendance-cancel',supersedes:'edit',approved:true}],{line:'A',employees}),[]);
 assert.deepEqual(projectPersonalHr([{...absence,attendanceScope:undefined},loan],{line:'B',employees}),[]);
});
