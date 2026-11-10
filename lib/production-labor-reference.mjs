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
// Shared by resolution and fixed-basis binding: every SKU precedence branch
// must select the same identity when validating a retained rate.
export function laborRateIdentity(report,order){
 const choices=[['legacy-basis',report.legacyEarnedBasis?.sku],['order-snapshot',report.orderSnapshot?.sku],['report',report.sku],['live-order',order?.sku]];
 const selected=choices.find(([,sku])=>Boolean(sku));
 return {source:selected?.[0]??null,sku:String(selected?.[1]||'').trim().toUpperCase()};
}
// Read-only dated calculation basis. Saved evidence always wins; never write this projection back to a report.
export function attachLaborReferences(reports,orders,menu){
 const byOrder=new Map(orders.map(o=>[o.id,o])),bySku=new Map(menu.map(r=>[String(r.payload?.sku||r.key).trim().toUpperCase(),r.payload]));
 return reports.map(report=>{
  if(!laborReferenceInScope(report)||isDailyOutput(report)||report.kind!=='completion'||report.cancelled||report.voided||report.replacedByStageBatch||earnedReportBasis(report).unit!=null||report.rateBasis||report.standardUnit!=null&&report.standardUnit!==''||report.legacyEarnedBasis&&report.legacyEarnedBasis.status!=='missing')return report;
  const order=byOrder.get(report.transitId),sku=laborRateIdentity(report,order).sku,date=outputDate(report),rate=bySku.get(sku);
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
 return {unit:result.basis.value,earned:qty*result.basis.value,source:'Giờ công theo ngày',reference:ref};
}
export function laborReferenceLabel(references=[]){
 return references.length?'Giờ công theo ngày · '+references.map(r=>`${r.sku}: ${r.productionDate}, ${r.basis.validFrom}, ${r.basis.versionId}`).join('; '):'';
}

// Deployment-scoped, explicit exceptions. An omitted rate is still unknown, not zero.
// Match all business keys; never infer exceptions from a name or a missing rate alone.
export function attachLaborRateOmissions(reports,orders,policy=[]){
 if(!Array.isArray(policy))return reports;
 const byOrder=new Map(orders.map(o=>[o.id,o]));
 return reports.map(report=>{
  if(!laborReferenceInScope(report)||referenceReportBasis(report).unit!=null)return report;
  const saved=report.legacyEarnedBasis,order=byOrder.get(report.transitId),date=outputDate(report);
  if(saved&&saved.status!=='missing'||report.rateBasis||report.standardUnit!=null&&report.standardUnit!=='')return report;
  const sku=String(saved?.sku||report.orderSnapshot?.sku||report.sku||order?.sku||'').trim().toUpperCase();
  const orderCode=String(saved?.lsxCode||report.orderSnapshot?.lsxCode||order?.lsxCode||'').trim();
  if(!sku||!orderCode||!policy.some(p=>p&&p.orderCode===orderCode&&p.sku===sku&&p.date===date))return report;
  return {...report,laborRateOmission:{kind:'explicit-missing-rate-omission-v1',orderCode,sku,date}};
 });
}
export function isLaborRateOmitted(report){
 return report.laborRateOmission?.kind==='explicit-missing-rate-omission-v1'&&report.laborRateOmission.date===outputDate(report)&&laborReferenceInScope(report)&&referenceReportBasis(report).unit==null;
}
