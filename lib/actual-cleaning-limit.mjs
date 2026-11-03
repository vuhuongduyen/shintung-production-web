import {eligibleStaff,effectiveAttendance} from './production-attendance.mjs';
import {employeeActiveOn} from './employee-employment.mjs';
const upper=value=>String(value||'').trim().toUpperCase();
const minute=value=>/^([01]\d|2[0-3]):[0-5]\d$/.test(value||'')?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
// User rule: the initial actual arrangement of this day/Line, at HC start.
// Capacity's scalar workers and provisional display ranges are not staff counts.
/** @param {{reference?:Record<string,any>,events?:Record<string,any>[],employees?:Record<string,any>[],line:string,day:Record<string,any>}} options */
export function actualCleaningLimit({reference,events=[],employees=[],line,day}) {
 const at=minute(day.hcStart||'08:00'),date=day.date;
 if(!reference||at===null||!day.working||(reference.line&&reference.line!==line)||(reference.key&&!reference.key.endsWith(`:${line}`)))return {known:false,count:null};
 const planned=reference.input?.dailySchedule?.find(d=>d.date===date);
 let roster=reference.roster?.find(r=>r.date===date);
 if(!planned?.working)roster=reference.roster?.filter(r=>r.date<date&&r.hc?.length).at(-1)||roster;
 if(!Array.isArray(roster?.hc))return {known:false,count:null};
 const active=effectiveAttendance(events),instant=Date.parse(`${date}T00:00:00+07:00`)+at*60000;
 const required=new Set(roster.hc.map(upper));
 for(const row of reference.input?.dailyHcLeave||[])if(row.date<=date&&(row.to||row.date)>=date)for(const id of row.employees||[])required.add(upper(id));
 for(const event of active)if(Date.parse(event.effectiveAt)<=instant&&(!event.endsAt||Date.parse(event.endsAt)>instant)&&(event.line===line||event.destinationLine===line))for(const id of event.employees||[])required.add(upper(id));
 const directory=new Map(employees.map(p=>[upper(p.id),p]));
 if([...required].some(id=>!directory.has(id)))return {known:false,count:null};
 const people=employees.map(p=>({...p,active:employeeActiveOn(p,date)}));
 const resolved={...reference,days:[...(reference.days||[]).filter(d=>d.date!==date),day]};
 const allowed=eligibleStaff({reference:resolved,events:active,employees:people,line,date,at,includeHelpers:true}).allowed;
 // One person counts once, even when directory/event input has duplicate entries.
 return {known:true,count:new Set(allowed.map(p=>upper(p.id))).size};
}
/** @param {{reference?:Record<string,any>,events?:Record<string,any>[],employees?:Record<string,any>[],line:string,day:Record<string,any>}} options */
export function cleaningLimitError(options) {
 const groups=(options.day.cleaning||[]).filter(g=>Number(g.people)>0);
 if(!groups.length)return '';
 const limit=actualCleaningLimit(options);
 if(!limit.known)return `Chưa đủ danh sách nhân sự thực tế đầu ca ngày ${options.day.date}, Line ${options.line}; tải lại lịch trước khi lưu vệ sinh.`;
 const points=[...new Set(groups.map(g=>minute(g.start)).filter(v=>v!==null))];
 if(points.some(at=>groups.filter(g=>minute(g.start)<=at&&minute(g.end)>at).reduce((sum,g)=>sum+Number(g.people),0)>limit.count))return `Số người vệ sinh ngày ${options.day.date}, Line ${options.line} vượt số người thực tế đầu ca (${limit.count}).`;
 return '';
}
