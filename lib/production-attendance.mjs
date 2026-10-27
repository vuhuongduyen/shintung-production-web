import {rosterRanges} from './capacity-transfers.mjs';
// Named attendance for a single Vietnam calendar day. Approved Capacity is a
// reference; actual absences recorded by QLSX override it without editing it.
const upper = value => String(value || '').trim().toUpperCase();
const vn = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
export function vnMoment(value) {
 const parts=vn.formatToParts(new Date(value)),part=type=>parts.find(p=>p.type===type)?.value||'';
 return {date:`${part('year')}-${part('month')}-${part('day')}`,minute:Number(part('hour'))*60+Number(part('minute'))};
}
const minute = value => {const match=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(value||''));return match?Number(match[1])*60+Number(match[2]):null;};
const covers = (row,date) => row.date <= date && (row.to || row.date) >= date;
const contains = (row,at) => {
 const start=minute(row.start),end=minute(row.end);
 return start!==null&&end!==null&&at>=start&&at<end;
};
function rosterFor(reference,date,part) {
 const roster=reference?.roster?.find(row=>row.date===date),planned=reference?.input?.dailySchedule?.find(day=>day.date===date);
 const actual=reference?.days?.find(day=>day.date===date);
 if(part==='hc'&&actual?.working&&!planned?.working) {
   // QLSX opened a previously unscheduled day: carry the last named HC roster
   // forward, then subtract absences specific to the new date.
   return reference?.roster?.filter(row=>row.date<date&&row.hc?.length).at(-1)||roster;
 }
 return roster;
}
export function attendanceEdges(reference,date) {
 const input=reference?.input||{};
 const roster=reference?.roster?.find(r=>r.date===date);
 const windows=[...Object.values(roster?.hcWindows||{}),...Object.values(roster?.otWindows||{})].flat(2);
 return [...(input.dailyHcLeave||[]).filter(row=>covers(row,date)&&row.mode==='hours'),
   ...(input.dailyOtLeave||[]).filter(row=>covers(row,date)&&['hours','interval'].includes(row.mode))]
   .flatMap(row=>[minute(row.start),minute(row.end)])
   .concat((input.dailyHcLeave||[]).filter(row=>covers(row,date)&&row.includeOt&&row.otMode==='hours')
     .flatMap(row=>[minute(row.otStart),minute(row.otEnd)]))
   .concat(windows).filter(value=>value!==null);
}
function approvedLeave(reference,date,part,id,at) {
 const input=reference?.input||{},days=input.dailySchedule||[];
 const hc=(input.dailyHcLeave||[]).filter(row=>covers(row,date)&&(row.employees||[]).some(employee=>upper(employee)===id));
 if(part==='hc')return hc.some(row=>row.mode==='full'||row.mode==='hours'&&contains(row,at));
 const ot=(input.dailyOtLeave||[]).filter(row=>covers(row,date)&&(row.employees||[]).some(employee=>upper(employee)===id));
 if(ot.some(row=>row.mode==='full'||row.mode==='attended'&&Number(row.hours)===0||row.mode==='hours'&&contains(row,at)||row.mode==='interval'&&contains(row,at)))return true;
 return hc.some(row=>row.includeOt && days.some(day=>day.date===date&&day.ot) &&
   date>=(row.otFrom||row.date) && date<=(row.otTo||row.otFrom||row.date) &&
   ((row.otMode||'full')==='full'||row.otMode==='hours'&&contains({start:row.otStart,end:row.otEnd},at)));
}
// Corrections append a new version; original events remain in the journal.
export function effectiveAttendance(events, includePending=false) {
 const accepted=(events||[]).filter(e=>!e.voided&&(includePending||e.approved!==false));
 const replaced=new Set(accepted.flatMap(e=>[e.supersedes,e.approvedFrom].filter(Boolean)));
 // Preserve the provenance of legacy station assignments before cancellation or
 // correction removes the governing loan from the effective event stream.
 return accepted.filter(e=>!replaced.has(e.id)&&e.kind!=="attendance-cancel").map(event=>{
  if(event.kind!=='transfer')return event;
  const inherited=(event.employees||[]).filter(id=>accepted.some(move=>move.kind==='line-movement'&&move.destinationLine===event.destinationLine&&(move.employees||[]).some(v=>upper(v)===upper(id))&&Date.parse(move.effectiveAt)<=Date.parse(event.effectiveAt)&&(!move.endsAt||Date.parse(move.endsAt)>Date.parse(event.effectiveAt))));
  if(!inherited.length)return event;
  return {...event,orderAssignmentOnlyEmployees:[...new Set([...(event.orderAssignmentOnlyEmployees||[]),...inherited])]};
 });
}
// One owner at each instant. Dependency depth makes equal-start onward loans
// deterministic even when persisted events arrive in a different order.
export function activeStaffMovement(events,id,instant) {
 const active=effectiveAttendance(events),byId=new Map(active.map(e=>[e.id,e]));
 const isOrderOnly=e=>e.kind==='transfer'&&(e.orderAssignmentOnlyEmployees||[]).some(v=>upper(v)===upper(id));
 const depth=(event,seen=new Set())=>{if(seen.has(event.id))return 0;const next=new Set([...seen,event.id]);return 1+Math.max(0,...(event.parentMovementIds||[]).map(id=>byId.has(id)?depth(byId.get(id),next):0));};
 return active.filter(e=>['transfer','line-movement'].includes(e.kind)&&!isOrderOnly(e)&&(e.employees||[]).some(v=>upper(v)===upper(id))&&Date.parse(e.effectiveAt)<=instant&&(!e.endsAt||Date.parse(e.endsAt)>instant))
  .sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt)||depth(a)-depth(b)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||''))).at(-1);
}
// Eligibility covers the entire half-open requested interval, including every
// movement and Capacity window boundary, rather than only its first instant.
/** @param {{references?:Record<string,any>[],events?:Record<string,any>[],employees?:Record<string,any>[],line:string,effectiveAt:string,endsAt:string}} options */
export function transferStaffCandidates({references=[],events=[],employees=[],line,effectiveAt,endsAt}) {
 const start=Date.parse(effectiveAt),end=Date.parse(endsAt);
 if(!line||!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>366*86400000)return [];
 const active=effectiveAttendance(events),points=new Set([start]);
 for(const e of active)for(const value of [e.effectiveAt,e.endsAt]){const at=Date.parse(value);if(at>start&&at<end)points.add(at);}
 for(let midnight=Date.parse(`${vnMoment(start).date}T00:00:00+07:00`);midnight<end;midnight+=86400000){
  if(midnight>start)points.add(midnight);
  const date=vnMoment(midnight).date;
  for(const reference of references){
   for(const at of attendanceEdges(reference,date)){const instant=midnight+at*60000;if(instant>start&&instant<end)points.add(instant);}
   const day=reference.days?.find(d=>d.date===date)||reference.input?.dailySchedule?.find(d=>d.date===date);
   for(const key of ['hcStart','hcEnd','otStart','otEnd']){const at=minute(day?.[key]);if(at!==null&&midnight+at*60000>start&&midnight+at*60000<end)points.add(midnight+at*60000);}
  }
 }
 let candidates=employees.filter(e=>e.active!==false);
 for(const instant of [...points].sort((a,b)=>a-b)){
  const {date,minute:at}=vnMoment(instant),reference=references.find(r=>(r.line===line||r.key?.endsWith(`:${line}`))&&(r.days?.some(d=>d.date===date)||r.roster?.some(d=>d.date===date)));
  const day=reference?.days?.find(d=>d.date===date)||reference?.input?.dailySchedule?.find(d=>d.date===date);
  const part=day?.ot&&at>=(minute(day.otStart)??1050)&&at<(minute(day.otEnd)??1260)?'ot':'hc';
  const allowed=new Set(eligibleStaff({reference,events:active,employees:candidates,line,date,at,part}).allowed.map(e=>upper(e.id)));
  candidates=candidates.filter(e=>allowed.has(upper(e.id))&&!references.some(other=>{
   const otherLine=other.line||other.key?.split(':').at(-1);if(otherLine===line||activeStaffMovement(active,e.id,instant))return false;
   const roster=other.roster?.find(r=>r.date===date),d=other.days?.find(d=>d.date===date)||other.input?.dailySchedule?.find(d=>d.date===date);
   return ['hc','ot'].some(shift=>rosterRanges(roster,d,shift,e.id).some(([a,b])=>a<=at&&at<b));
  }));
  if(!candidates.length)break;
 }
 return candidates;
}
export function isPresent(reference, events, id, line, date, at, part='hc', includeHelpers=false) {
 events=effectiveAttendance(events);
 const employee=upper(id),roster=rosterFor(reference,date,part);
 const instant=Date.parse(`${date}T00:00:00+07:00`)+at*60000;
 // A recorded transfer into this Line can supplement its approved roster.
 const movement=activeStaffMovement(events,employee,instant);
 const movedIn=movement?.destinationLine===line;
 if(movement?.destinationLine&&movement.destinationLine!==line)return false;
 const actualPresence=(events||[]).some(event=>event.kind==='attendance-override'&&event.approved!==false&&event.line===line&&
   (event.employees||[]).some(value=>upper(value)===employee)&&Date.parse(event.effectiveAt)<=instant&&Date.parse(event.endsAt)>instant);
 if(roster && !(roster[part]||[]).some(value=>upper(value)===employee) && !movedIn&&!actualPresence&&!actualLeaveCandidate(reference,date,part,employee))return false;
 if(roster?.[part+'Windows']?.[id]&&!movedIn&&!actualPresence&&!rosterRanges(roster,reference?.input?.dailySchedule?.find(d=>d.date===date),part,id).some(([a,b])=>a<=at&&at<b))return false;
 // Capacity leave is a forecast. Only actual HR absence deducts production time.
 if((events||[]).some(event=>['absence','line-absence'].includes(event.kind)&&event.approved!==false&&(!includeHelpers||!['Phụ kho','CV khác'].includes(event.absenceType))&&(!event.sourceId||event.line===line)&&
    (event.employees||[]).some(value=>upper(value)===employee)&&
    Date.parse(event.effectiveAt)<=instant&&Date.parse(event.endsAt)>instant))return false;
 return true;
}
export function hasApprovedLeave(reference, id, date, start, end, part='hc') {
 for(let at=start;at<end;at++) if(approvedLeave(reference,date,part,upper(id),at)) return true;
 return false;
}
export function eligibleStaff({reference,events,employees,line,date,at,part='hc',includeHelpers=false,assigned=/** @type {string[]} */ ([])}) {
 events=effectiveAttendance(events);
 const roster=rosterFor(reference,date,part),names=roster?.[part];
 const all=(employees||[]).filter(row=>row.active!==false&&
   (activeStaffMovement(events,row.id,Date.parse(`${date}T00:00:00+07:00`)+at*60000)?.destinationLine===line || (names ? names.some(id=>upper(id)===upper(row.id)) || upper(row.line)===line&&
      (actualLeaveCandidate(reference,date,part,row.id)|| (events||[]).some(event=>event.kind==='attendance-override'&&event.line===line&&(event.employees||[]).some(id=>upper(id)===upper(row.id)))) : upper(row.line)===line)));
 const allowed=all.filter(row=>isPresent(reference,events,row.id,line,date,at,part,includeHelpers));
 const free=allowed.filter(row=>!assigned.some(id=>upper(id)===upper(row.id)));
 const limit=part==='hc'?Number(reference?.workers||0):Number(reference?.days?.find(day=>day.date===date)?.otWorkers??reference?.input?.otWorkers??reference?.workers??0);
 return {free,allowed,blocked:all.filter(row=>!allowed.includes(row)),exact:Boolean(names)||(!roster&&limit>0&&allowed.length===limit),limit};
}
function actualLeaveCandidate(reference,date,part,id) {
 return (part==='hc'?reference?.input?.dailyHcLeave:reference?.input?.dailyOtLeave)?.some(row=>covers(row,date)&&(row.employees||[]).some(value=>upper(value)===upper(id)))||false;
}
