// Internal preparation only: no HTTP route, policy activation or production execution.
// Publication writes isolated snapshot-keyed anchors; runtime ignores them until manifest is complete.
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {previewLegacyPreservation,legacySourceCondition} from './production-legacy-snapshot.mjs';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const raw=(db,entity,key)=>db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();
const targets=['production_legacy_basis','production_legacy_month','production_legacy_order'];
const verified='production_legacy_verified';
const prefix=id=>JSON.stringify([id]).slice(0,-1)+',';
function access(actor,sourceId){if(!actor?.isAdmin||actor.line||!actor.login)fail('Chỉ Admin toàn quyền được chuẩn bị mốc bảo toàn.',403);if(typeof sourceId!=='string'||!/^[a-f0-9]{64}$/.test(sourceId))fail('Thiếu định danh build máy chủ.',503);}
async function manifest(db,id,actor,sourceId){access(actor,sourceId);if(typeof id!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(id))fail('Định danh snapshot không hợp lệ.',422);const row=await raw(db,'production_legacy_manifest',id);if(!row)fail('Không tìm thấy mốc nguồn.',404);const value=JSON.parse(row.payload);if(value.sourceId!==sourceId||value.captureModel!=='observed-source-records-v1')fail('Mốc không khớp source build.');return {row,value};}
const emptyGuard=(entity,key)=>({sql:'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)',args:[entity,key]});
export function legacyPublicationArtifactsCondition(id,plan){
 const p=prefix(id),expected=plan.targetCounts;
 const comparison=`NOT EXISTS(SELECT 1 FROM app_records v LEFT JOIN app_records a ON a.entity=json_extract(v.record_key,'$[1]') AND a.record_key=json_extract(v.record_key,'$[2]') WHERE v.entity=? AND v.record_key>=? AND v.record_key<? AND (a.payload IS NULL OR a.payload IS NOT v.payload))`;
 const counts=targets.map(()=>"(SELECT count(*) FROM app_records WHERE entity=? AND record_key>=? AND record_key<?)=?");
 return {sql:[comparison,"(SELECT count(*) FROM app_records WHERE entity=? AND record_key>=? AND record_key<?)=?",...counts].join(' AND '),args:[verified,p,p+'\uffff',verified,p,p+'\uffff',plan.recordCount,...targets.flatMap(e=>[e,id+':',id+';',expected[e]])]};
}
async function updateManifest(db,id,old,next,actor,checks=[],changes=[]){
 const now=new Date().toISOString(),token=crypto.randomUUID(),value={...next,publicationNonce:token},gate="EXISTS(SELECT 1 FROM app_records WHERE entity='production_legacy_manifest' AND record_key=? AND json_extract(payload,'$.publicationNonce')=?)";
 const statements=[db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_legacy_manifest' AND record_key=? AND payload=?${checks.length?' AND '+checks.map(c=>'('+c.sql+')').join(' AND '):''}`).bind(JSON.stringify(value),actor.login,now,id,old,...checks.flatMap(c=>c.args))];
 for(const r of changes)statements.push(db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE ${gate}`).bind(r.entity,r.key,r.payload,actor.login,now,id,token));
 const result=await db.batch(statements);if(result[0].meta.changes!==1)fail(conflictMessage);return value;
}
export async function prepareLegacyPublication(db,{snapshotId},actor,{sourceId}={}){
 const {row,value}=await manifest(db,snapshotId,actor,sourceId),proposed=await previewLegacyPreservation(db,{snapshotId},actor,{sourceId});if(!proposed.sourceStillMatches)fail('Nguồn live đã đổi; chuẩn bị mốc mới, không chốt dữ liệu trộn.');
 const entries=[...proposed.basis.map(x=>({entity:targets[0],key:snapshotId+':'+x.id,payload:JSON.stringify(x)})),...proposed.monthly.map(x=>({entity:targets[1],key:snapshotId+':'+x.month,payload:JSON.stringify(x)})),...proposed.orders.map(x=>({entity:targets[2],key:snapshotId+':'+x.orderId,payload:JSON.stringify(x)}))];
 if(new Set(entries.map(x=>JSON.stringify([x.entity,x.key]))).size!==entries.length)fail('Trùng khóa anchor; cần đối chiếu nguồn.');
 const chunks=[];let chunk=[],bytes=0;for(const r of entries){const n=new TextEncoder().encode(JSON.stringify(r)).length;if(n>128*1024)fail('Một anchor vượt 128 KiB; cần kế hoạch phân trang riêng, không bỏ dữ liệu.',422);if(chunk.length&&(chunk.length>=8||bytes+n>128*1024)){chunks.push(chunk);chunk=[];bytes=0;}chunk.push(r);bytes+=n;}if(chunk.length)chunks.push(chunk);
 if(chunks.length>2048)fail('Mốc vượt giới hạn chuẩn bị hiện tại; cần kế hoạch chia lô lớn hơn.',422);
 const digest=await recordRevision(JSON.stringify(entries)),plan={digest,recordCount:entries.length,targetCounts:Object.fromEntries(targets.map(e=>[e,entries.filter(x=>x.entity===e).length])),chunks:await Promise.all(chunks.map(async records=>({hash:await recordRevision(JSON.stringify(records)),count:records.length}))),scope:proposed.manifest.scope,counts:proposed.manifest.counts,missingEarned:proposed.manifest.missingEarned,next:0};
 if(new TextEncoder().encode(JSON.stringify({...value,status:'staging',publication:plan})).length>256*1024)fail('Metadata mốc vượt 256 KiB; cần phân trang danh sách đối chiếu, không bỏ dữ liệu.',422);
 if(value.publication){if(value.publication.digest!==digest)fail('Kết quả đối chiếu khác kế hoạch đã chốt.');return {manifest:value,chunks,replayed:true};}
 if(value.status!=='captured')fail('Mốc không còn ở bước chuẩn bị.');
 const checks=targets.map(e=>({sql:'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key>=? AND record_key<?)',args:[e,snapshotId+':',snapshotId+';']}));checks.push({sql:'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key>=? AND record_key<?)',args:[verified,prefix(snapshotId),prefix(snapshotId)+'\uffff']});
 const saved=await updateManifest(db,snapshotId,row.payload,{...value,status:'staging',publication:plan},actor,checks);return {manifest:saved,chunks,replayed:false};
}
export async function publishLegacyChunk(db,{snapshotId,index,records},actor,{sourceId}={}){
 const {row,value}=await manifest(db,snapshotId,actor,sourceId),plan=value.publication;if(!plan||!Number.isInteger(index)||index<0||index>=plan.chunks.length||!Array.isArray(records)||records.length>8||await recordRevision(JSON.stringify(records))!==plan.chunks[index].hash)fail('Lô anchor không khớp kế hoạch đã đối chiếu.');
 if(records.some(r=>!targets.includes(r.entity)||typeof r.key!=='string'||!r.key.startsWith(snapshotId+':')||typeof r.payload!=='string'))fail('Lô có dữ liệu ngoài mốc.');
 if(index<plan.next){for(const r of records){const old=await raw(db,r.entity,r.key),copy=await raw(db,verified,JSON.stringify([snapshotId,r.entity,r.key]));if(old?.payload!==r.payload||copy?.payload!==r.payload)fail('Anchor đã ghi khác kế hoạch; không ghi đè khi thử lại.');}return {ok:true,replayed:true,next:plan.next};}
 if(value.status!=='staging'||index!==plan.next)fail('Chốt lô tuần tự theo kế hoạch; chưa được bỏ qua lô.');
 const checks=records.flatMap(r=>[emptyGuard(r.entity,r.key),emptyGuard(verified,JSON.stringify([snapshotId,r.entity,r.key]))]),changes=records.flatMap(r=>[r,{entity:verified,key:JSON.stringify([snapshotId,r.entity,r.key]),payload:r.payload}]);
 const saved=await updateManifest(db,snapshotId,row.payload,{...value,publication:{...plan,next:index+1}},actor,checks,changes);return {ok:true,replayed:false,next:saved.publication.next};
}
export async function finalizeLegacyPublication(db,{snapshotId},actor,{sourceId}={}){
 const {row,value}=await manifest(db,snapshotId,actor,sourceId),plan=value.publication;if(!plan||plan.next!==plan.chunks.length)fail('Chưa ghi đủ lô anchor; không đánh dấu complete.');if(value.status==='complete')return {...value,replayed:true};if(value.status!=='staging')fail('Mốc không ở bước hoàn tất.');
 const source=legacySourceCondition(snapshotId,value),artifacts=legacyPublicationArtifactsCondition(snapshotId,plan),next={...value,status:'complete',scope:plan.scope,counts:plan.counts,missingEarned:plan.missingEarned,completedAt:new Date().toISOString()};
 return updateManifest(db,snapshotId,row.payload,next,actor,[source,artifacts]);
}
