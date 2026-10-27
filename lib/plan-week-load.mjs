import {dateISO,weekEnd,plannedLaborHours} from './production-plan.mjs';
import {calculateCapacity} from './capacity.mjs';
const round=n=>Math.round(n*10000)/10000;
export function capacityDailyBudgets(row){
 if(row.status!=='Đã xác nhận'||row.reviewStatus!=='approved'||!row.syncedAt||!row.khsxAcceptedAt||!row.input)return [];
 try{const r=calculateCapacity(row.input,row.week);if(r.hasUnallocatedLeave||row.input.leaveMode==='aggregate')return [];return r.days.map(d=>({date:d.date,available:round((d.hcNet+d.otNet)*Number(row.input.factor)/100)}));}catch{return [];}
}
// Allocate chronologically up to the visible week end. Never pull future-start
// work into this week; never invent future capacity to distribute a remainder.
export function allocatePlanWeek(rows,budgets,week,editedIds=[]){
 const end=weekEnd(week),days=new Map(budgets.map(d=>[d.date,d.available])),used=new Map(),uncertain=new Set(),edited=new Set(editedIds);
 const queue=[...new Map(rows.filter(r=>!r._deleted&&!['HỦY','TẠM HOÃN'].includes(r.status)).map(r=>[r.id,r])).values()].sort((a,b)=>Number(!!b.backlog)-Number(!!a.backlog)||Number(edited.has(a.id))-Number(edited.has(b.id))||String(a.start).localeCompare(String(b.start))||(a.sequence??999999)-(b.sequence??999999)||String(a.id).localeCompare(String(b.id)));
 return queue.map(r=>{
  const hours=plannedLaborHours(r),start=dateISO(r.start),finish=dateISO(r.end),base={id:r.id,backlog:!!r.backlog,previousWeek:!!r.previousWeek,sku:r.sku};
  if(start>end)return {...base,hours:0,deferred:hours,future:true};
  if(hours===0)return {...base,hours:0,deferred:0};
  if(!start||!finish||finish<start||Date.parse(end)-Date.parse(start)>366*86400000)return {...base,hours:finish&&finish<week?0:null,deferred:null,reason:'missingDates'};
  const last=finish<end?finish:end,dates=[];for(let d=start;d<=last;d=new Date(Date.parse(d)+86400000).toISOString().slice(0,10))dates.push(d);
  let remaining=hours,weekHours=0,unknown=hours===null;const allocations=[];
  for(const date of dates){
   if(unknown||!days.has(date)||uncertain.has(date)){unknown=true;uncertain.add(date);continue;}
   const take=Math.min(remaining,Math.max(0,days.get(date)-(used.get(date)||0)));remaining-=take;used.set(date,(used.get(date)||0)+take);if(date>=week)weekHours+=take;if(take)allocations.push({date,hours:round(take)});if(remaining<1e-8)break;
  }
  // If its requested completion is this week, excess still belongs to that
  // final day. If completion is later, keep the remainder for a later week.
  if(!unknown&&remaining>1e-8&&finish<=end){used.set(finish,(used.get(finish)||0)+remaining);if(finish>=week)weekHours+=remaining;allocations.push({date:finish,hours:round(remaining)});remaining=0;}
  return {...base,hours:unknown&&finish>=week?null:round(weekHours),deferred:unknown?null:round(remaining),allocations,...(unknown?{reason:hours===null?'missingLabor':'missingCapacity'}:{})};
 });
}
