import {employeeActiveOn} from './employee-employment.mjs';
import {rosterRanges} from './capacity-transfers.mjs';
import {effectiveAttendance,activeStaffMovement} from './production-attendance.mjs';
const upper=v=>String(v||'').trim().toUpperCase();
const minute=v=>{const m=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(String(v||''));return m?Number(m[1])*60+Number(m[2]):null;};
const covers=(r,date)=>r.date<=date&&(r.to||r.date)>=date;
const inRange=(at,a,b)=>a!==null&&b!==null&&at>=a&&at<b;
export function normalizedWorkDay(day){return {...day,hcStart:day.hcStart||'08:00',hcEnd:day.hcEnd||'17:00',lunchStart:day.lunchStart||'12:00',lunchEnd:day.lunchEnd||'13:00',otStart:day.otStart||'17:30',otEnd:day.otEnd||'21:00',preOtStart:day.preOtStart||'17:00',preOtEnd:day.preOtEnd||'17:30',breaks:[{start:day.breaks?.[0]?.start||'10:00',end:day.breaks?.[0]?.end||'10:10'},{start:day.breaks?.[1]?.start||'15:00',end:day.breaks?.[1]?.end||'15:10'}]};}
export function scheduledPart(day,at){
 if((day.breaks||[]).some(b=>inRange(at,minute(b.start),minute(b.end)))||inRange(at,minute(day.preOtStart),minute(day.preOtEnd)))return null;
 if(day.working&&inRange(at,minute(day.hcStart),minute(day.hcEnd))&&!inRange(at,minute(day.lunchStart),minute(day.lunchEnd)))return 'hc';
 if(day.ot&&inRange(at,minute(day.otStart),minute(day.otEnd)))return 'ot';
 return null;
}
// Calculate from the same resolved actual days used by production reporting.
// Calendar roster + named planned leave = scheduled people before HR deductions.
/** @param {{events?:Record<string,any>[],schedules?:Record<string,any>[],orders?:Record<string,any>[],employees?:Record<string,any>[],month:string,line:string}} options */
export function monthlyAttendance({events=[],schedules=[],orders=[],employees=[],month,line}){
 const issues=new Set(),dates=new Map(),people=new Map(),active=effectiveAttendance(events,true);
 const from=Date.parse(`${month}-01T00:00:00+07:00`),next=new Date(`${month}-01T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
 const until=Date.parse(`${next.toISOString().slice(0,10)}T00:00:00+07:00`);
 const lineOf=e=>e.line||orders.find(o=>o.id===e.sourceId)?.line;
 const relevant=active.filter(e=>Date.parse(e.effectiveAt)<until&&(['absence','line-absence','attendance-override'].includes(e.kind)?Date.parse(e.endsAt)>from:['transfer','line-movement'].includes(e.kind)));
 for(const e of relevant)if(e.approved===false&&(lineOf(e)===line||e.destinationLine===line))issues.add('Có biến động nhân lực chờ QLSX duyệt giờ');
 for(const e of relevant)if(e.openArrival&&lineOf(e)===line)issues.add('Có nhân viên chưa ghi giờ vào thực tế');
 const accepted=relevant.filter(e=>e.approved!==false),directory=new Map(employees.map(e=>[upper(e.id),e]));
 for(const s of schedules.filter(s=>s.line===line||s.key?.endsWith(`:${line}`)))for(const day of s.days||[])if(day.date?.startsWith(month))dates.set(day.date,{day,s});
 for(let dayMs=from;dayMs<until;dayMs+=86400000){
  const date=new Date(dayMs+7*3600000).toISOString().slice(0,10),entry=dates.get(date);
  if(!entry){issues.add('Chưa đủ lịch làm việc cả tháng');continue;}
  const {s}=entry,day=normalizedWorkDay(entry.day);if(!day.working&&!day.ot)continue;
  let roster=s.roster?.find(r=>r.date===date);
  if(day.working&&!s.input?.dailySchedule?.find(d=>d.date===date)?.working&&!roster?.hc?.length)roster=s.roster?.filter(r=>r.date<date&&r.hc?.length).at(-1)||roster;
  if(!roster){issues.add(`Thiếu danh sách nhân viên theo ca: ${date}`);continue;}
  const named={hc:new Set((roster.hc||[]).map(upper)),ot:new Set((roster.ot||[]).map(upper))};
  for(const r of s.input?.dailyHcLeave||[])if(covers(r,date)){for(const id of r.employees||[])named.hc.add(upper(id));if(r.includeOt&&date>=(r.otFrom||r.date)&&date<=(r.otTo||r.to||r.date))for(const id of r.employees||[])named.ot.add(upper(id));}
  for(const r of s.input?.dailyOtLeave||[])if(covers(r,date))for(const id of r.employees||[])named.ot.add(upper(id));
  if(day.working&&s.workers>0&&!named.hc.size||day.ot&&Number(day.otWorkers??s.input?.otWorkers??s.workers)>0&&!named.ot.size)issues.add(`Thiếu danh sách nhân viên theo ca: ${date}`);
  const dayEvents=accepted.filter(e=>Date.parse(e.effectiveAt)<dayMs+86400000&&(['transfer','line-movement'].includes(e.kind)||Date.parse(e.endsAt)>dayMs));
  const ids=new Set([...named.hc,...named.ot,...dayEvents.filter(e=>lineOf(e)===line||e.destinationLine===line).flatMap(e=>(e.employees||[]).map(upper))]);
  for(const id of ids){
   const employee=directory.get(id);if(!employee){issues.add(`Nhân viên chưa có trong danh sách: ${id}`);continue;}
   if((employee.startDate&&date<employee.startDate)||(employee.endDate&&date>=employee.endDate))continue;
   const own=dayEvents.filter(e=>(e.employees||[]).some(v=>upper(v)===id));
   const edges=new Set([0,1440,...['hcStart','hcEnd','otStart','otEnd','lunchStart','lunchEnd','preOtStart','preOtEnd'].map(k=>minute(day[k])),...(day.breaks||[]).flatMap(b=>[minute(b.start),minute(b.end)])].filter(v=>v!==null));
   for(const shift of ['hc','ot'])for(const range of roster[shift+'Windows']?.[id]||[])range.forEach(m=>edges.add(m));
   for(const e of own)for(const value of [e.effectiveAt,e.endsAt]){const m=(Date.parse(value)-dayMs)/60000;if(m>0&&m<1440)edges.add(m);}
   const points=[...edges].sort((a,b)=>a-b);
   const result=people.get(id)||{...employee,id,include:true,calendarHc:0,calendarOt:0,absentHc:0,absentOt:0,hc:0,ot:0,helper:0,otherWork:0,transferFromHours:{}};
   for(let i=0;i<points.length-1;i++){
    const at=points[i],part=scheduledPart(day,at);if(!part)continue;
    const instant=dayMs+at*60000,ongoing=own.filter(e=>Date.parse(e.effectiveAt)<=instant&&Date.parse(e.endsAt)>instant);
    const movement=activeStaffMovement(own,id,instant);
    const destination=movement&&(movement.destinationLine||orders.find(o=>o.id===movement.destinationId)?.line);
    const assigned=destination?destination===line:named[part].has(id)&&(!roster[part+'Windows']?.[id]||rosterRanges(roster,day,part,id).some(([a,b])=>a<=at&&at<b));
    if(destination&&destination!==line)continue;
    if(!assigned&&!ongoing.some(e=>e.kind==='attendance-override'&&lineOf(e)===line))continue;
    const hours=(points[i+1]-at)/60;
    result[part==='hc'?'calendarHc':'calendarOt']+=hours;
    const absent=ongoing.some(e=>['absence','line-absence'].includes(e.kind)&&!['Phụ kho','CV khác'].includes(e.absenceType));
    if(absent)result[part==='hc'?'absentHc':'absentOt']+=hours;
    else {result[part]+=hours;const other=ongoing.some(e=>['absence','line-absence'].includes(e.kind)&&e.absenceType==='CV khác'&&lineOf(e)===line);const helper=ongoing.some(e=>['absence','line-absence'].includes(e.kind)&&e.absenceType==='Phụ kho'&&lineOf(e)===line);if(helper)result.helper+=hours;else if(other)result.otherWork+=hours;else if(movement&&destination===line&&lineOf(movement)!==line){const source=lineOf(movement);result.transferFromHours[source]=(result.transferFromHours[source]||0)+hours;}else {const plannedMove=(s.input?.staffTransfers||[]).find(m=>m.to===line&&m.shift===part&&m.dates?.includes(date)&&m.employees?.some(v=>upper(v)===id)&&minute(m.start)<=at&&at<minute(m.end));if(plannedMove)result.transferFromHours[plannedMove.from]=(result.transferFromHours[plannedMove.from]||0)+hours;}}
   }
   if(result.calendarHc+result.calendarOt>0)people.set(id,result);
  }
 }
 for(const e of employees.filter(e=>!e._deleted&&e.line===line&&(!e.startDate||e.startDate<next.toISOString().slice(0,10))&&(!e.endDate||e.endDate>`${month}-01`)&&(e.startDate||e.endDate||employeeActiveOn(e,`${month}-01`))))if(!people.has(upper(e.id))){issues.add(`Chưa có lịch phân công trong tháng: ${e.name||e.id}`);people.set(upper(e.id),{...e,id:upper(e.id),include:true,calendarHc:null,calendarOt:null,absentHc:null,absentOt:null,hc:null,ot:null,helper:0});}
 return {people:[...people.values()],issues:[...issues]};
}
