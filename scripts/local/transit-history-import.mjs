import {randomUUID} from 'node:crypto';
import {parseTransitHistory} from '../../lib/transit-history-import.mjs';
import {normalizeTransit} from '../../lib/in-transit.mjs';
import {usableSku} from '../../lib/sku-state.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {PlanError} from './production-plan.mjs';
export async function importTransitHistory(db,body,actor,catalog) {
 const fail=(m,s=422)=>{throw new PlanError(m,s);};
 if(!actor?.isAdmin||actor.line)fail('Chỉ Admin không giới hạn Line được nhập dữ liệu lịch sử.',403);
 const rows=parseTransitHistory(body.text,body.week),old=(await db.prepare("SELECT record_key,payload FROM app_records WHERE entity='in_transit'").all()).results;
 const requested=body.remove||[];
 if(!Array.isArray(requested)||requested.length>100)fail('Danh sách gỡ không hợp lệ.');
 const removals=[];
 for(const item of requested){const stored=old.find(r=>r.record_key===item.id);if(!stored||await recordRevision(stored.payload)!==item.revision)fail(conflictMessage,409);const row=JSON.parse(stored.payload);if(row._deleted||!['2026-09-14','2026-09-21'].includes(row.week))fail('Chỉ gỡ lệnh thuộc tuần 38 và 39 trong lần thay dữ liệu này.');removals.push(stored);}
 const live=old.filter(r=>!JSON.parse(r.payload)._deleted);
 const updates=[];
 const prepared=rows.map(row=>{
  const same=live.filter(r=>JSON.parse(r.payload).planId===row.planId);
  const existing=same.length===1?same[0]:null;
  if(same.length>1)fail(`Plan ID ${row.planId} có nhiều LSX; hãy chỉnh từng dòng.`);
  if(existing&&(!body.updateExisting||!row.extendedImport))fail(`Đã có Plan ID ${row.planId}; không nhập trùng.`);
  if(live.some(r=>r!==existing&&row.lsxCode&&JSON.parse(r.payload).lsxCode===row.lsxCode))fail(`Đã có LSX ${row.lsxCode}; không nhập trùng.`);
  const master=catalog.find(c=>(c.payload||c).code===row.sku);if(!master||!usableSku(master.payload||master))fail(`SKU ${row.sku} chưa có hoặc chưa được xác nhận.`);
  const prior=existing?{...JSON.parse(existing.payload),id:JSON.parse(existing.payload).id||existing.record_key}:null;
  if(prior&&(prior.sku!==row.sku||prior.line!==row.line||prior.week!==row.week||(prior.lsxCode&&prior.lsxCode!==row.lsxCode)))fail(`Plan ID ${row.planId} không khớp SKU, Line, tuần hoặc LSX.`);
  if(existing)updates.push(existing);
  return {row,existing,prior,master:master.payload||master};
 });
 for(const stored of updates){
  const revision=body.updateRevisions?.find(r=>r.id===stored.record_key)?.revision;
  if(!revision||revision!==await recordRevision(stored.payload))fail(conflictMessage,409);
 }
 const production=(await db.prepare("SELECT payload FROM app_records WHERE entity IN ('production_report','production_event')").all()).results.flatMap(r=>{const p=JSON.parse(r.payload);return Array.isArray(p.rows)?p.rows:[p];});
 for(const {row,prior} of prepared)if(production.some(p=>!p._deleted&&!p.voided&&!p.cancelled&&((prior?.id&&[p.transitId,p.sourceId,p.destinationId].includes(prior.id))||(row.lsxCode&&[p.lsxCode,p.orderCode,p.mo].includes(row.lsxCode))||(!p.transitId&&!p.lsxCode&&!p.orderCode&&!p.mo&&p.planId===row.planId))))fail(`LSX ${row.lsxCode} đã có báo công; hãy dùng Điều chỉnh báo công.`);
 const now=new Date().toISOString(),batchId=randomUUID();
 const imported=prepared.map(({row:r,prior,master:p},i)=>normalizeTransit({...prior,...r,id:prior?.id||`history:${batchId}:${i}`,planStart:r.planStart||prior?.planStart||'',planEnd:r.planEnd||prior?.planEnd||'',group:prior?.group||p.group||p.productGroup,name:r.extendedImport?r.name:p.name,spec:r.extendedImport?r.spec:p.specification||p.spec,unit:prior?.unit||p.unit,priority:r.extendedImport?r.priority:'THƯỜNG',sequence:r.extendedImport?r.sequence:i+1,source:r.extendedImport?r.source:'Nhập dữ liệu lịch sử',syncStatus:prior?.syncStatus||(r.extendedImport?'CHƯA ĐỒNG BỘ':'ĐÃ ĐỒNG BỘ'),historicalImport:true,importBlankPriority:r.extendedImport&&!r.priority,createdAt:prior?.createdAt||now,createdBy:prior?.createdBy||actor.login,updatedAt:now,updatedBy:actor.login}));
 const expected=[...removals,...updates].map(r=>({id:r.record_key,payload:r.payload}));
 const incoming=prepared.map(({row,existing,prior})=>({id:existing?.record_key||'',transitId:prior?.id||'',planId:row.planId,lsxCode:row.lsxCode}));
 // JSON parameters keep this atomic claim below D1's bound-parameter limit.
 const guards=[
  "NOT EXISTS(SELECT 1 FROM json_each(?) e WHERE NOT EXISTS(SELECT 1 FROM app_records a WHERE a.entity='in_transit' AND a.record_key=json_extract(e.value,'$.id') AND a.payload=json_extract(e.value,'$.payload')))",
  "NOT EXISTS(SELECT 1 FROM json_each(?) i JOIN app_records a ON a.entity='in_transit' AND a.record_key<>json_extract(i.value,'$.id') WHERE coalesce(json_extract(a.payload,'$._deleted'),0)<>1 AND (json_extract(a.payload,'$.planId')=json_extract(i.value,'$.planId') OR (json_extract(i.value,'$.lsxCode')<>'' AND json_extract(a.payload,'$.lsxCode')=json_extract(i.value,'$.lsxCode'))))",
  "NOT EXISTS(SELECT 1 FROM json_each(?) i, app_records a, json_each(CASE WHEN json_type(a.payload,'$.rows')='array' THEN json_extract(a.payload,'$.rows') ELSE json_array(json(a.payload)) END) p WHERE a.entity IN ('production_report','production_event') AND coalesce(json_extract(p.value,'$._deleted'),0)<>1 AND coalesce(json_extract(p.value,'$.voided'),0)<>1 AND coalesce(json_extract(p.value,'$.cancelled'),0)<>1 AND ((json_extract(i.value,'$.transitId')<>'' AND json_extract(i.value,'$.transitId') IN (json_extract(p.value,'$.transitId'),json_extract(p.value,'$.sourceId'),json_extract(p.value,'$.destinationId'))) OR (json_extract(i.value,'$.lsxCode')<>'' AND json_extract(i.value,'$.lsxCode') IN (json_extract(p.value,'$.lsxCode'),json_extract(p.value,'$.orderCode'),json_extract(p.value,'$.mo'))) OR (coalesce(json_extract(p.value,'$.transitId'),'')='' AND coalesce(json_extract(p.value,'$.lsxCode'),json_extract(p.value,'$.orderCode'),json_extract(p.value,'$.mo'),'')='' AND json_extract(p.value,'$.planId')=json_extract(i.value,'$.planId'))))"
 ];
 const args=[JSON.stringify(expected),JSON.stringify(incoming),JSON.stringify(incoming)];
 const log={id:batchId,action:'import-history',at:now,actor:actor.login,week:body.week,inserted:imported.filter((r,i)=>!prepared[i].existing).map(r=>r.id),updated:updates.map(r=>r.record_key),before:updates.map(r=>JSON.parse(r.payload)),after:imported,removed:removals.map(r=>r.record_key),reason:'Nhập dữ liệu In transit theo bảng đối chiếu'};
 const statements=[db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit_audit',?,?,?,? WHERE ${guards.join(' AND ')}`).bind(batchId,JSON.stringify(log),actor.login,now,...args)];
 const claimed="EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit_audit' AND record_key=?)";
 for(const [i,r] of imported.entries()){
  const existing=prepared[i].existing;
  statements.push(existing?db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit' AND record_key=? AND payload=? AND ${claimed}`).bind(JSON.stringify(r),actor.login,now,existing.record_key,existing.payload,batchId):db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit',?,?,?,? WHERE ${claimed}`).bind(r.id,JSON.stringify(r),actor.login,now,batchId));
 }
 for(const r of removals){const p={...JSON.parse(r.payload),_deleted:true,deletedAt:now,deletedBy:actor.login,deleteReason:log.reason};statements.push(db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit' AND record_key=? AND payload=? AND ${claimed}`).bind(JSON.stringify(p),actor.login,now,r.record_key,r.payload,batchId));}
 const result=await db.batch(statements);if(result[0].meta.changes!==1)fail(conflictMessage,409);
 return {ok:true,inserted:imported.length-updates.length,updated:updates.length,removed:removals.length};
}
export async function restoreTransitHistoryRemovals(db,body,actor) {
 const fail=(m,s=409)=>{throw new PlanError(m,s);};
 if(!actor?.isAdmin||actor.line)fail('Chỉ Admin được khôi phục dữ liệu lịch sử.',403);
 const audit=await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit_audit' AND record_key=?").bind(String(body.batchId||'')).first();
 const batch=audit&&JSON.parse(audit.payload);if(batch?.action!=='import-history'||!batch.removed?.length)fail('Không có bản gỡ để khôi phục.');
 const stored=[];for(const id of batch.removed){const r=await db.prepare("SELECT payload FROM app_records WHERE entity='in_transit' AND record_key=?").bind(id).first();if(!r||!JSON.parse(r.payload)._deleted)fail('Dữ liệu đã thay đổi hoặc đã khôi phục.');const old=JSON.parse(r.payload);if(old.lsxCode){const duplicate=await db.prepare("SELECT record_key FROM app_records WHERE entity='in_transit' AND record_key<>? AND coalesce(json_extract(payload,'$._deleted'),0)<>1 AND upper(json_extract(payload,'$.lsxCode'))=upper(?)").bind(id,old.lsxCode).first();if(duplicate)fail('Mã LSX đã được dùng lại; không thể khôi phục trùng.');}stored.push({id,payload:r.payload});}
 const now=new Date().toISOString(),id=randomUUID(),log={id,action:'restore-history',actor:actor.login,at:now,restored:batch.removed,sourceBatch:body.batchId};
 const claim=db.prepare(`INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'in_transit_audit',?,?,?,? WHERE ${stored.map(()=>"EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit' AND record_key=? AND payload=?)").join(' AND ')}`).bind(id,JSON.stringify(log),actor.login,now,...stored.flatMap(r=>[r.id,r.payload]));
 const statements=[claim,...stored.map(r=>{const p={...JSON.parse(r.payload),_deleted:false,restoredAt:now,restoredBy:actor.login};delete p.deletedAt;delete p.deletedBy;delete p.deleteReason;return db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='in_transit_audit' AND record_key=?)").bind(JSON.stringify(p),actor.login,now,r.id,r.payload,id);})];
 const result=await db.batch(statements);if(result[0].meta.changes!==1)fail(conflictMessage);return {ok:true,restored:stored.length};
}
