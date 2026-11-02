import test from 'node:test';
import assert from 'node:assert/strict';
import {allocationAuthority,allocationInstant,allocationPending,allocationQueueView,applyAllocationCommand,emptyAllocationQueue} from '../lib/production-allocation-queue.mjs';
import {activeStaffMovement,isPresent} from '../lib/production-attendance.mjs';
const now='2026-10-16T00:00:00.000Z',time=(day,hour)=>`2026-10-${day}T${hour}:00:00+07:00`;
const employees=[{id:'C1',name:'Nhân viên C 1',line:'C',active:true},{id:'C2',name:'Nhân viên C 2',line:'C',active:true},{id:'A1',name:'Nhân viên A 1',line:'A',active:true},{id:'B1',name:'Nhân viên B 1',line:'B',active:true}];
const authority=group=>({actorId:group==='C'?'manager-c':'manager-ab',group,lines:group==='C'?['C']:['A','B']});
const ctx=(group='C',extra={})=>({authority:authority(group),employees,blockers:[],now,...extra});
let seq=0;const command=(state,body)=>({requestId:`test-command-${String(++seq).padStart(8,'0')}`,expectedRevision:state.revision,...body});
const offerBody={action:'offer',reason:'Hỗ trợ kế hoạch tuần',sourceLine:'C',employees:['C1','C2'],effectiveAt:time('19','08'),endsAt:time('23','17')};
function offered(){return applyAllocationCommand(emptyAllocationQueue(),command(emptyAllocationQueue(),offerBody),ctx());}
const allocate=(state,offerId,employeeId='C1',targetLine='A',start=time('19','08'),end=time('19','12'))=>command(state,{action:'allocate',offerId,employeeId,targetLine,effectiveAt:start,endsAt:end});
test('scope is explicit, account-bound and never inferred from administrator, department or line',()=>{
 const config={schemaVersion:1,enabled:true,managers:[{userId:'manager-c',group:'C'},{userId:'manager-ab',group:'AB'}]};
 const actor={userId:'manager-c',login:'mail@example.test',grants:['Quản lý sản xuất / Lịch SX thực tế / Sửa']};
 assert.deepEqual(allocationAuthority(actor,config),authority('C'));
 assert.equal(allocationAuthority({...actor,userId:'stranger',isAdmin:true,department:'QLSX',line:'C'},config),null);
 assert.equal(allocationAuthority({...actor,authMode:'quick_line'},config),null);
 assert.deepEqual(allocationAuthority({...actor,grants:[]},config),authority('C'));
 assert.equal(allocationAuthority({...actor,active:false},config),null);
 for(const bad of [undefined,{...config,enabled:false},{...config,schemaVersion:2},{...config,managers:[{userId:'manager-c',group:'ABC'}]}])assert.equal(allocationAuthority(actor,bad),null);
 assert.throws(()=>allocationQueueView(emptyAllocationQueue(),null,now),{status:403});
});
test('strict calendar and timezone validation rejects rollover, unbounded and reversed windows',()=>{
 for(const value of ['2026-02-30T08:00:00+07:00','2026-13-01T08:00:00Z','2026-01-01T24:00:00Z','2026-01-01T08:60:00Z','2026-01-01T08:00:00+14:01','2026-01-01T08:00:00','bad','',null])assert.throws(()=>allocationInstant(value),{status:422});
 assert.equal(allocationInstant('2028-02-29T08:00:00+07:00'),Date.parse('2028-02-29T01:00:00Z'));
 for(const window of [{endsAt:null},{endsAt:offerBody.effectiveAt},{effectiveAt:time('15','08')}])assert.throws(()=>applyAllocationCommand(emptyAllocationQueue(),command(emptyAllocationQueue(),{...offerBody,...window}),ctx()),{status:422});
});
test('offering names creates no movement, station entry or payroll event',()=>{
 const result=offered();assert.deepEqual(result.events,[]);assert.equal(result.state.offers.length,1);assert.equal(result.state.audit.length,1);
 assert.deepEqual(result.state.offers[0].people,employees.slice(0,2).map(({id,name})=>({id,name})));
 assert.equal(allocationQueueView(result.state,authority('AB'),now).pendingPeople,2);
});
test('receiver splits people, lines, days and subwindows while residual time stays pending',()=>{
 let {state,result}=offered();const id=result.offerId,allEvents=[];
 for(const [person,line,day,start,end] of [['C1','A','19','08','12'],['C2','B','20','09','11'],['C1','B','22','13','17']]){
  const next=applyAllocationCommand(state,allocate(state,id,person,line,time(day,start),time(day,end)),ctx('AB'));state=next.state;allEvents.push(...next.events);
 }
 assert.equal(state.offers[0].allocations.length,3);assert.equal(allEvents.length,0);
 assert.ok(state.offers[0].allocations.every(a=>a.planning===true&&!a.movementId));
 assert.deepEqual(allocationPending(state.offers[0],'C1'),[
  {effectiveAt:new Date(time('19','12')).toISOString(),endsAt:new Date(time('22','13')).toISOString()},
  {effectiveAt:new Date(time('22','17')).toISOString(),endsAt:new Date(time('23','17')).toISOString()},
 ]);
 assert.equal(activeStaffMovement(allEvents,'C1',Date.parse(time('19','08'))),undefined);
});
test('both assembly source lines can offer to C, but not each other',()=>{
 for(const line of ['A','B']){
  const initial=emptyAllocationQueue();const offered=applyAllocationCommand(initial,command(initial,{...offerBody,sourceLine:line,employees:[`${line}1`]}),ctx('AB'));
  const accepted=applyAllocationCommand(offered.state,allocate(offered.state,offered.result.offerId,`${line}1`,'C'),ctx('C'));
  assert.deepEqual(accepted.events,[]);assert.equal(accepted.state.offers[0].allocations[0].targetLine,'C');
  assert.throws(()=>applyAllocationCommand(offered.state,allocate(offered.state,offered.result.offerId,`${line}1`,'A'),ctx('AB')),{status:403});
 }
});
test('source/receiver forgery and foreign or inactive employees are rejected without mutation',()=>{
 const initial=emptyAllocationQueue(),before=structuredClone(initial);
 assert.throws(()=>applyAllocationCommand(initial,command(initial,offerBody),ctx('AB')),{status:403});
 for(const ids of [['A1'],['missing'],['C1','C1'],[]])assert.throws(()=>applyAllocationCommand(initial,command(initial,{...offerBody,employees:ids}),ctx()));
 assert.throws(()=>applyAllocationCommand(initial,command(initial,offerBody),ctx('C',{employees:employees.map(p=>({...p,active:false}))})),{status:403});
 assert.deepEqual(initial,before);
 const {state,result}=offered();assert.throws(()=>applyAllocationCommand(state,allocate(state,result.offerId),ctx('C')),{status:403});
 assert.throws(()=>applyAllocationCommand(state,allocate(state,result.offerId,'A1'),ctx('AB')),{status:403});
 assert.throws(()=>applyAllocationCommand(state,allocate(state,result.offerId,'C1','C'),ctx('AB')),{status:403});
});
test('overlap across offers, allocations and authoritative external conflicts is blocked; touching boundaries are allowed',()=>{
 const {state,result}=offered();
 assert.throws(()=>applyAllocationCommand(state,command(state,offerBody),ctx()),{status:409});
 for(const kind of ['movement','accepted-hr-absence','actual-station-work']){
  const blockers=[{employeeId:'C1',effectiveAt:time('19','09'),endsAt:time('19','10'),kind}];
  assert.throws(()=>applyAllocationCommand(state,allocate(state,result.offerId),ctx('AB',{blockers})),{status:409});
  assert.throws(()=>applyAllocationCommand(emptyAllocationQueue(),command(emptyAllocationQueue(),offerBody),ctx('C',{blockers})),{status:409});
 }
 const first=applyAllocationCommand(state,allocate(state,result.offerId),ctx('AB'));
 assert.throws(()=>applyAllocationCommand(first.state,allocate(first.state,result.offerId,'C1','B',time('19','11'),time('19','13')),ctx('AB')),{status:409});
 assert.doesNotThrow(()=>applyAllocationCommand(first.state,allocate(first.state,result.offerId,'C1','B',time('19','12'),time('19','13')),ctx('AB')));
 assert.throws(()=>applyAllocationCommand(state,allocate(state,result.offerId,'C1','A',time('18','08'),time('19','09')),ctx('AB')),{status:409});
});
test('sender can withdraw only pending time and preserves all allocation/audit evidence',()=>{
 const {state,result}=offered(),accepted=applyAllocationCommand(state,allocate(state,result.offerId),ctx('AB'));
 const withdraw=(s,start,end)=>command(s,{action:'withdraw',reason:'Điều chỉnh nhu cầu Line nguồn',offerId:result.offerId,employeeId:'C1',effectiveAt:time('19',start),endsAt:time('19',end)});
 assert.throws(()=>applyAllocationCommand(accepted.state,withdraw(accepted.state,'08','13'),ctx()),{status:409});
 assert.throws(()=>applyAllocationCommand(accepted.state,withdraw(accepted.state,'12','13'),ctx('AB')),{status:403});
 const after=applyAllocationCommand(accepted.state,withdraw(accepted.state,'12','13'),ctx());
 assert.deepEqual(after.events,[]);assert.deepEqual(after.state.offers[0].allocations,accepted.state.offers[0].allocations);
 assert.equal(after.state.audit.length,3);assert.equal(after.state.offers[0].withdrawals.length,1);
 assert.throws(()=>applyAllocationCommand(after.state,allocate(after.state,result.offerId,'C1','B',time('19','12'),time('19','13')),ctx('AB')),{status:409});
});
test('expiry is a read-only projection, clips past portions, and cannot create phantom assignments',()=>{
 const {state,result}=offered(),before=structuredClone(state);
 const during=allocationQueueView(state,authority('AB'),time('20','10'));
 assert.equal(during.offers[0].people[0].pending[0].effectiveAt,new Date(time('20','10')).toISOString());
 const expired=allocationQueueView(state,authority('AB'),time('23','17'));assert.equal(expired.pendingPeople,0);assert.equal(expired.offers[0].expired,true);
 assert.deepEqual(state,before);assert.throws(()=>applyAllocationCommand(state,allocate(state,result.offerId),ctx('AB',{now:time('23','18')})),{status:422});
});
test('same command replays exactly once; changed payload or actor cannot reuse identity',()=>{
 const {state,result}=offered(),body=allocate(state,result.offerId),first=applyAllocationCommand(state,body,ctx('AB'));
 const retry=applyAllocationCommand(first.state,body,ctx('AB'));
 assert.equal(retry.result.replayed,true);assert.deepEqual(retry.events,[]);assert.equal(retry.state,first.state);
 assert.throws(()=>applyAllocationCommand(first.state,{...body,targetLine:'B'},ctx('AB')),{status:409});
 assert.throws(()=>applyAllocationCommand(first.state,body,ctx('AB',{authority:{...authority('AB'),actorId:'other-manager'}})),{status:409});
});
test('receiver/receiver and receiver/withdraw races require the winning revision',()=>{
 const {state,result}=offered(),first=applyAllocationCommand(state,allocate(state,result.offerId),ctx('AB'));
 assert.throws(()=>applyAllocationCommand(first.state,allocate(state,result.offerId,'C1','B'),ctx('AB')),{status:409});
 assert.throws(()=>applyAllocationCommand(first.state,command(state,{action:'withdraw',reason:'Điều chỉnh nhu cầu Line nguồn',offerId:result.offerId,employeeId:'C1',effectiveAt:time('19','08'),endsAt:time('19','12')}),ctx()),{status:409});
});
test('DTO contains only offered identities and no unoffered HR, payroll or directory fields',()=>{
 const {state}=offered();state.offers[0].privatePayroll='must not disclose';state.offers[0].people[0].health='must not disclose';
 const view=allocationQueueView(state,authority('AB'),now),raw=JSON.stringify(view);
 assert.equal(view.offers[0].people.length,2);assert.ok(!raw.includes('A1'));assert.ok(!raw.includes('must not disclose'));assert.ok(!raw.includes('receipts'));assert.ok(!raw.includes('fingerprint'));
});

