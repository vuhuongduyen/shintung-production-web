// Temporary production-only hold requested while ERP data is being imported.
export const reportingHoldEndsAt='2026-11-01T00:00:00+07:00';
export function productionReportingHold(hostname,now=Date.now()) {
 const active=hostname==='main.example.invalid'&&Number(now)>=Date.parse('2026-10-27T00:00:00+07:00')&&Number(now)<Date.parse(reportingHoldEndsAt);
 return active?{active:true,endsAt:reportingHoldEndsAt,remainingMs:Date.parse(reportingHoldEndsAt)-Number(now),message:'Tạm khóa báo công trên web chính đến hết 31/10/2026 để nhập dữ liệu ERP. Tự mở lại lúc 00:00 ngày 01/11/2026 (GMT+7).'}:null;
}
export function reportingWriteBlocked(path,body={}) {
 if(path==='/api/production-report')return true;
 if(path!=='/api/production-workflow')return false;
 return !!body.stageEntries||['start','complete','pause','resume','transfer','add','reduce','extra','incident','incident-create'].includes(body.action);
}
