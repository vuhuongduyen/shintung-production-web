import {effectiveValueOn,validBusinessDate} from './effective-dated-value.mjs';

export function laborUpdatedDate(value){
 if(validBusinessDate(value))return value;
 if(typeof value!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))return null;
 return new Date(Date.parse(value)+7*3600000).toISOString().slice(0,10);
}
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
// Read projection only. Never write inferred versions back into a master/report.
// Each version uses its effective date, otherwise its own update date.
export function laborRateTimeline(record,history=[]){
 const explicit=structuredClone(record?.effectiveVersions||[]);
 const published=explicit.filter(v=>v.status==='published');
 if(published.some(v=>!effectiveValueOn(explicit,v.validFrom).ok))return {versions:explicit,issues:['invalid-effective-history']};
 const explicitRevisions=new Set(published.map(v=>Number(v.revision)).filter(Number.isFinite));
 const sku=String(record?.sku||'').toUpperCase(),events=[],issues=[];
 const add=(h,id,value,at)=>{
  if(!amount(value))return;
  const hasEffectiveDate=h.effectiveFrom!=null&&h.effectiveFrom!=='';
  const date=hasEffectiveDate?(validBusinessDate(h.effectiveFrom)?h.effectiveFrom:null):laborUpdatedDate(at);
  if(!date){issues.push('missing-or-invalid-date:'+id);return;}
  if(explicitRevisions.has(Number(h.version)))return;
  if(h.isTest===true||h.usage==='test'||h.status==='test'){issues.push('excluded-test:'+id);return;}
  events.push({id:'labor-history:'+sku+':'+id,status:'published',validFrom:date,value,revision:Number(h.version)||1,source:h.source||'Menu Giờ công',dateBasis:hasEffectiveDate?'effective-date':'updated-date',recordedAt:at||null});
 };
 for(const row of history){const h=row.payload||row;if(String(h.sku||'').toUpperCase()!==sku)continue;add(h,h.id||row.key||'V'+h.version,h.newLaborHour,h.at||row.updatedAt);}
 // With no audit row for the current legacy version, its own update timestamp
 // is evidence only from that day onward, never from a guessed earlier date.
 if(!published.length&&!history.some(row=>{const h=row.payload||row;return String(h.sku||'').toUpperCase()===sku&&Number(h.version)===Number(record?.version)&&h.newLaborHour===record?.laborHour&&laborUpdatedDate(h.at||row.updatedAt)===laborUpdatedDate(record?.updatedAt||record?.configuredAt);}))add(record||{},'current-V'+(record?.version||0),record?.laborHour,record?.updatedAt||record?.configuredAt);
 events.sort((a,b)=>a.validFrom.localeCompare(b.validFrom)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||''))||a.revision-b.revision||a.id.localeCompare(b.id));
 if(!events.length)return {versions:explicit,issues};
 const activeExplicit=[...new Set(published.map(v=>v.validFrom))].map(date=>{const resolved=effectiveValueOn(explicit,date);return published.find(v=>v.id===resolved.basis.versionId);});
 const combined=[...events,...activeExplicit].sort((a,b)=>a.validFrom.localeCompare(b.validFrom)||(Number(a.revision)||1)-(Number(b.revision)||1)||String(a.recordedAt||a.publishedAt||'').localeCompare(String(b.recordedAt||b.publishedAt||''))||a.id.localeCompare(b.id));
 const dates=new Map();for(const e of combined)dates.set(e.validFrom,e);
 const active=[...dates.values()].map(v=>({...v}));
 for(let i=0;i<active.length;i++){const next=active[i+1]?.validFrom;delete active[i].supersedesVersionId;if(next&&(!active[i].validTo||next<active[i].validTo))active[i].validTo=next;}
 return {versions:active,issues};
}
export function previewLaborRateBackfill(reports,menuBySku){
 return reports.map(report=>{
  if(report.rateBasis||report.standardUnit!=null||report.legacyEarnedBasis?.status==='resolved')return {reportId:report.id,status:'preserve-saved-basis'};
  const date=validBusinessDate(report.productionDate)?report.productionDate:laborUpdatedDate(report.completedAt),sku=report.sku||report.orderSnapshot?.sku||report.legacyEarnedBasis?.sku,menu=menuBySku.get(String(sku||'').toUpperCase());
  const result=effectiveValueOn(menu?.resolvedRateVersions||menu?.effectiveVersions||[],date);
  return {reportId:report.id,sku,date,status:result.ok?(report.reviewStatus==='Đã xác nhận'||report.closedAt?'review-required-locked':'proposed-only'):'unresolved',...(result.ok?{proposedBasis:result.basis}:{reason:result.reason})};
 });
}
