import {activeStaffMovement,effectiveAttendance} from './production-attendance.mjs';
import {rosterRanges} from './capacity-transfers.mjs';
import {normalizedWorkDay,scheduledPart} from './production-monthly-attendance.mjs';
const minute=value=>{const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value||''));return match?Number(match[1])*60+Number(match[2]):null;};
// A row's scheduled duration per person, not its additive contribution after
// other overlapping events. Never multiply by headcount or mutate attendance.
function calendarDuration(event,schedules=[]){
 if(event.openArrival)return {minutes:null,reason:'Chưa ghi giờ vào'};
 if(!event.endsAt)return {minutes:null,reason:'Chưa có giờ kết thúc'};
 const start=Date.parse(event.effectiveAt),end=Date.parse(event.endsAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return {minutes:null,reason:'Khoảng giờ không hợp lệ'};
 if(end-start>366*86400000)return {minutes:null,reason:'Khoảng giờ quá dài'};
 const line=['transfer','line-movement'].includes(event.kind)?event.destinationLine||event.line:event.line;
 const dates=new Map();for(const s of schedules.filter(s=>s.line===line||s.key?.endsWith(`:${line}`)))for(const day of s.days||[])dates.set(day.date,day);
 const first=new Date(start+7*3600000).toISOString().slice(0,10);
 let minutes=0,productionMinutes=0;
 for(let midnight=Date.parse(`${first}T00:00:00+07:00`);midnight<end;midnight+=86400000){
  const date=new Date(midnight+7*3600000).toISOString().slice(0,10),stored=dates.get(date);
  if(!stored)return {minutes:null,reason:'Thiếu lịch làm việc'};
  const day=normalizedWorkDay(stored),administrativeDay={...day,breaks:[]},a=Math.max(0,(start-midnight)/60000),b=Math.min(1440,(end-midnight)/60000);
  const edges=[a,b,...['hcStart','hcEnd','otStart','otEnd','lunchStart','lunchEnd','preOtStart','preOtEnd'].map(k=>minute(day[k])),...(day.breaks||[]).flatMap(r=>[minute(r.start),minute(r.end)])];
  const points=[...new Set(edges.filter(v=>v!==null&&v>=a&&v<=b))].sort((x,y)=>x-y);
  for(let i=1;i<points.length;i++){
   const midpoint=(points[i-1]+points[i])/2,elapsed=points[i]-points[i-1];
   if(scheduledPart(administrativeDay,midpoint))minutes+=elapsed;
   if(scheduledPart(day,midpoint))productionMinutes+=elapsed;
  }
 }
 return {minutes:productionMinutes,administrativeMinutes:minutes,reason:null};
}
export function formatProductionEventDuration(result){
 if(result.minutes===null)return result.reason||'Chưa tính được';
 const minutes=Math.round(result.minutes),hours=Math.floor(minutes/60),remaining=minutes%60;
 return hours?`${hours} giờ${remaining?` ${remaining} phút`:''}`:`${remaining} phút`;
}

// Resolve each employee's actual receiving line before applying its calendar.
// Do not rewrite the HR fact's home line or sum durations across employees.
export function productionEventDuration(event,schedules=[],context){
 if(!context||!['absence','line-absence','attendance-override'].includes(event.kind)||!event.employees?.length||event.openArrival||!event.endsAt)return calendarDuration(event,schedules);
 const start=Date.parse(event.effectiveAt),end=Date.parse(event.endsAt);
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>366*86400000)return calendarDuration(event,schedules);
 const active=context.activeEvents||effectiveAttendance(context.events||[]),people=[];
 for(const id of event.employees){
  const person=context.employees?.find(p=>String(p.id).toUpperCase()===String(id).toUpperCase());
  const movements=active.filter(e=>['transfer','line-movement'].includes(e.kind)&&e.employees?.some(v=>String(v).toUpperCase()===String(id).toUpperCase()));
  const points=new Set([start,end]),windows=[];
  for(const e of movements)for(const value of [e.effectiveAt,e.endsAt]){const at=Date.parse(value);if(at>start&&at<end)points.add(at);}
  const first=new Date(start+7*3600000).toISOString().slice(0,10);
  for(let midnight=Date.parse(`${first}T00:00:00+07:00`);midnight<end;midnight+=86400000){
   if(midnight>start)points.add(midnight);
   const date=new Date(midnight+7*3600000).toISOString().slice(0,10);
   for(const ref of schedules){
    const day=ref.days?.find(d=>d.date===date),roster=ref.roster?.find(r=>r.date===date),line=ref.line||ref.key?.split(':').at(-1);
    if(!day||!roster||!line)continue;
    for(const shift of ['hc','ot']){
     const rosterId=roster[shift]?.find(v=>String(v).toUpperCase()===String(id).toUpperCase());
     for(const [a,b] of rosterRanges(roster,normalizedWorkDay(day),shift,rosterId||id)){
      const from=midnight+a*60000,to=midnight+b*60000;if(to<=start||from>=end)continue;
      windows.push({from,to,line});for(const at of [from,to])if(at>start&&at<end)points.add(at);
     }
    }
   }
  }
  const sorted=[...points].sort((a,b)=>a-b),segments=[];let minutes=0,administrativeMinutes=0,reason=null;
  for(let i=1;i<sorted.length;i++){
   const from=sorted[i-1],to=sorted[i],at=(from+to)/2,move=activeStaffMovement(movements,id,at);
   const assigned=[...new Set(windows.filter(w=>w.from<=at&&w.to>at).map(w=>w.line))];
   if(!move&&assigned.length>1){reason='Lịch điều chuyển bị chồng line';break;}
   const line=move?.destinationLine||assigned[0]||event.line||person?.line;
   const result=calendarDuration({...event,line,effectiveAt:new Date(from).toISOString(),endsAt:new Date(to).toISOString()},schedules);
   if(result.minutes===null){reason=result.reason;break;}
   minutes+=result.minutes;administrativeMinutes+=result.administrativeMinutes;
   if(result.administrativeMinutes>0)segments.push({line,from:new Date(from).toISOString(),to:new Date(to).toISOString(),minutes:result.minutes,administrativeMinutes:result.administrativeMinutes});
  }
  people.push({id,name:person?.name||id,minutes:reason?null:minutes,administrativeMinutes:reason?null:administrativeMinutes,reason,segments});
 }
 const same=people.every(p=>p.minutes===people[0].minutes&&p.administrativeMinutes===people[0].administrativeMinutes);
 return {minutes:same?people[0].minutes:null,administrativeMinutes:same?people[0].administrativeMinutes:null,reason:same?people[0].reason:'Xem giờ từng nhân viên',people,lines:[...new Set(people.flatMap(p=>p.segments.map(s=>s.line)))]};
}
