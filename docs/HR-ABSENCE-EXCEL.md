# Nhập và hủy Excel vắng mặt

Ứng viên PR riêng; chưa merge, triển khai hoặc nghiệm thu trên web thật.

## Chức năng

- Ghi nhận chấm công: sau Quay lại có Tải file Excel và Hủy lần nhập. Giữ nhập thủ công.
- XLSX một sheet, tối đa 5 MB/100 dòng mỗi lần, giới hạn giải nén 20 MB. Đọc tại trình duyệt; không ghi R2/file gốc. Chọn file không gọi API ghi.
- Đối chiếu id/sourceEmployeeId duy nhất và tên. PN/VR/HL1 là Nghỉ, 15P là Đi trễ đúng khoảng giờ; TRVS cần chọn Đi trễ/Về sớm. Không suy đoán mã mới.
- Cột thời lượng giữ để đối chiếu; giờ vắng tính theo lịch hiện hành và loại các khoảng nghỉ. Không trừ giải lao hai lần.
- Xem trước không ghi. Phải xử lý/bỏ dòng lỗi và kiểm lại trước xác nhận. Bỏ qua dòng trùng cả với nhập thủ công, không ghi đè.
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
- Browser QA chưa thực hiện: preview bị automatic approval review chặn vì lo ngại chuyển source sang dịch vụ ngoài; không đi vòng hạn chế. Cần preview được phép trước nghiệm thu giao diện và tốc độ Site.
- Chưa đối chiếu toàn bộ phiếu thật, chưa merge/deploy QA hoặc MAIN; chưa thể tuyên bố nghiệm thu đầy đủ.

## Source

Base staging 518d501 (PR47), đối chiếu ba tệp HR/duration/workflow khớp MAIN v844 b2f5357 trước sửa. Điểm nối chung: production-management, production-workflow, report-model, route guard, translations. Trước merge/deploy phải đọc lại PR/head/base/live, kiểm phần giao nhau và triển khai lần lượt.
