import {activeStaffMovement,effectiveAttendance} from './production-attendance.mjs';
export const lineAssignmentEvents=events=>events.filter(e=>['line-movement','transfer','attendance-cancel'].includes(e.kind));
const same=(a,b)=>String(a).toUpperCase()===String(b).toUpperCase();
// A borrowed station assignment belongs to one loan, not every future loan.
export function assignmentLoanActive(loan,events,id,line,at){
 if(!loan)return true;
 const active=effectiveAttendance(events),byId=new Map(events.map(e=>[e.id,e]));
 const follows=e=>{const seen=new Set();while(e&&!seen.has(e.id)){if(e.id===loan.movementId)return true;seen.add(e.id);e=byId.get(e.supersedes);}return false;};
 return active.some(e=>e.kind==='line-movement'&&follows(e)&&e.destinationLine===line&&(e.employees||[]).some(p=>same(p,id))&&Date.parse(e.effectiveAt)<=at&&(!e.endsAt||at<Date.parse(e.endsAt)));
}
export function stagePersonAvailable(stage,id,line,events,at){
 const movement=activeStaffMovement(events,id,at);
 const assignedAt=Date.parse(stage.assignmentAt?.[id]||stage.startedAt||stage.at);
 // A departure releases the old station. Returning only restores Line eligibility.
 const departed=Number.isFinite(assignedAt)&&effectiveAttendance(events).some(e=>e.kind==='line-movement'&&e.destinationLine!==line&&(e.employees||[]).some(p=>same(p,id))&&Date.parse(e.effectiveAt)>=assignedAt&&Date.parse(e.effectiveAt)<=at);
 return !departed&& (!movement?.destinationLine||movement.destinationLine===line)&&assignmentLoanActive(stage.lineAssignments?.[id],events,id,line,at);
}
export function suspendedStageAssignments(state,orders,events,at){
 const lines=new Map(orders.map(o=>[o.id,o.line]));
 return Object.entries(state).flatMap(([key,s])=>(s.people||[]).filter(id=>!stagePersonAvailable(s,id,lines.get(s.orderId),events,at)).map(id=>({key,id})));
}
export function lineAssignmentLabel(events,id,line,at){
 const move=activeStaffMovement(events,id,at);
 return move?.destinationLine&&move.destinationLine!==line?`Đang chuyển Line ${move.destinationLine}`:'';
}
// Preserve each person's latest actual admission, even across pause/add snapshots.
export function stageAssignmentTimes(previous,next,at){
 const assignmentAt={};
 for(const id of next.people||[])assignmentAt[id]=next.assignmentAt?.[id]||((previous?.people||[]).includes(id)?previous.assignmentAt?.[id]:null)||at;
 return {...next,assignmentAt};
}
