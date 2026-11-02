import {projectLiveStages} from '../../lib/production-stage-live.mjs';
import {correctionStage} from '../../lib/production-correction-orders.mjs';
import {productionDisplayTime} from '../../lib/production-display-time.mjs';
// Compute the exact overlapping intervals. Only the selected order/stages win;
// removal from another assignment requires an explicit choice in the dialog.
export function planCorrectionConflicts({state,events,reports,order,stages,from,actor,now,originalEvents=events,originalReports=reports}){
 const active=events.filter(e=>!e.voided&&(e.stageReporting||e.sourceTimeLog||e.kind==='stage-incident'));
 const points=[...new Set([from,...active.map(e=>Date.parse(e.effectiveAt)).filter(t=>Number.isFinite(t)&&t>=from),Date.parse(now)])].sort((a,b)=>a-b);
 const writes=[],impacts=[],previous=new Map();
 const label=s=>`${state.orders.find(o=>o.id===s.orderId)?.lsxCode||s.orderId} · ${s.stage}`;
 for(let i=0;i<points.length;i++){
  const at=points[i],baseline=Object.values(projectLiveStages(state.orders,originalReports,originalEvents,points[i])),all=Object.values(projectLiveStages(state.orders,reports,active,at)),owners=new Map();
  for(const s of all.filter(s=>s.orderId===order.id&&stages.has(correctionStage(s))))for(const id of s.people||[])owners.set(id,s);
  for(const s of all.filter(s=>s.orderId!==order.id||!stages.has(correctionStage(s)))){
   const key=JSON.stringify([s.orderId,s.stage]),remove=(s.people||[]).filter(id=>owners.has(id)&&!(baseline.find(x=>x.orderId===s.orderId&&x.stage===s.stage)?.people?.includes(id)&&baseline.find(x=>x.orderId===order.id&&x.stage===owners.get(id).stage)?.people?.includes(id))),prior=previous.get(key)||[];
   if(!remove.length&&!prior.length)continue;
   const other=state.orders.find(o=>o.id===s.orderId);
   if(other?.line!==order.line)throw Object.assign(Error(`${label(s)}: phân công trùng thuộc Line khác; tài khoản hiện tại chưa được phép điều chỉnh phân công này.`),{status:403});
   const stamp=new Date(at).toISOString(),to=points[i+1]?new Date(points[i+1]).toISOString():null;
   if(remove.length)impacts.push({orderId:s.orderId,stage:s.stage,label:label(s),employees:remove,from:stamp,to,action:'Điều chỉnh phân công trùng giờ'});
   const ownBoundary=active.some(e=>e.sourceId===s.orderId&&correctionStage(e)===correctionStage(s)&&Date.parse(e.effectiveAt)===at);
   if(JSON.stringify(remove)!==JSON.stringify(prior)||ownBoundary){
    const after={...s,people:(s.people||[]).filter(id=>!remove.includes(id)),at:stamp};if(after.status==='running'&&!after.people.length)after.status='paused';
    const before=Object.values(projectLiveStages(state.orders,reports,[...active,...writes.map(w=>w.value)],at-1)).find(x=>x.orderId===s.orderId&&x.stage===s.stage)||s;
    const event={id:crypto.randomUUID(),kind:'stage-work',stageReporting:true,stageAction:'transfer',sourceId:s.orderId,line:other.line,stageName:s.stage,stageBefore:before,stageAfter:after,employees:after.people,count:after.people.length,effectiveAt:stamp,recordedAt:now,actor:actor.login,actorId:actor.userId||actor.login,reason:'Điều chỉnh phân công trùng giờ',timeCorrection:true};
    writes.push({entity:'production_event',key:event.id,value:event});
   }
   previous.set(key,remove);
  }
 }
 return {writes,impacts};
}
export function describeCorrectionConflicts(impacts,employees){return impacts.map(i=>`${i.employees.map(id=>employees.find(p=>p.id===id)?.name||id).join(', ')} · ${i.label}: ${productionDisplayTime(i.from)} – ${i.to?productionDisplayTime(i.to):'đang thực hiện'}`).join('; ');}
