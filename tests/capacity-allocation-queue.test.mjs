import test from 'node:test';
import assert from 'node:assert/strict';
import {newDailyCapacity,calculateCapacity} from '../lib/capacity.mjs';
import {applyCapacityAllocation,applyCapacityAllocationCancellation,assertCapacityAllocationPreserved} from '../lib/capacity-allocation-queue.mjs';
import {rosterRanges} from '../lib/capacity-transfers.mjs';
const week='2026-10-19',now='2026-10-16T09:00:00Z';
const employees=[{id:'A1',name:'A One',line:'A',active:true},{id:'B1',name:'B One',line:'B',active:true},{id:'C1',name:'C One',line:'C',active:true}];
function records(start=week){return [{key:start,payload:{schemaVersion:1,week:start,revision:3,rows:['A','B'].map(line=>{
 const row=newDailyCapacity(start,line);row.input.workers=1;row.input.otWorkers=1;row.input.dailyRoster=row.input.dailySchedule.map(d=>({date:d.date,hc:d.working?[line+'1']:[],ot:[]}));row.result=calculateCapacity(row.input,start);row.availableHours=row.result.availableHours;return row;
})}}];}
const offer=(source='C',from=`${week}T08:00:00+07:00`,to=`${week}T17:00:00+07:00`)=>({id:'offer-one',sourceLine:source,effectiveAt:from,endsAt:to,people:[{id:source+'1',name:source+' One'}]});
const allocation=(source='C',target='A',from=`${week}T09:00:00+07:00`,to=`${week}T11:00:00+07:00`,id='allocation-one')=>({id,employeeId:source+'1',targetLine:target,effectiveAt:from,endsAt:to,actorId:'manager'});
const apply=(input=records(),o=offer(),a=allocation(),options={})=>applyCapacityAllocation(input,employees,o,a,{now,actorId:'manager',...options});
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-8,`${actual} != ${expected}`);

test('C to A changes only the Capacity draft and keeps exact partial headcount hours',()=>{
 const before=records(),copy=structuredClone(before),result=apply(before),saved=result.records[0].payload,a=saved.rows[0];
 assert.deepEqual(before,copy);assert.equal(saved.revision,4);assert.equal(a.version,0);assert.equal(a.status,'Nháp');
 assert.deepEqual(a.input.dailyRoster[0].hcWindows.C1,[[540,660]]);assert.equal(a.input.dailyRoster[0].hc.length,2);
 near(a.result.hcHours-copy[0].payload.rows[0].result.hcHours,11/6);
 assert.deepEqual(saved.rows[1],copy[0].payload.rows[1]);assert.equal(a.input.staffTransfers[0].queuePlanning,true);
 assert.equal(a.input.staffTransfers[0].allocationId,'allocation-one');assert.equal(a.history.at(-1).action,'staffAllocation');
 assert.deepEqual(result.planningSegments,[{week,date:week,shift:'hc',start:'09:00',end:'11:00',from:'C',to:'A',employeeId:'C1',transferId:`capacity-allocation-one-${week}-hc`}]);
 assert.equal('events' in result,false);assert.equal(saved.rows.some(r=>r.line==='C'),false);
});

test('A to C subtracts only the offered subwindow and never materializes a Capacity C row',()=>{
 const before=records(),result=apply(before,offer('A'),allocation('A','C')),saved=result.records[0].payload,a=saved.rows[0];
 assert.deepEqual(a.input.dailyRoster[0].hcWindows.A1,[[480,540],[660,1020]]);
 near(before[0].payload.rows[0].result.hcHours-a.result.hcHours,11/6);
 assert.equal(a.input.staffTransfers[0].to,'C');assert.equal(saved.rows.length,2);assert.equal(saved.rows.some(r=>r.line==='C'),false);
 assert.deepEqual(saved.rows[1],before[0].payload.rows[1]);
});

