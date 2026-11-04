// Explicit internal preparation only. No route, activation, migration or source deletion.
import {readRecordPages} from './production-record-pages.mjs';
import {readProductionWorkflow} from './production-workflow.mjs';
import {captureLegacyPreservation} from '../../lib/production-legacy-preservation.mjs';
import {siteCatalog} from '../../lib/site-catalog.mjs';import {siteLaborHours} from '../../lib/site-labor-hours.mjs';
import {dailyToday} from './production-daily-output.mjs';import {validBusinessDate} from '../../lib/effective-dated-value.mjs';
export const legacySnapshotSources=['in_transit','production_event','production_report','production_history_import','employees','users','labor_hours','sku','leadtime','leadtime_versions','capacity','production_schedule','production_reporting_policy','production_cursor'];
const sourceIdentity=value=>{if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))fail('Cần định danh source từ bản build riêng của máy chủ; không dùng giá trị client.',503);return value;};
const entity='production_legacy_source',fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
function access(actor){if(!actor?.isAdmin||actor.line||!actor.login)fail('Chỉ Admin toàn quyền được chuẩn bị mốc bảo toàn.',403);}
function identity(id){if(typeof id!=='string'||!/^[A-Za-z0-9-]{16,80}$/.test(id))fail('Định danh snapshot không hợp lệ.',422);return JSON.stringify([id]).slice(0,-1)+',';}
const manifestRow=(db,id)=>db.prepare("SELECT payload FROM app_records WHERE entity='production_legacy_manifest' AND record_key=?").bind(id).first();
function relation(id){const prefix=identity(id);return `(SELECT json_extract(record_key,'$[1]') AS entity,json_extract(record_key,'$[2]') AS record_key,payload,updated_by,updated_at FROM app_records WHERE entity='${entity}' AND record_key>='${prefix}' AND record_key<'${prefix}\uffff')`;}
// Used only with trusted SELECTs from existing readers. Never expose as a SQL API.
export function legacySnapshotDatabase(db,id){const table=relation(id);return {prepare(sql){if(!/^\s*SELECT\b/i.test(sql)||!(/\bapp_records\b/i.test(sql))||/\b(auth_accounts|auth_sessions|pragma|sqlite_master)\b/i.test(sql))fail('Snapshot chỉ hỗ trợ đọc nghiệp vụ đã chốt.',403);return db.prepare(sql.replace(/\bapp_records\b/gi,table));},batch(){fail('Không được ghi qua snapshot đọc.',403);}};}
export async function captureLegacySource(db,{snapshotId,cutoverDate},actor,{sourceId}={}){
 access(actor);sourceIdentity(sourceId);const prefix=identity(snapshotId);
 if(!validBusinessDate(cutoverDate)||cutoverDate<dailyToday())fail('Chọn ngày chuyển đổi từ hôm nay; không dựng snapshot quá khứ.',422);
 const existing=await manifestRow(db,snapshotId);
 if(existing){const saved=JSON.parse(existing.payload);if(saved.captureModel!=='observed-source-records-v1'||saved.createdBy!==actor.login||saved.cutoverDate!==cutoverDate||saved.sourceId!==sourceId)fail('Định danh snapshot đã có nội dung/người chuẩn bị khác.');return {...saved,replayed:true};}
 if((await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity=? AND record_key>=? AND record_key<?").bind(entity,prefix,prefix+'\uffff').first()).n)fail('Có source snapshot chưa được đối chiếu; không ghi đè hoặc xóa.');
 const now=new Date().toISOString(),manifest={id:snapshotId,kind:'observed-production-baseline-v1',captureModel:'observed-source-records-v1',sourceId,cutoverDate,capturedAt:now,observedAt:now,createdBy:actor.login,status:'captured',sources:legacySnapshotSources,scope:{earned:false,reportPresentation:false,monthlyAttendance:false,orderMetadata:false}};
 // One atomic batch: all sources are copied before any live edit can interleave.
 // Payload and original metadata remain byte-exact; JSON is only used for the key.
 await db.batch([
  db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,json_array(?,entity,record_key),payload,updated_by,updated_at FROM app_records WHERE entity IN (SELECT value FROM json_each(?)) AND NOT EXISTS(SELECT 1 FROM app_records WHERE entity='production_legacy_manifest' AND record_key=?)").bind(entity,snapshotId,JSON.stringify(legacySnapshotSources),snapshotId),
  db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'production_legacy_manifest',?,json_set(?,'$.sourceCount',(SELECT count(*) FROM app_records WHERE entity=? AND record_key>=? AND record_key<?)),?,? WHERE NOT EXISTS(SELECT 1 FROM app_records WHERE entity='production_legacy_manifest' AND record_key=?)").bind(snapshotId,JSON.stringify(manifest),entity,prefix,prefix+'\uffff',actor.login,now,snapshotId)
 ]);
 const saved=JSON.parse((await manifestRow(db,snapshotId)).payload);if(saved.createdBy!==actor.login||saved.cutoverDate!==cutoverDate||saved.sourceId!==sourceId)fail('Snapshot vừa được chuẩn bị bởi lượt khác.');return saved;
}
export async function legacySourceStillMatches(db,snapshotId,actor,{sourceId}={}){
 access(actor);sourceIdentity(sourceId);identity(snapshotId);const row=await manifestRow(db,snapshotId);if(!row)fail('Không tìm thấy source snapshot.',404);const manifest=JSON.parse(row.payload);
 if(manifest.captureModel!=='observed-source-records-v1'||manifest.sourceId!==sourceId)fail('Source build đã đổi hoặc không đúng dạng snapshot. Chuẩn bị snapshot mới.');
 const frozen=relation(snapshotId);
 const result=await db.prepare(`SELECT ((SELECT count(*) FROM app_records WHERE entity IN (SELECT value FROM json_each(?)))=?) AND NOT EXISTS(SELECT 1 FROM ${frozen} frozen LEFT JOIN app_records live ON live.entity=frozen.entity AND live.record_key=frozen.record_key WHERE live.payload IS NULL OR live.payload IS NOT frozen.payload OR live.updated_by IS NOT frozen.updated_by OR live.updated_at IS NOT frozen.updated_at) AS unchanged`).bind(JSON.stringify(manifest.sources),manifest.sourceCount).first();return result.unchanged===1;
}
export async function previewLegacyPreservation(db,{snapshotId},actor,{sourceId}={}){
 access(actor);sourceIdentity(sourceId);const row=await manifestRow(db,snapshotId);if(!row)fail('Không tìm thấy source snapshot.',404);const manifest=JSON.parse(row.payload);identity(snapshotId);
 if(manifest.captureModel!=='observed-source-records-v1'||manifest.sourceId!==sourceId)fail('Source build đã đổi hoặc không đúng dạng snapshot. Chuẩn bị snapshot mới.');
 const frozen=legacySnapshotDatabase(db,snapshotId),source=await readRecordPages(frozen),catalog=siteCatalog(source.filter(r=>r.entity==='sku').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}))),workflow=await readProductionWorkflow(frozen,actor,catalog),rateRows=source.filter(r=>r.entity==='labor_hours').map(r=>({key:r.record_key,payload:JSON.parse(r.payload)}));
 const standards=new Map(siteLaborHours(rateRows).filter(r=>!r.payload._deleted&&!r.payload.cancelled&&r.payload.status!=='Đã hủy'&&r.payload.laborHour!=null).map(r=>[r.key,Number(r.payload.laborHour)]));
 const rawReports=[...source.filter(r=>r.entity==='production_history_import').flatMap(r=>JSON.parse(r.payload).reports||[]),...source.filter(r=>r.entity==='production_report').map(r=>({...JSON.parse(r.payload),id:r.record_key}))],rawOrders=source.filter(r=>r.entity==='in_transit').map(r=>({...JSON.parse(r.payload),id:r.record_key}));
 const proposed=await captureLegacyPreservation({workflow,standards,snapshotId,observedAt:manifest.capturedAt,cutoverDate:manifest.cutoverDate,rawReports,rawOrders});
 return {...proposed,manifest:{...proposed.manifest,status:'preview',captureModel:manifest.captureModel,sourceId,sourceCount:manifest.sourceCount},sourceStillMatches:await legacySourceStillMatches(db,snapshotId,actor,{sourceId})};
}
