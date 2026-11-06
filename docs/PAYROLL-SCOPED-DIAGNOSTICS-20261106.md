# Cảnh báo Hiệu suất đúng phạm vi Line

## Lỗi và phạm vi

Tài khoản chỉ xem Line A không được trả lịch B hoặc ngày làm việc của người B. Backend vẫn trả id/tên/Line/trạng thái tối thiểu của người B có điều chuyển liên quan đến A để đối chiếu. Bộ tính tháng trước đây tính diagnostics cho cả A+B từ payload đã giới hạn, rồi ghép các cảnh báo B và coi ngày nhân sự bị ẩn là thiếu thật. Ví dụ synthetic trước sửa đồng thời báo thiếu lịch B, thiếu phân công B và thiếu ngày bắt đầu người B trong màn A.

Bản sửa xuất phát từ nhánh staging `ce4636b804f02f031fce70a7b3fcd83df575742f`, độc lập với PR #7. Hai module ứng dụng khớp initial remix v810 trong manifest nguồn đã đối chiếu. Lỗi được tái hiện bằng fixture; chưa kiểm màn này trên MAIN và không khẳng định dữ liệu MAIN hiện gặp đúng tình huống.

## Thay đổi

- Chỉ tính giờ, sản lượng và diagnostics cho các Line có trong phạm vi xem. Không dựng cảnh báo từ lịch Line khác không được cung cấp.
- Người điều chuyển từ Line khác vẫn giữ giờ tham gia đã có căn cứ ở Line đang xem. Thông tin ngày nhân sự ngoài phạm vi được đánh dấu chưa thể đối chiếu theo quyền; không tạo ngày giả, không coi là thiếu ngày bắt đầu.
- Giữ cảnh báo chung cần quyền cả A+B và không phân bổ/trả quỹ khi chưa đủ quyền. Giờ làm ở Line khác không thể tính từ payload bị giới hạn hiển thị chưa có căn cứ, không giả số 0.
- Cảnh báo thật về lịch, giờ, ngày nhân sự hoặc Line gốc không hợp lệ trong dữ liệu được phép vẫn chặn như trước. Người đủ quyền hai Line vẫn được kiểm cả hai, kể cả cảnh báo và điều kiện của người điều chuyển.

Không sửa JSX/CSS, layout, backend projection, quyền, cấu hình, dữ liệu, lịch sử, công thức chia quỹ, định mức hoặc schema. Chỉ hai file ứng dụng: `lib/production-payroll-month.mjs` và `lib/production-payroll.mjs`.

## Bằng chứng kiểm thử

- Hồi quy synthetic trước/sau cho A/B, ngày nhân sự bị giới hạn, lịch/ngày/Line thật sự sai, không đọc lịch Line ngoài phạm vi, lịch sử quỹ và các khoản đóng góp độc lập. Ví dụ đủ quyền giữ phân bổ 3 triệu mỗi Line, tổng 6 triệu, nhân viên điều chuyển nhận đúng phần ở từng Line.
- Worker đã build, xác thực mật khẩu bình thường của tài khoản synthetic chỉ xem A và tài khoản đủ quyền; query yêu cầu B không mở phạm vi. Payload vẫn chỉ trả lịch A và thông tin tối thiểu của người B liên quan, không thêm người B không liên quan. GET/tính toán không ghi lại business records, quyền hoặc audit cũ.
- Mounted component thật với transport giả kiểm cảnh báo, selector Line bị khóa, tiêu đề bảng không đổi và tài khoản đủ quyền. Đây là JSDOM, không thay kiểm browser/pixel trên Site.
- Kiểm các bài hiện có về vắng/phụ kho, điều chuyển, điều kiện nhận, quỹ, xuất và quyền Line. TypeScript/build và CI được báo theo commit cuối; không cộng các nhóm kiểm bị trùng thành số test độc lập.

## Đưa lên web thử

Chỉ cập nhật chọn lọc hai module ứng dụng trong source Site QA hiện có `appgprj_6aed30807a6c8191bfcc31f6ec1d4291`. Trước áp dụng phải so hash base; giữ hosting identity, guard QA, dữ liệu snapshot, tài khoản/quyền, DB/FILES, cấu hình tích hợp và các tệp đang chờ. Không seed, import, migration hay sửa dữ liệu để chứng minh lỗi. PR/CI, deployment và browser là ba trạng thái riêng.

Sau build/publish QA, đọc lại source/version/deployment active và dùng browser với tài khoản Line A cùng tài khoản đủ quyền. Kiểm màn Hiệu suất/nhân viên/lịch sử quỹ, cảnh báo thật, ngày/Line, người điều chuyển, không xuất tiền từ dữ liệu bị giới hạn; kiểm desktop/mobile giữ bố cục. Chưa báo hoàn tất hoặc gửi bản mới cho người dùng nếu deployment/browser chưa có bằng chứng. MAIN và PR #7/#8 không được hợp nhất hoặc triển khai trong lượt sửa này.
