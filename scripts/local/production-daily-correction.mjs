import {readLaborRateSource} from './labor-rate-source.mjs';
import {mergeProduction} from '../../lib/in-transit.mjs';
import {queuePendingDailyCorrection} from './production-daily-pending-correction.mjs';
import {buildCorrectedDailyReport} from './production-daily-correction-value.mjs';
import {canCorrectProduction} from '../../lib/production-correction-access.mjs';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';
import {isDailyOutput,dailyOutputModel} from '../../lib/production-daily-output.mjs';
import {readDailyOrderReports,readDailyOutputPolicy,dailyPolicyGuards} from './production-daily-output.mjs';
const fail=(message,status=409)=>{throw Object.assign(Error(message),{status});};
const rawRow=(db,entity,key)=>db.prepare('SELECT payload FROM app_records WHERE entity=? AND record_key=?').bind(entity,key).first();
export async function correctDailyOutput(db,body,actor){
 if(!canCorrectProduction(actor))fail('Không có quyền Điều chỉnh báo công.',403);
 if(!['preview','apply'].includes(body.action)||!['daily-output-edit','daily-output-cancel'].includes(body.operation))fail('Chọn điều chỉnh hoặc hủy phiếu sản lượng.',422);
 const token=String(body.requestIdempotency||''),reason=String(body.reason||'').trim();
 if(!/^[a-zA-Z0-9-]{16,80}$/.test(token)||!reason||reason.length>1000)fail('Nhập mã thao tác ổn định và lý do (tối đa 1000 ký tự).',422);
 const fingerprint=await recordRevision(JSON.stringify([body.operation,body.reportId,body.quantity,body.productionDate,body.productionLocalDateTime,reason]));
 if(await rawRow(db,'production_daily_change',token))return queuePendingDailyCorrection(db,body,actor);
 const replay=await db.prepare("SELECT payload FROM app_records WHERE entity='production_event' AND json_extract(payload,'$.requestIdempotency')=? LIMIT 1").bind(token).first();
 if(replay){const event=JSON.parse(replay.payload);if(event.kind!=='daily-output-correction'||event.actor!==actor.login||event.requestFingerprint!==fingerprint||actor.line&&actor.line!==event.line)fail('Mã thao tác không khớp nội dung/người đã ghi nhận.');return {ok:true,replayed:true,event,report:JSON.parse((await rawRow(db,'production_report',body.reportId)).payload)};}
 const reportRow=await rawRow(db,'production_report',String(body.reportId||'')),old=reportRow?JSON.parse(reportRow.payload):null;
 if(!isDailyOutput(old))fail('Không tìm thấy phiếu sản lượng ngày.',404);
 if(actor.line&&old.line!==actor.line)fail('Không có quyền xử lý Line khác.',403);
 if(old.cancelled||old.voided)fail('Phiếu đã hủy.');
 if(old.reviewStatus==='Đã xác nhận')return queuePendingDailyCorrection(db,body,actor);
 const warehouseSql="NOT EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_in' AND (coalesce(json_extract(payload,'$.sourceReportId'),json_extract(payload,'$.reportId'))=? OR record_key=?))";
 const warehouseArgs=[old.id,`SX:${old.id}`];
 if(!(await db.prepare(`SELECT ${warehouseSql} AS safe`).bind(...warehouseArgs).first()).safe)fail('Phiếu đã liên kết kho, không tự sửa hoặc đảo kho.');
 const [orderRow,cursor,policy,rateRow]=await Promise.all([rawRow(db,'in_transit',old.transitId),rawRow(db,'production_cursor','global'),readDailyOutputPolicy(db),rawRow(db,'labor_hours',String(old.sku||'').trim().toUpperCase())]);
 const rateSource=body.productionDate!==old.productionDate?await readLaborRateSource(db,old.sku):{menu:null,guards:[]};
 if(!orderRow||!policy.policy?.active)fail('Lệnh hoặc mốc triển khai đã thay đổi.');
 const order={...JSON.parse(orderRow.payload),id:old.transitId};
 if(['line','sku','lsxCode'].some(k=>order[k]!==old[k]))fail('Lệnh đã đổi Line/SKU/LSX so với phiếu. Cần đối chiếu trước khi điều chỉnh.');
 const scoped=await readDailyOrderReports(db,order),now=new Date().toISOString();
 const next=buildCorrectedDailyReport({old,body,actor,order,scoped,policy,rateRow,rateVersions:rateSource.menu?.resolvedRateVersions,now,reason});
 const cursorRaw=cursor?.payload||JSON.stringify({version:0,token:''}),expectedRevision=await recordRevision(JSON.stringify([fingerprint,cursorRaw,reportRow.payload,orderRow.payload,policy.raw,policy.activationRaw,policy.manifestRaw,rateRow?.payload??null,rateSource.guards,scoped.guards]));
 if(body.action==='preview')return {ok:true,expectedRevision,before:old,after:next};
 if(body.expectedRevision!==expectedRevision||Number(body.expectedVersion)!==Number(old.version||0))fail(conflictMessage);
 const event={id:crypto.randomUUID(),kind:'daily-output-correction',reportingModel:dailyOutputModel,quantityOnly:true,sourceId:old.transitId,line:old.line,reportId:old.id,operation:body.operation,before:old,after:next,reason,actor:actor.login,recordedAt:now,effectiveAt:now,requestIdempotency:token,requestFingerprint:fingerprint};
 const guard=(entity,key,raw)=>raw==null?{sql:'NOT EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=?)',args:[entity,key]}:{sql:'EXISTS(SELECT 1 FROM app_records WHERE entity=? AND record_key=? AND payload=?)',args:[entity,key,raw]};
 const guards=[guard('production_report',old.id,reportRow.payload),guard('in_transit',old.transitId,orderRow.payload),...dailyPolicyGuards(policy),guard('labor_hours',String(old.sku||'').trim().toUpperCase(),rateRow?.payload??null),...rateSource.guards,...scoped.guards,{sql:warehouseSql,args:warehouseArgs}],nextCursor=JSON.stringify({version:Number(JSON.parse(cursorRaw).version||0)+1,token:crypto.randomUUID()});
 const writes=[db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_cursor' AND record_key='global' AND payload=? AND ${guards.map(g=>g.sql).join(' AND ')}`).bind(nextCursor,actor.login,now,cursorRaw,...guards.flatMap(g=>g.args))];
 const gate="EXISTS(SELECT 1 FROM app_records WHERE entity='production_cursor' AND record_key='global' AND payload=?)";
 writes.push(db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_report' AND record_key=? AND ${gate}`).bind(JSON.stringify(next),actor.login,now,old.id,nextCursor));
 writes.push(db.prepare(`INSERT INTO app_records SELECT 'production_event',?,?,?,? WHERE ${gate}`).bind(event.id,JSON.stringify(event),actor.login,now,nextCursor));
 // Refresh existing materialized totals; retain admission revisions on never-reviewed rows.
 if(Object.hasOwn(order,'pendingReportQty')){const merged=mergeProduction(order,scoped.reports.map(r=>r.id===old.id?next:r)),nextOrder={...JSON.parse(orderRow.payload),completedQty:merged.completedQty,pendingReportQty:merged.pendingReportQty,productionState:merged.productionState,actualCompletedAt:merged.actualCompletedAt,updatedAt:now,updatedBy:actor.login};
 writes.push(db.prepare(`UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='in_transit' AND record_key=? AND ${gate}`).bind(JSON.stringify(nextOrder),actor.login,now,old.transitId,nextCursor));}
 const result=await db.batch(writes);if(result[0].meta.changes!==1)fail(conflictMessage);return {ok:true,report:next,event};
}
