# Kết nối kho Google Sheet và ONSPA

Chưa có kết nối tự động cho đến khi hoàn tất cài đặt dưới đây.

1. Giữ bản sao code Apps Script kho hiện tại. Ngưng nút/lịch gọi KHO_TP_dayHoanCongSangKho ở file SX cũ; không xóa dữ liệu NHAP.
2. Trên web, đăng nhập Admin → Nhập kho → Nhập từ Sản xuất báo công → Kết nối Google Sheet. Nhập ID file kho, bấm Tạo / cấp lại khóa. Sao chép khóa, chỉ hiển thị một lần.
3. Trong Apps Script của file kho: thay code xác nhận cũ bằng toàn bộ KHO_TP_XAC_NHAN.gs. Không để hai bản trùng hàm/hằng số. Giữ các file nghiệp vụ khác; toàn dự án chỉ có một onOpen, gọi KHO_TP_taoMenuKho_ trong onOpen hiện có nếu cần.
4. Tạo thêm file ONSPA_KHO_WEB.gs, dán toàn bộ code tương ứng. Không dán file SX_DAY_NHAP_KHO_TP cũ vào dự án kho.
5. Chạy ONSPA_caiDatKetNoi một lần bằng tài khoản quản trị file kho; cấp quyền Google yêu cầu; nhập URL web và khóa ở bước 2. Tài khoản này tạo lịch tự chạy mỗi phút.
6. QLSX xác nhận báo công thành phẩm: web vẫn tạo phiếu; Sheet nhận trong lần chạy tiếp theo, thường khoảng một phút, có thể chậm theo lịch Apps Script. Ngày nhập lấy thời điểm xuất trạm, không lấy ngày duyệt.
7. Kho chọn dòng NHAP và dùng menu xác nhận cũ. Nhập N nếu số lượng khác, P nếu chênh lệch. Kho cần dùng tài khoản Google nhận diện được email. Kết quả được gửi ngay về web, không cần xác nhận lại.
8. T = ĐÃ ĐỒNG BỘ WEB mới là đã gửi thành công. Nếu lỗi: xem U. Giữ kết quả xác nhận tại Sheet và tự gửi lại mỗi phút. Không sửa tay M/R/S để thử xác nhận lại.

Chỉ phiếu mới được đánh dấu chờ đồng bộ sau bản cập nhật này được xuất. Không tự bù lịch sử: ID cũ/phiếu ERP cần đối chiếu riêng. Phiếu đã được xác nhận trên web bằng thông tin khác sẽ báo xung đột, không ghi đè.

Môi trường thử phải dùng bản sao Sheet riêng và khóa riêng. Code chặn file kho thật khi kết nối web thử. Giữ múi giờ file kho và Apps Script GMT+7.

Kiểm tra trước khi dùng thật: nhận đủ; nhận lệch có lý do; thử lại cùng phiếu không trùng; mất kết nối rồi gửi lại; khóa sai bị từ chối. Không dùng phiếu giả trong file kho thật.

Tắt kết nối trên web sẽ dừng quyền truy cập của script. Cấp lại khóa làm khóa cũ hết hiệu lực; chạy lại bước 5.

Nếu SX điều chỉnh ngày xuất trạm hợp lệ: lần đồng bộ tiếp theo cập nhật riêng cột A (Ngày nhập kho), giữ nguyên xác nhận, số lượng và người kho. Chỉ áp dụng phiếu đã liên kết ONSPA_WEB.

## Sửa kết nối 24/10/2026
Nếu đã nhập URL/khóa nhưng cài đặt báo lỗi: thay toàn bộ WEB.gs bằng ONSPA_KHO_WEB.txt mới, lưu rồi chạy ONSPA_khoiPhucKetNoi. Hàm dùng lại khóa đã lưu, kiểm tra kết nối trước khi tạo lịch mỗi phút; không nhập hoặc xác nhận phiếu khi kiểm tra. Không tạo khóa mới chỉ để thử lại. Nếu TOKEN_INVALID, chạy ONSPA_caiDatKetNoi nhập khóa hiện hành. NOT_CONFIGURED: kiểm tra URL; DISABLED: kiểm tra cấu hình Admin.
