import {importedStageEvents} from './production-stage-history.mjs';
import {stageKey,trialStages,applyStageTrial} from './production-stage-trial.mjs';
import {incidentStage,projectIncidentStages} from './production-incidents.mjs';
export const liveStageChoices=(order,state,action)=>trialStages(order).filter(stage=>{const s=state[stageKey(order.id,stage)]?.status||'waiting';return action==='start'?['waiting','partial'].includes(s):action==='extra'?s!=='done':action==='resume'?s==='paused':action==='incident'?['running','paused'].includes(s):s==='running';});
// Rebuild from official source records; browser-only trial state is never migrated.
export function projectLiveStages(orders,reports,events,at=Infinity){
 let state={};
 for(const o of orders)for(const stage of trialStages(o)){
  const rs=reports.filter(r=>r.transitId===o.id&&!r.cancelled&&!r.voided&&r.reviewStatus!=='Cần điều chỉnh'&&incidentStage(r.stageName||r.stageCode)===incidentStage(stage)&&Date.parse(r.completedAt)<=at);
  const completed=rs.reduce((n,r)=>n+Number(r.stageQuantity??r.reportedQuantity??0),0),last=rs.sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt)).at(-1);
  state[stageKey(o.id,stage)]={orderId:o.id,stage,people:[],completed,status:completed>=Number(o.lsxQty)?'done':last?'partial':'waiting',at:last?.completedAt};
 }
 for(const e of [...importedStageEvents(orders,reports,events),...events.filter(e=>!e.importedStageProjection)].filter(e=>!e.voided&&Date.parse(e.effectiveAt)<=at).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||(a.importedStageProjection&&b.importedStageProjection?0:a.importedStageProjection?-1:b.importedStageProjection?1:String(a.recordedAt).localeCompare(String(b.recordedAt))))){
  if(e.stageReporting&&e.stageAfter){const o=orders.find(o=>o.id===e.sourceId),stage=o&&trialStages(o).find(s=>incidentStage(s)===incidentStage(e.stageName));const key=stageKey(e.sourceId,stage);if(state[key]&&(!state[key].at||Date.parse(e.effectiveAt)>=Date.parse(state[key].at)))state[key]={...e.stageAfter,orderId:e.sourceId,stage};}
  if(e.kind==='stage-incident')state=projectIncidentStages(state,[e],orders);
 }
 return state;
}
export function applyLiveStages(state,command,orders){
 const o=orders.find(o=>o.id===command.orderId),allowed=o?liveStageChoices(o,state,command.action):[];
 if(!command.entries?.length||new Set(command.entries.map(e=>e.stage)).size!==command.entries.length||command.entries.some(e=>!allowed.includes(e.stage)))throw Error('Công đoạn không còn phù hợp với thao tác. Tải lại dữ liệu và chọn lại.');
 const next=applyStageTrial(state,command,orders);
 for(const [key,s] of Object.entries(next))if(JSON.stringify(s)!==JSON.stringify(state[key])){
  s.startedAt=state[key]?.startedAt||command.at;
  s.extraDate=state[key]?.extraDate;
  if(command.action==='extra'&&command.entries.some(e=>key===stageKey(command.orderId,e.stage)))s.extraDate=new Date(Date.parse(command.at)+7*3600000).toISOString().slice(0,10);
 }
 return next;
}
export function stageTimeline(events,orderId,stage){
 return events.filter(e=>!e.voided&&e.sourceId===orderId&&(e.stageReporting&&incidentStage(e.stageName)===incidentStage(stage)||e.kind==='stage-incident'&&e.stages?.some(s=>incidentStage(s)===incidentStage(stage)))).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||String(a.recordedAt).localeCompare(String(b.recordedAt)));
}
export function stageHours(events,report,schedule,attendance,calculate){
 const from=Date.parse(report.startedAt),to=Date.parse(report.completedAt),timeline=stageTimeline([...new Map([...events,...(report.importedStageTimeline||[])].map(e=>[e.id,e])).values()],report.transitId,report.stageName);
 const result={hc:0,ot:0,total:0,perEmployee:[],perDay:[],staffing:[]},people=new Map(),days=new Map();
 for(let i=0;i<timeline.length;i++){
  const e=timeline[i],s=e.stageAfter;if(!s||s.status!=='running'||!s.people.length)continue;
  const a=Math.max(from,Date.parse(e.effectiveAt)),b=Math.min(to,i+1<timeline.length?Date.parse(timeline[i+1].effectiveAt):to);if(b<=a)continue;
  const map=structuredClone(schedule),extra=s.extraDate;
  if(extra)map[extra]={working:true,ot:false,hcStart:480,hcEnd:1020,lunchStart:720,lunchEnd:780,breakMorningStart:600,breakMorningEnd:610,breakAfternoonStart:900,breakAfternoonEnd:910,...(map[extra]?.working?map[extra]:{}),ot:false,hcEnd:Math.min(map[extra]?.working?map[extra].hcEnd:1020,1020)};
  const absence=events.filter(x=>['absence','line-absence'].includes(x.kind)&&!x.voided&&x.approved!==false).map(x=>({...x,kind:'absence',sourceId:report.transitId}));
  const policy=extra?{...attendance,present:(id,date,minute,part)=>date===extra?attendance.extraPresent(id,date,minute,part):attendance.present(id,date,minute,part)}:attendance;
  const h=calculate([{kind:'start',sourceId:report.transitId,effectiveAt:new Date(a).toISOString(),count:s.people.length,employees:s.people},...absence],map,report.transitId,new Date(a).toISOString(),new Date(b).toISOString(),policy);
  result.hc+=h.hc;result.ot+=h.ot;result.staffing.push(...(h.staffing||[]));
  for(const p of h.perEmployee||[]){const old=people.get(p.id)||{id:p.id,hc:0,ot:0};old.hc+=p.hc;old.ot+=p.ot;people.set(p.id,old);}
  for(const p of h.perDay||[]){const old=days.get(p.date)||{date:p.date,hc:0,ot:0};old.hc+=p.hc;old.ot+=p.ot;days.set(p.date,old);}
 }
 result.total=result.hc+result.ot;result.perEmployee=[...people.values()].map(p=>({...p,total:p.hc+p.ot}));result.perDay=[...days.values()].map(p=>({...p,total:p.hc+p.ot}));return result;
}
