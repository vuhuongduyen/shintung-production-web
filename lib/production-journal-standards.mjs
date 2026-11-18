import {reportStandardHours} from './production-report-standard-hours.mjs';
export function journalStandardHours(reports,orders,standards,finalIds,cumulative,rawReports=reports,{reference=false}={}){
 const result=new Map(),targets=new Map(),rawById=new Map(rawReports.map(r=>[r.id,r]));
 const key=r=>r.transitId||r.planId||r.id;
 for(const r of reports)if(finalIds.has(r.id))targets.set(key(r),{report:r,reports:[]});
 for(const r of reports){const target=targets.get(key(r));if(!target||r.kind!=='completion'||r.cancelled||r.voided||r.replacedByStageBatch||r.reviewStatus==='Đã hủy'||(target.report.erpStageImport&&!r.erpStageImport)||Date.parse(r.completedAt)>Date.parse(target.report.completedAt))continue;
  target.reports.push(rawById.get(r.id)||r);
 }
 for(const {report:r,reports:own} of targets.values()){
  const {unit,earned:standardLaborHours,references}=reportStandardHours(own,{reported:true,reference}),total=cumulative.get(r.id)?.orderCumulativeHours;
  result.set(r.id,{...(reference?{laborReferences:references}:{}),standardUnitHours:unit,standardLaborHours,laborDeviation:standardLaborHours>0&&total!=null?total/standardLaborHours-1:null});
 }
 return result;
}
