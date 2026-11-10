import {recordRevision} from './record-revision.mjs';
import {laborReferenceBinding,applyFixedLaborReferences} from './production-labor-reference-snapshot.mjs';
import {earnedReportBasis} from './production-legacy-earned-basis.mjs';
import {laborRateIdentity} from './production-labor-reference.mjs';
import {isDailyOutput} from './production-daily-output.mjs';
import {hasFinishedOutput,outputDate} from './production-output-summary.mjs';
export const menuPreservationModel='labor-menu-preservation-v1';
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
export const preservationDigest=v=>recordRevision(JSON.stringify(canonical(v)));
const number=v=>v===null||v===undefined||String(v).trim()===''?null:Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
// Observed menu output, NOT an effective version retroactively assigned to a day.
export async function previewMenuPreservation({reports,orders,menu,parentManifest,month,observedAt}){
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||month<'2026-10'||!Number.isFinite(Date.parse(observedAt)))throw Error('Invalid preservation scope or observation time.');
 if(parentManifest?.kind!=='labor-reference-snapshot-v1')throw Error('A verified prior registry is required.');
 await applyFixedLaborReferences([],parentManifest,orders);
 const bySku=new Map(menu.map(r=>[String(r.payload?.sku||r.key).trim().toUpperCase(),r])),byOrder=new Map(orders.map(o=>[o.id,o])),entries=[],rows=[];
 for(const report of reports){
  if(!hasFinishedOutput(report)||report.reviewStatus!=='Đã xác nhận'||outputDate(report).slice(0,7)!==month)continue;
  const sku=laborRateIdentity(report,byOrder.get(report.transitId)).sku,master=bySku.get(sku),p=master?.payload,stored=earnedReportBasis(report),qty=Number(report.approvedQuantity??report.reportedQuantity);
  if(!Number.isFinite(qty)||qty<0)throw Error('Invalid period quantity.');
  const protectedBasis=isDailyOutput(report)||!!report.rateBasis||report.standardUnit!=null&&report.standardUnit!==''||report.legacyEarnedBasis&&report.legacyEarnedBasis.status!=='missing';
  const unit=stored.unit??(!protectedBasis&&p&&!p.cancelled&&!p._deleted&&p.status!=='Đã hủy'&&!p.isTest&&!p.testOnly&&!p.currentRateIssue?number(p.laborHour):null);
  const row={reportId:report.id,orderId:report.transitId,sku,date:outputDate(report),quantity:qty,unit,earned:unit===null?null:qty*unit,status:stored.unit!==null?'preserve-stored':protectedBasis?'preserve-unresolved':unit===null?'missing':'observed-menu'};
  rows.push(row);
  if(stored.unit!==null||protectedBasis)continue;
  entries.push({reportId:report.id,binding:await laborReferenceBinding(report,orders),reference:{kind:'observed-menu-labor-reference-v1',status:unit===null?'missing':'resolved',sku,productionDate:row.date,unit,quantity:qty,observedAt,menuRevision:master?await preservationDigest({key:master.key,value:unit,version:p.version??null,updatedAt:p.updatedAt||master.updatedAt||null}):null,source:'Menu Giờ công tại lần bảo toàn'}});
 }
 if(new Set(reports.map(r=>r.id)).size!==reports.length)throw Error('Duplicate report identity.');
 const manifest={kind:menuPreservationModel,month,observedAt,parentManifest,observedReportIds:reports.map(r=>r.id).sort(),entries};
 return {manifest:{...manifest,digest:await preservationDigest(manifest)},rows,counts:rows.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),summary:{reports:rows.length,orders:new Set(rows.map(r=>r.orderId)).size,quantity:rows.reduce((s,r)=>s+r.quantity,0),knownEarned:rows.reduce((s,r)=>s+(r.earned??0),0)}};
}
export async function applyMenuPreservation(reports,manifest,orders=[]){
 const {digest,...body}=manifest||{};
 if(body.kind!==menuPreservationModel||await preservationDigest(body)!==digest||!Array.isArray(body.observedReportIds)||new Set(body.observedReportIds).size!==body.observedReportIds.length||new Set(body.entries.map(e=>e.reportId)).size!==body.entries.length)throw Error('Invalid menu preservation registry.');
 const observed=new Set(body.observedReportIds),entries=new Map(body.entries.map(e=>[e.reportId,e]));
 if(body.entries.some(e=>!observed.has(e.reportId)))throw Error('Preservation entry is outside captured inventory.');
 const prior=await applyFixedLaborReferences(reports.filter(r=>observed.has(r.id)),body.parentManifest,orders),byId=new Map(prior.map(r=>[r.id,r]));
 const result=[];
 for(const report of reports){
  const entry=entries.get(report.id);
  if(!entry){const {laborReference,...original}=report;result.push(byId.get(report.id)||(earnedReportBasis(report).unit!==null?report:original));continue;}
  const {laborReference,...original}=report;
  if(earnedReportBasis(original).unit!==null){result.push(report);continue;}
  if(entry.binding!==await laborReferenceBinding(original,orders)){result.push(original);continue;}
  result.push({...original,laborReference:{...structuredClone(entry.reference),frozen:true,snapshotDigest:digest}});
 }
 return result;
}
