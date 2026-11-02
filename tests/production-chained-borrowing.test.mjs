import test from 'node:test';
import assert from 'node:assert/strict';
import {transferStaffCandidates,activeStaffMovement,isPresent,effectiveAttendance} from '../lib/production-attendance.mjs';
import {monthlyAttendance} from '../lib/production-monthly-attendance.mjs';
const date='2026-10-16',at=time=>`${date}T${time}:00+07:00`;
const employees=[...Array.from({length:10},(_,i)=>({id:`B${i}`,line:'B',active:true})),{id:'C1',line:'C',active:true},{id:'C2',line:'C',active:true}];
const loan={id:'parent',kind:'line-movement',line:'C',destinationLine:'B',employees:['C1','C2'],effectiveAt:at('08:00'),endsAt:at('17:00')};
const onward={id:'child',kind:'line-movement',line:'B',destinationLine:'A',employees:['C1'],effectiveAt:at('09:00'),endsAt:at('12:00'),parentMovementIds:['parent']};
const candidates=(events,line='B',start='08:00',end='17:00',references=[])=>transferStaffCandidates({events,employees,line,effectiveAt:at(start),endsAt:at(end),references}).map(e=>e.id);
test('source B includes ten home staff plus two actual incoming loans for the full interval',()=>{
 assert.equal(candidates([loan]).length,12);assert.equal(candidates([loan],'C').length,0);
 assert.equal(candidates([loan],'B','07:00','17:00').length,10);
 assert.equal(candidates([loan],'B','08:00','17:01').length,10);
 assert.equal(candidates([loan],'B','17:00','18:00').length,10);
 assert.deepEqual(employees.slice(-2).map(e=>e.line),['C','C']);
});
test('onward loan has one owner and automatically returns to B, then C',()=>{
 const events=[loan,onward];
 assert.equal(candidates(events).length,11);assert.equal(candidates(events,'B','12:00','17:00').length,12);
 assert.deepEqual(candidates(events,'A','09:00','12:00'),['C1']);
 for(const [time,line] of [['08:00','B'],['09:00','A'],['12:00','B']])assert.equal(activeStaffMovement(events,'C1',Date.parse(at(time))).destinationLine,line);
 assert.equal(activeStaffMovement(events,'C1',Date.parse(at('17:00'))),undefined);
 for(const [minute,owner] of [[480,'B'],[540,'A'],[720,'B'],[1020,'C']]){
  const present=['A','B','C'].filter(line=>isPresent({roster:[{date,hc:line==='C'?['C1']:[],ot:[]}]},events,'C1',line,date,minute));assert.deepEqual(present,[owner]);
 }
});
test('same-start chain resolves by dependency, independent of event retrieval order',()=>{
 const child={...onward,effectiveAt:loan.effectiveAt};
 assert.equal(activeStaffMovement([child,loan],'C1',Date.parse(at('08:00'))).id,'child');
 assert.deepEqual(candidates([child,loan],'A','08:00','12:00'),['C1']);
});
test('cancelled and superseded loans disappear; inactive employees cannot be borrowed',()=>{
 const cancel={id:'cancel',kind:'attendance-cancel',supersedes:'parent',approved:true};
 assert.equal(candidates([loan,cancel]).length,10);
 assert.equal(candidates([{...loan,voided:true}]).length,10);
 assert.equal(candidates([{...loan,approved:false}]).length,10);
 const changed={...loan,id:'changed',supersedes:'parent',endsAt:at('10:00')};assert.equal(candidates([loan,changed]).length,10);
 assert.equal(transferStaffCandidates({employees:[{...employees[0],active:false}],line:'B',effectiveAt:at('08:00'),endsAt:at('17:00')}).length,0);
});
test('approved Capacity inbound windows count only while fully assigned to source',()=>{
 const day={date,working:true,hcStart:'08:00',hcEnd:'17:00',ot:false};
 const references=[{line:'B',days:[day],input:{dailySchedule:[day]},roster:[{date,hc:[...employees.slice(0,10).map(e=>e.id),'C1','C2'],ot:[],hcWindows:{C1:[[480,1020]],C2:[[540,720]]}}]}];
 assert.equal(candidates([],'B','08:00','17:00',references).length,11);
 assert.equal(candidates([],'B','09:00','12:00',references).length,12);
 assert.deepEqual(candidates([],'C','09:00','12:00',references),[]);
});
test('monthly labor counts chained staff once and attributes source B for onward loan',()=>{
 const day={date,working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',breaks:[{start:'10:00',end:'10:10'},{start:'15:00',end:'15:10'}],ot:false};
 const schedules=['A','B','C'].map(line=>({line,days:[day],input:{dailySchedule:[day]},roster:[{date,hc:line==='C'?['C1']:[],ot:[]}]}));
 const totals=['A','B','C'].map(line=>monthlyAttendance({events:[loan,onward],schedules,employees:[employees.at(-2)],month:'2026-10',line}));
 const hours=totals.map(result=>result.people[0]?.hc??0);
 assert.ok(Math.abs(hours.reduce((a,b)=>a+b,0)-23/3)<1e-9);
 assert.ok(Math.abs(hours[0]-17/6)<1e-9);
 assert.ok(Math.abs(totals[0].people[0].transferFromHours.B-17/6)<1e-9);
});

test('station transfers during a temporary loan cannot extend its line ownership',()=>{
 const station={id:'station',kind:'transfer',line:'B',destinationLine:'A',employees:['C1'],effectiveAt:at('10:00'),sourceId:'JOB-B',destinationId:'JOB-A'};
 for(const event of [station,{...station,orderAssignmentOnlyEmployees:['C1']}]){
  assert.equal(activeStaffMovement([loan,onward,event],'C1',Date.parse(at('11:00'))).id,'child');
  assert.equal(activeStaffMovement([loan,onward,event],'C1',Date.parse(at('12:00'))).id,'parent');
  assert.equal(activeStaffMovement([loan,onward,event],'C1',Date.parse(at('17:00'))),undefined);
  assert.deepEqual(candidates([loan,onward,event],'A','12:00','17:00'),[]);
  assert.deepEqual(candidates([loan,onward,event],'A','17:00','18:00'),[]);
 }
 const canceled={id:'cancel',kind:'attendance-cancel',supersedes:'child',approved:true};
 assert.equal(activeStaffMovement([loan,onward,{...station,orderAssignmentOnlyEmployees:['C1']},canceled],'C1',Date.parse(at('11:00'))).id,'parent');
 for(const events of [[loan,onward,station,canceled],effectiveAttendance([loan,onward,station,canceled])]){
  assert.equal(activeStaffMovement(events,'C1',Date.parse(at('13:00'))).id,'parent');
  assert.equal(activeStaffMovement(events,'C1',Date.parse(at('17:00'))),undefined);
 }
 const corrected={...onward,id:'corrected',supersedes:'child',effectiveAt:at('11:00'),endsAt:at('12:00')};
 assert.equal(activeStaffMovement(effectiveAttendance([loan,onward,station,corrected]),'C1',Date.parse(at('13:00'))).id,'parent');
 assert.equal(station.orderAssignmentOnlyEmployees,undefined,'normalization must not mutate the persisted event');
});
test('attendance override cannot duplicate a worker assigned by a loan to another line',()=>{
 const day={date,working:true,hcStart:'08:00',hcEnd:'17:00',lunchStart:'12:00',lunchEnd:'13:00',ot:false};
 const schedules=['A','B','C'].map(line=>({line,days:[day],input:{dailySchedule:[day]},roster:[{date,hc:line==='C'?['C1']:[],ot:[]}]}));
 const override={id:'override',kind:'attendance-override',line:'B',employees:['C1'],effectiveAt:at('09:00'),endsAt:at('12:00')};
 const totals=['A','B','C'].map(line=>monthlyAttendance({events:[loan,onward,override],schedules,employees:[employees.at(-2)],month:'2026-10',line}).people[0]?.hc??0);
 assert.ok(Math.abs(totals.reduce((a,b)=>a+b,0)-23/3)<1e-9);
});

test('closing a parent keeps equal-start child ownership through historical parent ID',()=>{
 const child={...onward,effectiveAt:loan.effectiveAt};
 const closed={...loan,id:'closed-parent',supersedes:loan.id,before:loan,recordedAt:'2026-11-02T01:00:00Z'};
 assert.equal(activeStaffMovement([child,loan,closed],'C1',Date.parse(at('08:00'))).id,child.id);
});
