import {allocatePlanWeek} from './plan-week-load.mjs';
import {dateISO,monday,weekEnd,numberOrNull,remainingPlanSummary,plannedLaborHours} from './production-plan.mjs';
const round=n=>Math.round(n*10000)/10000;
// Input must be the same merged/normalized progress used by In transit.
export function planTransitBacklog(transit,week,labor=[]){
 const standards=new Map(labor.map(r=>[String(r.sku).toUpperCase(),numberOrNull(r.laborHour)]));
 const unique=[...new Map(transit.filter(r=>!r._deleted).map(r=>[r.id,r])).values()];
 const rows=unique.filter(r=>r.status!=='HỦY'&&!r.cancelReason&&!r.actualCompletedAt&&dateISO(r.planEnd)>=week&&(!dateISO(r.planStart)||dateISO(r.planStart)<=weekEnd(week))).flatMap(r=>{
  const quantity=numberOrNull(r.lsxQty)??numberOrNull(r.planQty),completed=numberOrNull(r.completedQty)||0;
  const remaining=quantity===null?null:Math.max(0,quantity-completed);if(remaining===0)return [];
  const standard=standards.get(String(r.sku).toUpperCase())??numberOrNull(r.laborHour),laborHour=standard!==null&&standard>=0?standard:null;
  return [{id:`transit:${r.id}`,transitId:r.id,planRowId:r.planRowId,planId:r.planId,lsxCode:r.lsxCode,sku:r.sku,name:r.name,line:r.line,week:r.week,
   originalStart:dateISO(r.planStart),start:dateISO(r.planStart)&&r.planStart>week?r.planStart:week,end:r.planEnd,quantity,completed,remaining,pending:Number(r.pendingReportQty)||0,laborHour,
   hours:remaining===null||laborHour===null?null:round(remaining*laborHour),previousWeek:!!r.week&&monday(r.week)<week}];
 }).sort((a,b)=>a.end.localeCompare(b.end)||a.line.localeCompare(b.line)||a.id.localeCompare(b.id));
 return {rows,coveredRowIds:[...new Set(unique.map(r=>r.planRowId).filter(Boolean))],coveredPlanIds:[...new Set(unique.map(r=>r.planId).filter(Boolean))]};
}
export function combinePlanBacklog(plans,backlog){
 const rowIds=new Set(backlog.coveredRowIds),planIds=new Set(backlog.coveredPlanIds);
 return [...plans.filter(r=>!rowIds.has(r.id)&&!(r.planId&&planIds.has(r.planId))),...backlog.rows.map(r=>({...r,plan:r.remaining,status:'DỰ KIẾN',backlog:true}))];
}
export function backlogLineSummary(backlog,line){
 const rows=backlog.rows.filter(r=>r.line===line),missing=rows.filter(r=>r.hours===null),old=rows.filter(r=>r.previousWeek);
 return {backlogRows:rows,backlogHours:round(rows.reduce((n,r)=>n+(r.hours??0),0)),previousBacklogHours:round(old.reduce((n,r)=>n+(r.hours??0),0)),backlogMissing:missing.length};
}
export function planSummaryWithBacklog(s,capacity){
 const c=capacity.find(c=>c.line===s.line)||{},backlogHours=c.backlogHours??0,total=round((s.required??0)+backlogHours);
 const ratio=total===null||s.available===null?null:s.available===0?(total?Infinity:0):total/s.available;
 return {...s,partial:Boolean(s.missingLabor||c.backlogMissing),backlogHours,previousBacklogHours:c.previousBacklogHours??0,backlogRows:c.backlogRows||[],backlogMissing:c.backlogMissing||0,totalRequired:total,ratio,difference:total===null||s.available===null?null:round(s.available-total),warning:ratio===null?'missing':ratio>1?'overload':ratio>=.9?'near':'ok'};
}

export function remainingPlanWithTransitSummary(rows,capacity,week,editedIds=[]){
 const backlog=capacity.flatMap(c=>c.backlogRows||[]),coveredRows=new Set(backlog.map(r=>r.planRowId).filter(Boolean)),coveredPlans=new Set(backlog.map(r=>r.planId).filter(Boolean));
 const pending=rows.filter(r=>!coveredRows.has(r.id)&&!(r.planId&&coveredPlans.has(r.planId)));
 const missingLines=capacity.filter(c=>(c.backlogRows?.length||c.otherPlans?.length)&&!pending.some(r=>r.line===c.line)).map(c=>({line:c.line,week,status:'HỦY'}));
 return remainingPlanSummary([...pending,...missingLines],capacity,week).map(s=>{
  const c=capacity.find(c=>c.line===s.line)||{};
  // Compatibility for retained snapshots predating daily budgets. Fetching the
  // current API replaces these snapshots; future-start rows are still excluded.
  if(!Array.isArray(c.dailyBudgets)){const inWeek=r=>{const finish=dateISO(r.end);return finish>=week&&finish<=weekEnd(week);};const eligible=pending.filter(inWeek);const base=remainingPlanSummary([...eligible,...missingLines],capacity,week).find(x=>x.line===s.line)||s;const known=eligible.filter(r=>r.line===s.line&&!r._deleted&&!(['HỦY','TẠM HOÃN','ĐÃ CHUYỂN'].includes(r.status))).reduce((n,r)=>n+(plannedLaborHours(r)??0),0);const eligibleBacklog=(c.backlogRows||[]).filter(r=>dateISO(r.start)<=weekEnd(week)&&dateISO(r.end)>=week);return planSummaryWithBacklog({...base,required:round(known)},[{...c,...backlogLineSummary({rows:eligibleBacklog},s.line),backlogRows:c.backlogRows||[]}]);}
  const lineRows=[...pending.filter(r=>r.line===s.line&&r.status!=='ĐÃ CHUYỂN'),...(c.otherPlans||[]),...(c.backlogRows||[]).map(r=>({...r,plan:r.remaining,backlog:true,status:'DỰ KIẾN'}))];
  const allocations=allocatePlanWeek(lineRows,c.dailyBudgets,week,editedIds),sum=items=>round(items.reduce((n,r)=>n+(r.hours??0),0));
  const required=sum(allocations.filter(r=>!r.backlog)),backlogHours=sum(allocations.filter(r=>r.backlog)),previousBacklogHours=sum(allocations.filter(r=>r.backlog&&r.previousWeek)),totalRequired=sum(allocations);
  const ratio=totalRequired===null||s.available===null?null:s.available===0?(totalRequired?Infinity:0):totalRequired/s.available;
  return {...s,partial:allocations.some(r=>r.hours===null),missingLabor:allocations.filter(r=>!r.backlog&&r.reason==='missingLabor').length,required,backlogHours,previousBacklogHours,backlogRows:c.backlogRows||[],backlogMissing:allocations.filter(r=>r.backlog&&r.reason==='missingLabor').length,allocationMissing:allocations.filter(r=>r.hours===null&&r.reason!=='missingLabor').length,totalRequired,ratio,difference:totalRequired===null||s.available===null?null:round(s.available-totalRequired),deferredHours:allocations.some(r=>r.deferred===null)?null:round(allocations.reduce((n,r)=>n+r.deferred,0)),warning:ratio===null?'missing':ratio>1?'overload':ratio>=.9?'near':'ok'};
 });
}
