import {requestDepartments} from './department-change-access.mjs';
export const incidentStage=s=>String(s||'').replace(/^[ABC]-/,'').trim().toUpperCase().replace(/^ASSY\s*1$/,'ASSY');
export const incidentLogin=a=>String(a.permissionLogin||a.login||a.userId||'').toLowerCase();
export const incidentAllowed=(a,department)=>Boolean(a.isAdmin||requestDepartments(incidentLogin(a)).includes(department));
export const incidentStatus=r=>({awaiting_qlsx:'Chờ QLSX xác nhận',awaiting_khsx:'Chờ KHSX phản hồi',handling:'Đang xử lý',resolved:'Đã xử lý'}[r.incident?.status]||'Phiếu báo sự cố');
export function incidentStages(order,reports=[]){
 const stages=[...new Set((order.processes||[]).map(incidentStage).filter(Boolean))];
 return stages.filter(stage=>reports.filter(r=>r.transitId===order.id&&!r.cancelled&&!r.voided&&incidentStage(r.stageCode||r.stageName||r.stage||r.process||r.processName)===stage).reduce((n,r)=>n+Number(r.stageQuantity??r.reportedQuantity??0),0)<Number(order.lsxQty));
}
export function incidentRights(r,a){const status=r.incident.status;return {canConfirmIncident:status==='awaiting_qlsx'&&incidentAllowed(a,'QLSX'),canReplyIncident:status==='awaiting_khsx'&&incidentAllowed(a,'KHSX'),canResolveIncident:status==='handling'&&(incidentAllowed(a,'QLSX')||r.owner===incidentLogin(a))};}

// Project only the selected stages; never pause an entire order from a stage event.
export function projectIncidentStages(state,events,orders){
 const next={...state};
 for(const event of events.filter(e=>e.kind==='stage-incident'&&!e.voided).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt))){
 const order=orders.find(o=>o.id===event.sourceId);if(!order)continue;
 for(const selected of event.stages||[]){const stage=(order.processes||[]).find(s=>incidentStage(s)===incidentStage(selected));if(!stage)continue;
 const key=JSON.stringify([order.id,stage]),old=next[key];if(old?.at&&Date.parse(old.at)>=Date.parse(event.effectiveAt))continue;
 next[key]={...old,orderId:order.id,stage,people:old?.people||[],completed:old?.completed||0,status:'paused',at:event.effectiveAt,incidentId:event.incidentId};
 }
 }return next;
}
