// Display projection only: preserve stored event kinds and source data.
export function correctionOperation(row){
 if(row.stageReporting&&row.stageAction)return ({start:'Nhập trạm',extra:'Nhập trạm',pause:'Tạm ngưng',resume:'Tiếp tục',complete:'Xuất trạm',add:'Bổ sung người',transfer:'Chuyển người',cutover:'Mốc tiếp nối'})[row.stageAction]||row.operation||'';
 const name=String(row.sourceTimeLog?row.sourceOperation:row.operation||'').trim().toLocaleUpperCase('vi');
 if(['BẮT ĐẦU','NHẬP TRẠM'].includes(name)||row.kind==='start')return 'Nhập trạm';
 if(['HOÀN THÀNH','XUẤT TRẠM'].includes(name)||['complete','completion'].includes(row.kind))return 'Xuất trạm';
 if(['TẠM NGƯNG','TẠM DỪNG'].includes(name)||row.kind==='pause')return 'Tạm ngưng';
 if(name==='TIẾP TỤC'||row.kind==='resume')return 'Tiếp tục';
 return row.operation||row.sourceOperation||'';
}
export function correctionDisplayRows(events,reports){
 const rows=events.filter(e=>String(e.sourceOperation||e.operation||'').trim().toLocaleUpperCase('vi')!=='BÁO CÔNG').map(e=>({...e,operation:correctionOperation(e)}));
 for(const report of reports){
  const candidates=rows.filter(e=>e.operation==='Xuất trạm'&&(e.reportId===report.id||e.sourceId===report.sourceId&&Date.parse(e.effectiveAt)===Date.parse(report.completedAt)));
  const event=candidates.find(e=>!e.voided&&e.reportId===report.id)||candidates.find(e=>!e.voided);
  if(event)event.hoursReport=report;
  else rows.push({...report,operation:'Xuất trạm',hoursReport:report});
 }
 return rows;
}
