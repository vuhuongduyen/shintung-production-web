import {hoursForOrder} from './production-hours.mjs';
import {effectiveAttendance,vnMoment} from './production-attendance.mjs';
const minute=(value,fallback)=>typeof value==='number'?value:/^\d\d:\d\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):fallback;
const same=(a,b)=>String(a).toUpperCase()===String(b).toUpperCase();
// Disposable preview only. No writes, no opening the whole line's calendar.
export function extraTrialHours(session,line,references=[],events=[]){
 const date=vnMoment(session.start).date;
 const refs=references.filter(r=>r.line===line||r.key?.endsWith(`:${line}`));
 const ref=refs.find(r=>r.days?.some(d=>d.date===date));
 const days=refs.flatMap(r=>r.days||[]);
 const day=ref?.days?.find(d=>d.date===date&&d.working)||days.filter(d=>d.date<=date&&d.working).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)||{};
 const defaults={hcStart:480,hcEnd:1020,lunchStart:720,lunchEnd:780,breakMorningStart:600,breakMorningEnd:610,breakAfternoonStart:900,breakAfternoonEnd:910};
 const hc={working:true,ot:false,...Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,minute(day[k],v)]))};
 hc.hcEnd=Math.min(hc.hcEnd,1020);
 const midnight=Date.parse(`${date}T00:00:00+07:00`),end=Math.min(midnight+hc.hcEnd*60000,session.end?Date.parse(session.end):Infinity);
 if(end<=Date.parse(session.start))return {date,hours:0};
 const absent=effectiveAttendance(events).filter(e=>['absence','line-absence'].includes(e.kind)&&e.employees?.some(id=>same(id,session.employee)));
 const leaves=(ref?.input?.dailyHcLeave||[]).filter(r=>r.date<=date&&(r.to||r.date)>=date&&r.employees?.some(id=>same(id,session.employee)));
 const blocked=absent.map(e=>[Date.parse(e.effectiveAt),Date.parse(e.endsAt)]).concat(leaves.map(r=>[midnight+(r.mode==='full'?0:minute(r.start,0))*60000,midnight+(r.mode==='full'?1440:minute(r.end,1440))*60000]));
 const synthetic=[{kind:'start',sourceId:'trial',effectiveAt:session.start,count:1,employees:[session.employee]},...blocked.filter(([a,b])=>Number.isFinite(a)&&Number.isFinite(b)&&b>a).map(([a,b],i)=>({id:`absence-${i}`,kind:'absence',sourceId:'trial',effectiveAt:new Date(a).toISOString(),endsAt:new Date(b).toISOString(),count:1,employees:[session.employee]}))];
 return {date,hours:hoursForOrder(synthetic,{[date]:hc},'trial',session.start,new Date(end).toISOString()).hc};
}
