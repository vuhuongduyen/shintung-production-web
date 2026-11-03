import {acceptedCapacity} from './capacity-accepted.mjs';
import {calculateCapacity} from './capacity.mjs';
import {dateISO,plannedLaborHours} from './production-plan.mjs';
const round=n=>Math.round(n*10000)/10000;
const range=(start,end)=>{if(!dateISO(start)||!dateISO(end)||end<start)return [];const n=(Date.parse(end)-Date.parse(start))/86400000;if(n>366)return [];return Array.from({length:n+1},(_,i)=>new Date(Date.parse(start)+i*86400000).toISOString().slice(0,10));};
const live=r=>!r._deleted&&!['HỦY','TẠM HOÃN'].includes(r.status);
/** Reserve existing orders first, then edited orders. Fill earliest available day;
 * the unfulfilled remainder is shown on the requested final day, never moved past it. */
export function planDailyLoad(rows,capacities,editedIds,warningIds=[]){
 const reportIds=new Set([...editedIds,...warningIds]);
 const edited=new Set(editedIds),days=new Map(),used=new Map(),notChecked=[],warnings=[];
 for(const c of capacities.map(acceptedCapacity)){
  if(c.status!=='Đã xác nhận'||c.reviewStatus!=='approved'||!c.syncedAt||!c.khsxAcceptedAt||!c.input)continue;
  try{const result=calculateCapacity(c.input,c.week);if(result.hasUnallocatedLeave||c.input.leaveMode==='aggregate')continue;
   for(const d of result.days)if(Number.isFinite(d.hcNet)&&Number.isFinite(d.otNet))days.set(`${c.line}|${d.date}`,round((d.hcNet+d.otNet)*Number(c.input.factor)/100));
  }catch{/* Incomplete legacy schedules have no reliable daily budget. */}
 }
 const unique=[...new Map(rows.filter(live).map(r=>[r.id,r])).values()];
 const order=(a,b)=>Number(!!b.backlog)-Number(!!a.backlog)||String(a.start).localeCompare(String(b.start))||(Number(a.sequence)||Infinity)-(Number(b.sequence)||Infinity)||String(a.id).localeCompare(String(b.id));
 const queue=[...unique.filter(r=>!edited.has(r.id)).sort(order),...unique.filter(r=>edited.has(r.id)).sort(order)];
 // Unknown background demand must not be presented as free capacity.
 const uncertain=new Set();
 for(const r of queue.filter(r=>!edited.has(r.id))){const dates=range(r.start,r.end),hours=plannedLaborHours(r);const firstUnknown=hours===null?0:dates.findIndex(d=>!days.has(`${r.line}|${d}`));if(firstUnknown>=0)for(const d of dates.slice(firstUnknown))uncertain.add(`${r.line}|${d}`);}
 for(const r of queue){
  const dates=range(r.start,r.end),hours=plannedLaborHours(r),isEdited=reportIds.has(r.id);
  if(!dates.length||!r.line)continue; // Date entry may be incomplete during auto-save.
  if(hours===null){if(isEdited)notChecked.push({id:r.id,sku:r.sku,line:r.line,reason:'missingLabor'});continue;}
  if(isEdited&&dates.some(d=>uncertain.has(`${r.line}|${d}`)))notChecked.push({id:r.id,sku:r.sku,line:r.line,reason:'incompleteOtherOrders'});
  const lastKey=`${r.line}|${dates.at(-1)}`,lastDayBefore=used.get(lastKey)||0;
  let remaining=hours,blocked=false;const allocations=[];
  for(const date of dates){if(!days.has(`${r.line}|${date}`)){blocked=true;if(isEdited)notChecked.push({id:r.id,sku:r.sku,line:r.line,reason:'missingCapacity'});break;}const key=`${r.line}|${date}`,available=days.get(key),before=used.get(key)||0,take=Math.min(remaining,Math.max(0,available-before));if(take>0){used.set(key,before+take);allocations.push({date,hours:round(take)});remaining=Math.max(0,remaining-take);}if(remaining<1e-8)break;}
  if(!blocked&&remaining>1e-8){const date=dates.at(-1),key=`${r.line}|${date}`,before=used.get(key)||0,available=days.get(key),total=before+remaining;used.set(key,total);
   if(isEdited)warnings.push({id:r.id,source:r.backlog?'inTransit':'proPlan',sku:r.sku,name:r.name,line:r.line,start:r.start,end:r.end,date,required:hours,available,scheduled:round(lastDayBefore),remaining:round(total-lastDayBefore),total:round(total),over:round(total-available),allocations});
  }
 }
 return {warnings,notChecked};
}
