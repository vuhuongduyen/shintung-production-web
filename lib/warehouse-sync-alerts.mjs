// Read-only signals from the existing ONSPA bridge state, not a stock recount.
export const WAREHOUSE_SYNC_WARNING_MS=5*60*1000;
const pendingKinds=new Set(['daily-pending-edit','daily-pending-cancel']);
const withdrawalKinds=new Set(['withdrawal-request','withdrawal-approved','withdrawal-rejected']);
const stamp=value=>{if(!value)return NaN;const text=String(value);return Date.parse(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(text)?text+'+07:00':text);};
export function warehouseSyncAlert(receipt,{now=Date.now()}={}) {
 const p=receipt,s=p?.sheetSync;
 if(p?.source!=='Sản xuất'||!p.reportId||!s||p._deleted)return null;
 const command=s.command,withdrawal=p.withdrawalRequest,correction=p.pendingCorrection;
 const result=(code,severity,message)=>({receiptId:p.id,reportId:p.reportId,lsxCode:p.lsxCode||'',sku:p.sku||'',line:p.line||'',code,severity,message,commandId:command?.id||null,commandRevision:command?.revision??null});
 if(s.status==='error'||s.error)return result('sync-error','error','Lỗi đồng bộ Kho. Cần kiểm tra phiếu, lệnh sửa/hủy và ACK trước khi gửi lại.');
 if(command){
  const request=pendingKinds.has(command.kind)?correction:withdrawalKinds.has(command.kind)?withdrawal:null;
  if(!request||typeof command.id!=='string'||!command.id||request.id!==command.id||!Number.isSafeInteger(command.revision)||command.revision<1)return result('command-mismatch','error','Mã hoặc phiên bản lệnh Kho không khớp. Chưa đủ bằng chứng đối soát; cần kiểm tra phiếu gốc.');
  const expectedRevision=command.kind==='withdrawal-request'||pendingKinds.has(command.kind)?1:2;
  if(s.status==='sent'||command.revision!==expectedRevision||pendingKinds.has(command.kind)&&(request.status!=='pending'||request.operation!==(command.kind==='daily-pending-cancel'?'daily-output-cancel':'daily-output-edit'))||withdrawalKinds.has(command.kind)&&request.status!==({'withdrawal-request':'pending','withdrawal-approved':'approved-awaiting-sheet','withdrawal-rejected':'rejected'}[command.kind]))return result('command-mismatch','error','Trạng thái hoặc phiên bản lệnh Kho không khớp. Cần đối soát đúng lượt sửa/hủy.');
 }
 const cancelled=p.cancelled===true||p.voided===true;
 const completed=correction?.status==='completed'&&!!correction.id||withdrawal?.status==='completed'&&!!withdrawal.id&&s.withdrawalId===withdrawal.id;
 if((cancelled||withdrawal?.status==='completed')&&(!cancelled||p.stockExcluded!==true||s.status!=='sent'||command||!completed))return result('cancel-proof-missing','error','Phiếu đã hủy nhưng chưa có đủ bằng chứng Kho đã loại lượng khỏi tồn. Cần đối soát lại, không tự trừ lần nữa.');
 if((correction?.status==='pending'||withdrawal?.status==='approved-awaiting-sheet')&&!command)return result('command-missing','error','Phiếu đang chờ sửa/hủy nhưng thiếu lệnh đối soát Kho. Cần kiểm tra lượt gốc.');
 if(!command&&!['pending','waiting-warehouse'].includes(s.status))return null;
 // Errors/retries update receipt.updatedAt. Their timestamp must not reset the
 // waiting window for an approved withdrawal; use the business decision first.
 const since=withdrawal?.status==='approved-awaiting-sheet'?withdrawal.decidedAt:
   command?.kind==='withdrawal-request'?withdrawal?.requestedAt:
   correction?.requestedAt||p.updatedAt||s.queuedAt||p.createdAt;
 const started=stamp(since);
 if(!Number.isFinite(started))return result('sync-time-missing','warning','Thiếu thời điểm bắt đầu đồng bộ Kho; chưa xác định được thời gian chờ. Cần kiểm tra phiếu.');
 if(now-started<WAREHOUSE_SYNC_WARNING_MS)return null;
 if(command?.kind==='withdrawal-request')return result('warehouse-decision-overdue','warning','Yêu cầu hủy đang chờ Kho xử lý quá 5 phút. Chưa phải xác nhận đã trừ tồn.');
 if(command?.kind==='withdrawal-approved'||command?.kind==='daily-pending-cancel')return result('cancel-ack-overdue','warning','Hủy đang chờ bằng chứng loại lượng khỏi tồn Kho quá 5 phút. Kiểm tra dòng gốc và ACK trước khi xử lý lại.');
 if(command)return result('correction-ack-overdue','warning','Điều chỉnh Kho đang chờ ACK đúng mã/phiên bản quá 5 phút. Cần đối soát lại phiếu.');
 return result('export-overdue','warning','Phiếu đang chờ đồng bộ Kho quá 5 phút. Kiểm tra kết nối và trạng thái dòng gốc.');
}
export function warehouseSyncAlerts(records,options) {
 const found=new Map();
 for(const row of records){const p=row.payload??row,id=row.key??row.record_key??p.id;const alert=warehouseSyncAlert({...p,id},options);if(alert)found.set(id,alert);}
 return [...found.values()].sort((a,b)=>(a.severity==='error'?0:1)-(b.severity==='error'?0:1)||a.receiptId.localeCompare(b.receiptId));
}
