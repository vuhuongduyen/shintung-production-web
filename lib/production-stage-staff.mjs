import {eligibleStaff,vnMoment,activeStaffMovement} from './production-attendance.mjs';
import {employeeActiveOn} from './employee-employment.mjs';
const minutes=v=>{const [h,m]=String(v).split(':').map(Number);return h*60+m;};
// Use the same named roster and attendance policy as the actual production calendar.
/** @param {{employees?:Record<string,any>[],events?:Record<string,any>[],schedules?:Record<string,any>[],line:string,effectiveAt:string,extra?:boolean}} options */
export function stageEmployeeChoices({employees=[],events=[],schedules=[],line,effectiveAt,extra=false}){
 if(!line||!Number.isFinite(Date.parse(effectiveAt)))return [];
 const {date,minute}=vnMoment(effectiveAt),directory=employees.filter(p=>employeeActiveOn(p,date));
 if(extra)return directory.filter(p=>(activeStaffMovement(events,p.id,Date.parse(effectiveAt))?.destinationLine||p.line)===line);
 const reference=schedules.find(r=>(r.line===line||r.key?.endsWith(':'+line))&&r.days?.some(d=>d.date===date));
 const day=reference?.days?.find(d=>d.date===date);
 if(!day?.working)return [];
 const part=minute>=minutes(day.hcStart||'08:00')&&minute<minutes(day.hcEnd||'17:00')?'hc':day.ot&&minute>=minutes(day.otStart||'17:30')&&minute<minutes(day.otEnd||'21:00')?'ot':null;
 if(!part)return [];
 return eligibleStaff({reference,events,employees:directory,line,date,at:minute,part}).allowed;
}
