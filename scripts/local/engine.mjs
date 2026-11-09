import {engineLaborBasis} from './engine-labor-basis.mjs';
import {recordAuditStatement} from '../../lib/record-mutation-audit.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {randomUUID} from 'node:crypto';
import {PlanError} from './production-plan.mjs';
import {monday} from '../../lib/production-plan.mjs';
export async function saveEngine(db,body,session){
 if(!session?.login)throw new PlanError('Đăng nhập để cập nhật dữ liệu tuần',401);
 const p=body.payload;if(!p||!/^\d{4}-\d{2}-\d{2}$/.test(p.week)||!Array.isArray(p.rows)||!Array.isArray(p.metrics))throw new PlanError('Dữ liệu Engine không hợp lệ');
 const stored=(await db.prepare("SELECT payload FROM app_records WHERE entity='sku'").all()).results.map(r=>JSON.parse(r.payload));
 const masters=session.catalog ? session.catalog.map(r=>r.payload||r) : stored;
 const masterBySku=new Map(masters.map(item=>[String(item.code||'').trim().toUpperCase(),item]));
 const invalid=p.rows.filter(row=>!usableSku(masterBySku.get(String(row.sku||'').trim().toUpperCase())));
 const valid=p.rows.filter(row=>usableSku(masterBySku.get(String(row.sku||'').trim().toUpperCase())));
 if(!valid.length&&invalid.length)throw new PlanError('Không có SKU đã xác nhận và đang sử dụng để cập nhật dữ liệu tuần',409);
 const rows=valid.map(row=>{const master=masterBySku.get(String(row.sku||'').trim().toUpperCase());return {...row,group:master?.group||row.group};});
 const validIds=new Set(rows.map(row=>row.id));
 const now=new Date().toISOString(),labor=await engineLaborBasis(db,rows.map(r=>r.sku),now),rowsById=new Map(rows.map(r=>[r.id,r]));
 const metrics=p.metrics.filter(entry=>Array.isArray(entry)&&validIds.has(entry[0])).map(([id,metric])=>[id,{...metric,...labor.values.get(String(rowsById.get(id).sku).trim().toUpperCase())}]);
 const skippedSkus=[...new Set(invalid.map(row=>String(row.sku||'').trim().toUpperCase()).filter(Boolean))];
 const warning=skippedSkus.length?`Đã loại ${skippedSkus.length} SKU chưa xác nhận hoặc chưa sử dụng trong SKU Master.`:'';
 const key=`${p.week}:${randomUUID()}`,payload={...p,rows,metrics,warnings:[...(p.warnings||[]),...(warning?[warning]:[])],generatedBy:session.login,generatedAt:now};
 const weekKey=monday(p.week);
 if(!weekKey)throw new PlanError('Tuần tính Engine không hợp lệ.',400);
 const snapshotId=String(p.snapshotId||'').trim();
 const rawSnapshot=snapshotId?await db.prepare("SELECT payload FROM app_records WHERE entity='inventory_snapshot' AND record_key=?").bind(snapshotId).first():null;
 if(snapshotId&&!rawSnapshot)throw new PlanError('Không tìm thấy bản chốt tồn đã chọn. Tải lại dữ liệu tuần.',409);
 const snapshot=rawSnapshot?JSON.parse(rawSnapshot.payload):null;
 if(snapshot&&(snapshot.weekKey!==weekKey||!['Đã chốt','Đã được Production_engine sử dụng'].includes(snapshot.status)||p.snapshotCode&&p.snapshotCode!==snapshot.code))
  throw new PlanError('Bản chốt tồn đã thay đổi hoặc không thuộc tuần này. Tải lại dữ liệu trước khi cập nhật Engine.',409);
 if(!snapshot){
  const active=(await db.prepare("SELECT 1 AS found FROM app_records WHERE entity='inventory_snapshot' AND json_extract(payload,'$.weekKey')=? AND json_extract(payload,'$.status') IN ('Đã chốt','Đã được Production_engine sử dụng') LIMIT 1").bind(weekKey).first());
  if(active)throw new PlanError('Tuần đã có bản chốt tồn. Tải lại dữ liệu tuần trước khi tính Engine.',409);
 }
 const writes=['production_engine','production_engine_snapshot'].map(entity=>snapshot
  ?db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM app_records WHERE entity='inventory_snapshot' AND record_key=? AND payload=?) AND ${labor.sql}`).bind(entity,key,JSON.stringify(payload),session.login,now,snapshotId,rawSnapshot.payload,...labor.args)
  :db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT ?,?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM app_records WHERE entity='inventory_snapshot' AND json_extract(payload,'$.weekKey')=? AND json_extract(payload,'$.status') IN ('Đã chốt','Đã được Production_engine sử dụng')) AND ${labor.sql}`).bind(entity,key,JSON.stringify(payload),session.login,now,weekKey,...labor.args));
 let usedSnapshot=snapshot;
 if(snapshot?.status==='Đã chốt'){
  usedSnapshot={...snapshot,status:'Đã được Production_engine sử dụng',usedByEngineAt:now};
  writes.push(db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='inventory_snapshot' AND record_key=? AND payload=? AND ${labor.sql}`)
   .bind(JSON.stringify(usedSnapshot),session.login,now,snapshotId,rawSnapshot.payload,...labor.args));
  writes.push(db.prepare('INSERT INTO app_records SELECT ?,?,?,?,? WHERE changes()=1').bind('inventory_snapshot_audit',randomUUID(),JSON.stringify({snapshotId,weekKey,fromStatus:snapshot.status,toStatus:usedSnapshot.status,engineKey:key,actor:session.login,at:now}),session.login,now));
 }
 const created="EXISTS(SELECT 1 FROM app_records WHERE entity='production_engine' AND record_key=? AND payload=?) AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_engine_snapshot' AND record_key=? AND payload=?)";
 writes.push(recordAuditStatement(db,{entity:'production_engine',key,before:null,after:payload,actor:session,at:now,source:'engine-run',action:'create'},created,[key,JSON.stringify(payload),key,JSON.stringify(payload)]));
 const result=await db.batch(writes);
 if(result.some(entry=>entry.meta.changes!==1))throw new PlanError('Bản chốt tồn hoặc nguồn Giờ công vừa thay đổi. Tải lại dữ liệu tuần trước khi cập nhật Engine.',409);
 return {ok:true,key,payload,skippedSkus,snapshot:usedSnapshot};
}