test('planning acceptance does not move actual attendance before Capacity approval',()=>{
 const initial=emptyAllocationQueue(),offered=applyAllocationCommand(initial,command(initial,{...offerBody,sourceLine:'A',employees:['A1']}),ctx('AB'));
 assert.deepEqual(offered.events,[]);
 const allocated=applyAllocationCommand(offered.state,allocate(offered.state,offered.result.offerId,'A1','C'),ctx('C'));
 const reference=line=>({roster:[{date:'2026-10-19',hc:line==='A'?['A1']:[],ot:[]}]});
 for(const [minute,owner] of [[479,'A'],[480,'A'],[719,'A'],[720,'A']]){
  assert.deepEqual(['A','B','C'].filter(line=>isPresent(reference(line),allocated.events,'A1',line,'2026-10-19',minute)),[owner]);
 }
});

const cancel=(state,offerId,allocationId,extra={})=>command(state,{action:'cancel',offerId,allocationId,reason:'Nhu cầu Line nhận thay đổi',...extra});
function allocated(){const sent=offered();return applyAllocationCommand(sent.state,allocate(sent.state,sent.result.offerId),ctx('AB'));}

test('offer, withdraw and cancel require a bounded nonblank reason, normalized and retained in history',()=>{
 const initial=emptyAllocationQueue(),sent=offered(),received=allocated();
 const withdrawBody={action:'withdraw',offerId:sent.result.offerId,employeeId:'C1',effectiveAt:time('19','08'),endsAt:time('19','12')};
 const cancelBody={action:'cancel',offerId:received.result.offerId,allocationId:received.result.allocationId};
 for(const reason of [undefined,null,'','  \n  ',17,{},'x'.repeat(501)]){
  for(const [state,body,group] of [[initial,offerBody,'C'],[sent.state,withdrawBody,'C'],[received.state,cancelBody,'AB']]){
   const before=structuredClone(state);
   assert.throws(()=>applyAllocationCommand(state,command(state,{...body,reason}),ctx(group)),{status:422});
   assert.deepEqual(state,before);
  }
 }
 const offeredWithReason=applyAllocationCommand(initial,command(initial,{...offerBody,reason:'  Cần hỗ trợ tuần tới  '}),ctx());
 assert.equal(offeredWithReason.state.offers[0].reason,'Cần hỗ trợ tuần tới');
 assert.equal(offeredWithReason.state.audit[0].reason,'Cần hỗ trợ tuần tới');
 assert.deepEqual(offeredWithReason.state.audit[0].employees,employees.slice(0,2).map(({id,name})=>({id,name})));
 assert.doesNotThrow(()=>applyAllocationCommand(initial,command(initial,{...offerBody,reason:'x'.repeat(500)}),ctx()));
 const withdrawn=applyAllocationCommand(sent.state,command(sent.state,{...withdrawBody,reason:'  Giữ lại nhân lực  '}),ctx());
 assert.equal(withdrawn.state.offers[0].withdrawals[0].reason,'Giữ lại nhân lực');
 assert.equal(withdrawn.state.audit.at(-1).employeeName,'Nhân viên C 1');
});

