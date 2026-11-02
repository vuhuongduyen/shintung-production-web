import {stagePersonAvailable} from './production-line-assignment.mjs';
import {attendanceEdges,effectiveAttendance,eligibleStaff,vnMoment} from './production-attendance.mjs';
import {normalizedWorkDay,scheduledPart} from './production-monthly-attendance.mjs';
import {employeeActiveOn} from './employee-employment.mjs';
import {importedStageEvents} from './production-stage-history.mjs';
import {projectLiveStages} from './production-stage-live.mjs';
import {employeesAt} from './production-hours.mjs';
const upper=v=>String(v||'').trim().toUpperCase();
const minute=v=>Number(v?.slice(0,2))*60+Number(v?.slice(3));
// Read-only named assignments. Breaks pause the waiting clock without erasing it.
// Anonymous legacy labor cannot establish that a particular employee is assigned.
export function unassignedAlerts({schedules=[],events=[],orders=[],reports=[],employees=[],line='all',now=Date.now()}){
 const {date}=vnMoment(now),midnight=Date.parse(`${date}T00:00:00+07:00`),active=effectiveAttendance(events),result=[];
 const eligibilityEvents=active.filter(e=>['line-movement','transfer','attendance-override','absence','line-absence'].includes(e.kind));
 const staff=employees.filter(p=>employeeActiveOn(p,date));
 for(const reference of schedules){
  const currentLine=reference.line||reference.key?.split(':').at(-1),raw=reference.days?.find(d=>d.date===date);
  if(!raw||!currentLine||line!=='all'&&currentLine!==line)continue;
  const day=normalizedWorkDay(raw);if(!scheduledPart(day,(now-midnight)/60000))continue;
  const lineOrders=orders.filter(o=>o.line===currentLine&&o.status!=='HỦY'),orderIds=new Set(lineOrders.map(o=>o.id)),lineReports=reports.filter(r=>orderIds.has(r.transitId)),stageEvents=active.filter(e=>orderIds.has(e.sourceId)||orderIds.has(e.destinationId));
  const preparedEvents=[...importedStageEvents(lineOrders,lineReports,stageEvents),...stageEvents.filter(e=>!e.importedStageProjection)];
  const edges=new Set([midnight,now]);
  const add=at=>{if(Number.isFinite(at)&&at>midnight&&at<now)edges.add(at);};
  for(const key of ['hcStart','hcEnd','otStart','otEnd','lunchStart','lunchEnd','preOtStart','preOtEnd'])add(midnight+minute(day[key])*60000);
  for(const row of [...(day.breaks||[]),...(day.cleaning||[])])for(const key of ['start','end'])add(midnight+minute(row[key])*60000);
  for(const at of attendanceEdges(reference,date))add(midnight+at*60000);
  for(const e of active)for(const value of [e.effectiveAt,e.endsAt])add(Date.parse(value));
  for(const r of reports)add(Date.parse(r.completedAt));
  const points=[...edges].sort((a,b)=>a-b),waiting=new Map();
  const evaluate=at=>{
   const m=(at-midnight)/60000,part=scheduledPart(day,m)||(day.ot&&m>=minute(day.otStart)?'ot':'hc');
   const eligibility=eligibleStaff({reference,events:eligibilityEvents,employees:staff,line:currentLine,date,at:m,part});
   if(!eligibility.exact)return [];
   const stages=projectLiveStages(lineOrders,lineReports,active,at,{preparedEvents}),assigned=new Set();
   for(const o of lineOrders){
    const states=Object.values(stages).filter(s=>s.orderId===o.id),hasStage=states.some(s=>s.at||s.startedAt);
    if(hasStage){for(const s of states)for(const id of s.people||[])if(stagePersonAvailable(s,id,currentLine,active,at))assigned.add(upper(id));}
    else {const ids=employeesAt(active,o.id,at);for(const id of ids||[])assigned.add(upper(id));}
   }
   return eligibility.allowed.filter(p=>!assigned.has(upper(p.id))&&!active.some(e=>['absence','line-absence'].includes(e.kind)&&(e.employees||[]).some(id=>upper(id)===upper(p.id))&&Date.parse(e.effectiveAt)<=at&&Date.parse(e.endsAt)>at)&&!(day.cleaning||[]).some(c=>m>=minute(c.start)&&m<minute(c.end)&&((c.employees||[]).some(id=>upper(id)===upper(p.id))||Number(c.people)>0&&!c.employees?.length)));
  };
  for(let i=0;i<points.length-1;i++){
   const from=points[i],to=points[i+1],free=evaluate(from+(to-from)/2),ids=new Set(free.map(p=>upper(p.id)));
   for(const id of waiting.keys())if(!ids.has(id))waiting.delete(id);
   if(scheduledPart(day,((from+to)/2-midnight)/60000))for(const p of free){const id=upper(p.id);if(!waiting.has(id))waiting.set(id,{person:p,since:from,workingMs:0});waiting.get(id).workingMs+=to-from;}
  }
  const current=new Set(evaluate(now).map(p=>upper(p.id)));
  for(const [id,{person,since,workingMs}] of waiting)if(current.has(id)&&workingMs>10*60000)result.push({id:person.id,name:person.name||person.id,line:currentLine,since,minutes:Math.floor(workingMs/60000),key:`${date}:${currentLine}:${id}:${since}`});
 }
 return result;
}
