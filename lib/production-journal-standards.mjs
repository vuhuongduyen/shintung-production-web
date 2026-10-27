import {standardForOrder} from './production-payroll.mjs';
export function journalStandardHours(reports,orders,standards,finalIds,cumulative){
 const result=new Map(),targets=new Map(),byOrder=new Map(orders.map(o=>[o.id,o]));
 const key=r=>r.transitId||r.planId||r.id;
 for(const r of reports)if(finalIds.has(r.id))targets.set(key(r),{report:r,quantity:0});
 for(const r of reports){const target=targets.get(key(r));if(!target||r.kind!=='completion'||r.cancelled||r.voided||r.replacedByStageBatch||r.reviewStatus==='Đã hủy'||(target.report.erpStageImport&&!r.erpStageImport)||Date.parse(r.completedAt)>Date.parse(target.report.completedAt))continue;
  target.quantity+=Number(r.reportedQuantity||0);
 }
 for(const {report:r,quantity} of targets.values()){
  const order=byOrder.get(r.transitId)||r.orderSnapshot||r;
  const {unit}=standardForOrder(order,standards);
  const standardLaborHours=unit===null?null:unit*quantity,total=cumulative.get(r.id)?.orderCumulativeHours;
  result.set(r.id,{standardUnitHours:unit,standardLaborHours,laborDeviation:standardLaborHours>0&&total!=null?total/standardLaborHours-1:null});
 }
 return result;
}
