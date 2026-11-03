import {actualAllocationEvents} from '../../lib/production-allocation-actual.mjs';
import {employeeActiveOn} from '../../lib/employee-employment.mjs';
import {recallCovers} from '../../lib/production-staff-recall.mjs';
import {capacityFromRecords} from './capacity.mjs';
import {monday} from '../../lib/production-plan.mjs';
import {planningAssignments} from '../../lib/capacity-allocation-reservations.mjs';
import {applyCapacityAllocation,applyCapacityAllocationCancellation} from '../../lib/capacity-allocation-queue.mjs';
import {activeAllocation,allocationAuthority,allocationInstant,allocationPending,allocationQueueView,applyAllocationCommand,emptyAllocationQueue} from '../../lib/production-allocation-queue.mjs';
import {activeStaffMovement,effectiveAttendance} from '../../lib/production-attendance.mjs';
import {assignedAt,employeesAt} from '../../lib/production-hours.mjs';
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status});};
// One ordered snapshot guards every read dependency, including configuration,
// employees and Capacity writers that do not use the production cursor.
export const allocationSnapshotSql="SELECT json_group_array(json_array(entity,record_key,payload)) AS snapshot FROM (SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_allocation_scope','production_allocation_queue','production_cursor','production_event','production_schedule','employees','capacity','users','permissions','department_permissions') ORDER BY entity,record_key)";
const snapshotExpression=allocationSnapshotSql.replace(' AS snapshot','');
export async function allocationSnapshot(db){
 const serialized=(await db.prepare(allocationSnapshotSql).first()).snapshot;
 const rows=JSON.parse(serialized).map(([entity,key,raw])=>({entity,key,raw,payload:JSON.parse(raw)}));
 const records=entity=>rows.filter(r=>r.entity===entity&&!r.payload._deleted).map(r=>({...r.payload,...(entity==='employees'?{id:r.payload.id||r.key}:{}),key:r.key}));
 return {serialized,rows,records,queue:rows.find(r=>r.entity==='production_allocation_queue'&&r.key==='global')?.payload||emptyAllocationQueue(),scope:rows.find(r=>r.entity==='production_allocation_scope'&&r.key==='global')?.payload};
}
export function allocationBlockers(snapshot,window){
 const from=allocationInstant(window.effectiveAt),to=allocationInstant(window.endsAt);
 if(to<=from||to-from>366*86400000)fail('Khoảng hỗ trợ phải lớn hơn 0 và không quá 366 ngày.',422);
 const events=effectiveAttendance(snapshot.records('production_event')),employees=snapshot.records('employees'),blockers=[];
 const push=(employeeId,a,b,kind)=>{const start=Math.max(from,a),end=Math.min(to,b);if(start<end)blockers.push({employeeId,effectiveAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString(),kind});};
 for(const e of events.filter(e=>['line-movement','transfer','absence','line-absence'].includes(e.kind))){
  // A transfer may represent both movement and actual work. Conservatively
  // reserve its employee interval; never infer availability from net payroll.
  const start=Date.parse(e.effectiveAt),end=e.endsAt?Date.parse(e.endsAt):to;
  if(!Number.isFinite(start)||!Number.isFinite(end))continue;
  const people=e.employees?.length?e.employees:employees.filter(p=>p.line===e.line).map(p=>p.id);
  for(const id of people){if(e.kind==='transfer'&&(e.orderAssignmentOnlyEmployees||[]).includes(id))continue;push(id,start,end,e.kind);}
 }
 const orderIds=[...new Set(events.flatMap(e=>[e.sourceId,e.destinationId]).filter(Boolean))];
 const edges=[...new Set([from,to,...events.flatMap(e=>[Date.parse(e.effectiveAt),Date.parse(e.endsAt)]).filter(t=>t>from&&t<to)])].sort((a,b)=>a-b);
 for(const orderId of orderIds)for(let i=1;i<edges.length;i++){
  const start=edges[i-1],end=edges[i],state=assignedAt(events,orderId,start);
  // Paused workers remain assigned until reduced/transferred/finally completed.
  if(!state.known||state.count<=0)continue;
  let ids=employeesAt(events,orderId,start);
  if(!ids||ids.length!==state.count){const line=events.find(e=>e.sourceId===orderId)?.line;ids=employees.filter(p=>!line||p.line===line).map(p=>p.id);}
  for(const id of ids){
   const orderLine=events.find(e=>e.sourceId===orderId)?.line||events.find(e=>e.destinationId===orderId)?.destinationLine;
   const owner=activeStaffMovement(events,id,start)?.destinationLine||employees.find(p=>p.id===id)?.line;
   // Receiving into an old station's line must not reactivate that station
   // merely because a new borrowing movement makes the employee present again.
   if(!owner||!orderLine||owner===orderLine||window.targetLine===orderLine)push(id,start,end,'station-assignment');
  }
 }

 // A person's normal source roster is expected; foreign planned assignments
 // and all prior transfers reserve their windows before offering or acceptance.
 for(const record of snapshot.records('capacity')){
  const approvedRows=(record.rows||[]).flatMap(row=>{const accepted=(row.history||[]).filter(h=>h.action==='review'&&h.decision==='approve'&&h.request?.kind==='capacity').at(-1);const input=accepted?.after||(row.reviewStatus==='approved'&&row.status==='Đã xác nhận'?row.input:null);return input?[{line:row.line,input}]:[];});
  for(const assignment of planningAssignments([...(record.rows||[]),...approvedRows])){
   const home=employees.find(p=>p.id===assignment.employeeId)?.line;
   if(home&&home!==assignment.line)push(assignment.employeeId,Date.parse(assignment.effectiveAt),Date.parse(assignment.endsAt),'planned-assignment');
  }
  for(const row of [...(record.rows||[]),...approvedRows])for(const transfer of row.input?.staffTransfers||[])for(const date of transfer.dates||[]){
   const a=Date.parse(`${date}T${transfer.start}:00+07:00`),b=Date.parse(`${date}T${transfer.end}:00+07:00`);
   if(Number.isFinite(a)&&Number.isFinite(b))for(const id of transfer.employees||[])push(id,a,b,'planned-transfer');
  }
 }
 return blockers;
}
async function scopedSnapshot(db,actor){
 // Resolve scope before reading a broad operational snapshot. Unconfigured users
 // receive no queue, roster, HR, payroll or other department metadata.
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_allocation_scope' AND record_key='global'").first();
 const authority=allocationAuthority(actor,row?JSON.parse(row.payload):null);
 if(!authority)fail('Chưa được cấu hình phạm vi QLSX cho Chờ phân bổ.',403);
 const snapshot=await allocationSnapshot(db),freshAuthority=allocationAuthority(actor,snapshot.scope);
 const account=snapshot.records('users').find(u=>u.key===authority.actorId);
 if(authority.group!=='ADMIN'&&(!account||account.active!==true||account.authMode==='quick_line'))fail('Tài khoản không còn hoạt động trong phạm vi Chờ phân bổ.',403);
 if(!freshAuthority||JSON.stringify(freshAuthority)!==JSON.stringify(authority))fail('Phạm vi quản lý vừa thay đổi. Tải lại.',409);
 return {snapshot,authority};
}
export async function readAllocationQueue(db,actor,now=new Date().toISOString()){
 const {snapshot,authority}=await scopedSnapshot(db,actor);
 return {...allocationQueueView(snapshot.queue,authority,now),readOnly:false,configurationEnabled:snapshot.scope?.enabled===true,candidates:snapshot.records('employees').filter(p=>employeeActiveOn(p)&&authority.lines.includes(p.line)).map(({id,name,line})=>({id,name,line}))};
}
function prepareAllocation(snapshot,body,actor,authority,now){
 // Replay is read-only and checks the full command fingerprint in the domain.
 // Do this before deriving conflict windows so changed allocation IDs cannot
 // evade the idempotency mismatch and completed retries need no fresh blockers.
 if(snapshot.queue.receipts.some(r=>r.requestId===body.requestId))return {result:applyAllocationCommand(snapshot.queue,body,{authority,employees:snapshot.records('employees'),blockers:[],now}).result,state:snapshot.queue,planning:{records:[]}};
 // Cancel payloads contain only IDs and a reason. Compute conflicts from the
 // persisted allocation, never from absent or client-controlled window fields.
 let blockerWindow=body;
 if(body.action==='cancel'){
  const offer=snapshot.queue.offers.find(o=>o.id===body.offerId);if(!offer)fail('Không tìm thấy đề nghị phân bổ.',404);
  if(authority.group!=='ADMIN'&&authority.group!==offer.targetGroup)fail('Chỉ QLSX phía nhận được hủy phân bổ đã nhận.',403);
  const allocation=offer.allocations.find(a=>a.id===body.allocationId);if(!allocation)fail('Không tìm thấy phân bổ đã nhận.',404);
  blockerWindow=allocation;
 }
 const blockers=allocationBlockers(snapshot,blockerWindow).filter(b=>body.action!=='cancel'||!['planned-assignment','planned-transfer'].includes(b.kind));
 const result=applyAllocationCommand(snapshot.queue,body,{authority,employees:snapshot.records('employees'),blockers,now});
 if(result.result.replayed)return {...result,planning:{records:[]}};
 let planning={records:[]};
 if(body.action==='allocate'){
  const offer=result.state.offers.find(o=>o.id===body.offerId),allocation=offer.allocations.find(a=>a.id===result.result.allocationId);
  const calendar=snapshot.rows.filter(r=>r.entity==='capacity').map(r=>({key:r.key,payload:r.payload}));
  const directory=snapshot.rows.filter(r=>r.entity==='employees').map(r=>({key:r.key,payload:r.payload}));
  const localDate=value=>new Date(allocationInstant(value)+7*3600000).toISOString().slice(0,10);
  // Only absent weeks get the same named default schedule used by the calendar.
  // Never submit or save the user's unsaved calendar inputs through this API.
  const last=localDate(new Date(allocationInstant(allocation.endsAt)-1).toISOString());
  for(let date=localDate(allocation.effectiveAt);date<=last;){
   const week=monday(date);
   if(!calendar.some(r=>r.key===week&&r.payload.schemaVersion===1)){
    const initial=capacityFromRecords(calendar,directory,week,actor);
    if(initial.legacy.length)fail(`Tuần ${week}: có dữ liệu Capacity cũ cần đối chiếu trước khi nhận phân bổ.`);
    calendar.push({key:week,payload:{schemaVersion:1,week,revision:0,rows:initial.rows}});
   }
   const next=new Date(`${week}T00:00:00Z`);next.setUTCDate(next.getUTCDate()+7);date=next.toISOString().slice(0,10);
  }
  const actual=actualAllocationEvents(snapshot.rows,offer,allocation,{now,actorId:authority.actorId});
  if(actual){
   planning={records:[],events:actual};
   Object.assign(allocation,{planning:false,movementId:actual[0].id,movementIds:actual.map(e=>e.id)});
   Object.assign(result.result,{planning:false,movementId:actual[0].id});
   Object.assign(result.state.audit.at(-1),{planning:false,movementId:actual[0].id});
  }else{
   planning=applyCapacityAllocation(calendar,snapshot.records('employees'),offer,allocation,{now,actorId:authority.actorId});
   allocation.planningSegments=planning.planningSegments;
  }
 }else if(body.action==='cancel'){
  const offer=result.state.offers.find(o=>o.id===body.offerId),allocation=offer.allocations.find(a=>a.id===result.result.allocationId);
  planning=applyCapacityAllocationCancellation(snapshot.rows.filter(r=>r.entity==='capacity').map(r=>({key:r.key,payload:r.payload})),snapshot.records('employees'),offer,allocation,{now,actorId:authority.actorId,reason:allocation.cancellationReason});
 }
 return {...result,planning};
}
function prepareManyAllocations(snapshot,body,actor,authority,now){
 if(typeof body.requestId!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(body.requestId))fail('Mã thao tác không hợp lệ.',422);
 if(!Array.isArray(body.selections)||!body.selections.length||body.selections.length>100)fail('Chọn từ 1 đến 100 nhân viên.',422);
 const selections=body.selections.map(item=>({offerId:item?.offerId,employeeId:item?.employeeId}));
 if(selections.some(item=>typeof item.offerId!=='string'||typeof item.employeeId!=='string')||new Set(selections.map(item=>item.employeeId)).size!==selections.length)fail('Danh sách nhân viên không hợp lệ hoặc bị chọn lặp.',422);
 const action=body.action==='withdraw-many'?'withdraw':'allocate';
 const fingerprint=JSON.stringify({action:body.action,selections,targetLine:body.targetLine,effectiveAt:body.effectiveAt,endsAt:body.endsAt,...(action==='withdraw'?{reason:body.reason}:{})});
 const prior=snapshot.queue.receipts.find(r=>r.requestId===body.requestId);
 if(prior){if(prior.actorId!==authority.actorId||prior.fingerprint!==fingerprint)fail('Mã thao tác đã được dùng cho nội dung khác.',409);return {state:snapshot.queue,result:{...prior.result,replayed:true},planning:{records:[]}};}
 if(body.expectedRevision!==snapshot.queue.revision)fail('Danh sách vừa thay đổi. Tải lại trước khi phân bổ.',409);
 let current={...snapshot,rows:[...snapshot.rows]},state=snapshot.queue;
 const records=new Map(),allocations=[],events=[];
 for(const [index,item] of selections.entries()){
  let prepared;
  try{prepared=prepareAllocation({...current,queue:state,records:entity=>current.rows.filter(r=>r.entity===entity&&!r.payload._deleted).map(r=>({...r.payload,...(entity==='employees'?{id:r.payload.id||r.key}:{}),key:r.key}))},{action,...item,targetLine:body.targetLine,effectiveAt:body.effectiveAt,endsAt:body.endsAt,...(action==='withdraw'?{reason:body.reason}:{}),expectedRevision:state.revision,requestId:`${body.requestId}-${index}`},actor,authority,now);}
  catch(error){const person=snapshot.records('employees').find(p=>p.id===item.employeeId);throw Object.assign(new Error(`${person?.name||item.employeeId}: ${error.message}`),{status:error.status||409});}
  state=prepared.state;allocations.push(prepared.result);
  for(const event of prepared.planning.events||[]){events.push(event);current.rows.push({entity:'production_event',key:event.id,payload:event});}
  for(const record of prepared.planning.records){records.set(record.key,record);current.rows=current.rows.filter(r=>!(r.entity==='capacity'&&r.key===record.key));current.rows.push({entity:'capacity',key:record.key,payload:record.payload});}
 }
 const result={action:body.action,allocations,count:allocations.length,planning:action==='allocate'&&allocations.every(a=>a.planning)};
 state.receipts.push({requestId:body.requestId,actorId:authority.actorId,fingerprint,result});
 state.audit.push({...result,requestId:body.requestId,actorId:authority.actorId,at:now,targetLine:body.targetLine,...(action==='withdraw'?{reason:body.reason}:{}),window:{effectiveAt:body.effectiveAt,endsAt:body.endsAt},employees:selections.map(s=>({id:s.employeeId,name:snapshot.records('employees').find(p=>p.id===s.employeeId)?.name||s.employeeId}))});
 return {state,result,planning:{records:[...records.values()],events}};
}
// Edit is one atomic replacement: validate reversal and new reservation against
// an in-memory snapshot, then persist both rosters and the queue in the same CAS.
function prepareAllocationEdit(snapshot,body,actor,authority,now){
 if(typeof body.requestId!=='string'||!/^[-a-zA-Z0-9]{16,64}$/.test(body.requestId))fail('Mã thao tác không hợp lệ.',422);
 const fingerprint=JSON.stringify({action:'edit',offerId:body.offerId,allocationId:body.allocationId,targetLine:body.targetLine,effectiveAt:body.effectiveAt,endsAt:body.endsAt,reason:body.reason});
 const prior=snapshot.queue.receipts.find(r=>r.requestId===body.requestId);
 if(prior){if(prior.actorId!==authority.actorId||prior.fingerprint!==fingerprint)fail('Mã thao tác đã được dùng cho nội dung khác.',409);return {state:snapshot.queue,result:{...prior.result,replayed:true},planning:{records:[]}};}
 const original=snapshot.queue.offers.find(o=>o.id===body.offerId)?.allocations.find(a=>a.id===body.allocationId);
 if(!original)fail('Không tìm thấy phân bổ đã nhận.',404);
 const canceled=prepareAllocation(snapshot,{action:'cancel',offerId:body.offerId,allocationId:body.allocationId,expectedRevision:body.expectedRevision,reason:body.reason,requestId:body.requestId+'-cancel'},actor,authority,now);
 const rows=snapshot.rows.map(r=>r.entity==='capacity'&&canceled.planning.records.some(c=>c.key===r.key)?{...r,payload:canceled.planning.records.find(c=>c.key===r.key).payload}:r);
 const virtual={...snapshot,rows,queue:canceled.state,records:entity=>rows.filter(r=>r.entity===entity&&!r.payload._deleted).map(r=>({...r.payload,...(entity==='employees'?{id:r.payload.id||r.key}:{}),key:r.key}))};
 const accepted=prepareAllocation(virtual,{action:'allocate',offerId:body.offerId,employeeId:original.employeeId,targetLine:body.targetLine,effectiveAt:body.effectiveAt,endsAt:body.endsAt,reason:body.reason,expectedRevision:canceled.state.revision,requestId:body.requestId+'-replace'},actor,authority,now);
 const offer=accepted.state.offers.find(o=>o.id===body.offerId),previous=offer.allocations.find(a=>a.id===original.id),replacement=offer.allocations.find(a=>a.id===accepted.result.allocationId);
 previous.replacedBy=replacement.id;replacement.replaces=previous.id;
 const before={targetLine:original.targetLine,effectiveAt:original.effectiveAt,endsAt:original.endsAt};
 replacement.previousAllocation=before;
 const result={action:'edit',offerId:body.offerId,allocationId:replacement.id,previousAllocationId:original.id,planning:accepted.result.planning,...(accepted.result.movementId?{movementId:accepted.result.movementId}:{})};
 // Only the public edit has a replay token/audit action; internal steps never escape.
 accepted.state.revision=snapshot.queue.revision+1;
 accepted.state.receipts=[...snapshot.queue.receipts,{requestId:body.requestId,actorId:authority.actorId,fingerprint,result}];
 accepted.state.audit=[...snapshot.queue.audit,{...accepted.state.audit.at(-1),...result,requestId:body.requestId,before,reason:body.reason}];
 const records=new Map(canceled.planning.records.map(r=>[r.key,r]));for(const r of accepted.planning.records)records.set(r.key,r);
 return {state:accepted.state,result,planning:{records:[...records.values()],events:accepted.planning.events||[]}};
}
export async function mutateAllocationQueue(db,body,actor,now=new Date().toISOString()){
 const {snapshot,authority}=await scopedSnapshot(db,actor);
 const prepared=body.action==='edit'?prepareAllocationEdit(snapshot,body,actor,authority,now):['allocate-many','withdraw-many'].includes(body.action)?prepareManyAllocations(snapshot,body,actor,authority,now):prepareAllocation(snapshot,body,actor,authority,now);
 const result=prepared,planning=prepared.planning;
 if(result.result.replayed)return result.result;
 const by=authority.actorId,token=crypto.randomUUID(),cursor=snapshot.rows.find(r=>r.entity==='production_cursor'&&r.key==='global')?.payload;
 const updatedCursor=JSON.stringify({version:Number(cursor?.version||0)+1,token});
 const guardId=crypto.randomUUID(),audit={...result.state.audit.at(-1),kind:'production-allocation',revision:result.state.revision};
 const statements=[db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_allocation_guard',?,?,?,? WHERE (${snapshotExpression})=?`).bind(guardId,'{}',by,now,snapshot.serialized)];
 const guard="EXISTS(SELECT 1 FROM app_records WHERE entity='production_allocation_guard' AND record_key=?)";
 const save=(entity,key,payload)=>db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE ${guard} ON CONFLICT(entity,record_key) DO UPDATE SET payload=excluded.payload,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).bind(entity,key,typeof payload==='string'?payload:JSON.stringify(payload),by,now,guardId);
 statements.push(save('production_allocation_queue','global',result.state),save('production_cursor','global',updatedCursor));
 for(const record of planning.records)statements.push(save('capacity',record.key,record.payload));
 for(const event of planning.events||[])statements.push(save('production_event',event.id,event));
 statements.push(save('admin_audit',`allocation-${body.requestId}`,audit),db.prepare("DELETE FROM app_records WHERE entity='production_allocation_guard' AND record_key=?").bind(guardId));
 const saved=await db.batch(statements);if(saved[0].meta.changes!==1)fail('Dữ liệu nhân lực vừa thay đổi. Tải lại trước khi ghi.',409);
 return result.result;
}