test('receiver cancels complete future planning allocation, preserving evidence and restoring pending',()=>{
 const received=allocated(),before=structuredClone(received.state),original=received.state.offers[0].allocations[0];
 const body=cancel(received.state,received.result.offerId,received.result.allocationId);
 const canceled=applyAllocationCommand(received.state,body,ctx('AB'));
 assert.deepEqual(received.state,before);assert.deepEqual(canceled.events,[]);
 const allocation=canceled.state.offers[0].allocations[0];
 assert.deepEqual(allocation,{...original,canceled:true,canceledBy:authority('AB').actorId,canceledAt:now,cancellationReason:body.reason});
 assert.deepEqual(allocationPending(canceled.state.offers[0],'C1'),[{effectiveAt:new Date(offerBody.effectiveAt).toISOString(),endsAt:new Date(offerBody.endsAt).toISOString()}]);
 const audit=canceled.state.audit.at(-1);
 for(const [key,value] of Object.entries({action:'cancel',reason:body.reason,actorId:authority('AB').actorId,at:now,employeeId:'C1',employeeName:'Nhân viên C 1',sourceLine:'C',targetLine:'A',allocationId:original.id}))assert.equal(audit[key],value);
 assert.deepEqual(audit.window,{effectiveAt:original.effectiveAt,endsAt:original.endsAt});
 const acceptedAgain=applyAllocationCommand(canceled.state,allocate(canceled.state,received.result.offerId,'C1','B'),ctx('AB'));
 assert.equal(acceptedAgain.state.offers[0].allocations.length,2);
 assert.equal(acceptedAgain.state.offers[0].allocations[1].targetLine,'B');
});

