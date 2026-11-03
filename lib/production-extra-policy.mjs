// Extra work is for a date with no scheduled HC or OT work on this Line.
// Lunch, breaks and after-hours on a scheduled date are not unscheduled days.
export const extraWorkBlockedMessage='Line đã có lịch làm việc trong ngày này. Không được chọn Làm việc phát sinh; hãy dùng Nhập trạm hoặc Tiếp tục theo lịch.';
export function hasScheduledWorkday(references,line,date){
 return references.some(r=>(r.line===line||r.key?.split(':').at(-1)===line)&&(r.days||[]).some(d=>d.date===date&&(d.working===true||d.ot===true)));
}