test('a continuous multi-day availability span becomes precise daily scheduled segments',()=>{
 const o=offer('C',`${week}T08:00:00+07:00`,'2026-10-23T17:00:00+07:00'),a=allocation('C','B',o.effectiveAt,o.endsAt);
 const before=records(),result=apply(before,o,a),b=result.records[0].payload.rows[1];
 assert.equal(result.planningSegments.length,5);assert.ok(result.planningSegments.every(s=>s.start==='08:00'&&s.end==='17:00'&&s.shift==='hc'));
 near(b.result.hcHours-before[0].payload.rows[1].result.hcHours,5*(8-1/3));
 assert.equal(b.input.staffTransfers.length,5);assert.equal(b.history.length,1);
});

test('multi-week acceptance is returned atomically and skips nonworking days',()=>{
 const input=[...records(),...records('2026-10-26')],o=offer('C','2026-10-23T15:00:00+07:00','2026-10-26T11:00:00+07:00'),a=allocation('C','A',o.effectiveAt,o.endsAt),result=apply(input,o,a);
 assert.deepEqual(result.weeks,[week,'2026-10-26']);assert.deepEqual(result.planningSegments.map(s=>[s.date,s.start,s.end]),[['2026-10-23','15:00','17:00'],['2026-10-24','08:00','17:00'],['2026-10-26','08:00','11:00']]);
 assert.ok(result.records.every(r=>r.payload.revision===4));assert.ok(input.every(r=>r.payload.revision===3));
 assert.throws(()=>apply(records(),o,a),/lưu nháp Capacity/);
});

test('HC and OT are separate roster windows, with the gap excluded from capacity',()=>{
 const input=records();input[0].payload.rows[0].input.dailySchedule[0].ot=true;input[0].payload.rows[0].input.dailyRoster[0].ot=['A1'];
 const o=offer('C',`${week}T16:00:00+07:00`,`${week}T19:00:00+07:00`),result=apply(input,o,allocation('C','A',o.effectiveAt,o.endsAt)),row=result.records[0].payload.rows[0];
 assert.deepEqual(result.planningSegments.map(s=>[s.shift,s.start,s.end]),[['hc','16:00','17:00'],['ot','17:30','19:00']]);
 assert.deepEqual(row.input.dailyRoster[0].otWindows.C1,[[1050,1140]]);
 assert.equal(row.history.length,1);
});

test('no schedule coverage, missing named roster, locked rows, and legacy weeks fail closed',()=>{
 const nonworking=offer('C','2026-10-25T08:00:00+07:00','2026-10-25T17:00:00+07:00');assert.throws(()=>apply(records(),nonworking,allocation('C','A',nonworking.effectiveAt,nonworking.endsAt)),/không có giờ/);
 const unnamed=records();delete unnamed[0].payload.rows[0].input.dailyRoster;assert.throws(()=>apply(unnamed),/danh sách nhân viên/);
 for(const direction of ['C','A']){const input=records();input[0].payload.rows[0].status='Đã xác nhận';assert.throws(()=>apply(input,offer(direction),allocation(direction,direction==='C'?'A':'C')),/đang khóa/);}
 assert.throws(()=>apply([{key:week,payload:{week,line:'A'}}]),/lưu nháp Capacity/);
});

test('adjustment cutoff matches Saturday Vietnam and a valid legacy approval is consumed',()=>{
 const input=records();Object.assign(input[0].payload.rows[0],{reviewStatus:'adjusting'});
 assert.doesNotThrow(()=>apply(input,offer(),allocation(),{now:'2026-10-17T16:59:59Z'}));
 assert.throws(()=>apply(input,offer(),allocation(),{now:'2026-10-17T17:00:00Z'}),/hạn điều chỉnh/);
 Object.assign(input[0].payload.rows[0],{status:'Đã xác nhận',reviewStatus:'adjust-approved',version:2,editPermission:{version:2,used:false,approvedBy:'planner',approvedAt:now}});
 const row=apply(input).records[0].payload.rows[0];assert.equal(row.status,'Nháp');assert.equal(row.reviewStatus,'adjusting');assert.equal(row.editPermission.used,true);assert.equal(row.version,2);
 input[0].payload.rows[0].editPermission.used=true;assert.throws(()=>apply(input),/chưa được KHSX/);
});

