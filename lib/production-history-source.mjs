// Source totals are authoritative. Reconstructing names must never replace them.
export function earlierHistorySourceReports(report, reports) {
 const end=Date.parse(report.completedAt);
 return reports.filter(prior=>!prior.cancelled&&!prior.voided&&
  (report.transitId?prior.transitId===report.transitId:report.planId&&prior.planId===report.planId)&&
  Number.isFinite(Date.parse(prior.completedAt))&&Date.parse(prior.completedAt)<end);
}
export function historySourceBaseline(report,reports) {
 return Math.max(0,Number(report.sourceBaseline?.cumulativeHours)||0,...earlierHistorySourceReports(report,reports).filter(prior=>prior.sourceCumulativeHours!=null&&Number.isFinite(Number(prior.sourceCumulativeHours))).map(prior=>Number(prior.sourceCumulativeHours)));
}
export function reconcileHistorySource(reports, priorReports=[]) {
 return reports.map(r=>{
  if(r.sourceVerified||!r.historicalImport||!Number.isFinite(Number(r.sourceCumulativeHours))||r.sourceCumulativeHours==null)return r;
  const previous=historySourceBaseline(r,[...priorReports,...reports]);
  const personHours=Math.max(0,Number(r.sourceCumulativeHours)-previous),count=Number(r.sourceCount),total=personHours*count;
  const candidates=[...(r.hours?.perEmployee||[])].sort((a,b)=>b.total-a.total||String(a.id).localeCompare(String(b.id))).slice(0,count);
  const available=candidates.reduce((s,p)=>s+Number(p.total||0),0),factor=available?Math.min(1,total/available):0;
  const perEmployee=candidates.map(p=>({...p,hc:p.hc*factor,ot:p.ot*factor,total:p.total*factor}));
  const allocated=perEmployee.reduce((s,p)=>s+p.total,0),ot=perEmployee.reduce((s,p)=>s+p.ot,0);
  const ids=new Set(perEmployee.map(p=>p.id));
  return {...r,count,employees:[...ids],employeeDetails:(r.employeeDetails||[]).filter(p=>ids.has(p.id)),
   sourcePeriodHours:personHours,sourceLaborHours:total,standardLaborHours:Number(r.standardUnit)>0?Number(r.standardUnit)*Number(r.reportedQuantity):null,laborDeviation:Number(r.standardUnit)>0&&Number(r.reportedQuantity)>0?total/(Number(r.standardUnit)*Number(r.reportedQuantity))-1:null,allocationVersion:3,unallocatedHours:Math.max(0,total-allocated),
   hours:{hc:total-(allocated?total*ot/allocated:0),ot:allocated?total*ot/allocated:0,total,estimated:true,sourceTotal:true,perEmployee},
   historicalAllocations:(r.historicalAllocations||[]).filter(a=>ids.has(a.id)).map(a=>({...a,to:new Date(Date.parse(a.from)+(Date.parse(a.to)-Date.parse(a.from))*factor).toISOString()})),
   laborNotes:[{text:'Giờ trong ảnh là giờ/người lũy kế. Tổng giờ công lần này = (giờ/người lũy kế lần này − lần trước) × số người gốc. Tên nhân viên và phần chia HC/TC là phân bổ bổ sung; giờ chuẩn/SP chỉ là trọng số, không thay tổng giờ gốc.'}]
  };
 });
}

// Separate source person-hours from named, schedule-constrained allocation.
export function historyAllocationSummary(report) {
 const people=report.hours?.perEmployee||[];
 const hc=people.reduce((sum,p)=>sum+Math.max(0,Number(p.hc)||0),0);
 const ot=people.reduce((sum,p)=>sum+Math.max(0,Number(p.ot)||0),0);
 const allocated=people.reduce((sum,p)=>sum+Math.max(0,Number(p.total)||0),0);
 const source=Number(report.sourceLaborHours??report.hours?.total)||0;
 const unallocated=Math.max(0,source-allocated,Number(report.unallocatedHours)||0);
 return {source,hc,ot,allocated,unallocated};
}
export const historyAllocationTolerance=1e-6;
