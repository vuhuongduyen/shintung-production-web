# Lịch sản xuất thực tế — PR giữ lựa chọn

## Phạm vi
Giữ tuần, Line và bộ lọc đã áp dụng bằng display store hiện có, theo tài khoản/quyền/Line đã xác minh. Bộ lọc lịch tách theo Line đang chọn. Không lưu lý do, bản nháp lịch, dialog, nhân viên được chọn hoặc quyền ghi. Bỏ khóa tuần sessionStorage dùng chung. Tài khoản/Line đổi làm remount workspace; API hiện tại vẫn xác minh quyền, trạng thái và phiên bản.

## Phối hợp nguồn
Base GitHub staging 0f0fa6b55dafa6ca042e243bcbd0fe53817350b1. MAIN đã đọc source v842 c831dd863882660137755a919dd4f74ca12ee367; production-management.tsx khớp baseline trước sửa. PR43 sửa daily-approval-queue; PR44 sửa progress-review và API legacy close, không trùng các hunk của PR này. Không sửa display store, auth, API, D1/R2, migration hoặc quy trình xác nhận. Staging sau đó có PR43 tại e656b5d; đối chiếu lại trước merge theo yêu cầu.

## Bằng chứng
- Browser MAIN trước sửa: phiên Admin hiện bảng lịch lưu sẵn, nút lưu khóa rồi mở sau đọc mới; chọn Line B, reload và mở lại lịch trở về A. Reload trong mẫu trở lại tab Tiến độ; đây là vấn đề shell/đa tab dùng chung cần phối hợp, chưa sửa app/page.tsx trong PR này.
- Mounted regression: giữ tuần/Line và ghi chú server trước response; cập nhật mới giữ ngữ cảnh; bộ lọc tháng đã áp dụng khôi phục; trường tra cứu chưa bấm Tìm kiếm không tự áp dụng; lý do/bản nháp không persist. Đổi user/quyền/Line và HTTP403 không hiển thị lại lịch cũ. Lưu gửi đúng approvedVersion; HTTP409 giữ bản nháp, không báo thành công.
- 19 test retained/display-store/profile transition; 11 lookup/draft; 11 API cutover attendance/context/display-merge; 24 CI contracts đạt. TypeScript và build đạt.
- Mẫu mounted synthetic: hiện snapshot ~34ms, cập nhật response được chủ động trả ~86ms. Không phải thời gian mạng production hoặc bằng chứng backend nhanh.

## Chưa nghiệm thu
Chưa kiểm bản sửa trên full-app browser với dữ liệu TEST, đăng xuất/đăng nhập thật, mọi tài khoản/Line, đối chiếu toàn bộ dữ liệu hoặc thời gian tải nền production. Giữ draft. Phần tải nền tách PR riêng sau đo và đối chiếu; không dùng kết quả cache để tuyên bố hoàn tất tốc độ. Không merge/deploy khi chưa được yêu cầu.
