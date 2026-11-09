import {finalReportIds} from './production-report-order.mjs';
import {effectiveValueOn} from './effective-dated-value.mjs';
import {outputDate} from './production-output-summary.mjs';
import {earnedReportBasis,preservedJournalPresentation,legacyEarnedModel} from './production-legacy-earned-basis.mjs';
import {isDailyOutput} from './production-daily-output.mjs';
// A journal-last-row flag is presentation, not the stage classification.
export function isLaborFinalReport(report,orders){
 if(report.kind!=='completion'||report.cancelled||report.voided||report.replacedByStageBatch||report.reviewStatus==='Đã hủy')return false;
 const saved=report.legacyEarnedBasis;
 if(saved?.kind===legacyEarnedModel&&saved.status!=='stale'&&typeof saved.finalStage==='boolean')return saved.finalStage;
 if(preservedJournalPresentation(report).legacyJournalFinal===true)return true;
 return String(report.stageName||report.stageCode||'').trim()?finalReportIds([report],orders).has(report.id):false;
}
export const laborReferenceInScope=report=>{const date=outputDate(report)||'';return /^\d{4}-\d{2}-\d{2}$/.test(date)&&date>='2026-10-01';};
// Read-only comparison. Never promote this projection to a saved/payroll basis.
export function attachLaborReferences(reports,orders,menu){
 const byOrder=new Map(orders.map(o=>[o.id,o])),bySku=new Map(menu.map(r=>[String(r.payload?.sku||r.key).trim().toUpperCase(),r.payload]));
 return reports.map(report=>{
  if(!laborReferenceInScope(report)||isDailyOutput(report)||report.kind!=='completion'||report.cancelled||report.voided||report.replacedByStageBatch||earnedReportBasis(report).unit!=null||report.rateBasis||report.standardUnit!=null&&report.standardUnit!==''||report.legacyEarnedBasis&&report.legacyEarnedBasis.status!=='missing')return report;
  const order=byOrder.get(report.transitId),sku=String(report.legacyEarnedBasis?.sku||report.orderSnapshot?.sku||report.sku||order?.sku||'').trim().toUpperCase(),date=outputDate(report),rate=bySku.get(sku);
  if(!rate||rate.cancelled||rate._deleted||rate.status==='Đã hủy')return report;
  const resolved=effectiveValueOn(rate.resolvedRateVersions||[],date);
  return {...report,laborReference:{kind:'historical-labor-reference-v1',status:resolved.ok?'resolved':'missing',sku,productionDate:date,frozen:false,...(resolved.ok?{basis:resolved.basis}:{reason:resolved.reason})}};
 });
}
export function referenceReportBasis(report){
 const stored=earnedReportBasis(report);if(!laborReferenceInScope(report)||stored.unit!=null||isDailyOutput(report)||report.rateBasis||report.standardUnit!=null&&report.standardUnit!==''||report.legacyEarnedBasis&&report.legacyEarnedBasis.status!=='missing')return stored;
 const ref=report.laborReference,qty=Number(report.approvedQuantity??report.reportedQuantity);
 if(ref?.kind!=='historical-labor-reference-v1'||ref.status!=='resolved'||!Number.isFinite(qty)||qty<0)return stored;
 const result=effectiveValueOn([],outputDate(report),ref.basis);if(!result.ok||typeof result.basis.value!=='number'||!Number.isFinite(result.basis.value)||result.basis.value<0)return stored;
 return {unit:result.basis.value,earned:qty*result.basis.value,source:'Đối chiếu lịch sử, chưa chốt',reference:ref};
}
export function laborReferenceLabel(references=[]){
 return references.length?'Đối chiếu lịch sử, chưa chốt · '+references.map(r=>`${r.sku}: ${r.productionDate}, ${r.basis.validFrom}, ${r.basis.versionId}`).join('; '):'';
}
