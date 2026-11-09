import {isDailyOutput,dailyEarnedHours} from './production-daily-output.mjs';
import {hasFinishedOutput,outputDate} from './production-output-summary.mjs';
import {recordRevision} from './record-revision.mjs';
import {effectiveValueOn,validBusinessDate} from './effective-dated-value.mjs';
export const legacyEarnedModel='observed-legacy-earned-v1';
const number=value=>!['number','string'].includes(typeof value)||String(value).trim()===''?null:Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
// Deliberately does not hash current master data: later master edits must not
// invalidate an observed result. Explicit report corrections require review.
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().filter(k=>value[k]!==undefined).map(k=>[k,canonical(value[k])])):value;
export const legacyEarnedSignature=r=>recordRevision(JSON.stringify(canonical(r)));
// Historical pay must use evidence stored with the report, never a mutable
// order/planning estimate or today's scalar master. Actual labor hours are not
// a substitute for standard hours per product.
export function storedLegacyEarnedBasis(report){
 const date=outputDate(report),quantity=number(report.approvedQuantity??report.reportedQuantity);
 const stored=number(report.standardUnit),hasStored=report.standardUnit!==null&&report.standardUnit!==undefined&&String(report.standardUnit).trim()!=='';
 const snapshot=report.rateBasis?effectiveValueOn([],date,report.rateBasis):null;
 const dated=snapshot?.ok?number(snapshot.basis.value):null;
 const invalid=!validBusinessDate(date)||hasStored&&stored===null||snapshot&&(!snapshot.ok||dated===null)||stored!==null&&dated!==null&&stored!==dated;
 const unit=invalid?null:dated??stored;
 return {unit,earned:unit===null||quantity===null?null:quantity*unit,source:unit===null?'Thiếu căn cứ định mức lịch sử':snapshot?'Định mức hiệu lực lưu cùng phiếu':'Định mức lưu cùng phiếu'};
}
export async function captureLegacyEarnedBasis({orders,reports,standards,snapshotId,observedAt,rawReports=reports}){
 if(!snapshotId||!Number.isFinite(Date.parse(observedAt)))throw Error('Thiếu định danh/thời điểm bảo toàn kết quả.');
 const byOrder=new Map(orders.map(o=>[o.id,o])),rawById=new Map(rawReports.map(r=>[r.id,r])),basis=[],issues=[];
 for(const r of reports){
  if(isDailyOutput(r)||r.kind!=='completion')continue;
  const raw=rawById.get(r.id)||r,order=byOrder.get(r.transitId),quantity=number(r.approvedQuantity??r.reportedQuantity),unit=storedLegacyEarnedBasis(raw).unit,productionDate=outputDate(r),presentation=observedPresentation(r);
  // A derived/read projection cannot promote today's rate to stored evidence.
  if(raw.standardUnit===undefined)delete presentation.standardUnit;else presentation.standardUnit=structuredClone(raw.standardUnit);
  const applicable=hasFinishedOutput(r)&&r.reviewStatus==='Đã xác nhận';
  const known=!!order&&['A','B','C'].includes(order.line)&&!!productionDate&&quantity!==null&&unit!==null;
  const value={kind:legacyEarnedModel,snapshotId,reportId:r.id,sourceSignature:await legacyEarnedSignature(raw),sourceSignatureFormat:'sha256-canonical-v1',presentation,status:!applicable?'not-applicable':known?'resolved':'missing',orderSnapshot:order?Object.fromEntries(['id','planId','planGroupId','lsxCode','sku','name','spec','line','lsxQty','processes','planStart','planEnd','actualStartedAt','actualCompletedAt','standardLeadtime'].filter(k=>order[k]!==undefined).map(k=>[k,structuredClone(order[k])])):null,planId:order?.planId??r.planId??null,lsxQty:order?.lsxQty??null,line:order?.line??r.line??null,sku:order?.sku??r.sku??null,lsxCode:order?.lsxCode??r.lsxCode??null,name:order?.name??r.name??null,spec:order?.spec??r.spec??null,productionDate,quantity,unit,earned:applicable&&known?quantity*unit:null,observedAt,source:'Căn cứ lưu cùng phiếu legacy; không phải lịch sử hiệu lực được dựng lại'};
  if(applicable&&!known)issues.push({reportId:r.id,reason:'Thiếu căn cứ kết quả legacy tại mốc bảo toàn'});
  basis.push({...value,id:await recordRevision(JSON.stringify([snapshotId,r.id]))});
 }
 return {basis,issues};
}
export async function attachLegacyEarnedBasis(reports,basis,{required=false,rawReports=reports}={}){
 const rawById=new Map(rawReports.map(r=>[r.id,r]));
 const byReport=new Map(basis.map(b=>[b.reportId,b]));
 const attach=async r=>{
  if(isDailyOutput(r))return r;
  const saved=byReport.get(r.id);
  if(!saved)return required&&r.kind==='completion'?{...r,legacyEarnedBasis:{kind:legacyEarnedModel,reportId:r.id,status:'missing',line:r.line||null,productionDate:outputDate(r),reason:'Chưa có mốc bảo toàn kết quả legacy; không dùng mức hiện tại thay thế'}}:r;
  const source=rawById.get(r.id)||r,matches=saved.sourceSignatureFormat==='sha256-canonical-v1'?saved.sourceSignature===await legacyEarnedSignature(source):saved.sourceSignature===JSON.stringify(canonical(source));
  const status=matches?saved.status:'stale';
  const {presentation,sourceSignature,orderSnapshot,...metadata}=saved;
  // Do not send the raw source signature or a second employee/hour tree to clients.
  const journalPresentation=Object.fromEntries(['standardUnit','stageCumulativeHours','orderCumulativeHours','standardUnitHours','standardLaborHours','laborDeviation','legacyJournalFinal'].filter(k=>presentation?.[k]!==undefined).map(k=>[k,presentation[k]]));
  return {...r,...(status!=='stale'?structuredClone(presentation||{}):{}),legacyEarnedBasis:{...structuredClone(metadata),journalPresentation,status,...(status==='stale'?{earned:null,reason:'Phiếu legacy đã thay đổi sau mốc bảo toàn; cần đối chiếu lại'}:{})}};
 };
 const result=[];for(let i=0;i<reports.length;i+=32)result.push(...await Promise.all(reports.slice(i,i+32).map(attach)));return result;
}
export function earnedReportBasis(report,legacyStandard){
 if(isDailyOutput(report))return {unit:report.rateBasis?.value??null,earned:dailyEarnedHours(report),source:'Theo ngày sản xuất'};
 const b=report.legacyEarnedBasis;
 if(b?.kind===legacyEarnedModel)return {unit:b.status==='resolved'?b.unit:null,earned:b.status==='resolved'?b.earned:null,source:b.status==='resolved'?'Kết quả legacy được bảo toàn':'Thiếu căn cứ kết quả legacy'};
 return storedLegacyEarnedBasis(report);
}

export const legacyPresentationFields=['standardUnit','hours','hourStatus','laborNotes','unresolvedAttendance','pendingAttendance','sourcePeriodHours','sourceLaborHours','standardLaborHours','laborDeviation','unallocatedHours','count','employees','employeeDetails','actorId','reportedById','reviewedById'];
export function observedPresentation(report){return Object.fromEntries(legacyPresentationFields.filter(k=>report[k]!==undefined).map(k=>[k,structuredClone(report[k])]));}

// Only unchanged, anchored reports may override live journal calculations.
export function preservedJournalPresentation(report){
 const b=report.legacyEarnedBasis;
 return b?.kind===legacyEarnedModel&&b.status!=='stale'&&b.journalPresentation?b.journalPresentation:{};
}
export function preservedJournalFinalIds(reports,calculated){
 const result=new Set(calculated);
 for(const r of reports){const p=preservedJournalPresentation(r);if(typeof p.legacyJournalFinal==='boolean'){result.delete(r.id);if(p.legacyJournalFinal)result.add(r.id);}}
 return result;
}
