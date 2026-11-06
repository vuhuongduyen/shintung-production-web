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


## Source thu hồi sản lượng ngày — chưa triển khai

Phần dưới là hợp đồng bản phát triển PR #7, không phải hướng dẫn chạy ngay trên kho thật. Chưa đủ nghiệm thu: giao diện QLSX và sửa/hủy khi kho chưa nhận còn đang hoàn thiện; chưa tự kiểm browser hoặc recalculate thực tế Google Sheets. Không cấp lại khóa hay tạo kết nối chỉ để thử source này.

- Kho chưa xác nhận: QLSX sửa/hủy theo luồng trực tiếp; không bắt Kho duyệt thu hồi. Kho đã xác nhận: QLSX yêu cầu, Kho quyết định, sau đó mới vô hiệu hóa dòng và đối soát kết quả.
- Source gồm ba file `KHO_TP_XAC_NHAN.gs`, `ONSPA_KHO_WEB.gs` (TXT cùng nội dung) và helper `ONSPA_STOCK_FORMULAS.gs`. Thêm các hàm menu vào onOpen hiện có; không tạo onOpen thứ hai. Việc cập nhật Apps Script/công thức thật cần bước triển khai được duyệt riêng.
- Công thức tồn phải loại trạng thái M `ĐÃ HỦY THEO YÊU CẦU SX` và V `KHO ĐỒNG Ý HỦY`. Helper hiện chỉ lập kế hoạch chuyển mẫu hỗ trợ, không tự ghi công thức. Bridge kiểm công thức NHAP tại SKU bị ảnh hưởng và chặn nếu chưa loại trừ, không công nhận chỉ tô màu/ẩn dòng là đã thu hồi.
- Chọn đúng dòng NHAP, dùng menu Đồng ý/Từ chối thu hồi. Cần email Google hiện hành và quyền sửa dòng; không dùng tài khoản chủ script thay người quyết định. Đọc đối chiếu và xác nhận trước khi gửi.
- Giữ nguyên dòng, lượng đề xuất E, lượng nhận N, người/thời điểm nhận R/S. Trạng thái và lịch sử quyết định được ghi riêng; ghi chú W giữ mã đối soát cùng ghi chú cũ. Không xóa dòng, đặt lượng bằng 0 hoặc tạo dòng thay thế cho dòng gốc bị mất.
- Web chỉ coi thu hồi hoàn tất sau bằng chứng đúng phiên bản từ Sheet. Trong lúc chờ, số lượng cũ còn hiệu lực. Lỗi hoặc mất phản hồi giữ mã lượt cũ; thử lại không tạo quyết định/thu hồi thứ hai. Nếu ID trùng, dữ liệu gốc khác, thiếu dòng/công thức, xử lý đối soát riêng, không sửa tay để vượt kiểm tra.
- TEST phải dùng Sheet sao chép cô lập và khóa TEST hiện có. Kiểm cả nhận thiếu/0, từ chối, quyền, mất phản hồi sau ghi, di chuyển dòng, công thức chưa cập nhật và dữ liệu thay đổi đồng thời trước mọi nghiệm thu thật.

### Source sửa/hủy trước Kho nhận (PR #7, chưa triển khai)

QLSX dùng Sửa / hủy trước Kho nhận; không dùng menu thu hồi của Kho. Web giữ lượng cũ và báo chờ đối soát, Sheet kiểm đúng dòng chưa có N/R/S rồi áp đề xuất/ngày hoặc vô hiệu hủy. Ghi chú W lưu marker và lượng/ngày gốc; không xóa ghi chú này khi còn chờ. Kho chưa được xác nhận nhận hàng nếu marker chưa acknowledged. Nếu đã nhận trước, script gửi sự thật nhận hàng về Web và không áp thay đổi đề xuất; sau đó dùng quy trình thu hồi.

Cần cập nhật cả KHO_TP_XAC_NHAN, ONSPA_KHO_WEB và helper công thức bằng một kế hoạch được nghiệm thu. Thiếu helper thì chặn, không tự bỏ guard. Phiếu gốc chưa xuất lần đầu: chờ đồng bộ rồi sửa/hủy; không tạo dòng thay thế để vượt lỗi. ACK từ dòng luôn kiểm ID duy nhất toàn cột, kể cả retry khi Web không còn trả lệnh trong pull.
