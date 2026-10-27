import {eligibleStaff,effectiveAttendance,attendanceEdges,vnMoment} from './production-attendance.mjs';
const attendanceKinds=new Set(['transfer','line-movement','attendance-override','absence','line-absence','attendance-cancel']);
const minutes=value=>{const [h,m]=String(value||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
// Historical correction selects people who belonged to this Line during a work
// interval on the chosen Vietnam date. Never merge the complete directory or
// names on unrelated orders into this list.
/** @param {{employees?:Record<string,any>[],events?:Record<string,any>[],references?:Record<string,any>[],line:string,effectiveAt:string}} options */
export function correctionEmployeeChoices({employees=[],events=[],references=[],line,effectiveAt}){
 if(!line||!Number.isFinite(Date.parse(effectiveAt)))return [];
 const {date}=vnMoment(effectiveAt),midnight=Date.parse(date+'T00:00:00+07:00');
 const reference=references.find(r=>(r.line===line||r.key?.endsWith(':'+line))&&(r.days?.some(d=>d.date===date)||r.roster?.some(d=>d.date===date)));
 const day=reference?.days?.find(d=>d.date===date)||reference?.input?.dailySchedule?.find(d=>d.date===date);
 const windows=[['hc',minutes(day?.hcStart)??480,minutes(day?.hcEnd)??1020],...(day?.ot?[['ot',minutes(day.otStart)??1050,minutes(day.otEnd)??1260]]:[])];
 // Source timestamps, outputs and correction audit snapshots cannot affect
 // presence. Resolve cancellation/loan provenance before narrowing to this day.
 const active=effectiveAttendance(events.filter(e=>attendanceKinds.has(e.kind))).filter(e=>Date.parse(e.effectiveAt)<midnight+86400000&&(!e.endsAt||Date.parse(e.endsAt)>midnight)),edges=attendanceEdges(reference,date);
 for(const e of active)for(const value of [e.effectiveAt,e.endsAt]){const t=(Date.parse(value)-midnight)/60000;if(t>=0&&t<=1440)edges.push(t);}
 const found=new Set(),directory=employees.filter(p=>!p._deleted&&p.active!==false);
 for(const [part,start,end]of windows){
  const points=[...new Set([start,end,...edges.filter(t=>t>start&&t<end)])].sort((a,b)=>a-b);
  for(let i=0;i<points.length-1;i++)for(const person of eligibleStaff({reference,events:active,employees:directory,line,date,at:(points[i]+points[i+1])/2,part}).allowed)found.add(person.id);
 }
 return directory.filter(p=>found.has(p.id));
}
