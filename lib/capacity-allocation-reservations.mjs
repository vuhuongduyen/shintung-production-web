import {rosterRanges} from './capacity-transfers.mjs';
import {allocationPending,allocationOverlap} from './production-allocation-queue.mjs';
const at=(date,minute)=>new Date(Date.parse(`${date}T00:00:00+07:00`)+minute*60000).toISOString();
export function planningAssignments(rows){
 const out=[];
 for(const row of rows)for(const roster of row.input?.dailyRoster||[]){
  const day=row.input.dailySchedule?.find(d=>d.date===roster.date);
  for(const shift of ['hc','ot'])for(const employeeId of roster[shift]||[])for(const [a,b] of rosterRanges(roster,day,shift,employeeId))out.push({employeeId,line:row.line,effectiveAt:at(roster.date,a),endsAt:at(roster.date,b)});
 }
 return out;
}
export function assertPlanningReservations(queue,nextRows){
 for(const assignment of planningAssignments(nextRows))for(const offer of queue?.offers||[]){
  if(!offer.people.some(p=>p.id===assignment.employeeId))continue;
  if(assignment.line!==offer.sourceLine&&allocationPending(offer,assignment.employeeId).some(w=>allocationOverlap(w,assignment)))throw Object.assign(Error('Nhân viên đang Chờ phân bổ. Hãy nhận qua Điều phối nhân sự hoặc rút thời gian trước khi điều phối trực tiếp.'),{status:409});
  for(const allocated of offer.allocations.filter(a=>a.canceled!==true&&a.employeeId===assignment.employeeId&&a.planning))if(assignment.line!==allocated.targetLine&&allocationOverlap(assignment,allocated))throw Object.assign(Error('Lịch nhân viên trùng khoảng đã phân công qua Điều phối nhân sự.'),{status:409});
 }
}
