// Pure, fail-closed queue domain. Callers supply trusted scope and a complete
// conflict snapshot; commands never accept authority or employee names from UI.
import {productionActorId} from './production-actor.mjs';
const fail=(message,status=422)=>{throw Object.assign(new Error(message),{status});};
export const ALLOCATION_REASON_MAX=500;
export const activeAllocation=allocation=>allocation.canceled!==true;
export const emptyAllocationQueue=()=>({schemaVersion:1,revision:0,offers:[],audit:[],receipts:[]});
export function allocationInstant(value){
 const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{3}))?(Z|[+-]\d{2}:\d{2})$/);
 if(!match)fail('Thời điểm phải đầy đủ ngày, giờ và múi giờ.');
 const [,year,month,day,hour,minute,second,,zone]=match;
 const local=new Date(Date.UTC(+year,+month-1,+day));
 if(local.getUTCFullYear()!==+year||local.getUTCMonth()!==+month-1||local.getUTCDate()!==+day||+hour>23||+minute>59||+second>59||zone!=='Z'&&(+zone.slice(1,3)>14||+zone.slice(4)>59||+zone.slice(1,3)===14&&+zone.slice(4)!==0))fail('Ngày hoặc giờ không hợp lệ.');
 const time=Date.parse(value);if(!Number.isFinite(time))fail('Ngày hoặc giờ không hợp lệ.');return time;
}
export const allocationOverlap=(a,b)=>allocationInstant(a.effectiveAt)<allocationInstant(b.endsAt)&&allocationInstant(b.effectiveAt)<allocationInstant(a.endsAt);
const interval=(start,end)=>({effectiveAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString()});
function windowOf(value){const start=allocationInstant(value.effectiveAt),end=allocationInstant(value.endsAt);if(end<=start)fail('Giờ kết thúc phải sau giờ bắt đầu.');return interval(start,end);}
function subtract(windows,cut){return windows.flatMap(w=>{if(!allocationOverlap(w,cut))return [w];const start=allocationInstant(w.effectiveAt),end=allocationInstant(w.endsAt),from=allocationInstant(cut.effectiveAt),to=allocationInstant(cut.endsAt);return [...(start<from?[interval(start,from)]:[]),...(to<end?[interval(to,end)]:[])];});}
const contains=(outer,inner)=>allocationInstant(outer.effectiveAt)<=allocationInstant(inner.effectiveAt)&&allocationInstant(inner.endsAt)<=allocationInstant(outer.endsAt);
export function allocationPending(offer,employeeId,now){
 let windows=[windowOf(offer)];
 for(const cut of [...offer.allocations.filter(activeAllocation),...offer.withdrawals].filter(c=>c.employeeId===employeeId))windows=subtract(windows,cut);
 if(now!==undefined){const at=allocationInstant(now);windows=windows.filter(w=>allocationInstant(w.endsAt)>at).map(w=>interval(Math.max(at,allocationInstant(w.effectiveAt)),allocationInstant(w.endsAt)));}
 return windows;
}
// Managers require the audited account assignment. Authenticated, unscoped
// Admins have explicit A/B/C authority; names/departments/client payloads do not.
export function allocationAuthority(actor,configuration){
 const id=productionActorId(actor);
 if(id&&actor?.isAdmin===true&&!actor.line&&actor.authMode!=='quick_line'&&actor.active!==false)return {actorId:id,group:'ADMIN',lines:['A','B','C']};
 const matches=configuration?.schemaVersion===1&&configuration?.enabled===true&&Array.isArray(configuration.managers)?configuration.managers.filter(m=>m.userId===id):[],entry=matches.length===1?matches[0]:null;
 if(!id||actor.authMode==='quick_line'||actor.active===false||!entry)return null;
 if(entry.group==='C')return {actorId:id,group:'C',lines:['C']};
 if(entry.group==='AB')return {actorId:id,group:'AB',lines:['A','B']};
 return null;
}
const requireAuthority=authority=>{if(!authority?.actorId||!['C','AB','ADMIN'].includes(authority.group)||JSON.stringify(authority.lines)!==JSON.stringify(authority.group==='ADMIN'?['A','B','C']:authority.group==='C'?['C']:['A','B']))fail('Chưa được cấu hình phạm vi QLSX cho Chờ phân bổ.',403);return authority;};
const manages=(authority,group)=>authority.group==='ADMIN'||authority.group===group;
const groupOf=line=>line==='C'?'C':['A','B'].includes(line)?'AB':null;
const identity=value=>{if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>100)fail('Mã nhân viên không hợp lệ.');return value;};
const conflict=()=>fail('Nhân viên có khoảng giờ không còn khả dụng. Tải lại và chọn khoảng khác.',409);
function checkBlockers(employeeId,window,blockers){if(blockers.some(b=>b.employeeId===employeeId&&allocationOverlap(b,window)))conflict();}
function checkOffers(state,employeeId,window,except){
 for(const offer of state.offers){if(offer.id===except||!offer.people.some(p=>p.id===employeeId))continue;
  if([...allocationPending(offer,employeeId),...offer.allocations.filter(a=>activeAllocation(a)&&a.employeeId===employeeId)].some(w=>allocationOverlap(w,window)))conflict();}
}
function commandReason(command){
 const required=['offer','withdraw','cancel'].includes(command.action),value=command.reason;
 if(value===undefined||value===null){if(required)fail('Vui lòng ghi lý do thao tác.');return null;}
 if(typeof value!=='string'||value.length>ALLOCATION_REASON_MAX)fail(`Lý do phải là văn bản không quá ${ALLOCATION_REASON_MAX} ký tự.`);
 const reason=value.trim();if(!reason&&required)fail('Vui lòng ghi lý do thao tác.');return reason||null;
}
const canCancel=(allocation,offer,authority,at)=>activeAllocation(allocation)&&allocation.planning===true&&!allocation.movementId&&manages(authority,offer.targetGroup)&&authority.lines.includes(allocation.targetLine)&&allocationInstant(allocation.effectiveAt)>at;
export function allocationQueueView(state,authority,now){
 requireAuthority(authority);const at=allocationInstant(now);
 const offers=state.offers.filter(o=>manages(authority,o.sourceGroup)||manages(authority,o.targetGroup)).map(o=>({
  id:o.id,sourceLine:o.sourceLine,sourceGroup:o.sourceGroup,targetGroup:o.targetGroup,effectiveAt:o.effectiveAt,endsAt:o.endsAt,
  reason:o.reason??null,createdBy:o.createdBy,createdAt:o.createdAt,
  people:o.people.map(p=>({id:p.id,name:p.name,pending:allocationPending(o,p.id,now)})),
  allocations:o.allocations.map(a=>({...a,canCancel:canCancel(a,o,authority,at)})),withdrawals:o.withdrawals.map(w=>({...w})),
  expired:allocationInstant(o.endsAt)<=at,canWithdraw:manages(authority,o.sourceGroup),canAllocate:manages(authority,o.targetGroup),
 }));
 const visibleIds=new Set(offers.map(o=>o.id));
 const audit=state.audit.filter(entry=>visibleIds.has(entry.offerId)).map(({action,offerId,allocationId,requestId,actorId,at,window,employeeId,employeeName,employees,sourceLine,targetLine,sourceGroup,targetGroup,reason,planning})=>({action,offerId,allocationId,requestId,actorId,at,window:window?{effectiveAt:window.effectiveAt,endsAt:window.endsAt}:undefined,employeeId,employeeName,employees:Array.isArray(employees)?employees.map(({id,name})=>({id,name})):undefined,sourceLine,targetLine,sourceGroup,targetGroup,reason,planning}));
 return {revision:state.revision,group:authority.group,sourceLines:authority.lines,offers,audit,pendingPeople:new Set(offers.filter(o=>o.canAllocate).flatMap(o=>o.people.filter(p=>p.pending.length).map(p=>p.id))).size};
}
export function applyAllocationCommand(state,command,context){
 const {authority,employees,blockers,now}=context;requireAuthority(authority);
 if(!Array.isArray(employees)||!Array.isArray(blockers))fail('Thiếu dữ liệu kiểm tra nhân lực.',503);
 const at=allocationInstant(now),requestId=command.requestId;
 if(typeof requestId!=='string'||!/^[-a-zA-Z0-9]{16,80}$/.test(requestId))fail('Mã thao tác không hợp lệ.');
 if(!['offer','allocate','withdraw','cancel'].includes(command.action))fail('Thao tác Chờ phân bổ không hợp lệ.');
 const prior=state.receipts.find(r=>r.requestId===requestId);
 // Existing pre-reason receipts remain safe to retry verbatim. This branch can
 // only replay a stored result; it never authorizes a new reasonless mutation.
 if(prior&&command.reason===undefined&&command.allocationId===undefined&&command.action!=='cancel'){
  const legacy={action:command.action,offerId:command.offerId??null,sourceLine:command.sourceLine??null,targetLine:command.targetLine??null,employees:command.employees??null,employeeId:command.employeeId??null,effectiveAt:command.effectiveAt??null,endsAt:command.endsAt??null};
  if(prior.fingerprint===JSON.stringify(legacy)){
   if(prior.actorId!==authority.actorId)fail('Mã thao tác đã được dùng cho nội dung khác.',409);
   return {state,result:{...prior.result,replayed:true},events:[]};
  }
 }
 const reason=commandReason(command);
 const normalized={action:command.action,offerId:command.offerId??null,allocationId:command.allocationId??null,sourceLine:command.sourceLine??null,targetLine:command.targetLine??null,employees:command.employees??null,employeeId:command.employeeId??null,effectiveAt:command.effectiveAt??null,endsAt:command.endsAt??null,reason};
 const fingerprint=JSON.stringify(normalized);
 if(prior){if(prior.actorId!==authority.actorId||prior.fingerprint!==fingerprint)fail('Mã thao tác đã được dùng cho nội dung khác.',409);return {state,result:{...prior.result,replayed:true},events:[]};}
 if(command.expectedRevision!==state.revision)fail('Danh sách vừa thay đổi. Tải lại trước khi phân bổ, rút hoặc hủy người.',409);
 let window;
 if(command.action!=='cancel'){
  window=windowOf(command);if(allocationInstant(window.effectiveAt)<at)fail('Không được sửa hoặc phân bổ khoảng giờ đã qua.');
 }
 const next=structuredClone(state),events=[];let result,auditOffer,auditPeople;
 if(command.action==='offer'){
  const sourceLine=command.sourceLine;if(!authority.lines.includes(sourceLine))fail('Không được đưa người từ Line ngoài phạm vi quản lý.',403);
  if(!Array.isArray(command.employees)||!command.employees.length||command.employees.length>500)fail('Chọn từ 1 đến 500 nhân viên.');
  const ids=command.employees.map(identity);if(new Set(ids).size!==ids.length)fail('Nhân viên bị chọn lặp.');
  const people=ids.map(id=>{const person=employees.find(p=>p.id===id&&p.active!==false&&p.line===sourceLine);if(!person)fail('Nhân viên không thuộc Line nguồn đang hoạt động.',403);checkBlockers(id,window,blockers);checkOffers(state,id,window);return {id,name:String(person.name||id)};});
  const offer={id:`offer-${requestId}`,sourceLine,sourceGroup:groupOf(sourceLine),targetGroup:sourceLine==='C'?'AB':'C',...window,reason,people,allocations:[],withdrawals:[],createdBy:authority.actorId,createdAt:now};
  next.offers.push(offer);result={offerId:offer.id,action:'offer'};auditOffer=offer;auditPeople=people;
 }else{
  const offer=next.offers.find(o=>o.id===command.offerId);if(!offer)fail('Không tìm thấy đề nghị phân bổ.',404);
  auditOffer=offer;
  if(command.action==='cancel'){
   // Cancellation always concerns the complete persisted reservation. Client
   // supplied employee/time fields can never widen or trim the authoritative cut.
   if(!manages(authority,offer.targetGroup))fail('Chỉ QLSX phía nhận được hủy phân bổ đã nhận.',403);
   const allocation=offer.allocations.find(a=>a.id===command.allocationId);if(!allocation)fail('Không tìm thấy phân bổ đã nhận.',404);
   if(!authority.lines.includes(allocation.targetLine)||groupOf(allocation.targetLine)!==offer.targetGroup)fail('Line nhận không thuộc phạm vi quản lý hiện tại.',403);
   if(allocation.planning!==true||allocation.movementId)fail('Không thể hủy phân bổ đã ghi nhận thành điều chuyển thực tế.',409);
   if(!activeAllocation(allocation))fail('Phân bổ đã được hủy. Tải lại danh sách.',409);
   window=windowOf(allocation);
   if(allocationInstant(window.effectiveAt)<=at)fail('Chỉ được hủy toàn bộ phân bổ chưa bắt đầu; không sửa giờ đã qua.',409);
   if(!contains(windowOf(offer),window))fail('Khoảng phân bổ không còn khớp đề nghị.',409);
   if(command.employeeId!==undefined&&command.employeeId!==allocation.employeeId||command.targetLine!==undefined&&command.targetLine!==allocation.targetLine||command.effectiveAt!==undefined&&allocationInstant(command.effectiveAt)!==allocationInstant(window.effectiveAt)||command.endsAt!==undefined&&allocationInstant(command.endsAt)!==allocationInstant(window.endsAt))fail('Chỉ được hủy toàn bộ khoảng phân bổ đã chọn.',422);
   const person=offer.people.find(p=>p.id===allocation.employeeId);if(!person)fail('Nhân viên không nằm trong đề nghị.',409);
   // Storage excludes draft planning conflicts here; actual work remains a
   // blocker even if the reservation itself was originally a planning entry.
   checkBlockers(allocation.employeeId,window,blockers);
   Object.assign(allocation,{canceled:true,canceledBy:authority.actorId,canceledAt:now,cancellationReason:reason});
   result={action:'cancel',offerId:offer.id,allocationId:allocation.id,employeeId:allocation.employeeId,planning:true};auditPeople=[person];
  }else{
   const employeeId=identity(command.employeeId);if(!offer.people.some(p=>p.id===employeeId))fail('Nhân viên không nằm trong đề nghị.',403);
   auditPeople=offer.people.filter(p=>p.id===employeeId);
   if(command.action==='allocate'&&!manages(authority,offer.targetGroup)||command.action==='withdraw'&&!manages(authority,offer.sourceGroup))fail('Không được thực hiện thao tác này với đề nghị.',403);
   if(!allocationPending(offer,employeeId,now).some(w=>contains(w,window)))fail('Khoảng giờ đã được nhận, rút, hết hạn hoặc ngoài đề nghị.',409);
   if(command.action==='allocate'){
    if(!authority.lines.includes(command.targetLine)||groupOf(command.targetLine)!==offer.targetGroup)fail('Line nhận không thuộc phạm vi quản lý.',403);
    const person=employees.find(p=>p.id===employeeId&&p.active!==false&&p.line===offer.sourceLine);if(!person)conflict();
    checkBlockers(employeeId,window,blockers);checkOffers(state,employeeId,window,offer.id);
    const id=`allocation-${requestId}`;
    offer.allocations.push({id,planning:true,employeeId,targetLine:command.targetLine,...window,reason,actorId:authority.actorId,recordedAt:now});
    // Planning acceptance reserves availability; its adapter updates draft rosters.
    // It never creates an actual attendance, station, or payroll event.
    result={action:'allocate',offerId:offer.id,allocationId:id,planning:true};
   }else{offer.withdrawals.push({id:`withdrawal-${requestId}`,employeeId,...window,reason,actorId:authority.actorId,recordedAt:now});result={action:'withdraw',offerId:offer.id};}
  }
 }
 const selected=result.allocationId?auditOffer.allocations.find(a=>a.id===result.allocationId):null;
 next.revision++;next.audit.push({...result,requestId,actorId:authority.actorId,at:now,window,reason,employeeId:auditPeople.length===1?auditPeople[0].id:null,employeeName:auditPeople.length===1?auditPeople[0].name:null,employees:auditPeople.map(p=>({id:p.id,name:p.name})),sourceLine:auditOffer.sourceLine,targetLine:selected?.targetLine??null,sourceGroup:auditOffer.sourceGroup,targetGroup:auditOffer.targetGroup});
 next.receipts.push({requestId,actorId:authority.actorId,fingerprint,result});return {state:next,result,events};
}
