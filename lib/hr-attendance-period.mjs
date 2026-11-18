/** HR's calendar-month entry window, inclusive through day 10 of the next month in GMT+7. */
export function hrAttendanceDeadline(date){
 const month=String(date||'').slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return null;
 const next=new Date(`${month}-01T00:00:00Z`);next.setUTCMonth(next.getUTCMonth()+1);
 return `${next.toISOString().slice(0,7)}-10`;
}
export function hrAttendancePeriodOpen(date,now=Date.now()){
 const deadline=hrAttendanceDeadline(date);if(!deadline)return false;
 return new Date(now+7*3600000).toISOString().slice(0,10)<=deadline;
}
export function assertHrAttendancePeriod(date,now=Date.now()){
 if(!hrAttendancePeriodOpen(date,now))throw Object.assign(new Error(`Đã hết hạn ghi nhận tháng ${String(date).slice(0,7)}. Hạn cuối là hết ngày ${hrAttendanceDeadline(date)?.split('-').reverse().join('/')} (giờ Việt Nam).`),{status:409});
}

/** Same deadline explanation for manual entry, Excel preflight and server validation. */
export function hrAttendancePeriodWarning(date,now=Date.now()){
 const deadline=hrAttendanceDeadline(date);
 if(!deadline||hrAttendancePeriodOpen(date,now))return '';
 return `Tháng ${String(date).slice(5,7)}/${String(date).slice(0,4)} đã hết hạn ghi nhận từ sau ngày ${deadline.split('-').reverse().join('/')} (giờ Việt Nam). Không lưu dữ liệu quá hạn.`;
}
export function hrImportDateIssue(date,month,now=Date.now()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(String(date))||!Number.isFinite(Date.parse(date))||new Date(`${date}T00:00:00Z`).toISOString().slice(0,10)!==date)return 'Ngày không hợp lệ.';
 return hrAttendancePeriodWarning(date,now)||(date.slice(0,7)!==month?'Ngày trong file khác tháng đang chọn. Chọn đúng tháng trước khi nhập.':'');
}