test('cancellation rejects sender, missing authority, wrong receiver target, legacy actual and started windows',()=>{
 const received=allocated(),body=cancel(received.state,received.result.offerId,received.result.allocationId),before=structuredClone(received.state);
 assert.throws(()=>applyAllocationCommand(received.state,body,ctx('C')),{status:403});
 assert.throws(()=>applyAllocationCommand(received.state,body,ctx('AB',{authority:null})),{status:403});
 for(const override of [{planning:false},{planning:undefined},{movementId:'actual-movement'},{targetLine:'C'}]){
  const state=structuredClone(received.state);Object.assign(state.offers[0].allocations[0],override);
  assert.throws(()=>applyAllocationCommand(state,body,ctx('AB')),{status:override.targetLine?403:409});
 }
 for(const current of [time('19','09'),time('19','12'),time('20','08')])assert.throws(()=>applyAllocationCommand(received.state,body,ctx('AB',{now:current})),{status:409});
 assert.throws(()=>applyAllocationCommand(received.state,body,ctx('AB',{now:time('19','08')})),{status:409});
 assert.throws(()=>applyAllocationCommand(received.state,body,ctx('AB',{blockers:[{employeeId:'C1',effectiveAt:time('19','09'),endsAt:time('19','10'),kind:'station-assignment'}]})),{status:409});
 assert.deepEqual(received.state,before);
});

