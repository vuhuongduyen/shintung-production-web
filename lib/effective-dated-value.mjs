export const validBusinessDate=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
// A correction adds a linked revision. The old version remains intact so that
// existing snapshots and the before/after audit can still identify its value.
function activePublishedVersions(versions){
 if(!Array.isArray(versions))return null;
 const published=versions.filter(v=>v?.status==='published'),byId=new Map(),superseded=new Set();
 for(const v of published){
  if(!v.id||byId.has(v.id)||!validBusinessDate(v.validFrom)||v.validTo!=null&&(!validBusinessDate(v.validTo)||v.validTo<=v.validFrom)||typeof v.value!=='number'||!Number.isFinite(v.value)||v.value<0)return null;
  byId.set(v.id,v);
 }
 for(const v of published){
  if(v.supersedesVersionId==null)continue;
  const old=byId.get(v.supersedesVersionId);
  if(!old||old.id===v.id||old.validFrom!==v.validFrom||superseded.has(old.id)||v.revision!=null&&old.revision!=null&&v.revision<=old.revision)return null;
  superseded.add(old.id);
 }
 for(const v of published){
  const seen=new Set();let cursor=v;
  while(cursor){if(seen.has(cursor.id))return null;seen.add(cursor.id);cursor=byId.get(cursor.supersedesVersionId);}
 }
 return published.filter(v=>!superseded.has(v.id));
}
// Published business dates only. Recorded-at is evidence, never a substitute for
// an effective date. A stored snapshot is authoritative for its original day.
export function effectiveValueOn(versions,date,snapshot=null){
 if(!validBusinessDate(date))return {ok:false,reason:'invalid-date'};
 if(snapshot){
  if(snapshot.productionDate!==date||snapshot.value===undefined||!snapshot.versionId)return {ok:false,reason:'invalid-snapshot'};
  return {ok:true,basis:structuredClone(snapshot)};
 }
 const published=activePublishedVersions(versions||[]);
 if(!published)return {ok:false,reason:'invalid-version'};
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
 const prior=structuredClone(versions||[]),published=activePublishedVersions(prior);
 if(!published)throw Error('Lịch sử hiệu lực chưa hợp lệ; cần đối chiếu trước khi thêm mức.');
 for(const v of published)if(!effectiveValueOn(prior,v.validFrom).ok)throw Error('Lịch sử hiệu lực chưa hợp lệ; cần đối chiếu trước khi thêm mức.');
 if(prior.some(v=>v.id===next.id))throw Error('Version ID phải mới và ổn định.');
 const sameDay=published.find(v=>v.validFrom===next.validFrom);
 if(sameDay)return appendEffectiveVersion(prior,{...structuredClone(next),validTo:sameDay.validTo??null,supersedesVersionId:sameDay.id});
 const previous=published.filter(v=>v.validFrom<next.validFrom).sort((a,b)=>b.validFrom.localeCompare(a.validFrom))[0];
 const later=published.filter(v=>v.validFrom>next.validFrom).sort((a,b)=>a.validFrom.localeCompare(b.validFrom))[0];
 const end=previous?.validTo&&previous.validTo>next.validFrom?previous.validTo:later?.validFrom??null;
 if(previous&&(previous.validTo==null||previous.validTo>next.validFrom))previous.validTo=next.validFrom;
 return appendEffectiveVersion(prior,{...structuredClone(next),validTo:end});
}
