import {monthlyAttendance} from './production-monthly-attendance.mjs';
import {validBusinessDate} from './effective-dated-value.mjs';
export const attendancePrefixModel='observed-attendance-prefix-v1';
const fields=['calendarHc','calendarOt','absentHc','absentOt','hc','ot','helper','otherWork'];
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value;
const comparable=result=>canonical({issues:[...result.issues].sort(),people:result.people.map(p=>({id:p.id,...Object.fromEntries(fields.map(k=>[k,p[k]??(k==='otherWork'?0:null)])),transferFromHours:p.transferFromHours||{}})).sort((a,b)=>a.id.localeCompare(b.id))});
export function captureAttendancePrefix({events,schedules,orders,employees,cutoverDate,snapshotId,observedAt}){
 if(!validBusinessDate(cutoverDate))throw Error('Ngày chuyển đổi không hợp lệ.');
 if(cutoverDate.endsWith('-01'))return null;
 const month=cutoverDate.slice(0,7),lines=Object.fromEntries(['A','B'].map(line=>[line,monthlyAttendance({events,schedules,orders,employees,month,line,dateUntil:cutoverDate})]));
 return {kind:attendancePrefixModel,snapshotId,month,from:month+'-01',until:cutoverDate,observedAt,lines};
}
// Server-side check with the same global attendance stream as capture. Current
// master data cannot replace the observed employee/order basis of the prefix.
// A changed HR/calendar result is reported, never silently applied or ignored.
export function checkAttendancePrefix(prefix,{events,schedules,orders,preservedOrders=[],currentEmployees}){
 if(prefix?.kind!==attendancePrefixModel)return null;
 const employees=[...new Map(Object.values(prefix.lines).flatMap(line=>line.people).map(p=>[p.id,p])).values()];
 const historicalOrders=new Map(orders.map(o=>[o.id,o]));for(const b of preservedOrders)historicalOrders.set(b.orderId,{id:b.orderId,line:b.display.line});
 const integrity={},livePrefixMatches={},observedOrders=[...historicalOrders.values()];
 for(const line of ['A','B']){
  const saved=prefix.lines[line];if(!saved){integrity[line]='missing';livePrefixMatches[line]=false;continue;}
  const input={events,schedules,orders:observedOrders,employees,month:prefix.month,line,dateUntil:prefix.until};
  const expected=JSON.stringify(comparable(saved)),current=monthlyAttendance(input);
  integrity[line]=JSON.stringify(comparable(current))===expected?'matched':'changed';
  const live=currentEmployees?monthlyAttendance({...input,orders,employees:currentEmployees}):current;
  livePrefixMatches[line]=JSON.stringify(comparable(live))===expected;
 }
 return {integrity,livePrefixMatches};
}
export function observedAttendanceLabels(current,before){const original=new Map(before.people.map(p=>[p.id,p]));return {...current,people:current.people.map(p=>{const saved=original.get(p.id);return saved?{...p,...Object.fromEntries(Object.entries(saved).filter(([k])=>!fields.includes(k)&&k!=='transferFromHours'))}:p;})};}
// A dated stop/withdrawal of a planned stop in the new period retains the
// existing monthly eligibility rule. It is not a guessed effective date for a
// changed Line or a rewritten start date.
export function prefixEmploymentBasis(before,current,cutoverDate){
 if(!before||!current||before.line!==current.line||(before.startDate||'')!==(current.startDate||''))return before;
 const old=before.endDate||'',next=current.endDate||'';
 if(old===next||old&&(!validBusinessDate(old)||old<cutoverDate))return before;
 if(next?validBusinessDate(next)&&next>=cutoverDate:validBusinessDate(old)&&old>=cutoverDate)return {...before,endDate:next};
 return before;
}
export function mergeAttendancePeriods(before,after){
 const people=new Map(before.people.map(p=>[p.id,structuredClone(p)]));
 for(const next of after.people){const prior=people.get(next.id);if(!prior){people.set(next.id,structuredClone(next));continue;}
  // A monthlyAttendance placeholder means no named assignment in this range,
  // not an unknown segment added to a named assignment in the other range.
  // Preserve the original whole-month rule: one real assignment resolves it.
  const missing=p=>['calendarHc','calendarOt','hc','ot'].every(k=>p[k]===null),priorMissing=missing(prior),nextMissing=missing(next);
  for(const key of fields){const a=prior[key]??(key==='otherWork'?0:null),b=next[key]??(key==='otherWork'?0:null);prior[key]=priorMissing&&!nextMissing?b:nextMissing&&!priorMissing?a:a===null||b===null?null:a+b;}
  for(const [line,hours]of Object.entries(next.transferFromHours||{})){prior.transferFromHours??={};prior.transferFromHours[line]=(prior.transferFromHours[line]||0)+hours;}
 }
 const unassigned=new Map();for(const p of [...before.people,...after.people])if(p.hc===null&&p.ot===null){const message=`Chưa có lịch phân công trong tháng: ${p.name||p.id}`;if(!unassigned.has(message))unassigned.set(message,new Set());unassigned.get(message).add(p.id);}
 const issues=[...new Set([...before.issues,...after.issues])].filter(message=>!unassigned.has(message)||[...unassigned.get(message)].some(id=>people.get(id)?.hc===null||people.get(id)?.ot===null));
 return {people:[...people.values()],issues};
}
