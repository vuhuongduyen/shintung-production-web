import {orderLaborOutput} from './production-output-summary.mjs';
// Cumulative posted labor uses active stage reports, never superseded totals.
export function reportCumulativeHours(reports){
 const groups=new Map(),result=new Map();
 for(const r of reports){
  if(r.cancelled||r.voided||r.replacedByStageBatch||r.reviewStatus==='Đã hủy')continue;
  const key=r.transitId||r.planId;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(r);
 }
 const accumulator=()=>({total:0,invalid:false,stages:new Map()});
 const add=(acc,r)=>{const valid=r.hours?.total!=null&&Number.isFinite(Number(r.hours.total)),value=valid?Number(r.hours.total):0;
  acc.total+=value;acc.invalid ||= !valid;
  const key=r.stageCode||r.stageName,old=acc.stages.get(key)||{total:0,invalid:false};
  old.total+=value;old.invalid ||= !valid;acc.stages.set(key,old);
 };
 for(const group of groups.values()){
  const ordered=group.filter(r=>Number.isFinite(Date.parse(r.completedAt))).sort((a,b)=>Date.parse(a.completedAt)-Date.parse(b.completedAt));
  const all=accumulator(),erp=accumulator();
  for(let i=0;i<ordered.length;){
   let end=i+1;while(end<ordered.length&&Date.parse(ordered[end].completedAt)===Date.parse(ordered[i].completedAt))end++;
   // All reports at the same instant contribute to each other's cumulative total.
   for(let j=i;j<end;j++){add(all,ordered[j]);if(ordered[j].erpStageImport)add(erp,ordered[j]);}
   for(let j=i;j<end;j++){const r=ordered[j],acc=r.erpStageImport?erp:all,stage=r.stageCode||r.stageName,s=acc.stages.get(stage);
    result.set(r.id,{stageCumulativeHours:stage&&!s.invalid?s.total:null,orderCumulativeHours:acc.invalid?null:acc.total});
   }
   i=end;
  }
  for(const r of group)if(!result.has(r.id))result.set(r.id,{stageCumulativeHours:null,orderCumulativeHours:null});
 }
 return result;
}

// Journal's final row is the whole-order comparison, not a timestamp cutoff.
// Keep per-report/stage chronological values for all other consumers.
export function journalOrderHours(reports,orders,finalIds){
 const result=reportCumulativeHours(reports),byOrder=new Map(orders.map(o=>[o.id,o]));
 for(const r of reports){
  if(!finalIds.has(r.id))continue;
  const order=byOrder.get(r.transitId)||r.orderSnapshot||{id:r.transitId};
  const total=orderLaborOutput(order,reports).total;
  result.set(r.id,{...result.get(r.id),orderCumulativeHours:total});
 }
 return result;
}
