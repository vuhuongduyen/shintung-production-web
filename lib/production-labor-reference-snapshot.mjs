import {recordRevision} from './record-revision.mjs';
import {earnedReportBasis} from './production-legacy-earned-basis.mjs';
import {attachLaborReferences,attachLaborRateOmissions,referenceReportBasis,isLaborRateOmitted,laborReferenceInScope,laborRateIdentity} from './production-labor-reference.mjs';
import {outputDate} from './production-output-summary.mjs';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const hash=v=>recordRevision(JSON.stringify(canonical(v)));
export async function laborReferenceBinding(report,orders=[]){
 const keys=['id','kind','reportingModel','quantityOnly','reviewStatus','transitId','version','sku','line','productionDate','completedAt','reportedQuantity','approvedQuantity','standardUnit','rateBasis','hours','orderSnapshot','legacyEarnedBasis','cancelled','voided','replacedByStageBatch'];
 return hash({...Object.fromEntries(keys.filter(k=>report[k]!==undefined).map(k=>[k,report[k]])),rateIdentity:laborRateIdentity(report,orders.find(o=>o.id===report.transitId))});
}
export function needsFixedLaborReference(report){
 const quantity=Number(report.approvedQuantity??report.reportedQuantity);
 return laborReferenceInScope(report)&&report.kind==='completion'&&!report.cancelled&&!report.voided&&!report.replacedByStageBatch&&report.reviewStatus!=='Đã hủy'&&quantity>0;
}
// Pure preview, no persistence. Approval/storage is a separate explicit operation.
export async function previewFixedLaborReferences({reports,orders,menu,omissions=[],observedAt}){
 if(!Number.isFinite(Date.parse(observedAt)))throw Error('A verified observation timestamp is required.');
 const orderById=new Map(orders.map(o=>[o.id,o]));
 const projected=attachLaborRateOmissions(attachLaborReferences(reports,orders,menu),orders,omissions),entries=[],rows=[];
 for(const report of projected){
  const qty=Number(report.approvedQuantity??report.reportedQuantity),stored=earnedReportBasis(report),resolved=referenceReportBasis(report);
  const status=!laborReferenceInScope(report)?'out-of-scope':!needsFixedLaborReference(report)?'not-applicable':stored.unit!=null?'preserve-stored':isLaborRateOmitted(report)?'explicit-omission':resolved.unit!=null?'fixed-candidate':'missing';
  const row={reportId:report.id,orderId:report.transitId,orderCode:report.legacyEarnedBasis?.lsxCode||report.orderSnapshot?.lsxCode||orderById.get(report.transitId)?.lsxCode||null,sku:report.laborReference?.sku||report.legacyEarnedBasis?.sku||report.sku||orderById.get(report.transitId)?.sku||null,date:outputDate(report),quantity:qty,status,unit:resolved.unit,earned:resolved.earned,actualHours:report.hours?.total??null,sourceBinding:await laborReferenceBinding(report,orders),reason:status==='not-applicable'?(report.kind!=='completion'?'not-completion':report.cancelled||report.voided||report.replacedByStageBatch||report.reviewStatus==='Đã hủy'?'inactive-report':'no-positive-output'):status==='missing'?'no-supported-date-rate-or-valid-stored-basis':status,reference:report.laborReference??null};
  if(status==='fixed-candidate')entries.push({reportId:report.id,binding:await laborReferenceBinding(report,orders),reference:structuredClone(report.laborReference),observedAt});
  rows.push(row);
 }
 const manifest={kind:'labor-reference-snapshot-v1',observedAt,entries};
 return {mode:'preview-only-no-writes',manifest:{...manifest,digest:await hash(manifest)},rows,counts:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{})};
}
// Offline verification of the proposed registry: missing/mismatched entries must
// not silently fall back to a mutable timeline. No caller writes source reports.
export async function applyFixedLaborReferences(reports,manifest,orders=[]){
 const {digest,...body}=manifest||{};
 if(body.kind!=='labor-reference-snapshot-v1'||!Array.isArray(body.entries)||await hash(body)!==digest)throw Error('Invalid labor reference snapshot.');
 const byId=new Map();for(const e of body.entries){if(byId.has(e.reportId))throw Error('Duplicate report in labor reference snapshot.');byId.set(e.reportId,e);}
 const result=[];
 for(const report of reports){
  const {laborReference,...original}=report,entry=byId.get(report.id);
  if(earnedReportBasis(original).unit!=null||!laborReferenceInScope(original)){result.push(report);continue;}
  // The registry protects output-bearing rows only. Keep existing display
  // references for rows never included (e.g. zero-output intermediate stages).
  // An existing entry still validates its binding if its quantity later changes.
  if(!entry&&!needsFixedLaborReference(original)){result.push(report);continue;}
  if(!entry||entry.binding!==await laborReferenceBinding(original,orders)){result.push(original);continue;}
  const candidate={...original,laborReference:{...structuredClone(entry.reference),frozen:true,snapshotDigest:digest}};
  result.push(referenceReportBasis(candidate).unit!=null?candidate:original);
 }
 return result;
}
