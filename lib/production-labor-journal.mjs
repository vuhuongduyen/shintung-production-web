import {assignedAt,employeesAt} from './production-hours.mjs';
import {importedStageEvents} from './production-stage-history.mjs';
import {projectLiveStages} from './production-stage-live.mjs';
import {staffTransferDetails} from './production-staff-transfer-detail.mjs';
import {activeStaffMovement} from './production-attendance.mjs';
import {journalContext} from './production-journal.mjs';
const key=v=>String(v||'').toUpperCase();
const movement=e=>['start','add','reduce','transfer'].includes(e.kind)||e.kind==='complete'&&e.finalCompletion;
const valid=e=>!e.voided&&!e.cancelled&&Number.isFinite(Date.parse(e.effectiveAt));
export function laborJournal(events,orders,employees,now=Date.now(),reports=[]) {
 const sorted=events.filter(valid).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt))||String(a.id).localeCompare(String(b.id)));
 const endpoint=(id,line,label)=>{const order=orders.find(o=>o.id===id);return {id,lsx:order?.lsxCode||'',sku:order?.sku||'',name:order?.name||'',spec:order?.spec||'',line:order?.line||line||'',label:order?.lsxCode?`LSX ${order.lsxCode}`:id?'Chưa có lệnh trong danh sách':label};};
 const count=(es,id,at)=>{if(!id)return null;const state=assignedAt(es,id,at);return state.known?state.count:null;};
 const rows=sorted.filter(e=>movement(e)||['absence','line-absence','attendance-override','line-movement'].includes(e.kind)).map(e=>{
  // Include pause/resume and other source events in the same canonical replay.
  const prior=sorted.slice(0,sorted.indexOf(e));const at=Date.parse(e.effectiveAt),after=[...prior,e];
  const source=e.kind==='line-movement'?endpoint(null,e.line,`Line ${e.line||'—'}`):['start','add'].includes(e.kind)?endpoint(null,e.line,'Nhân lực chưa phân công'):endpoint(e.sourceId,e.line,'Theo Line');
  const destination=e.kind==='line-movement'?endpoint(null,e.destinationLine,`Line ${e.destinationLine||'—'}`):['start','add'].includes(e.kind)?endpoint(e.sourceId,e.line,'Theo Line'):e.kind==='transfer'?endpoint(e.destinationId,e.destinationLine,'Chưa có lệnh đích'):['reduce','complete'].includes(e.kind)?endpoint(null,e.line,'Chờ phân bổ'):endpoint(e.sourceId,e.line,'Theo Line');
  const sourceBefore=['start','add'].includes(e.kind)?null:(e.before?.source??count(prior,e.sourceId,at));
  const sourceAfter=['start','add'].includes(e.kind)?null:(e.after?.source??count(after,e.sourceId,at));
  const destId=['start','add'].includes(e.kind)?e.sourceId:e.kind==='transfer'?e.destinationId:null;
  const context=journalContext(e,orders,employees);
  return {...context,source,destination,sourceBefore,sourceAfter,destinationBefore:destId===e.sourceId?(e.before?.source??count(prior,destId,at)):count(prior,destId,at),destinationAfter:destId===e.sourceId?(e.after?.source??count(after,destId,at)):count(after,destId,at),line:[...new Set([source.line,destination.line].filter(Boolean))].join(' / '),movement:movement(e)};
 });
 // Stage snapshots contain both outgoing and incoming people. In particular,
 // employees on an exit event is the AFTER crew, not everyone who just worked.
 const links=staffTransferDetails(events),stageRows=[];
 const stageEvents=[...importedStageEvents(orders,reports,events).filter(e=>!events.some(x=>x.id===e.id&&x.stageReporting)),...events];
 for(const e of stageEvents.filter(e=>e.stageReporting&&e.stageAfter&&Number.isFinite(Date.parse(e.effectiveAt)))){
  if(links.hidden.has(e.id))continue;
  const before=e.stageBefore?.people||[],after=e.stageAfter.people||[];
  for(const id of new Set([...before,...after,...(e.employees||[])])){
   const transfer=(links.details.get(e.id)||[]).find(x=>key(x.employeeId)===key(id));
   const was=before.some(x=>key(x)===key(id)),is=after.some(x=>key(x)===key(id));
   if(['add','transfer'].includes(e.stageAction)&&was&&is&&!transfer)continue;
   const source=transfer?{...endpoint(transfer.fromOrderId,e.line,'Chưa ghi nhận'),stage:transfer.fromStage}:was?{...endpoint(e.sourceId,e.line,'Chưa ghi nhận'),stage:e.stageName}:endpoint(null,e.line,'Chưa ghi nhận phân công trước');
   const destination=transfer?{...endpoint(transfer.toOrderId,e.line,'Chưa ghi nhận'),stage:transfer.toStage}:is?{...endpoint(e.sourceId,e.line,'Chưa ghi nhận'),stage:e.stageName}:endpoint(null,e.line,'Chờ phân bổ');
   const inferredAction=e.sourceOperation==='Nhập trạm'||e.id.includes(':start:')?'start':e.sourceOperation==='Xuất trạm'||e.id.includes(':complete:')?'complete':e.sourceOperation==='Tạm ngưng'||e.id.includes(':pause:')?'pause':e.sourceOperation==='Tiếp tục'||e.id.includes(':resume:')?'resume':null;
   const row=journalContext({...e,stageAction:e.stageAction||inferredAction||'stage-history',employees:[id],count:1},orders,employees,reports);
   stageRows.push({...row,operation:row.operation||e.sourceOperation||'Phân công theo dữ liệu lịch sử',id:`${e.id}:person:${id}`,eventId:e.id,source,destination,sourceBefore:null,sourceAfter:null,destinationBefore:null,destinationAfter:null,movement:!e.voided&&!e.cancelled&&!e.replacedByStageBatch,assignmentNote:e.voided||e.cancelled?'Thao tác đã hủy':e.replacedByStageBatch?'Thao tác đã thay thế':transfer?'Chuyển phân công giữa các công đoạn':!is?'Về chờ phân bổ':!was?'Bắt đầu phân công':e.stageAfter.status==='paused'?'Tạm ngưng tại công đoạn':'Tiếp tục phân công',stageStatus:e.stageAfter.status});
  }
 }
 rows.push(...stageRows);
 rows.sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt))||String(a.id).localeCompare(String(b.id)));
 const effective=sorted.filter(e=>Date.parse(e.effectiveAt)<=now);
 const assignments=orders.map(o=>({order:o,ids:employeesAt(effective,o.id,now),state:assignedAt(effective,o.id,now)}));
 const stages=Object.values(projectLiveStages(orders,reports,events.filter(e=>!e.cancelled&&!e.replacedByStageBatch),now));
 const stageOrders=new Set(stages.filter(s=>s.at||s.startedAt).map(s=>s.orderId));
 const positions=employees.map(p=>{
  const id=key(p.id),locations=[...assignments.filter(a=>!stageOrders.has(a.order.id)&&a.ids?.some(v=>key(v)===id)),...stages.filter(s=>(s.people||[]).some(v=>key(v)===id)).map(s=>({order:orders.find(o=>o.id===s.orderId),stage:s.stage,stageStatus:s.status}))].filter(a=>a.order);
  const history=rows.filter(e=>(e.employees||[]).some(v=>key(v)===id));
  const last=history.filter(e=>e.movement&&Date.parse(e.effectiveAt)<=now).at(-1);
  const ambiguous=locations.length>1||assignments.some(a=>!stageOrders.has(a.order.id)&&a.ids===null&&a.state.count>0&&effective.some(e=>(e.sourceId===a.order.id||e.destinationId===a.order.id)&&(e.employees||[]).some(v=>key(v)===id)));
  const released=last&&(last.stageReporting?!last.destination?.id:['reduce','complete'].includes(last.kind));
  const status=ambiguous?'Cần kiểm tra':locations.length===1?'Đang ở LSX':released?'Chờ phân bổ':'Chưa xác định';
  const order=locations.length===1?locations[0].order:null;
  return {...p,status,position:status,order,lsx:order?.lsxCode||'',sku:order?.sku||'',productName:order?.name||'',line:order?.line||activeStaffMovement(effective,p.id,now)?.destinationLine||last?.destinationLine||last?.line||p.line,stage:locations.map(a=>a.stage||'Chưa ghi công đoạn').join(' / '),stageStatus:locations[0]?.stageStatus,employee:`${p.name||''} ${p.id}`,effectiveAt:last?.effectiveAt,operation:last?.operation,actorId:last?.actorId,history:history.slice().reverse(),conflictingOrders:locations.map(a=>a.order)};
 });
 return {rows:rows.reverse(),positions};
}
export function filterLabor(rows,filters={},current=false) {
 const query=String(filters.value||'').trim().toLocaleLowerCase('vi');
 return rows.filter(r=>{
  const field=filters.field||'employee';
  const search=current?(field==='name'?r.productName:field==='actor'?r.actorId:r[field]):field==='lsx'?[r.source?.lsx,r.destination?.lsx].join(' '):field==='sku'?[r.source?.sku,r.destination?.sku].join(' '):field==='name'?[r.source?.name,r.destination?.name].join(' '):field==='actor'?r.actorId:r[field];
  if(query&&!String(search||'').toLocaleLowerCase('vi').includes(query))return false;
  if(filters.line&&filters.line!=='all'&&!String(r.line||'').split(' / ').includes(filters.line))return false;
  if(filters.status&&filters.status!=='all'&&r.status!==filters.status)return false;
  const day=r.effectiveAt?new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(r.effectiveAt)):'';
  return (!filters.from||day>=filters.from)&&(!filters.to||day<=filters.to);
 });
}
