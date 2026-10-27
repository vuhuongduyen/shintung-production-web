import {effectiveAttendance, vnMoment} from './production-attendance.mjs';

/** Display-only projection; never changes staffing or hours.
 * @param {{date:string,events?:Array<Record<string,any>>,employees?:Array<Record<string,any>>,orders?:Array<Record<string,any>>,line?:string}} options
 */
export function productionDailyAbsences({date,events=[],employees=[],orders=[],line='all'}) {
 const from=Date.parse(`${date}T00:00:00+07:00`),to=from+86400000;
 const clock=instant=>instant===to?'24:00':`${String(Math.floor(vnMoment(instant).minute/60)).padStart(2,'0')}:${String(vnMoment(instant).minute%60).padStart(2,'0')}`;
 return effectiveAttendance(events,true).filter(event=>!event.historicalImport&&
  ['absence','line-absence'].includes(event.kind)&&['Nghỉ','Đi trễ','Về sớm'].includes(event.absenceType)&&
  Date.parse(event.effectiveAt)<to&&Date.parse(event.endsAt)>from)
  .flatMap(event=>{
   const eventLine=event.line||orders.find(order=>order.id===event.sourceId)?.line;
   const people=(event.employees||[]).map(id=>employees.find(person=>String(person.id).toUpperCase()===String(id).toUpperCase())||{id,name:id});
   const lines=eventLine?[eventLine]:[...new Set(people.map(person=>person.line).filter(Boolean))];
   return lines.filter(value=>line==='all'||value===line).map(value=>({
    id:`${event.id}:${value}`,line:value,kind:event.absenceType,
    names:people.filter(person=>eventLine||person.line===value).map(person=>`${person.name||person.id} (${person.sourceEmployeeId||person.id})`),
    count:people.length||Number(event.count||0),start:clock(Math.max(from,Date.parse(event.effectiveAt))),
    end:clock(Math.min(to,Date.parse(event.endsAt))),openArrival:Boolean(event.openArrival),pending:event.approved===false,
   }));
  }).sort((a,b)=>a.line.localeCompare(b.line)||a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
}
