# SX báo công: giảm lượt đọc và giữ bảng khi mở lại

Ứng viên từ staging sau PR #31 (4819644). MAIN v827 source 7bfbe3a khác staging. Chỉ tạo PR, chưa merge/deploy. Không sửa menu khác, quyền, schema, dữ liệu hoặc trigger Kho.

## Thay đổi

- Cửa sổ tổng hợp tăng từ 25 lên tối đa 100 lệnh, độc lập với 10 dòng giao diện. Giảm lặp đọc nguồn lịch sử; vẫn tuần tự từng cửa sổ, byte-bound 512 KiB mỗi phản hồi dữ liệu, kiểm cursor, lọc, tổng và quyền Line.
- Giữ snapshot đúng URL/user/Line sau TTL 30 giây. Mở lại component hiện bảng cũ trong khi kiểm tra mới, khóa ghi đến khi xác minh. Trang đã xác minh trong component hiện hành vẫn thao tác khi refresh nền. Đổi phiên/quyền và 401/403 xóa cache. Không dùng localStorage hoặc cache máy chủ.
- Bỏ chữ cập nhật nền lặp trên cùng trang; giữ thông báo kiểm tra trang mới và lỗi đọc.
- Log chậm nhận nhãn /api/production-order-pages thay cho other, không thêm payload hoặc định danh.

## Bằng chứng

MAIN trước sửa: 122 lượt DB cho một trang Admin; API thành công 13,8–21,4 giây, có lượt hủy 25–26 giây. Không coi đây là toàn bộ thời gian người dùng chờ. Nhãn production_history_import có thể nhận cả truy vấn scope chứa biểu thức import, không đồng nhất với lượt chỉ đọc riêng import.

Fixture 126 lệnh (101 A / 25 B), 126 phiếu đã duyệt, import không liên quan: baseline 45 lượt DB, ứng viên 17, giảm 62,2%. Cùng total=126, quantity=12600, approved=2520; trang 11 bắt đầu BUDGET-100, trang vượt giới hạn Line A trả đúng 1 lệnh. Bản ghi trước/sau bất biến. Không suy ra tốc độ MAIN theo tỷ lệ này.

37 ca mục tiêu/hồi quy đạt, gồm cache hết hạn, khóa ghi đến khi kiểm tra, cập nhật nền không khóa trang đã xác minh, cách ly user/URL/phiên, quyền Quick Line, import thưa, legacy, totals/pending/ACK, CSV, chi tiết và cursor đồng thời. TypeScript và build đạt.

## Chưa nghiệm thu

Cần đo từ bấm menu đến bảng có dữ liệu và thao tác được trên Admin/Line A/B: mở mới, mở lại, hết TTL, lỗi/timeouts, đổi quyền; tính cả hủy/thử lại. Chưa đo trình duyệt bản sửa. Tổng vẫn cần quét số lệnh phù hợp; đây chưa phải mô hình tổng hợp tăng dần, không bảo đảm dữ liệu rất lớn. Mục tiêu mở đầu 3–5 giây chưa được xác nhận. Chỉ mở rộng menu khác sau khi SX báo công đạt. Source MAIN khác staging: promotion phải áp riêng delta, không chép đè.
