export const validBusinessDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
// Published business dates only. Recorded-at is evidence, never a substitute for
// an effective date. A stored snapshot is authoritative for its original day.
export function effectiveValueOn(versions,date,snapshot=null){
 if(!validBusinessDate(date))return {ok:false,reason:'invalid-date'};
 if(snapshot){
  if(snapshot.productionDate!==date||snapshot.value===undefined||!snapshot.versionId)return {ok:false,reason:'invalid-snapshot'};
  return {ok:true,basis:structuredClone(snapshot)};
 }
 const published=(versions||[]).filter(v=>v.status==='published');
 if(published.some(v=>!v.id||!validBusinessDate(v.validFrom)||v.validTo!=null&&(!validBusinessDate(v.validTo)||v.validTo<=v.validFrom)||v.value===undefined))return {ok:false,reason:'invalid-version'};
 const candidates=published.filter(v=>v.validFrom<=date&&(v.validTo==null||date<v.validTo));
 if(candidates.length!==1)return {ok:false,reason:candidates.length?'ambiguous':'missing'};
 const v=candidates[0];return {ok:true,basis:structuredClone({kind:'effective-version',versionId:v.id,revision:v.revision??1,value:v.value,productionDate:date,validFrom:v.validFrom,validTo:v.validTo??null,source:v.source??null,publishedAt:v.publishedAt??null})};
}
export function appendEffectiveVersion(versions,next){
 if(!next?.id||(versions||[]).some(v=>v.id===next.id))throw Error('Version ID phải mới và ổn định.');
 const result=structuredClone([...(versions||[]),next]);
 for(const v of result.filter(v=>v.status==='published')){
  const resolved=effectiveValueOn(result,v.validFrom);
  if(!resolved.ok)throw Error('Khoảng hiệu lực không hợp lệ hoặc chồng lấn; không thay đổi lịch sử.');
 }
 return result;
}

// Insert a new dated value without replacing any old value or report snapshot.
// Interval boundaries are revisions recorded by the caller's existing audit.
export function publishEffectiveValue(versions,next){
 if(!next||next.status!=='published'||!validBusinessDate(next.validFrom)||!next.id||typeof next.value!=='number'||!Number.isFinite(next.value)||next.value<0)throw Error('Mức hoặc ngày hiệu lực không hợp lệ.');
 const prior=structuredClone(versions||[]),published=prior.filter(v=>v.status==='published');
 for(const v of published)if(!effectiveValueOn(prior,v.validFrom).ok)throw Error('Lịch sử hiệu lực chưa hợp lệ; cần đối chiếu trước khi thêm mức.');
 if(prior.some(v=>v.id===next.id)||published.some(v=>v.validFrom===next.validFrom))throw Error('Đã có mức tại ngày hiệu lực này; không ghi đè lịch sử.');
 const previous=published.filter(v=>v.validFrom<next.validFrom).sort((a,b)=>b.validFrom.localeCompare(a.validFrom))[0];
 const later=published.filter(v=>v.validFrom>next.validFrom).sort((a,b)=>a.validFrom.localeCompare(b.validFrom))[0];
 const end=previous?.validTo&&previous.validTo>next.validFrom?previous.validTo:later?.validFrom??null;
 if(previous&&(previous.validTo==null||previous.validTo>next.validFrom))previous.validTo=next.validFrom;
 return appendEffectiveVersion(prior,{...structuredClone(next),validTo:end});
}