// All legacy station/movement writers must call this before their existing
// production_cursor CAS. HR changes are deliberately allowed and rechecked on
// queue acceptance. A queue movement cannot be silently edited/cancelled.
// Actual bounded onward loans overlay the accepted planning allocation.
function allocationLoanChain(events,id,allocation){
 const from=Date.parse(allocation.effectiveAt),to=Date.parse(allocation.endsAt);
 const moves=effectiveAttendance(events).filter(e=>e.kind==='line-movement'&&e.employees?.includes(id)&&Date.parse(e.effectiveAt)>=from&&Date.parse(e.endsAt)<=to&&Date.parse(e.endsAt)>Date.parse(e.effectiveAt));
 const accepted=[];let remaining=[...moves],changed=true;
 while(changed){changed=false;remaining=remaining.filter(e=>{
  const start=Date.parse(e.effectiveAt),end=Date.parse(e.endsAt);
  const points=[start,...accepted.flatMap(p=>[Date.parse(p.effectiveAt),Date.parse(p.endsAt)]).filter(t=>t>start&&t<end)];
  if(points.every(t=>(activeStaffMovement(accepted,id,t)?.destinationLine||allocation.targetLine)===e.line)){
   accepted.push(e);changed=true;return false;
  }return true;
 });}
 return accepted;
}
export async function assertLegacyAllocationWrite(db,events){
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_allocation_queue' AND record_key='global'").first();
 if(!row)return;
 const queue=JSON.parse(row.payload);
 const previous=(await db.prepare("SELECT entity,record_key,payload FROM app_records WHERE entity IN ('production_event','employees')").all()).results;
 const directory=previous.filter(r=>r.entity==='employees').map(r=>({id:r.record_key,...JSON.parse(r.payload)}));
 const history=new Map(previous.filter(r=>r.entity==='production_event').map(r=>JSON.parse(r.payload)).map(e=>[e.id,e]));
 for(const event of events)history.set(event.id,event);
 assertAllocationTimeline(queue,[...history.values()],directory);
 for(const event of events){
  for(const offer of queue.offers){
   if(offer.allocations.some(a=>activeAllocation(a)&&a.movementId&&[event.supersedes,event.id,event.targetEventId].includes(a.movementId)))fail('Phân bổ đã nhận phải được thay đổi qua quy trình phối hợp; không thể xóa hoặc sửa trực tiếp.',409);
   if(!['line-movement','start','add','transfer'].includes(event.kind)||event.voided)continue;
   const from=Date.parse(event.effectiveAt),to=event.endsAt?Date.parse(event.endsAt):Infinity;
   for(const employee of offer.people){
    if(!event.employees?.includes(employee.id))continue;
    const target=event.kind==='transfer'?event.destinationLine:event.line;
    const governing=event.kind!=='line-movement'&&offer.allocations.find(a=>activeAllocation(a)&&a.employeeId===employee.id&&a.targetLine===target&&Date.parse(a.effectiveAt)<=from&&from<Date.parse(a.endsAt));
    const effectiveTo=governing?Math.min(to,Date.parse(governing.endsAt)):to;
    const overlaps=w=>Date.parse(w.effectiveAt)<effectiveTo&&from<Date.parse(w.endsAt);
    const pending=allocationPending(offer,employee.id);
    if(pending.some(overlaps))fail('Nhân viên đã dành thời gian Chờ phân bổ. Rút phần chưa nhận trước khi phân công khác.',409);
    for(const allocated of offer.allocations.filter(a=>activeAllocation(a)&&a.employeeId===employee.id&&overlaps(a))){
     const target=event.kind==='transfer'?event.destinationLine:event.line;
     if(event.kind!=='line-movement'&&target===offer.sourceLine&&recallCovers([...history.values()],employee.id,from,allocated.targetLine,offer.sourceLine))continue;
     if(event.kind==='line-movement'&&event.movementType==='recall'&&event.line===allocated.targetLine&&event.destinationLine===offer.sourceLine&&directory.find(p=>p.id===employee.id)?.line===offer.sourceLine)continue;
     const chain=allocationLoanChain([...history.values()],employee.id,allocated);
     if(event.kind==='line-movement'&&chain.some(e=>e.id===event.id))continue;
     const owner=activeStaffMovement(chain,employee.id,from)?.destinationLine||allocated.targetLine;
     if(event.kind!=='line-movement'&&target===owner&&from>=Date.parse(allocated.effectiveAt)&&from<Date.parse(allocated.endsAt))continue;
     const person=directory.find(p=>p.id===employee.id)?.name||employee.id;
     const display=value=>new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour12:false});
     fail(`${person}: đang được phân bổ tại Line ${allocated.targetLine}, từ ${display(allocated.effectiveAt)} đến ${display(allocated.endsAt)}. Chỉ chuyển tiếp từ Line đang làm việc và trong khoảng được phân bổ; kiểm tra lại Line nguồn và giờ chuyển.`,409);
    }
   }
  }
 }
}

