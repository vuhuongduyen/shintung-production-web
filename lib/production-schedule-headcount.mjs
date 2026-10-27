import {effectiveAttendance,eligibleStaff,hasApprovedLeave,activeStaffMovement} from './production-attendance.mjs';
import {normalizedWorkDay,scheduledPart} from './production-monthly-attendance.mjs';
const upper=v=>String(v||'').trim().toUpperCase();
const minute=v=>/^\d\d:\d\d$/.test(v||'')?Number(v.slice(0,2))*60+Number(v.slice(3)):null;
const covers=(r,date)=>r.date<=date&&(r.to||r.date)>=date;
const named=(e,id)=>(e.employees||[]).some(v=>upper(v)===upper(id));
const absence=e=>['absence','line-absence'].includes(e.kind)&&['Nghỉ','Đi trễ','Về sớm'].includes(e.absenceType||'Nghỉ');
export const scheduleClock=at=>`${String(Math.floor(at/60)).padStart(2,'0')}:${String(Math.floor(at%60)).padStart(2,'0')}`;
// Display projection only. Never used to calculate reports or monthly actual hours.
// HR absence replaces Capacity for that employee/day; explicit presence covers its interval.
/** @param {{reference?:Record<string,any>,events?:Record<string,any>[],employees?:Record<string,any>[],line:string,day:Record<string,any>,now?:number,restrictedLine?:boolean}} options */
export function scheduleHeadcount({reference,events=[],employees=[],line,day,now=Date.now(),restrictedLine=false}) {
 const date=day.date,d=normalizedWorkDay(day),midnight=Date.parse(`${date}T00:00:00+07:00`);
 const next=new Date(`${date.slice(0,7)}-01T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
 const closed=Number(now)>=Date.parse(`${next.toISOString().slice(0,7)}-11T00:00:00+07:00`);
 const active=effectiveAttendance(events),overlapsDay=e=>Date.parse(e.effectiveAt)<midnight+86400000&&Date.parse(e.endsAt)>midnight;
 const hr=active.filter(e=>absence(e)&&overlapsDay(e));
 const planned=[...(reference?.input?.dailyHcLeave||[]),...(reference?.input?.dailyOtLeave||[])].filter(r=>covers(r,date));
 const warnings=[];
 if(planned.some(r=>!(r.employees||[]).length||r.employees.some(id=>!employees.some(p=>upper(p.id)===upper(id)))))warnings.push('Có nghỉ Capacity chưa xác định được nhân viên; chưa tự trừ số người.');
 if(effectiveAttendance(events,true).some(e=>e.approved===false&&overlapsDay(e)&&(e.line===line||e.destinationLine===line)))warnings.push('Có biến động chờ duyệt; chưa dùng để thay thế Capacity.');
 if(events.some(e=>e.kind==='attendance-cancel'&&e.line===line))warnings.push('Có lịch sử hủy ghi nhận; bản hủy không xác nhận nhân viên có mặt.');
 const edges=new Set([0,1440]);
 const add=v=>{if(Number.isFinite(v)&&v>=0&&v<=1440)edges.add(v);};
 for(const key of ['hcStart','hcEnd','otStart','otEnd','lunchStart','lunchEnd','preOtStart','preOtEnd'])add(minute(d[key]));
 for(const b of d.breaks||[])for(const k of ['start','end'])add(minute(b[k]));
 for(const r of planned)for(const k of ['start','end','otStart','otEnd'])add(minute(r[k]));
 for(const r of reference?.roster||[])for(const part of ['hc','ot'])for(const ranges of Object.values(r[part+'Windows']||{}))for(const range of ranges)range.forEach(add);
 for(const e of active)for(const value of [e.effectiveAt,e.endsAt])add((Date.parse(value)-midnight)/60000);
 const points=[...edges].sort((a,b)=>a-b),windows=[];
 for(let i=0;i<points.length-1;i++){
  const start=points[i],end=points[i+1],part=scheduledPart(d,start);if(!part)continue;
  const instant=midnight+start*60000;
  const eligible=eligibleStaff({reference,events:active,employees,line,date,at:start,part,includeHelpers:true});
  const actual=eligible.allowed;
  const provisional=closed?[]:actual.filter(p=>hasApprovedLeave(reference,p.id,date,start,end,part)&&
   !hr.some(e=>named(e,p.id)&&(!e.sourceId||e.line===line))&&
   !active.some(e=>e.kind==='attendance-override'&&e.line===line&&named(e,p.id)&&Date.parse(e.effectiveAt)<=instant&&Date.parse(e.endsAt)>instant));
  const people=actual.filter(p=>!provisional.includes(p));
  const actualAbsent=hr.filter(e=>(!e.sourceId||e.line===line)&&Date.parse(e.effectiveAt)<=instant&&Date.parse(e.endsAt)>instant).flatMap(e=>(e.employees||[]).filter(id=>[...eligible.allowed,...eligible.blocked].some(p=>upper(p.id)===upper(id))));
  const roster=reference?.roster?.find(r=>r.date===date);
  const unknownRoster=(roster?.[part]||[]).some(id=>!employees.some(p=>upper(p.id)===upper(id)));
  if(unknownRoster&&!warnings.includes('Danh sách phân công có mã nhân viên chưa đủ dữ liệu được xem; chưa thể xác định tổng người.'))warnings.push('Danh sách phân công có mã nhân viên chưa đủ dữ liệu được xem; chưa thể xác định tổng người.');
  const foreignLoan=restrictedLine&&employees.some(p=>upper(p.line)!==line&&(activeStaffMovement(active,p.id,instant)?.destinationLine===line||[...eligible.allowed,...eligible.blocked].some(v=>upper(v.id)===upper(p.id))));
  if(foreignLoan&&!warnings.includes('Chưa đủ dữ liệu HR được phép xem để xác định đầy đủ nhân lực điều chuyển.'))warnings.push('Chưa đủ dữ liệu HR được phép xem để xác định đầy đủ nhân lực điều chuyển.');
  const unknownOt=!closed&&part==='ot'&&(reference?.input?.dailyOtLeave||[]).some(r=>covers(r,date)&&r.mode==='attended'&&Number(r.hours)>0&&actual.some(p=>named(r,p.id)&&!hr.some(e=>named(e,p.id)&&(!e.sourceId||e.line===line))&&!active.some(e=>e.kind==='attendance-override'&&e.line===line&&named(e,p.id)&&Date.parse(e.effectiveAt)<=instant&&Date.parse(e.endsAt)>instant)));
  if(unknownOt&&!warnings.includes('Nghỉ TC chỉ có số giờ tham gia, chưa có khoảng giờ; chưa xác định được nhân lực từng khoảng TC.'))warnings.push('Nghỉ TC chỉ có số giờ tham gia, chưa có khoảng giờ; chưa xác định được nhân lực từng khoảng TC.');
  const unresolved=unknownRoster||foreignLoan||!eligible.exact||unknownOt;
  if(!eligible.exact&&!warnings.includes('Chưa có danh sách phân công chính xác; không suy đoán nhân viên được tính.'))warnings.push('Chưa có danh sách phân công chính xác; không suy đoán nhân viên được tính.');
  windows.push({start,end,part,count:unresolved?null:people.length,actualCount:eligible.exact?actual.length:Math.min(eligible.limit,actual.length),people:!eligible.exact?[]:people.map(p=>p.id),provisional:provisional.map(p=>p.id),actualAbsent:[...new Set(actualAbsent)]});
 }
 const counts=windows.map(w=>w.count).filter(n=>n!==null),min=counts.length?Math.min(...counts):0,max=counts.length?Math.max(...counts):0;
 return {closed,windows,min,max,actualMax:Math.max(0,...windows.map(w=>w.actualCount)),label:windows.some(w=>w.count===null)?'Chưa đủ dữ liệu':min===max?String(min):`${min}–${max}`,warnings};
}
