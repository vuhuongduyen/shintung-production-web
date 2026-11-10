import {laborRateIdentity,laborReferenceInScope,referenceReportBasis,isLaborFinalReport} from './production-labor-reference.mjs';
import {outputDate} from './production-output-summary.mjs';
const kind='labor-rate-warning-suppression-v1';
// Presentation-only policy. Never set laborRateOmission or change a calculation input.
export function attachLaborRateWarningSuppressions(reports,orders,policy=[]){
 reports=reports.map(report=>{if(!report.laborRateWarningSuppression)return report;const {laborRateWarningSuppression,...rest}=report;return rest;});
 if(!Array.isArray(policy))return reports;
 const rules=policy.filter(p=>p&&Object.keys(p).sort().join(',')==='date,orderCode,sku'&&typeof p.orderCode==='string'&&typeof p.sku==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(p.date));
 if(!rules.length)return reports;
 const byOrder=new Map(orders.map(o=>[o.id,o]));
 return reports.map(report=>{
  const qty=Number(report.approvedQuantity??report.reportedQuantity);
  if(!laborReferenceInScope(report)||!Number.isFinite(qty)||qty<=0||referenceReportBasis(report).unit!=null)return report;
  const order=byOrder.get(report.transitId),sku=laborRateIdentity(report,order).sku,date=outputDate(report);
  const orderCode=String(report.legacyEarnedBasis?.lsxCode||report.orderSnapshot?.lsxCode||order?.lsxCode||'').trim();
  if(!sku||!orderCode||!rules.some(p=>p.orderCode===orderCode&&p.sku===sku&&p.date===date)||!isLaborFinalReport(report,orders))return report;
  return {...report,laborRateWarningSuppression:{kind,reportId:report.id,orderCode,sku,date}};
 });
}
export function isLaborRateWarningSuppressed(report){
 const marker=report.laborRateWarningSuppression;
 return marker?.kind===kind&&marker.reportId===report.id&&marker.date===outputDate(report)&&marker.sku===laborRateIdentity(report).sku&&laborReferenceInScope(report)&&referenceReportBasis(report).unit==null;
}
