// Temporary production-only hold requested while ERP data is being imported.
export const reportingHoldEndsAt='2026-10-30T17:00:00+07:00';
export function productionReportingHold(hostname,now=Date.now()) {
 const active=hostname==='sanxuat.shintung-vn-4458.chatgpt.site'&&Number(now)>=Date.parse('2026-10-27T00:00:00+07:00')&&Number(now)<Date.parse(reportingHoldEndsAt);
 return active?{active:true,endsAt:reportingHoldEndsAt,remainingMs:Date.parse(reportingHoldEndsAt)-Number(now),message:'Tạm khóa nhập báo công trên web chính đến 17:00 ngày 30/10/2026 để nhập dữ liệu ERP. QLSX vẫn được xác nhận các phiếu đã có theo quyền. Tự mở lại lúc 17:00 ngày 30/10/2026 (GMT+7).'}:null;
}
export function reportingWriteBlocked(path,body={}) {
 if(path==='/api/production-report')return !(body.action==='review'&&body.approve===true);
 if(path!=='/api/production-workflow')return false;
 return !!body.stageEntries||['start','complete','pause','resume','transfer','add','reduce','extra','incident','incident-create'].includes(body.action);
}
