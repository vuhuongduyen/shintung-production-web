import {effectiveValueOn,validBusinessDate} from './effective-dated-value.mjs';

export function laborUpdatedDate(value){
 if(validBusinessDate(value))return value;
 if(typeof value!=='string'||!/(Z|[+-]\d\d:\d\d)$/.test(value)||!Number.isFinite(Date.parse(value)))return null;
 return new Date(Date.parse(value)+7*3600000).toISOString().slice(0,10);
}
const isTest=v=>v?.isTest===true||v?.usage==='test'||v?.status==='test';
const revision=v=>Number.isInteger(Number(v))&&Number(v)>0?Number(v):null;
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
// Read projection only. Never write inferred versions back into a master/report.
// Each version uses its effective date, otherwise its own update date.
export function laborRateTimeline(record,history=[]){
 const explicit=structuredClone(record?.effectiveVersions||[]);
 const published=explicit.filter(v=>v.status==='published');
 if(published.some(v=>!effectiveValueOn(explicit,v.validFrom).ok))return {versions:explicit,issues:['invalid-effective-history']};
 const sku=String(record?.sku||'').trim().toUpperCase(),events=[],issues=[];
 const audit=history.map(row=>({row,h:row.payload||row})).filter(({h})=>String(h.sku||'').trim().toUpperCase()===sku);
 const excluded=new Set([...audit.filter(({row})=>row.rateSource!=='pdf-baseline').map(({h})=>({value:h,rev:h.version})),{value:record,rev:record?.version},...explicit.map(v=>({value:v,rev:v.revision}))].filter(({value,rev})=>isTest(value)&&revision(rev)!=null).map(({rev})=>revision(rev)));
 const blocked=(v,rev)=>isTest(v)||excluded.has(revision(rev));
 const explicitRevisions=new Set(published.map(v=>Number(v.revision)).filter(Number.isFinite));
 const add=(h,id,value,at,baseline=false)=>{
  if(baseline?isTest(h):blocked(h,h.version)){issues.push('excluded-test:'+id);return;}
  if(!amount(value))return;
  const hasEffectiveDate=h.effectiveFrom!=null&&h.effectiveFrom!=='';
  const date=hasEffectiveDate?(validBusinessDate(h.effectiveFrom)?h.effectiveFrom:null):laborUpdatedDate(at);
  if(!date){issues.push('missing-or-invalid-date:'+id);return;}
  if(!baseline&&explicitRevisions.has(Number(h.version)))return;
  events.push({id:'labor-history:'+sku+':'+id,status:'published',validFrom:date,value,revision:Number(h.version)||1,source:h.source||'Menu Giờ công',dateBasis:hasEffectiveDate?'effective-date':'updated-date',recordedAt:at||null});
 };
 for(const {row,h} of audit){add(h,h.id||row.key||'V'+h.version,h.newLaborHour,h.at||row.updatedAt,row.rateSource==='pdf-baseline');}
 const currentHasAudit=audit.some(({row,h})=>revision(h.version)!=null&&revision(h.version)===revision(record?.version)&&(row.rateSource!=='pdf-baseline'||h.newLaborHour===record?.laborHour&&(h.at||row.updatedAt)===(record?.updatedAt||record?.configuredAt)));
 // Generated PDF V1 belongs to a separate source, not the live revision sequence.
 // With no live audit row for the current legacy version, its own update timestamp
 // is evidence only from that day onward, never from a guessed earlier date.
 if(!published.some(v=>revision(v.revision)==null)&&!currentHasAudit)add(record||{},'current-V'+(record?.version||0),record?.laborHour,record?.updatedAt||record?.configuredAt);
 events.sort((a,b)=>a.validFrom.localeCompare(b.validFrom)||String(a.recordedAt||'').localeCompare(String(b.recordedAt||''))||a.revision-b.revision||a.id.localeCompare(b.id));
 if(!events.length&&!published.some(v=>blocked(v,v.revision)))return {versions:explicit,issues};
 const activeExplicit=[...new Set(published.map(v=>v.validFrom))].map(date=>{const resolved=effectiveValueOn(explicit,date);return published.find(v=>v.id===resolved.basis.versionId);}).filter(v=>{if(blocked(v,v.revision)){issues.push('excluded-test:'+v.id);return false;}return true;});
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
