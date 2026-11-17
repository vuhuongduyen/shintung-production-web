# Tốc độ lưu xác nhận sản lượng — PR độc lập

Điểm nghẽn xác định trong mã: createReviewRunner chờ refresh toàn bộ Tiến độ sau POST thành công; thời gian báo lưu vì vậy bằng thời gian ghi cộng thời gian đọc lại. API daily đã có đường ghi scoped không tính lại giờ công toàn hệ thống.

Thay đổi: chỉ với ACK hợp lệ của phiếu daily, áp dụng kết quả đã lưu vào bảng và các snapshot hiện có, kết thúc trạng thái chờ lưu rồi chạy refresh nền. Không đánh dấu thành công trước ACK. Cache hủy hiệu lực lượt đọc cũ, không để pending cũ quay lại; không kéo dài TTL. Mất phản hồi/HTTP lỗi/ACK sai/legacy vẫn chờ đối chiếu và không tự gửi lại POST. Lỗi refresh hiện qua ProductionReadBoundary, giữ kết quả đã lưu.

Backend tái sử dụng policy snapshot vừa đọc trong cùng request; giữ nguyên policy/cursor/report/order/warehouse guards và batch nguyên tử. Không thay quyền, schema, DB/R2 hoặc dữ liệu nghiệp vụ.

Đo kiểm tổng hợp (không phải mạng production): giả lập ACK 10ms và đọc lại 200ms, luồng cũ hoàn tất khoảng 210–211ms; luồng mới khoảng 10–11ms và tiếp tục đọc nền. Ý nghĩa: bỏ thời gian đọc lại khỏi thời gian chờ lưu; chưa tuyên bố thời gian D1 thật hay tốc độ production.

Kiểm thử: 36 ca client/cache/session/daily-review/ACK và 9 review-selection; TypeScript/build đạt. Có kiểm xác nhận đồng thời chỉ tạo một phiếu Kho, policy đổi trước transaction bị chặn, ACK sai không áp dụng, phiên cũ không vượt ranh giới, response trước ghi không phục hồi pending. PR40 giao diện được kiểm ghép cục bộ riêng. Chưa ghi phiếu thật trên MAIN để đo.

Nguồn staging 0a44b027; tách PR40 (production-progress-review + queue) và PR39 (production-order-pages). Chưa merge/triển khai; cần full CI và kiểm tra bản ghép cuối với MAIN/PR mới nhất trước phát hành tuần tự.
