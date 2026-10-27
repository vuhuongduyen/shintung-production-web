import {monday} from './production-plan.mjs';
export const visibilityWeek=row=>monday(row.week)||'unassigned';
// Evaluate whole weeks before applying search, line, pagination or manual visibility.
export function completedWeeks(rows,isComplete){
 const groups=new Map();
 for(const row of rows){const key=visibilityWeek(row);groups.set(key,(groups.get(key)??true)&&Boolean(isComplete(row)));}
 return new Set([...groups].filter(([key,done])=>key!=='unassigned'&&done).map(([key])=>key));
}
export function transitReadyToArchive(row){
 if(Number(row.pendingReportQty||0)>0||row.syncStatus!=='ĐÃ ĐỒNG BỘ')return false;
 if(row.status==='HỦY')return true;
 return Boolean(row.actualCompletedAt&&Number(row.lsxQty)>0&&Number(row.completedQty)>=Number(row.lsxQty));
}
export const matchesVisibility=(mode,hidden)=>mode==='all'||(mode==='hidden'?hidden:!hidden);