test('the old KHSX approved snapshot remains unchanged during draft allocation',()=>{
 const input=records(),row=input[0].payload.rows[0],accepted=structuredClone(row.input);
 Object.assign(row,{reviewStatus:'adjusting',version:2,khsxAcceptedAt:'2026-10-10T01:00:00Z',lastConfirmed:{input:accepted,version:2},history:[{action:'review',decision:'approve',request:{kind:'capacity'},version:2,after:accepted}]});
 const next=apply(input).records[0].payload.rows[0];assert.deepEqual(next.lastConfirmed,row.lastConfirmed);assert.deepEqual(next.history[0],row.history[0]);assert.equal(next.khsxAcceptedAt,row.khsxAcceptedAt);assert.equal(next.version,2);
});

test('source leave, duplicate assignments, inactive staff and mismatched offer windows are rejected',()=>{
 const leave=records();leave[0].payload.rows[0].input.dailyHcLeave=[{date:week,to:week,employees:['A1'],people:1,mode:'hours',start:'09:00',end:'11:00'}];assert.throws(()=>apply(leave,offer('A'),allocation('A','C')),/đăng ký nghỉ/);
 const accepted=apply().records;assert.throws(()=>apply(accepted,offer(),allocation('C','B',undefined,undefined,'allocation-two')),/trùng thời gian/);
 const inactive=employees.map(e=>e.id==='C1'?{...e,active:false}:e);assert.throws(()=>applyCapacityAllocation(records(),inactive,offer(),allocation(),{now}),/Line nguồn/);
 assert.throws(()=>apply(records(),offer(),allocation('C','A',`${week}T07:00:00+07:00`)),/nằm trong đề nghị/);
 assert.throws(()=>apply(records(),offer(),allocation('C','A',`${week}T09:00:30+07:00`)),/chính xác đến phút/);
});

test('legacy saves cannot erase, alter, narrow or widen accepted queue assignments',()=>{
 const previous=apply().records[0].payload.rows;
 assert.doesNotThrow(()=>assertCapacityAllocationPreserved(previous,structuredClone(previous)));
 for(const modify of [rows=>{rows[0].input.staffTransfers=[];},rows=>{rows[0].input.staffTransfers[0].to='B';},rows=>{rows[0].input.dailyRoster[0].hcWindows.C1=[[540,600]];},rows=>{delete rows[0].input.dailyRoster[0].hcWindows.C1;},rows=>{rows[0].input.dailySchedule[0].working=false;}]){
  const next=structuredClone(previous);modify(next);assert.throws(()=>assertCapacityAllocationPreserved(previous,next),/phân bổ|khoảng giờ/i);
 }
 const unrelated=structuredClone(previous);unrelated[0].input.factor=90;assert.doesNotThrow(()=>assertCapacityAllocationPreserved(previous,unrelated));
 assert.throws(()=>assertCapacityAllocationPreserved(records()[0].payload.rows,previous),/Không thể thêm/);
});

test('legacy saves cannot restore outgoing A hours, and later adjacent queue acceptance is allowed',()=>{
 const out=apply(records(),offer('A'),allocation('A','C')).records[0].payload.rows,next=structuredClone(out);delete next[0].input.dailyRoster[0].hcWindows.A1;
 assert.throws(()=>assertCapacityAllocationPreserved(out,next),/phân bổ/);
 const accepted=apply().records,result=apply(accepted,offer(),allocation('C','B',`${week}T11:00:00+07:00`,`${week}T12:00:00+07:00`,'allocation-two'));
 assert.equal(result.records[0].payload.revision,5);assert.deepEqual(result.records[0].payload.rows[0],accepted[0].payload.rows[0]);
 assert.deepEqual(rosterRanges(result.records[0].payload.rows[1].input.dailyRoster[0],result.records[0].payload.rows[1].input.dailySchedule[0],'hc','C1'),[[660,720]]);
});


