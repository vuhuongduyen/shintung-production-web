import {isDailyOutput} from '../lib/production-report-model.mjs';
import {dailyReceiptMatches,dailyReceiptConfirmed,confirmedProductionWarehouseStatus} from '../lib/production-warehouse-status.mjs';
const fail=message=>{throw Object.assign(Error(message),{status:409});};
const reportId=p=>p.reportId||p.sourceReportId;
export async function warehouseProductionSources(db,receipts){
 const ids=[...new Set(receipts.map(r=>reportId(JSON.parse(r.payload))).filter(id=>typeof id==='string'&&id))],sources=new Map(),result=new Map(),seen=new Set();
 // Read only selected source IDs. Legacy payload trees are not transported.
 for(let i=0;i<ids.length;i+=80){const chunk=ids.slice(i,i+80),rows=await db.prepare(`SELECT record_key,CASE WHEN json_extract(payload,'$.reportingModel')='daily-finished-v1' AND json_extract(payload,'$.quantityOnly')=1 THEN payload ELSE NULL END AS payload FROM app_records WHERE entity='production_report' AND record_key IN (${chunk.map(()=>'?').join(',')})`).bind(...chunk).all();for(const r of rows.results)sources.set(r.record_key,r);}
 for(const row of receipts){
  const receipt=JSON.parse(row.payload),source=sources.get(reportId(receipt));
  if(!source?.payload){if(receipt.sourceProductionDate)fail('Thiếu phiếu sản lượng ngày nguồn; chưa xác nhận kho.');continue;}
  const report=JSON.parse(source.payload);
  if(report.id!==source.record_key||!dailyReceiptMatches(report,receipt)||report.pendingCorrection?.status==='pending')fail('Phiếu kho và báo sản lượng đã khác nguồn hoặc đang chờ điều chỉnh.');
  if(seen.has(report.id))fail('Có nhiều phiếu kho cùng một báo sản lượng; cần đối chiếu trước khi xác nhận.');
  seen.add(report.id);result.set(row.record_key,source);
 }
 return result;
}
export function warehouseConfirmationStatements(db,row,next,source,actor,now){
 const rawNext=JSON.stringify(next),guards=source?" AND EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?) AND NOT EXISTS(SELECT 1 FROM app_records w WHERE w.entity='warehouse_in' AND w.record_key<>? AND coalesce(json_extract(w.payload,'$.reportId'),json_extract(w.payload,'$.sourceReportId'))=?)":'';
 const receipt=db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='warehouse_in' AND record_key=? AND payload=?"+guards).bind(rawNext,actor,now,row.record_key,row.payload,...(source?[source.record_key,source.payload,row.record_key,source.record_key]:[]));
 if(!source)return [receipt];
 const report=JSON.parse(source.payload);
 if(!dailyReceiptConfirmed(report,next))fail('Thiếu bằng chứng kho đã xác nhận phiếu sản lượng.');
 // Stock acknowledgement changes status only, not production quantities/rates
 // or the business version. Exact raw CAS still invalidates stale previews.
 const reportNext=JSON.stringify({...report,warehouseStatus:confirmedProductionWarehouseStatus});
 return [receipt,
  db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='production_report' AND record_key=? AND payload=? AND EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_in' AND record_key=? AND payload=?)").bind(reportNext,actor,now,source.record_key,source.payload,row.record_key,rawNext),
  // A failed source update must roll back receipt/stock too, never leave half.
  db.prepare("SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM app_records WHERE entity='warehouse_in' AND record_key=? AND payload=?) OR EXISTS(SELECT 1 FROM app_records WHERE entity='production_report' AND record_key=? AND payload=?) THEN 1 ELSE json_extract('WAREHOUSE_REPORT_CAS_REJECTED','$') END AS guarded").bind(row.record_key,rawNext,source.record_key,reportNext)
 ];
}
// Receipt positions stay first so partial-success counts remain receipt counts.
// Group source updates/fences: 500 ordinary daily receipts need fewer than 550
// statements instead of 1,500. Each group is at most 80 rows / 128 KiB of JSON
// (an unusually large individual row is handled alone, never truncated).
export function warehouseConfirmationBatch(db,items,actor,now){
 const statements=[],entries=[];
 for(const {row,next,source} of items){
  const writes=warehouseConfirmationStatements(db,row,next,source,actor,now);statements.push(writes[0]);
  if(source)entries.push({reportKey:source.record_key,reportRaw:source.payload,reportNext:JSON.stringify({...JSON.parse(source.payload),warehouseStatus:confirmedProductionWarehouseStatus}),receiptKey:row.record_key,receiptNext:JSON.stringify(next)});
 }
 const groups=[];let group=[],bytes=2;
 for(const entry of entries){const size=new TextEncoder().encode(JSON.stringify(entry)).byteLength;if(group.length&&(group.length===80||bytes+1+size>131072)){groups.push(group);group=[];bytes=2;}bytes+=size+(group.length?1:0);group.push(entry);}if(group.length)groups.push(group);
 for(const group of groups){const payload=JSON.stringify(group);
  statements.push(db.prepare("WITH candidates AS (SELECT json_extract(value,'$.reportKey') AS report_key,json_extract(value,'$.reportRaw') AS old_payload,json_extract(value,'$.reportNext') AS new_payload,json_extract(value,'$.receiptKey') AS receipt_key,json_extract(value,'$.receiptNext') AS receipt_payload FROM json_each(?)) UPDATE app_records SET payload=(SELECT new_payload FROM candidates c WHERE c.report_key=app_records.record_key),updated_by=?,updated_at=? WHERE entity='production_report' AND EXISTS(SELECT 1 FROM candidates c WHERE c.report_key=app_records.record_key AND c.old_payload=app_records.payload AND EXISTS(SELECT 1 FROM app_records w WHERE w.entity='warehouse_in' AND w.record_key=c.receipt_key AND w.payload=c.receipt_payload))").bind(payload,actor,now));
  statements.push(db.prepare("SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM json_each(?) c WHERE EXISTS(SELECT 1 FROM app_records w WHERE w.entity='warehouse_in' AND w.record_key=json_extract(c.value,'$.receiptKey') AND w.payload=json_extract(c.value,'$.receiptNext')) AND NOT EXISTS(SELECT 1 FROM app_records r WHERE r.entity='production_report' AND r.record_key=json_extract(c.value,'$.reportKey') AND r.payload=json_extract(c.value,'$.reportNext'))) THEN 1 ELSE json_extract('WAREHOUSE_REPORT_CAS_REJECTED','$') END AS guarded").bind(payload));
 }
 return statements;
}
export async function projectDailyWarehouseStatuses(db,reports){
 const pending=reports.filter(r=>isDailyOutput(r)&&r.reviewStatus==='Đã xác nhận'&&!r.cancelled&&!r.voided&&r.warehouseStatus!==confirmedProductionWarehouseStatus),receipts=new Map();
 if(!pending.length)return reports;
 const fields=['source','reportId','sourceReportId','sku','line','lsxCode','sourceProductionDate','proposedQuantity','receivedQuantity','status','confirmation_status','confirmationStatus','cancelled','voided','_deleted','confirmedBy','confirmedAt'];
 for(let i=0;i<pending.length;i+=80){const ids=pending.slice(i,i+80).map(r=>'SX:'+r.id),rows=await db.prepare(`SELECT record_key,json_object(${fields.map(k=>`'${k}',json_extract(payload,'$.${k}')`).join(',')}) AS payload FROM app_records WHERE entity='warehouse_in' AND record_key IN (${ids.map(()=>'?').join(',')})`).bind(...ids).all();for(const row of rows.results)receipts.set(row.record_key,JSON.parse(row.payload));}
 // Repair the view of pre-fix confirmations without changing historical rows.
 // Only already-authorized report IDs are read; no warehouse identities escape.
 return reports.map(r=>dailyReceiptConfirmed(r,receipts.get('SX:'+r.id))?{...r,warehouseStatus:confirmedProductionWarehouseStatus}:r);
}
