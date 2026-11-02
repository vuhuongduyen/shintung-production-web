import {importedStageEvents} from './production-stage-history.mjs';
import {projectLiveStages} from './production-stage-live.mjs';
import {stageKey} from './production-stage-trial.mjs';
import {stageEmployeeChoices} from './production-stage-staff.mjs';
import {attendanceEdges,vnMoment} from './production-attendance.mjs';
import {employeesAt} from './production-hours.mjs';
const time=v=>Date.parse(v),minute=v=>{const[a,b]=String(v).split(':').map(Number);return a*60+b;};
export function backfillInspection(state,order,from,to){
 const a=time(from),b=time(to),points=new Set([a,b]),work=[];
 const preparedEvents=[...importedStageEvents(state.orders,state.reports,state.events),...state.events.filter(e=>!e.importedStageProjection)],orderMap=new Map(state.orders.map(o=>[o.id,o]));
 const initial=projectLiveStages(state.orders,state.reports,state.events,a,{preparedEvents});
 const initiallyStaged=new Set(Object.values(initial).filter(s=>s.at||s.startedAt).map(s=>s.orderId));
 const relevant=new Set([order.id,...Object.values(initial).filter(s=>s.people?.length).map(s=>s.orderId),...preparedEvents.filter(e=>time(e.effectiveAt)>a&&time(e.effectiveAt)<b).map(e=>e.sourceId)]);
 const stageOrders=state.orders.filter(o=>relevant.has(o.id)),stageReports=state.reports.filter(r=>relevant.has(r.transitId)),stageEvents=preparedEvents.filter(e=>relevant.has(e.sourceId));
 const legacyByOrder=new Map();for(const e of state.events.filter(e=>!e.voided&&!e.cancelled&&!e.stageReporting))for(const id of new Set([e.sourceId,e.destinationId].filter(Boolean))){if(!legacyByOrder.has(id))legacyByOrder.set(id,[]);legacyByOrder.get(id).push(e);}
 const rosterEvents=state.events.filter(e=>!['absence','line-absence'].includes(e.kind));
 for(let midnight=time(vnMoment(a).date+'T00:00:00+07:00');midnight<b;midnight+=86400000){
  const date=vnMoment(midnight).date,ref=state.approvedSchedules.find(r=>(r.line===order.line||r.key?.endsWith(':'+order.line))&&r.days?.some(d=>d.date===date)),day=ref?.days?.find(d=>d.date===date);
  if(!day)throw Error(`Line ${order.line} chưa có lịch được duyệt ngày ${date.split('-').reverse().join('/')}. Kiểm tra Lịch SX thực tế.`);
  if(day.working)for(const [start,end]of [[day.hcStart||'08:00',day.hcEnd||'17:00'],...(day.ot?[[day.otStart||'17:30',day.otEnd||'21:00']]:[])]){const x=Math.max(a,midnight+minute(start)*60000),y=Math.min(b,midnight+minute(end)*60000);if(x<y){work.push([x,y]);points.add(x);points.add(y);}}
  for(const v of attendanceEdges(ref,date)){const t=midnight+v*60000;if(t>a&&t<b)points.add(t);}
 }
 for(const e of state.events)for(const v of [e.effectiveAt,e.endsAt]){const t=time(v);if(t>a&&t<b)points.add(t);}
 const edges=[...points].sort((x,y)=>x-y),slices=[];
 for(let i=0;i<edges.length-1;i++){const start=edges[i],end=edges[i+1],working=work.some(([x,y])=>x<=start&&y>=end),stages=start===a?initial:projectLiveStages(stageOrders,stageReports,stageEvents,start,{preparedEvents:stageEvents});
 // Actual leave is deducted by the hour calculator; roster/Line eligibility is independent.
 const allowed=working?new Set(stageEmployeeChoices({employees:state.employees,events:rosterEvents,schedules:state.approvedSchedules,line:order.line,effectiveAt:new Date(start).toISOString()}).map(p=>p.id)):new Set();
 const assigned=new Map(),put=(id,item)=>{if(!assigned.has(id))assigned.set(id,[]);assigned.get(id).push(item);},staged=new Set(Object.values(stages).filter(s=>s.at||s.startedAt).map(s=>s.orderId));
 const window={from:new Date(start).toISOString(),to:new Date(end).toISOString()};
 for(const stage of Object.values(stages)){const o=orderMap.get(stage.orderId);for(const id of stage.people||[])put(id,{orderId:stage.orderId,order:o?.lsxCode||stage.orderId,stage:stage.stage,line:o?.line,...window});}
 for(const [id,history]of legacyByOrder){if(staged.has(id)||initiallyStaged.has(id))continue;const o=orderMap.get(id);if(!o)continue;for(const person of employeesAt(history,id,start)||[])put(person,{orderId:id,order:o.lsxCode,stage:'Chưa ghi công đoạn',legacy:true,line:o.line,...window});}
 slices.push({from:start,to:end,working,allowed,stages,assigned});}
 const total=work.reduce((n,[x,y])=>n+y-x,0);
 const candidates=state.employees.map(p=>{const eligible=slices.filter(s=>s.working&&s.allowed.has(p.id)).reduce((n,s)=>n+s.to-s.from,0),assignments=[];
 for(const s of slices)assignments.push(...(s.assigned.get(p.id)||[]));
 const compact=[];for(const item of assignments){const previous=compact.findLast(x=>x.orderId===item.orderId&&x.stage===item.stage&&x.to===item.from);if(previous)previous.to=item.to;else compact.push({...item});}
 return {id:p.id,name:p.name||p.id,line:p.line,eligible:total>0&&eligible===total,partial:eligible>0&&eligible<total,eligibleMinutes:eligible/60000,totalMinutes:total/60000,assignments:compact};}).filter(p=>p.eligibleMinutes>0||p.line===order.line);
 return {candidates,slices,total};
}
export {stageKey};
