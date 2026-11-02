import test from 'node:test';
import assert from 'node:assert/strict';
import {newDailyCapacity,calculateCapacity} from '../lib/capacity.mjs';
import {transferCapacityStaff,removeCapacityTransfer,validateCapacityAssignments} from '../lib/capacity-transfers.mjs';
import {isPresent,attendanceEdges} from '../lib/production-attendance.mjs';
const week='2026-10-12',employees=[{id:'A1',line:'A',active:true},{id:'B1',line:'B',active:true},{id:'C1',line:'C',active:true}];
const rows=()=>['A','B'].map(line=>{const r=newDailyCapacity(week,line);r.input.workers=1;r.input.dailyRoster=r.input.dailySchedule.map(d=>({date:d.date,hc:d.working?[line+'1']:[],ot:[]}));return r;});
const request={ids:['A1'],from:'A',to:'B',date:week,toDate:week,shift:'hc',start:'09:00',end:'11:00'};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
test('partial A to B conserves capacity and excludes break once; undo restores',()=>{
 const before=rows(),changed=transferCapacityStaff(before,employees,request),a=calculateCapacity(changed.rows[0].input,week),b=calculateCapacity(changed.rows[1].input,week),baseline=calculateCapacity(before[0].input,week);
 near(b.hcHours-baseline.hcHours,2-1/6);near(b.hcHours+a.hcHours,2*baseline.hcHours);
 assert.deepEqual(before[0].input.dailyRoster[0].hc,['A1']);
 const restored=removeCapacityTransfer(changed.rows,changed.rows[1].input.staffTransfers[0].id);
 near(calculateCapacity(restored.rows[0].input,week).hcHours,baseline.hcHours);near(calculateCapacity(restored.rows[1].input,week).hcHours,baseline.hcHours);
});
test('C staff can join two days; lunch and breaks are excluded, duplicate/overlap rejected',()=>{
 const before=rows(),changed=transferCapacityStaff(before,employees,{...request,ids:['C1'],from:'C',toDate:'2026-10-13',start:'08:00',end:'17:00'});
 near(calculateCapacity(changed.rows[1].input,week).hcHours-calculateCapacity(before[1].input,week).hcHours,2*(8-1/3));
 assert.throws(()=>transferCapacityStaff(changed.rows,employees,{...request,ids:['C1'],from:'C'}),/đã có lịch/);
 assert.throws(()=>transferCapacityStaff(changed.rows,employees,{...request,ids:['C1'],from:'C',to:'A'}),/trùng thời gian/);
 assert.throws(()=>transferCapacityStaff(before,employees,{...request,end:'08:00'}),/hợp lệ/);
 assert.throws(()=>transferCapacityStaff(before,employees,{...request,toDate:'2026-10-20'}),/thuộc tuần/);
});
test('locked source cannot change; persisted malformed or overlapping intervals fail validation',()=>{
 const before=rows();before[0].status='Đã xác nhận';assert.throws(()=>transferCapacityStaff(before,employees,request),/Nháp/);
 const bad=rows();bad[0].input.dailyRoster[0].hcWindows={A1:[[470,600]]};assert.throws(()=>validateCapacityAssignments(bad),/nằm trong ca/);
 const duplicate=rows();duplicate[1].input.dailyRoster[0].hc.push('A1');assert.throws(()=>validateCapacityAssignments(duplicate),/trùng thời gian/);
});
test('production attendance follows interval boundaries in approved roster',()=>{
 const changed=transferCapacityStaff(rows(),employees,request),input=changed.rows[1].input,ref={roster:input.dailyRoster,input};
 assert.equal(isPresent(ref,[],'A1','B',week,8*60),false);assert.equal(isPresent(ref,[],'A1','B',week,9*60),true);assert.equal(isPresent(ref,[],'A1','B',week,11*60),false);
 assert.ok(attendanceEdges(ref,week).includes(540));assert.ok(attendanceEdges(ref,week).includes(660));
});

test('monthly attendance counts transferred windows rather than the full shift',async()=>{
 const {monthlyAttendance}=await import('../lib/production-monthly-attendance.mjs');
 const changed=transferCapacityStaff(rows(),employees,{...request,ids:['C1'],from:'C'}),input=changed.rows[1].input;
 const schedules=[{key:week+':B',line:'B',days:input.dailySchedule,roster:input.dailyRoster,input}];
 const result=monthlyAttendance({month:'2026-10',line:'B',employees,schedules});
 const c=result.people.find(p=>p.id==='C1');near(c.calendarHc,11/6);near(c.hc,11/6);near(c.transferFromHours.C,11/6);
});