test('receiver cancellation reverses only allocated draft minutes in either direction and preserves audit',()=>{
 for(const [source,target] of [['C','A'],['A','C']]){
  const before=records(),o=offer(source),a={...allocation(source,target),planning:true};
  const accepted=apply(before,o,a);a.planningSegments=accepted.planningSegments;
  const canceled=applyCapacityAllocationCancellation(accepted.records,employees,o,a,{now,actorId:'receiver',reason:'Đổi kế hoạch'});
  const row=canceled.records[0].payload.rows[0];
  near(row.result.hcHours,before[0].payload.rows[0].result.hcHours);
  assert.deepEqual(rosterRanges(row.input.dailyRoster[0],row.input.dailySchedule[0],'hc',source+'1'),source==='A'?[[480,1020]]:[]);
  assert.equal(row.input.staffTransfers.length,0);assert.equal(row.history.at(-1).action,'staffAllocationCancel');assert.equal(row.history.at(-1).reason,'Đổi kế hoạch');
  assert.equal(row.history.at(-2).action,'staffAllocation');assert.equal(canceled.records[0].payload.revision,5);assert.equal(canceled.records[0].payload.rows.length,2);assert.deepEqual(canceled.records[0].payload.rows[1],accepted.records[0].payload.rows[1]);
  assert.equal(accepted.records[0].payload.rows[0].input.staffTransfers.length,1);
 }
});

test('cancellation rejects locked, past, missing or changed segments without mutating inputs',()=>{
 const o=offer(),a={...allocation(),planning:true},accepted=apply(records(),o,a);a.planningSegments=accepted.planningSegments;
 const options={now,actorId:'receiver',reason:'Đổi kế hoạch'};
 const locked=structuredClone(accepted.records);locked[0].payload.rows[0].status='Đã xác nhận';
 assert.throws(()=>applyCapacityAllocationCancellation(locked,employees,o,a,options),/đang khóa/);
 assert.throws(()=>applyCapacityAllocationCancellation(accepted.records,employees,o,a,{...options,now:'2026-10-19T03:00:00Z'}),/đã bắt đầu/);
 assert.throws(()=>applyCapacityAllocationCancellation(accepted.records,employees,o,{...a,planningSegments:[]},options),/đầy đủ lịch sử/);
 const changed=structuredClone(accepted.records);changed[0].payload.rows[0].input.staffTransfers[0].end='12:00';
 assert.throws(()=>applyCapacityAllocationCancellation(changed,employees,o,a,options),/đã thay đổi/);
 assert.throws(()=>applyCapacityAllocationCancellation(accepted.records,employees,o,a,{...options,reason:''}),/lý do/);
});

test('cancel one allocation leaves a second allocation and unrelated draft edits intact',()=>{
 const o=offer(),a={...allocation(),planning:true},first=apply(records(),o,a);a.planningSegments=first.planningSegments;
 const other={...allocation('C','A',`${week}T13:00:00+07:00`,`${week}T15:00:00+07:00`,'allocation-two'),planning:true};
 const second=apply(first.records,o,other);second.records[0].payload.rows[1].input.factor=91;
 const canceled=applyCapacityAllocationCancellation(second.records,employees,o,a,{now,actorId:'receiver',reason:'Đổi kế hoạch'});
 assert.equal(canceled.records[0].payload.rows[0].input.staffTransfers[0].allocationId,'allocation-two');
 assert.deepEqual(canceled.records[0].payload.rows[0].input.dailyRoster[0].hcWindows.C1,[[780,900]]);
 assert.equal(canceled.records[0].payload.rows[1].input.factor,91);
});
