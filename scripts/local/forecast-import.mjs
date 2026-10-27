import {randomUUID} from 'node:crypto';
import {recordRevision,conflictMessage} from '../../lib/record-revision.mjs';

const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export const nextForecastMonth=(month)=>{
 if(!/^(0[1-9]|1[0-2])\/\d{4}$/.test(month))fail('Tháng báo cáo trong PDF không hợp lệ.');
 const [m,y]=month.split('/').map(Number);
 return `${String(m===12?1:m+1).padStart(2,'0')}/${y+(m===12?1:0)}`;
};

export async function importForecastFile(db,body,actor,clock=()=>new Date()){
 if(!actor?.login)fail('Vui lòng đăng nhập ONSPA.',401);
 const fileId=String(body?.fileId||''),reportMonth=String(body?.reportMonth||'');
 const month=nextForecastMonth(reportMonth),rows=body?.rows;
 if(!fileId||!Array.isArray(rows)||!rows.length||rows.length>3000||Number(body.declaredSkuCount)!==rows.length)fail('Số SKU đọc từ PDF không khớp danh sách; chưa nhập dữ liệu.');
 const file=await db.prepare('SELECT file_id,original_name,module,status FROM file_objects WHERE file_id=?').bind(fileId).first();
 if(!file||file.module!=='base-forecast'||file.status!=='ready'||!file.original_name.toLowerCase().endsWith('.pdf'))fail('Không tìm thấy PDF Forecast đã lưu trong FILES.',404);
 const previousImport=await db.prepare("SELECT payload FROM app_records WHERE entity='forecast_import_history' AND record_key=?").bind(fileId).first();
 if(previousImport){const p=JSON.parse(previousImport.payload);if(p.month===month)return {month,count:p.count,fileId,alreadyImported:true};fail('PDF này đã được nhập cho tháng khác.',409);}
 const seen=new Set();
 const normalized=rows.map(row=>{
  const sku=String(row?.sku||'').trim().toUpperCase();
  if(!/^[A-Z0-9-]{7,20}$/.test(sku)||seen.has(sku))fail(`SKU trùng hoặc không hợp lệ: ${sku||'trống'}.`);
  seen.add(sku);
  if(row.month!==month||row.sourceReportMonth!==reportMonth||row.applicationMonth!==month)fail(`Báo cáo ${reportMonth} chỉ được áp dụng cho tháng ${month}.`);
  const f=[row.adjustment30D,row.f30,row.f60,row.f90].map(Number);
  if(!String(row.group||'').trim()||!f.every(n=>Number.isSafeInteger(n))||f.slice(1).some(n=>n<0))fail(`PDF có nhóm hoặc số Forecast không hợp lệ tại SKU ${sku}.`);
  const d30=f[1]/30,d60=f[2]/60,d90=f[3]/90;
  return {sku,group:String(row.group).trim(),name:String(row.name||'').trim(),spec:String(row.spec||'').trim(),line:String(row.line||'').trim(),adjustment30D:f[0],f30:f[1],f60:f[2],f90:f[3],d30,d60,used:Math.round(Math.max(d30,d60)),d90:d90<1?0:d90,warning:d90>=1&&d90>Math.round(Math.max(d30,d60))?'Cảnh báo 90D tăng - xem xét NVL/MOQ':'',month,applicationMonth:month,sourceReportMonth:reportMonth,reportExportDate:String(row.reportExportDate||''),sourceFileId:fileId,sourceFileName:file.original_name};
 });
 const now=clock().toISOString();
 const old=await db.prepare("SELECT payload FROM app_records WHERE entity='forecast' AND record_key=?").bind(month).first();
 if(!Object.hasOwn(body,'expectedRevision')||body.expectedRevision!==await recordRevision(old?.payload))fail(conflictMessage,409);
 const before=old?JSON.parse(old.payload):[];
 if(!Array.isArray(before))fail('Dữ liệu Forecast tháng này chưa có định dạng hợp lệ; chưa ghi đè.',409);
 const history={fileId,fileName:file.original_name,reportMonth,month,count:normalized.length,previousCount:before.length,importedBy:actor.login,importedAt:now};
 const nextPayload=JSON.stringify(normalized);
 const write=old
  ?db.prepare("UPDATE app_records SET payload=?,updated_by=?,updated_at=? WHERE entity='forecast' AND record_key=? AND payload=?").bind(nextPayload,actor.login,now,month,old.payload)
  :db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) VALUES('forecast',?,?,?,?) ON CONFLICT(entity,record_key) DO NOTHING").bind(month,nextPayload,actor.login,now);
 const result=await db.batch([
  write,
  db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'forecast_import_history',?,?,?,? WHERE changes()=1").bind(fileId,JSON.stringify(history),actor.login,now),
  db.prepare("INSERT INTO app_records(entity,record_key,payload,updated_by,updated_at) SELECT 'admin_audit',?,?,?,? WHERE changes()=1").bind(randomUUID(),JSON.stringify({entity:'forecast',key:month,before,after:normalized,actor:actor.login,at:now,sourceFileId:fileId}),actor.login,now)
 ]);
 if(result[0].meta.changes!==1)fail(conflictMessage,409);
 return {month,count:normalized.length,fileId,rows:normalized,revision:await recordRevision(nextPayload)};
}
