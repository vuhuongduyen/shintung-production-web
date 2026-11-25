// Describe the persisted workflow only; this projection never grants permission.
export function capacityReadiness(row, approved=false) {
 if(approved)return 'approved';
 if(!row)return 'missing';
 if(row.reviewStatus==='rejected')return 'rejected';
 if(row.status==='Đã xác nhận'&&row.reviewStatus==='pending'&&row.request?.kind==='capacity'&&row.request?.status==='pending'&&row.request.version===row.version)return 'pending';
 if(row.status==='Đã xác nhận'&&row.reviewStatus==='await-sync')return 'await-sync';
 if(row.status==='Nháp')return 'draft';
 return 'unknown';
}
export function scheduleReadinessMessage(week,line,states) {
 const stage=Array.isArray(states)?states.find(s=>s.key===`${week}:${line}`)?.stage||'missing':'unknown';
 const date=String(week).split('-').reverse().join('/');
 const steps={
  missing:'Chưa có lịch dự kiến/Capacity được lưu cho tuần và Line này. QLSX cần lập và lưu lịch dự kiến, xác nhận Capacity rồi đồng bộ sang KHSX.',
  draft:'Lịch dự kiến/Capacity đang ở bản nháp, QLSX chưa xác nhận. QLSX cần hoàn thiện lịch, xác nhận Capacity rồi đồng bộ sang KHSX.',
  'await-sync':'QLSX đã xác nhận Capacity nhưng chưa đồng bộ sang KHSX. QLSX cần đồng bộ Capacity để gửi KHSX xét duyệt.',
  pending:'QLSX đã đồng bộ Capacity sang KHSX. Đang chờ KHSX xét duyệt và đồng ý.',
  rejected:'KHSX đã từ chối Capacity. QLSX cần xem phản hồi tại Capacity tuần và xử lý theo quy trình trước khi gửi lại.',
  unknown:'Chưa xác định được bước còn thiếu của lịch dự kiến/Capacity. Hãy tải lại và kiểm tra trạng thái tại Capacity tuần; chưa thể kết luận đang chờ KHSX.',
  approved:'Chưa tải được lịch đã duyệt. Hãy tải lại dữ liệu; nếu vẫn thiếu, liên hệ quản trị để kiểm tra.'
 };
 return `Chưa có lịch làm việc được duyệt cho tuần ${date} · Line ${line}. ${steps[stage]||steps.unknown} Chưa thể nhập Lịch SX thực tế, bao gồm Phụ kho.`;
}
