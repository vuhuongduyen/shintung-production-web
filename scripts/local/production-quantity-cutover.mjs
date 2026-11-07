// Explicit trusted service, never called on startup or by a generic record API.
// Freezes source bytes with INSERT SELECT; it never derives legacy labor/payroll.
import {dailyOutputModel} from '../../lib/production-report-model.mjs';
export const quantityCutoverModel='server-receipt-quantity-v1';
export const quantityCutoverSources=Object.freeze(['in_transit','production_report','production_history_import','warehouse_in']);
const sources=quantityCutoverSources;
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const prefix=id=>JSON.stringify([id]).slice(0,-1)+',';
export function quantitySourceDatabase(db,id){
 if(!/^[A-Za-z0-9-]{16,80}$/.test(id||''))fail('Định danh nguồn đã chốt không hợp lệ.');
 const start=prefix(id),literal=value=>"'"+value.replaceAll("'","''")+"'";
 const source=`(SELECT json_extract(record_key,'$[1]') AS entity,json_extract(record_key,'$[2]') AS record_key,payload,updated_by,updated_at FROM app_records WHERE entity='production_quantity_source' AND record_key>=${literal(start)} AND record_key<${literal(start+'\uffff')})`;
 return {prepare(sql){if(!/^\s*SELECT\b/i.test(sql)||!/\bapp_records\b/i.test(sql))fail('Nguồn số lượng chỉ hỗ trợ đọc.');return db.prepare(sql.replace(/\bapp_records\b/gi,source));},batch(){fail('Không ghi qua nguồn số lượng đã chốt.');}};
}
export function quantityManifestValid(manifest,policy,activation){
 return policy?.intakeModel===quantityCutoverModel&&activation?.intakeModel===quantityCutoverModel&&
 manifest?.kind===quantityCutoverModel&&manifest.status==='complete'&&manifest.id===policy.legacySnapshotId&&
 activation.legacySnapshotId===manifest.id&&activation.receivedAt===manifest.receivedAt&&policy.receivedAt===manifest.receivedAt&&
 Number.isFinite(Date.parse(manifest.receivedAt))&&Number.isSafeInteger(manifest.sourceCount)&&manifest.sourceCount>=0;
}
export async function activateQuantityCutover(db,{snapshotId},actor,{sourceId}={}){
 if(!actor?.isAdmin||actor.line||!actor.login)fail('Chỉ Admin toàn quyền được chuẩn bị chuyển báo sản lượng.',403);
 if(!/^[A-Za-z0-9-]{16,80}$/.test(snapshotId||'')||!/^[a-f0-9]{64}$/.test(sourceId||''))fail('Thiếu định danh snapshot hoặc source máy chủ.',422);
 const old=await db.prepare("SELECT entity,payload FROM app_records WHERE entity IN ('production_reporting_policy','production_reporting_activation') AND record_key='global'").all();
 if(old.results.length){const activation=old.results.find(r=>r.entity==='production_reporting_activation');const policy=old.results.find(r=>r.entity==='production_reporting_policy');
  const a=activation&&JSON.parse(activation.payload),p=policy&&JSON.parse(policy.payload);
  if(a?.intakeModel===quantityCutoverModel&&a.legacySnapshotId===snapshotId&&a.sourceId===sourceId&&a.actor===actor.login&&p?.receivedAt===a.receivedAt){const row=await db.prepare("SELECT payload FROM app_records WHERE entity='production_legacy_manifest' AND record_key=?").bind(snapshotId).first();if(row&&quantityManifestValid(JSON.parse(row.payload),p,a)){const manifest=JSON.parse(row.payload),start=prefix(snapshotId);const count=await db.prepare("SELECT count(*) AS n FROM app_records WHERE entity='production_quantity_source' AND record_key>=? AND record_key<?").bind(start,start+'\uffff').first();if(count.n!==manifest.sourceCount)fail('Tập nguồn đã chốt không còn đầy đủ; không tự tạo lại hoặc kích hoạt lại.');return {...a,replayed:true};}}
  fail('Đã có mốc/policy khác; giữ nguyên và đối chiếu, không ghi đè.');
 }
 const receivedAt=new Date().toISOString(),effectiveFrom=new Date(Date.parse(receivedAt)+25200000).toISOString().slice(0,10);
 const a={intakeModel:quantityCutoverModel,legacySnapshotId:snapshotId,receivedAt,effectiveFrom,sourceId,actor:actor.login};
 const policy={...a,mode:dailyOutputModel,approved:true,revision:1};
 const manifest={id:snapshotId,kind:quantityCutoverModel,status:'complete',receivedAt,sourceId};
 const p=prefix(snapshotId),gate="EXISTS(SELECT 1 FROM app_records WHERE entity='production_reporting_activation' AND record_key='global' AND payload=?)";
 // Unique marker/policy inserts and all frozen sources commit together. A race
 // or SQL failure rolls back the entire batch; no partial activation is usable.
 await db.batch([
  db.prepare("INSERT INTO app_records VALUES('production_reporting_activation','global',?,?,?)").bind(JSON.stringify(a),actor.login,receivedAt),
  db.prepare(`INSERT INTO app_records SELECT 'production_quantity_source',json_array(?,entity,record_key),payload,updated_by,updated_at FROM app_records WHERE entity IN (SELECT value FROM json_each(?)) AND ${gate}`).bind(snapshotId,JSON.stringify(sources),JSON.stringify(a)),
  db.prepare(`INSERT INTO app_records SELECT 'production_legacy_manifest',?,json_set(?,'$.sourceCount',(SELECT count(*) FROM app_records WHERE entity='production_quantity_source' AND record_key>=? AND record_key<?)),?,? WHERE ${gate}`).bind(snapshotId,JSON.stringify(manifest),p,p+'\uffff',actor.login,receivedAt,JSON.stringify(a)),
  db.prepare(`INSERT INTO app_records SELECT 'production_reporting_policy','global',?,?,? WHERE ${gate}`).bind(JSON.stringify(policy),actor.login,receivedAt,JSON.stringify(a))
 ]);
 return a;
}
export async function frozenPendingReport(db,policy,reportId){
 if(policy?.intakeModel!==quantityCutoverModel||!policy.active)return false;
 const rows=await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='production_quantity_source' AND json_extract(record_key,'$[0]')=? AND ((json_extract(record_key,'$[1]')='production_report' AND json_extract(record_key,'$[2]')=?) OR (json_extract(record_key,'$[1]')='production_history_import' AND EXISTS(SELECT 1 FROM json_each(payload,'$.reports') h WHERE json_extract(h.value,'$.id')=?)))").bind(policy.legacySnapshotId,reportId,reportId).all();
 return rows.results.some(row=>{const value=JSON.parse(row.payload),key=JSON.parse(row.record_key);return (key[1]==='production_history_import'&&Array.isArray(value.reports)?value.reports:[{id:key[2],...value}]).some(r=>r.id===reportId&&!r._deleted&&['Chờ kiểm tra','Lịch sử chờ đối chiếu'].includes(r.reviewStatus)&&!r.cancelled&&!r.voided);});
}
