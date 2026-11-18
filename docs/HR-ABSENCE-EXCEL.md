# Nhập và hủy Excel vắng mặt

PR #49 đã merge staging và triển khai QA v29. Bản bổ sung TRVS/giao diện đang kiểm, chưa phát hành MAIN.

## Chức năng

- Ghi nhận chấm công: sau Quay lại có Tải file Excel và Hủy lần nhập. Giữ nhập thủ công.
- XLSX một sheet, tối đa 5 MB/100 dòng mỗi lần, giới hạn giải nén 20 MB. Đọc tại trình duyệt; không ghi R2/file gốc. Theo yêu cầu mới 17/11, chọn file tự kiểm tra/lưu bằng một request; không thêm nút kiểm tra/xác nhận/hủy tải hoặc bỏ dòng.
- Đối chiếu id/sourceEmployeeId duy nhất và tên. PN/VR/HL1 là Nghỉ, 15P là Đi trễ đúng khoảng giờ; TRVS tự nhận diện chung Đi trễ, về sớm. Nhập thủ công chỉ chọn Nghỉ hoặc Đi trễ, về sớm; nhóm lịch sử gom hai loại cũ khi xem/lọc, không ghi lại payload. Không suy đoán mã mới.
- Cột thời lượng giữ để đối chiếu; giờ vắng tính theo lịch hiện hành và loại các khoảng nghỉ. Không trừ giải lao hai lần.
- Máy chủ kiểm lại quyền, tháng, nhân viên, giờ và mã; lưu dòng hợp lệ, bỏ qua dòng trùng/lỗi và hiển thị số lượng/lý do. Không ghi đè. Khi lỗi mạng/quá tải, không tự retry; kết quả chưa xác nhận phải tra lịch sử lần nhập trước khi người dùng chủ động tải lại. API preview cũ giữ tương thích, không dùng trong luồng tự lưu.
- Chỉ HR không giới hạn Line và Admin. Giữ kỳ khóa ngày 10 tháng sau, policy bảo toàn lịch sử, các quyền và bindings hiện có.
- Một giao dịch tạo sự kiện và metadata lần nhập. Guard cursor/policy/manifest/danh mục, mã lần nhập và kiểm trùng chống lưu lặp, thay đổi đồng thời và phản hồi mất.
- Lịch sử phân trang 20 lần nhập. Chọn theo tên/thời điểm/người nhập, xem tác động và nhập lý do trước hủy. Sự kiện gốc giữ nguyên; cancellation và trạng thái lần nhập được ghi trong một giao dịch.
- Nếu một dòng đã sửa/hủy/thay thế hoặc hết kỳ, chặn toàn bộ lần hủy. Hủy lại không ghi thêm. Dữ liệu thủ công và file khác giữ nguyên.

## Trả lại giờ và hiệu năng

Nhập rồi hủy trả giờ về trước nhập nếu dữ liệu khác không đổi. Nếu lịch/phân công đổi, giờ theo dữ liệu còn hiệu lực; không khôi phục đè bằng số cũ. Không viết lại snapshot/report lịch sử, sản lượng, kho hoặc Capacity.

Đọc sự kiện theo nhân viên và đầy đủ chuỗi supersession kể cả bản sửa chuyển sang người khác. Không tải In Transit/report cho nhập Excel. Ghi nhận HR thuần túy không thay phân bổ/nhập trạm nên không chạy lại toàn bộ kiểm tra phân bổ lịch sử. Nhập thủ công theo nhân viên trong chế độ sản lượng dùng đọc có phạm vi, nhận xác nhận lưu ngay rồi gộp refresh nền.

100 dòng TEST: một giao dịch, khoảng 0,44–0,50 giây cục bộ. Không phải số đo MAIN, chưa đo tải lớn hoặc đồng thời trên Site.

## Kiểm tra

- 81 test cuối: import/cancel API và DOM, parser, nhập thủ công, production workflow và tải client đạt.
- 24 hợp đồng CI local, TypeScript và build đạt. Hồi quy riêng scope/attendance controls/duration cũng đạt.
- HTTP TEST xác minh phiên HR, từ chối viewer giả quyền, chặn generic record overwrite.
- Kiểm tra preview không ghi, replay, trùng, thủ công/file khác, chỉnh sửa hậu nhập, kỳ khóa, sai dữ liệu, nghỉ trưa/giải lao, lịch đổi, cursor/directory/policy đổi đồng thời.
- Parser thực tế đọc đủ cấu trúc file mẫu, không nhập vào DB. Không đưa file mẫu hoặc dữ liệu người dùng vào repository. Mọi test ghi dùng database TEST tạm riêng.
- QA v29: đã đăng nhập Admin, mở màn HR và đọc lịch sử nhập không lỗi. Browser upload chưa kiểm do tiện ích chưa được cấp quyền đọc file; cần hoàn tất bước này trước nghiệm thu. Bản bổ sung TRVS/toolbar cần QA lại sau triển khai.
- Chưa đối chiếu toàn bộ phiếu thật, chưa phát hành MAIN; chưa thể tuyên bố nghiệm thu đầy đủ.

## Source

Base staging 518d501 (PR47), đối chiếu ba tệp HR/duration/workflow khớp MAIN v844 b2f5357 trước sửa. Điểm nối chung: production-management, production-workflow, report-model, route guard, translations. Trước merge/deploy phải đọc lại PR/head/base/live, kiểm phần giao nhau và triển khai lần lượt.


17/11: cập nhật yêu cầu TRVS dùng chung “Đi trễ, về sớm”; nhập thủ công chỉ chọn Nghỉ hoặc Đi trễ, về sớm. Bản ghi cũ giữ nguyên payload, gom nhãn khi xem/lọc. Điều chỉnh thứ tự thanh HR theo vị trí đã chọn, bỏ phân trang trùng của lịch sử nhập. Chưa triển khai bản bổ sung này.

Bản bổ sung tự lưu: chỉ một request thay vì preview + save, giảm đọc dữ liệu/lịch lặp. Chuỗi sửa/hủy đọc khóa liên kết nhẹ một lượt có phân trang, duyệt bằng map trong bộ nhớ rồi chỉ tải payload của nhân viên liên quan; bỏ truy vấn SQL đệ quy quét JSON lặp. Cần đo trên QA; chưa kết luận đã hết quá tải D1 thật.
