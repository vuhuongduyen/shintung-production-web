import {effectiveValueOn,publishEffectiveValue,validBusinessDate} from './effective-dated-value.mjs';
import {isMasterCancelled} from './basic-master.mjs';

export const laborBusinessDate=(instant=new Date().toISOString())=>new Date(Date.parse(instant)+25200000).toISOString().slice(0,10);

// Shared by the hosted Worker and local TEST API. Only the caller's CAS batch
// persists this proposal; creating it never changes a report or closed Plan.
export function buildLaborHoursRevision({old,sku,value,effectiveFrom,note,source,reason,actor,now,mode}){
 if(!validBusinessDate(effectiveFrom))throw Object.assign(Error('Vui lòng nhập ngày hiệu lực hợp lệ của Giờ công/SP.'),{status:422});
 if(isMasterCancelled(old))throw Object.assign(Error('Giờ công đã Hủy, không được sửa để tự áp dụng lại.'),{status:409});
 const version=Number(old?.version||0)+1;
 const next={id:crypto.randomUUID(),status:'published',validFrom:effectiveFrom,value,revision:version,source,reason:reason||'Thêm mới Giờ công/SP',publishedAt:now,publishedBy:actor};
 let effectiveVersions;
 try{effectiveVersions=publishEffectiveValue(old?.effectiveVersions||[],next);}catch(error){throw Object.assign(error,{status:409});}
 const today=laborBusinessDate(now),prior=effectiveValueOn(old?.effectiveVersions||[],effectiveFrom),resolved=effectiveValueOn(effectiveVersions,today);
 // The undated scalar is an observed legacy value, not evidence for a past
 // business day. Retain it across future revisions for legacy consumers only.
 const legacyCurrentObservation=old?.legacyCurrentObservation||(!old?.effectiveVersions?.length&&effectiveFrom>today&&typeof old?.laborHour==='number'&&Number.isFinite(old.laborHour)?{value:old.laborHour,observedAt:now,source:'undated-master-before-future-publication'}:null);
 const beforeFirstVersion=effectiveVersions.filter(v=>v.status==='published').every(v=>v.validFrom>today);
 const retainedLegacyValue=beforeFirstVersion&&typeof legacyCurrentObservation?.value==='number'&&Number.isFinite(legacyCurrentObservation.value)?legacyCurrentObservation.value:null;
 const published=effectiveVersions.at(-1);
 const current={...old,sku,laborHour:resolved.ok?resolved.basis.value:retainedLegacyValue,note,source,configuredAt:old?.configuredAt||now,updatedAt:now,updatedBy:actor,version,effectiveVersions,...(legacyCurrentObservation?{legacyCurrentObservation}:{})};
 const history={id:crypto.randomUUID(),sku,version,oldLaborHour:prior.ok?prior.basis.value:null,newLaborHour:value,previousCurrentLaborHour:old?.laborHour??null,oldNote:old?.note||'',newNote:note,reason:mode==='edit'?reason:'Thêm mới Giờ công/SP',actor,at:now,source,effectiveFrom,versionId:published.id,supersedesVersionId:published.supersedesVersionId??null,effectiveVersionsBefore:old?.effectiveVersions||[],effectiveVersionsAfter:effectiveVersions};
 return {current,history};
}
