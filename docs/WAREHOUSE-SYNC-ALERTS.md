# Cảnh báo đồng bộ Kho — ứng viên kiểm thử

Chỉ áp dụng phiếu nguồn Sản xuất có reportId và sheetSync của bridge ONSPA. Không theo dõi hoặc thay đổi phiếu nhập tay/ERP không thuộc bridge. Không thêm job, email, thông báo ngoài web, migration hoặc quyền mới.

## Quy tắc

- Lỗi đồng bộ hoặc sai/thiếu mã lệnh, phiên bản, trạng thái nghiệp vụ: báo ngay.
- Yêu cầu hủy chờ Kho quyết định quá 5 phút: nhắc Kho xử lý, không gọi đó là thiếu trừ tồn.
- Kho đã đồng ý hủy hoặc hủy trước Kho nhận, chờ bằng chứng loại lượng khỏi tồn quá 5 phút: cảnh báo chờ ACK.
- Điều chỉnh/khôi phục trạng thái sau từ chối chờ ACK quá 5 phút: nhắc đối soát lượt gốc.
- Phiếu đã đánh dấu hủy nhưng thiếu trạng thái hoàn tất bridge/stockExcluded: cảnh báo thiếu bằng chứng; không khẳng định tồn sai và không tự trừ lần nữa.
- Một phiếu chỉ có một cảnh báo ưu tiên. Tự hết khi đọc được trạng thái hợp lệ; lỗi tải lại không xóa cảnh báo đã có. Không ghi trạng thái đã đọc/đã xử lý vào dữ liệu nghiệp vụ.

## Hiển thị và quyền

Dùng API chuông thông báo hiện có, tái sử dụng tập phiếu đã đọc để không tăng truy vấn DB cho chuông. Nhấp nhóm Cảnh báo đồng bộ Kho mở Nhập kho và lọc phiếu cảnh báo; Xem phiếu lọc chính xác ID và hiển thị mã báo công/lệnh/phiên bản. Xem tất cả phiếu trả lại danh sách. Không chọn checkbox hay tự xác nhận khi điều hướng.

Giữ quyền đọc Kho hiện tại ở backend. Tài khoản không có quyền không nhận cảnh báo hoặc dữ liệu phiếu. Không thay quyền cộng thêm hay phạm vi tài khoản đang có. Màn Nhập kho dùng refresh chung chỉ khi đang hoạt động; không thêm reader dữ liệu SX hoặc polling riêng trong tab SX. Dừng đọc khi đang duyệt bản xác nhận.

## Giới hạn

Đây là kiểm trạng thái và bằng chứng bridge trên web trong lúc người dùng mở ứng dụng; không phải cron khi web đóng. Chưa có phép đọc lại công thức/tồn Sheet sau mỗi lần người dùng sửa tay. ACK hợp lệ chứng minh lượt xử lý theo hợp đồng bridge tại thời điểm nhận; không chứng minh Sheet không bị thay đổi về sau. Để phát hiện lệch thực tế sau ACK cần bổ sung snapshot/heartbeat đối soát chỉ đọc từ Sheet bằng trigger TEST được nghiệm thu riêng.

Không tự bật trigger thật, gửi lại, duyệt, sửa/hủy phiếu, thay công thức, đổi khóa hay đánh dấu thu hồi hoàn tất. Phần WEB.gs đầy đủ xử lý commandId/revision và test web → Sheet → ACK vẫn là công việc độc lập còn mở.

## Kiểm chứng

Base staging 22263efbde4caa9f02cca7a9c42b3d8f901ff2a5. 14/14 kiểm thử mục tiêu (9 logic, 1 API/quyền/bất biến, 4 mounted UI) đạt; 24/24 quick contracts, TypeScript và build đạt. Bộ kiểm tra mới chạy đọc thuần trên 101 phiếu bridge vừa đối soát: 0 cảnh báo và dữ liệu đầu vào bất biến. Không đưa ID, nội dung phiếu hoặc danh tính thật vào repository.

Chưa có nghiệm thu browser toàn ứng dụng, ba ngôn ngữ hay luồng Sheet TEST đầy đủ; chưa merge/QA/MAIN. Không xem CI/build hoặc mounted UI là nghiệm thu triển khai.