test('cancellation derives persisted employee and whole window and rejects forged trimming',()=>{
 const received=allocated(),body=cancel(received.state,received.result.offerId,received.result.allocationId);
 for(const fields of [{employeeId:'C2'},{targetLine:'B'},{effectiveAt:time('19','09')},{endsAt:time('19','11')},{effectiveAt:null}])assert.throws(()=>applyAllocationCommand(received.state,{...body,...fields},ctx('AB')),{status:422});
 assert.throws(()=>applyAllocationCommand(received.state,{...body,allocationId:'missing'},ctx('AB')),{status:404});
 const result=applyAllocationCommand(received.state,{...body,employeeId:'C1',targetLine:'A',effectiveAt:time('19','08'),endsAt:time('19','12')},ctx('AB'));
 assert.equal(result.state.audit.at(-1).employeeId,'C1');
});

test('cancellation is idempotent with reason and selected allocation in its fingerprint; competing revisions fail',()=>{
 const received=allocated(),body=cancel(received.state,received.result.offerId,received.result.allocationId),canceled=applyAllocationCommand(received.state,body,ctx('AB'));
 const replay=applyAllocationCommand(canceled.state,body,ctx('AB',{now:time('20','08')}));
 assert.equal(replay.result.replayed,true);assert.equal(replay.state,canceled.state);assert.deepEqual(replay.events,[]);
 for(const payload of [{reason:'Lý do khác'},{allocationId:'another-allocation'}])assert.throws(()=>applyAllocationCommand(canceled.state,{...body,...payload},ctx('AB')),{status:409});
 assert.throws(()=>applyAllocationCommand(canceled.state,cancel(canceled.state,received.result.offerId,received.result.allocationId),ctx('AB')),{status:409});
 const staleWithdraw=command(received.state,{action:'withdraw',reason:'Nhu cầu nguồn',offerId:received.result.offerId,employeeId:'C1',effectiveAt:time('19','08'),endsAt:time('19','12')});
 assert.throws(()=>applyAllocationCommand(canceled.state,staleWithdraw,ctx('C')),{status:409});
 assert.throws(()=>applyAllocationCommand(canceled.state,allocate(received.state,received.result.offerId,'C1','B'),ctx('AB')),{status:409});
});

test('canceled allocations do not block later offers once restored pending is withdrawn',()=>{
 const received=allocated(),canceled=applyAllocationCommand(received.state,cancel(received.state,received.result.offerId,received.result.allocationId),ctx('AB'));
 const withdrawn=applyAllocationCommand(canceled.state,command(canceled.state,{action:'withdraw',reason:'Đổi đề nghị',offerId:received.result.offerId,employeeId:'C1',effectiveAt:time('19','08'),endsAt:time('19','12')}),ctx());
 const another=applyAllocationCommand(withdrawn.state,command(withdrawn.state,{...offerBody,employees:['C1'],endsAt:time('19','12')}),ctx());
 assert.equal(another.state.offers.length,2);
 assert.deepEqual(allocationPending(another.state.offers[0],'C1'),[{effectiveAt:new Date(time('19','12')).toISOString(),endsAt:new Date(offerBody.endsAt).toISOString()}]);
});

