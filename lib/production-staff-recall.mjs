import {effectiveAttendance,activeStaffMovement} from './production-attendance.mjs';
import {rosterRanges} from './capacity-transfers.mjs';
const upper=v=>String(v||'').trim().toUpperCase();
// Read-only actual overlay: never rewrite the approved planning roster or offer.
/** @param {{references?:Record<string,any>[],events?:Record<string,any>[],employees?:Record<string,any>[],effectiveAt:string,endsAt:string,homeLine?:string}} options
 * @returns {Record<string,any>[]}
 */
export function staffRecallCandidates({references=[],events=[],employees=[],effectiveAt,endsAt,homeLine=''}) {
 const from=Date.parse(effectiveAt),to=Date.parse(endsAt);
 if(!Number.isFinite(from)||!Number.isFinite(to)||to<=from||to-from>31*86400000)return [];
 const active=effectiveAttendance(events),result=[];
 for(const person of employees.filter(p=>p.active!==false&&p.line&&(!homeLine||upper(p.line)===upper(homeLine)))){
  const id=upper(person.id),home=upper(person.line),windows=[];
  for(const r of references){const line=r.line||r.key?.split(':').at(-1);if(!line||line===home)continue;
   for(const roster of r.roster||[]){const day=r.days?.find(d=>d.date===roster.date)||r.input?.dailySchedule?.find(d=>d.date===roster.date);
    const midnight=Date.parse(`${roster.date}T00:00:00+07:00`);
    for(const part of ['hc','ot'])for(const [a,b] of rosterRanges(roster,day,part,person.id))windows.push({start:midnight+a*60000,end:midnight+b*60000,line});
   }
  }
  for(const e of active)if(['line-movement','transfer'].includes(e.kind)&&e.movementType!=='recall'&&e.destinationLine!==home&&(e.employees||[]).some(v=>upper(v)===id)&&!(e.orderAssignmentOnlyEmployees||[]).some(v=>upper(v)===id))windows.push({start:Date.parse(e.effectiveAt),end:e.endsAt?Date.parse(e.endsAt):to,line:e.destinationLine});
  const edges=[...new Set([from,to,...windows.flatMap(w=>[w.start,w.end]),...active.filter(e=>e.employees?.some(v=>upper(v)===id)).flatMap(e=>[Date.parse(e.effectiveAt),Date.parse(e.endsAt)])].filter(t=>Number.isFinite(t)&&t>=from&&t<=to))].sort((a,b)=>a-b),segments=[];
  for(let i=1;i<edges.length;i++){
   const start=edges[i-1],end=edges[i],move=activeStaffMovement(active,id,start);
   if(move?.destinationLine===home)continue;
   const lines=move?.destinationLine?[move.destinationLine]:[...new Set(windows.filter(w=>w.start<=start&&w.end>=end).map(w=>w.line))];
   if(lines.length!==1||lines[0]===home)continue;
   const line=lines[0],last=segments.at(-1);
   if(last&&last.line===line&&Date.parse(last.endsAt)===start)last.endsAt=new Date(end).toISOString();
   else segments.push({line,destinationLine:home,effectiveAt:new Date(start).toISOString(),endsAt:new Date(end).toISOString()});
  }
  if(segments.length)result.push({...person,segments,borrowedLines:[...new Set(segments.map(s=>s.line))]});
 }
 return result;
}
export const recallCovers=(events,id,at,targetLine,homeLine)=>effectiveAttendance(events).some(e=>e.kind==='line-movement'&&e.movementType==='recall'&&e.line===targetLine&&e.destinationLine===homeLine&&e.employees?.includes(id)&&Date.parse(e.effectiveAt)<=at&&at<Date.parse(e.endsAt));
