import {laborRateIdentity,laborReferenceInScope,referenceReportBasis,isLaborFinalReport} from './production-labor-reference.mjs';
import {outputDate} from './production-output-summary.mjs';
const kind='labor-rate-warning-suppression-v1';
const identity=(report,order)=>({sku:laborRateIdentity(report,order).sku,date:outputDate(report),orderCode:String(report.legacyEarnedBasis?.lsxCode||report.orderSnapshot?.lsxCode||order?.lsxCode||'').trim()});
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
  const {sku,date,orderCode}=identity(report,byOrder.get(report.transitId));
  if(!sku||!orderCode||!rules.some(p=>p.orderCode===orderCode&&p.sku===sku&&p.date===date)||!isLaborFinalReport(report,orders))return report;
  return {...report,laborRateWarningSuppression:{kind,reportId:report.id,orderCode,sku,date}};
 });
}
/** @param {any} report @param {Record<string, any> | undefined} [order] */
export function isLaborRateWarningSuppressed(report,order=undefined){
 const marker=report.laborRateWarningSuppression,current=identity(report,order);
 return marker?.kind===kind&&marker.reportId===report.id&&marker.date===current.date&&marker.sku===current.sku&&marker.orderCode===current.orderCode&&laborReferenceInScope(report)&&referenceReportBasis(report).unit==null;
}
