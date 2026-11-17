# Tiến độ sản xuất: tải nhóm đang xử lý

Ứng viên tiếp theo PR #32, chỉ đề nghị PR vào staging. Chưa merge/deploy Tiến độ sản xuất. MAIN đã nhận riêng PR #32 ở v828 / 60653fcc97eaba80001b4860ed98a7c196d9edbb.

## Hành vi

- Mở menu mặc định chỉ lấy workflow chi tiết của lệnh đang xử lý. Hoàn thành đủ số lượng đã xác nhận hoặc trạng thái HỦY bị loại khỏi nhóm này. Lệnh còn bất kỳ phiếu chờ kiểm tra, kể cả công đoạn có sản lượng 0, vẫn thuộc nhóm cần xử lý.
- Chỉ khi chọn Hiển thị → Hoàn thành / Đã hủy hoặc Tất cả mới gửi yêu cầu scope=all. Sau đó dùng Tra cứu để tìm trong nhóm đã chọn. Không tải trước lịch sử.
- Máy chủ vẫn đọc bản tổng hợp trạng thái/số lượng gọn để xác định lệnh nào đang mở và nhận ra lệnh được điều chỉnh trở lại; không phải bỏ mọi lần kiểm tra metadata của lệnh cũ. Không trả báo công/chi tiết của lệnh hoàn thành hoặc hủy trong phản hồi mặc định.
- Profile progress tách khỏi full/work. Loại sourceSnapshot/history/overlapWarnings tại SQL; giữ hours, laborNotes, version, quyền, trạng thái và toàn bộ trường đối chiếu xác nhận. Danh sách không tính nhật ký giờ lũy kế hoặc đọc tổng hợp tiền lương tháng. Xem báo công chi tiết mới lấy full.
- Snapshot active và history được giữ riêng trong bộ nhớ cùng phiên, không thay thế dữ liệu full của menu khác. Khi cập nhật lỗi vẫn giữ bảng cũ. Hạn chờ 25 giây bao gồm body; giải phóng yêu cầu treo để Thử lại hoạt động, loại phản hồi muộn. Session/401/403 xóa cache.
- Nút Cập nhật dữ liệu thực sự yêu cầu bản mới, không trả lại cache còn hạn.

## Kiểm chứng và giới hạn

Fixture có 16 phiếu mang audit lớn: full 59 lượt DB / 19.064.014 byte; active progress 37 lượt / 23.209 byte. Đây là dữ liệu giả cô lập, không phải thời gian production hoặc bộ nhớ cực đại. So khớp số lượng, ngày, trạng thái runtime, quy trình và reviewSnapshot; bản ghi gốc bất biến. Kiểm tra API phân Line/quyền; lệnh đã hoàn thành/hủy chỉ xuất hiện khi yêu cầu lịch sử; phiếu 0 sản lượng chờ xác nhận không biến mất.

Mounted tests kiểm menu active không gọi scope=all trước lựa chọn, chọn lịch sử/quay lại, giữ bảng khi refresh lỗi, thử lại, không dùng profile nhẹ thay payroll. Kiểm timeout/body treo, phản hồi muộn và xóa cache khi mất quyền.

55 kiểm thử mục tiêu/hồi quy, TypeScript và build đạt.

Chưa đo tốc độ end-to-end của ứng viên trên web chính. Lượt mở đầu vẫn phụ thuộc metadata trạng thái và nguồn dữ liệu; không cam kết 3–5 giây. Khi đồng bộ phải ghép delta vào MAIN, không chép đè source staging và không sửa DB/FILES/schema/trigger.
