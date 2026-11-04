import {isDailyOutput,dailyEarnedHours} from './production-daily-output.mjs';
import {hasFinishedOutput,outputDate} from './production-output-summary.mjs';
import {recordRevision} from './record-revision.mjs';
export const legacyEarnedModel='observed-legacy-earned-v1';
const number=value=>value===null||value===undefined||String(value).trim()===''?null:Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
// Deliberately does not hash current master data: later master edits must not
// invalidate an observed result. Explicit report corrections require review.
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
export const legacyEarnedSignature=r=>JSON.stringify(canonical(r));
export async function captureLegacyEarnedBasis({orders,reports,standards,snapshotId,observedAt,rawReports=reports}){
 if(!snapshotId||!Number.isFinite(Date.parse(observedAt)))throw Error('Thiếu định danh/thời điểm bảo toàn kết quả.');
 const byOrder=new Map(orders.map(o=>[o.id,o])),rawById=new Map(rawReports.map(r=>[r.id,r])),basis=[],issues=[];
 for(const r of reports){
  if(isDailyOutput(r)||r.kind!=='completion')continue;
  const order=byOrder.get(r.transitId),quantity=number(r.approvedQuantity??r.reportedQuantity),unit=order?number(standards.get(String(order.sku||'').trim().toUpperCase())):null,productionDate=outputDate(r);
  const applicable=hasFinishedOutput(r)&&r.reviewStatus==='Đã xác nhận';
  const known=!!order&&['A','B','C'].includes(order.line)&&!!productionDate&&quantity!==null&&unit!==null;
  const value={kind:legacyEarnedModel,snapshotId,reportId:r.id,sourceSignature:legacyEarnedSignature(rawById.get(r.id)||r),presentation:observedPresentation(r),status:!applicable?'not-applicable':known?'resolved':'missing',line:order?.line||r.line||null,sku:order?.sku||r.sku||null,lsxCode:order?.lsxCode||r.lsxCode||null,name:order?.name||r.name||null,spec:order?.spec||r.spec||null,productionDate,quantity,unit,earned:applicable&&known?quantity*unit:null,observedAt,source:'Kết quả current-only đang quan sát tại mốc bảo toàn; không phải lịch sử hiệu lực được dựng lại'};
  if(applicable&&!known)issues.push({reportId:r.id,reason:'Thiếu căn cứ kết quả legacy tại mốc bảo toàn'});
  basis.push({...value,id:await recordRevision(JSON.stringify([snapshotId,r.id]))});
 }
 return {basis,issues};
}
export function attachLegacyEarnedBasis(reports,basis,{required=false,rawReports=reports}={}){
 const rawById=new Map(rawReports.map(r=>[r.id,r]));
 const byReport=new Map(basis.map(b=>[b.reportId,b]));
 return reports.map(r=>{
  if(isDailyOutput(r))return r;
  const saved=byReport.get(r.id);
  if(!saved)return required&&r.kind==='completion'?{...r,legacyEarnedBasis:{kind:legacyEarnedModel,reportId:r.id,status:'missing',line:r.line||null,productionDate:outputDate(r),reason:'Chưa có mốc bảo toàn kết quả legacy; không dùng mức hiện tại thay thế'}}:r;
  const status=saved.sourceSignature===legacyEarnedSignature(rawById.get(r.id)||r)?saved.status:'stale';
  return {...r,...(status!=='stale'?structuredClone(saved.presentation||{}):{}),legacyEarnedBasis:{...structuredClone(saved),status,...(status==='stale'?{earned:null,reason:'Phiếu legacy đã thay đổi sau mốc bảo toàn; cần đối chiếu lại'}:{})}};
 });
}
export function earnedReportBasis(report,legacyStandard){
 if(isDailyOutput(report))return {unit:report.rateBasis?.value??null,earned:dailyEarnedHours(report),source:'Theo ngày sản xuất'};
 const b=report.legacyEarnedBasis;
 if(b?.kind===legacyEarnedModel)return {unit:b.status==='resolved'?b.unit:null,earned:b.status==='resolved'?b.earned:null,source:b.status==='resolved'?'Kết quả legacy được bảo toàn':'Thiếu căn cứ kết quả legacy'};
 const quantity=number(report.approvedQuantity??report.reportedQuantity);
 return {unit:legacyStandard.unit,earned:quantity===null||legacyStandard.unit===null?null:quantity*legacyStandard.unit,source:legacyStandard.source};
}

export const legacyPresentationFields=['standardUnit','hours','hourStatus','laborNotes','unresolvedAttendance','pendingAttendance','sourcePeriodHours','sourceLaborHours','standardLaborHours','laborDeviation','unallocatedHours','count','employees','employeeDetails','actorId','reportedById','reviewedById'];
export function observedPresentation(report){return Object.fromEntries(legacyPresentationFields.filter(k=>report[k]!==undefined).map(k=>[k,structuredClone(report[k])]));}

// Only unchanged, anchored reports may override live journal calculations.
export function preservedJournalPresentation(report){
 const b=report.legacyEarnedBasis;
 return b?.kind===legacyEarnedModel&&b.status!=='stale'&&b.presentation?b.presentation:{};
}
export function preservedJournalFinalIds(reports,calculated){
 const result=new Set(calculated);
 for(const r of reports){const p=preservedJournalPresentation(r);if(typeof p.legacyJournalFinal==='boolean'){result.delete(r.id);if(p.legacyJournalFinal)result.add(r.id);}}
 return result;
}
