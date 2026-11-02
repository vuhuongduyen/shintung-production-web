import {assignmentLoanActive} from './production-line-assignment.mjs';
import {projectLiveStages} from './production-stage-live.mjs';
import {activeStaffMovement,vnMoment} from './production-attendance.mjs';
import {employeeActiveOn} from './employee-employment.mjs';
import {employeesAt} from './production-hours.mjs';
/** @param {{orders?: any[], events?: any[], reports?: any[], employees?: any[], line?: string, now?: number}} input */
export function assignmentOverview({orders=[],events=[],reports=[],employees=[],line='all',now=Date.now()}){
 const visibleOrders=orders.filter(o=>o.status!=='HỦY'),stages=Object.values(projectLiveStages(visibleOrders,reports,events,now)),byPerson=new Map();
 const add=(id,location)=>{const key=String(id).toUpperCase();if(!byPerson.has(key))byPerson.set(key,[]);byPerson.get(key).push(location);};
 for(const order of visibleOrders){const own=stages.filter(s=>s.orderId===order.id);if(own.some(s=>s.at||s.startedAt)){
  for(const stage of own)for(const id of [...(stage.people||[]),...(stage.retainedPeople||[]).filter(id=>{const move=activeStaffMovement(events,id,now);return move?.destinationLine&&move.destinationLine!==order.line;})]){if(assignmentLoanActive(stage.lineAssignments?.[id],events,id,order.line,now))add(id,{line:order.line,order:order.lsxCode||order.id,stage:stage.stage,status:stage.status==='paused'?'Tạm ngưng':'Đang làm'});}
 }else for(const id of employeesAt(events,order.id,now)||[])add(id,{line:order.line,order:order.lsxCode||order.id,stage:'Chưa ghi công đoạn',status:'Đang làm'});}
 const result=[];
 for(const person of employees.filter(p=>!p._deleted&&employeeActiveOn(p,vnMoment(now).date))){
  const locations=byPerson.get(String(person.id).toUpperCase())||[],move=activeStaffMovement(events,person.id,now),currentLine=move?.destinationLine||person.line;
  const working=move?locations.filter(r=>r.line===currentLine):locations;
  const rows=[...working];
  if(move?.destinationLine){
   const sources=locations.filter(r=>r.line!==currentLine);
   if(move.line&&move.line!==currentLine&&!sources.some(r=>r.line===move.line))sources.push({line:move.line,order:'—',stage:'—'});
   rows.push(...sources.map(r=>({...r,status:'Đang chuyển Line',destinationLine:currentLine,effectiveAt:move.effectiveAt,endsAt:move.endsAt})));
  }
  if(!working.length)rows.push({line:currentLine,order:'—',stage:'—',status:'Đang chờ phân bổ'});
  for(const row of rows)if(row.line&&(line==='all'||line===row.line))result.push({id:person.id,name:person.name||person.id,...row,conflict:row.status!=='Đang chuyển Line'&&working.length>1});
 }
 return result.sort((a,b)=>String(a.line).localeCompare(String(b.line))||a.name.localeCompare(b.name,'vi')||a.order.localeCompare(b.order));
}
