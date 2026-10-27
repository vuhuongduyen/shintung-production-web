import {effectiveAttendance,activeStaffMovement,eligibleStaff,vnMoment} from './production-attendance.mjs';
const key=value=>String(value||'').toUpperCase();
export const personalHrEvent=event=>event?.attendanceScope==='employee';
/** Expose only the receiving Line's portions of foreign employees' HR facts.
 * A projection is read-only; full HR originals and their audit chain stay private. */
export function projectPersonalHr(events,{line,employees=[],references=[]}){
 const active=effectiveAttendance(events,true),movementEvents=active.filter(event=>!['absence','line-absence','attendance-override'].includes(event.kind));
 const personal=active.filter(event=>personalHrEvent(event)&&['absence','line-absence','attendance-override'].includes(event.kind));
 const directory=new Map(employees.map(person=>[key(person.id),person]));
 const projected=[];
 for(const event of personal)for(const id of event.employees||[]){
  const start=Date.parse(event.effectiveAt),end=Date.parse(event.endsAt);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)continue;
  const person=directory.get(key(id));if(!person)continue;
  const own=movementEvents.filter(item=>item.employees?.some(value=>key(value)===key(id)));
  const boundaries=own;
  const points=new Set([start,end]);for(const item of boundaries)for(const value of [item.effectiveAt,item.endsAt]){const at=Date.parse(value);if(at>start&&at<end)points.add(at);}
  const refs=references.filter(reference=>reference.line===line||reference.key?.endsWith(`:${line}`));
  for(const ref of refs)for(const day of ref.days||[]){const midnight=Date.parse(`${day.date}T00:00:00+07:00`);if(midnight>=end||midnight+86400000<=start)continue;
   for(const value of [0,1440,...['hcStart','hcEnd','otStart','otEnd'].map(k=>{const [h,m]=String(day[k]||'').split(':').map(Number);return h*60+m;}),...Object.values(ref.roster?.find(row=>row.date===day.date)?.hcWindows||{}).flat(2),...Object.values(ref.roster?.find(row=>row.date===day.date)?.otWindows||{}).flat(2)]){const at=midnight+Number(value)*60000;if(Number.isFinite(at)&&at>start&&at<end)points.add(at);}
  }
  const spans=[],sorted=[...points].sort((a,b)=>a-b);
  for(let i=1;i<sorted.length;i++){const from=sorted[i-1],to=sorted[i],at=(from+to)/2;let visible=key(person.line)===key(line);
   if(!visible){const move=activeStaffMovement(movementEvents,id,at);if(move)visible=move.destinationLine===line;else{
    const {date,minute}=vnMoment(at),ref=refs.find(reference=>reference.days?.some(day=>day.date===date));const day=ref?.days?.find(day=>day.date===date);const clock=value=>{const [h,m]=String(value||'').split(':').map(Number);return h*60+m;};const inHc=day?.working&&minute>=clock(day.hcStart)&&minute<clock(day.hcEnd),inOt=day?.ot&&minute>=clock(day.otStart)&&minute<clock(day.otEnd);const part=inOt?'ot':'hc';
    const roster=ref&&(inHc||inOt)&&eligibleStaff({reference:ref,events:movementEvents,employees:[person],line,date,at:minute,part,includeHelpers:true});
    visible=Boolean(roster&&roster.allowed.some(person=>key(person.id)===key(id)));
   }}
   if(visible){const last=spans.at(-1);if(last&&last.to===from)last.to=to;else spans.push({from,to});}
  }
  spans.forEach((span,index)=>projected.push({id:`${event.id}:hr:${line}:${id}:${index}`,kind:event.kind,line,sourceId:null,employees:[id],count:1,attendanceScope:'employee',hrScopeProjection:true,hrAttendanceSourceId:event.id,effectiveAt:new Date(span.from).toISOString(),endsAt:new Date(span.to).toISOString(),absenceType:event.absenceType,approved:event.approved,openArrival:event.openArrival,actor:event.actor,actorId:event.actorId,recordedAt:event.recordedAt,reason:`HR · ${event.absenceType||'Nghỉ'}`}));
 }
 return projected;
}