test('queue view offers cancellation only to current receiver for unstarted active planning and scopes audit',()=>{
 const received=allocated();
 assert.equal(allocationQueueView(received.state,authority('AB'),now).offers[0].allocations[0].canCancel,true);
 assert.equal(allocationQueueView(received.state,authority('C'),now).offers[0].allocations[0].canCancel,false);
 assert.equal(allocationQueueView(received.state,authority('AB'),time('19','09')).offers[0].allocations[0].canCancel,false);
 const state=structuredClone(received.state);state.audit.push({offerId:'unknown',reason:'private unrelated history'});state.audit[0].privatePayroll='must not disclose';
 const view=allocationQueueView(state,authority('AB'),now);
 assert.equal(view.audit.length,2);assert.ok(!JSON.stringify(view).includes('private unrelated history'));assert.ok(!JSON.stringify(view).includes('must not disclose'));
 const canceled=applyAllocationCommand(received.state,cancel(received.state,received.result.offerId,received.result.allocationId),ctx('AB'));
 assert.equal(allocationQueueView(canceled.state,authority('AB'),now).offers[0].allocations[0].canCancel,false);
});

test('exact legacy receipts replay without reason but cannot authorize new reasonless writes',()=>{
 for(const action of ['offer','withdraw','allocate']){
  const state=emptyAllocationQueue(),body=command(state,action==='offer'?{...offerBody,reason:undefined}:{action,offerId:'old-offer',employeeId:'C1',targetLine:action==='allocate'?'A':undefined,effectiveAt:time('19','08'),endsAt:time('19','12')});
  const legacy={action:body.action,offerId:body.offerId??null,sourceLine:body.sourceLine??null,targetLine:body.targetLine??null,employees:body.employees??null,employeeId:body.employeeId??null,effectiveAt:body.effectiveAt??null,endsAt:body.endsAt??null};
  const group=action==='allocate'?'AB':'C',result={action,offerId:'stored-offer'};state.revision=12;state.receipts.push({requestId:body.requestId,actorId:authority(group).actorId,fingerprint:JSON.stringify(legacy),result});
  const replay=applyAllocationCommand(state,body,ctx(group));assert.equal(replay.result.replayed,true);assert.equal(replay.state,state);assert.deepEqual(replay.events,[]);
  assert.throws(()=>applyAllocationCommand(state,body,ctx(group,{authority:{...authority(group),actorId:'another-manager'}})),{status:409});
  assert.throws(()=>applyAllocationCommand(state,{...body,endsAt:time('19','13')},ctx(group)));
  assert.throws(()=>applyAllocationCommand(state,{...body,reason:'New reason'},ctx(group)),{status:409});
  if(action!=='allocate')assert.throws(()=>applyAllocationCommand(state,{...body,requestId:'new-command-00000001',expectedRevision:12},ctx(group)),{status:422});
 }
});

test('only trusted active unscoped Admin has global authority; role names, quick Line and same-group targets cannot elevate',()=>{
 for(const id of ['ADMIN-ONE','ADMIN-TWO']){
  const admin=allocationAuthority({userId:id,isAdmin:true},null);assert.deepEqual(admin,{actorId:id,group:'ADMIN',lines:['A','B','C']});
  for(const patch of [{isAdmin:false,role:'SUPER_ADMIN',department:'Admin'},{line:'A'},{authMode:'quick_line'},{active:false}])assert.equal(allocationAuthority({userId:id,isAdmin:true,...patch},null),null);
  const context={...ctx(),authority:admin};for(const sourceLine of ['A','B','C']){const s=emptyAllocationQueue(),employee=sourceLine+'1',sent=applyAllocationCommand(s,command(s,{...offerBody,sourceLine,employees:[employee]}),context);assert.equal(sent.state.offers[0].createdBy,id);assert.equal(sent.state.offers[0].sourceGroup,sourceLine==='C'?'C':'AB');assert.throws(()=>applyAllocationCommand(sent.state,allocate(sent.state,sent.result.offerId,employee,sourceLine),context),{status:403});}
 }
});
