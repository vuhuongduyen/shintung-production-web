import {effectiveAttendance,vnMoment} from './production-attendance.mjs';
const clock=minute=>`${String(Math.floor(minute/60)).padStart(2,'0')}:${String(minute%60).padStart(2,'0')}`;
const same=(a,b)=>String(a).toUpperCase()===String(b).toUpperCase();

/** Information only: selection eligibility and hour calculation stay in their existing rules.
 * @param {{employeeId:string,date?:string,events?:Array<Record<string,any>>,reference?:any}} options
 */
export function productionStaffNotes({employeeId,date,events=[],reference}) {
 if(!date)return [];
 const from=Date.parse(`${date}T00:00:00+07:00`),to=from+86400000,notes=[];
 const day=reference?.days?.find(d=>d.date===date);
 for(const [field,label,start,end] of [['dailyHcLeave','Đăng ký nghỉ HC',day?.hcStart||'08:00',day?.hcEnd||'17:00'],['dailyOtLeave','Đăng ký nghỉ TC',day?.otStart||'17:30',day?.otEnd||'21:00']]){
  for(const leave of reference?.input?.[field]||[]){
   if(leave.date>date||(leave.to||leave.date)<date||!leave.employees?.some(id=>same(id,employeeId)))continue;
   if(leave.mode==='attended'&&Number(leave.hours)>0)continue;
   notes.push(`${label} ${leave.start||start}–${leave.end||end}`);
   if(field==='dailyHcLeave'&&leave.includeOt)notes.push(`Đăng ký nghỉ TC ${leave.otStart||day?.otStart||'17:30'}–${leave.otEnd||day?.otEnd||'21:00'}`);
  }
 }
 const attendance=effectiveAttendance(events,true).filter(e=>['absence','line-absence','attendance-override'].includes(e.kind)&&e.employees?.some(id=>same(id,employeeId))&&Date.parse(e.effectiveAt)<to&&Date.parse(e.endsAt)>from).sort((a,b)=>Date.parse(a.effectiveAt)-Date.parse(b.effectiveAt));
 for(const event of attendance){
  const start=Math.max(from,Date.parse(event.effectiveAt)),end=Math.min(to,Date.parse(event.endsAt));
  const label=event.kind==='attendance-override'?'Có mặt thực tế':event.absenceType||'Nghỉ';
  notes.push(`${label} ${clock(vnMoment(new Date(start).toISOString()).minute)}${event.openArrival?' · Chưa đến':`–${end===to?'24:00':clock(vnMoment(new Date(end).toISOString()).minute)}`}${event.approved===false?' · Chờ duyệt điều chỉnh giờ':''}`);
 }
 return [...new Set(notes)];
}