export function assertAllocationTimeline(queue,proposedEvents,directory){
 const events=effectiveAttendance(proposedEvents),orderIds=[...new Set(events.flatMap(e=>[e.sourceId,e.destinationId]).filter(Boolean))];
 for(const offer of queue.offers)for(const person of offer.people){
  const windows=[...allocationPending(offer,person.id).map(w=>({...w,targetLine:null})),...offer.allocations.filter(a=>activeAllocation(a)&&a.employeeId===person.id)];
  for(const window of windows){
   const from=Date.parse(window.effectiveAt),to=Date.parse(window.endsAt);
   const points=[...new Set([from,to,...events.flatMap(e=>[Date.parse(e.effectiveAt),Date.parse(e.endsAt)]).filter(t=>t>from&&t<to)])].sort((a,b)=>a-b);
   for(let i=1;i<points.length;i++)for(const orderId of orderIds){
    const at=points[i-1],state=assignedAt(events,orderId,at);if(!state.known||state.count<=0)continue;
    const orderLine=events.find(e=>e.sourceId===orderId)?.line||events.find(e=>e.destinationId===orderId)?.destinationLine;
    const owner=activeStaffMovement(events,person.id,at)?.destinationLine||directory.find(p=>p.id===person.id)?.line;
    // Station assignment made while borrowing stops contributing at the bounded
    // movement end, matching attendance/headcount and payroll's existing rules.
    if(owner&&owner!==orderLine)continue;
    const people=employeesAt(events,orderId,at);
    if(people&&people.length===state.count&&!people.includes(person.id))continue;
    if(window.targetLine===orderLine)continue;
    if(window.targetLine&&activeStaffMovement(allocationLoanChain(events,person.id,window),person.id,at)?.destinationLine===orderLine)continue;
    if(window.targetLine&&orderLine===offer.sourceLine&&recallCovers(events,person.id,at,window.targetLine,offer.sourceLine))continue;
    fail('Điều chỉnh làm trùng giờ nhân viên đã dành hoặc đã phân bổ. Xử lý phân bổ trước khi sửa báo công.',409);
   }
  }
 }
}

// Session capability controls only queue navigation; every queue action resolves
// trusted scope and current account state again. No legacy grant is synthesized.
export async function allocationSessionGroup(db,actor){
 if(!actor||actor.authMode==='quick_line')return null;
 const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_allocation_scope' AND record_key='global'").first();
 const authority=allocationAuthority(actor,row?JSON.parse(row.payload):null);if(!authority)return null;
 const user=await db.prepare("SELECT payload FROM app_records WHERE entity='users' AND record_key=?").bind(authority.actorId).first();
 const account=user?JSON.parse(user.payload):null;
 return account?.active===true&&!account._deleted&&account.authMode!=='quick_line'?authority.group:null;
}
