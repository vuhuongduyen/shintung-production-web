# ONSPA — Sao lưu và khôi phục

Trạng thái hiện tại: bộ kiểm thử Windows cục bộ, phiên bản `BKP-20260908-02`.

## Quyết định đã thống nhất

- Không tạo website hoặc dự án mới.
- Chưa chạy sao lưu, xóa hoặc khôi phục trên dữ liệu chính thức.
- Bộ PowerShell dùng `F:\CompanyBackups` làm nơi lưu cục bộ trên máy Windows; website không truy cập trực tiếp đường dẫn này.
- Chế độ `TEST_LOCAL` chỉ tạo dữ liệu thử, kiểm tra ZIP, manifest, SHA-256, log, Task Scheduler và giải nén vào `restore-test`.
- API xuất D1 thật và khôi phục production tiếp tục bị khóa.
- Khi người dùng thông báo đã có máy chủ, phải kiểm tra lại hệ điều hành, database, thư mục mã nguồn, thư mục upload, tài khoản dịch vụ và nơi lưu sao lưu trước khi kích hoạt.
- Chỉ Super Admin được truy cập và gọi API; quyền phải được kiểm tra ở backend.
- Lịch mặc định: 12:00 thứ Bảy, múi giờ `Asia/Ho_Chi_Minh`, có sao lưu bù và khóa chống chạy trùng theo tuần ISO.
- Khôi phục cần hai lần xác nhận, xác thực lại mật khẩu và chuỗi `shintungvn`.
- Luôn tạo và kiểm tra bản sao an toàn trước khôi phục; thử trên staging, không thử phá hủy bằng dữ liệu chính thức.

## Việc cần làm khi có máy chủ

1. Xác nhận kiến trúc triển khai chính thức và tạo môi trường staging.
2. Thiết lập xác thực thật, password hash và vai trò Super Admin ở backend.
3. Chọn adapter lưu trữ: thư mục bền vững/NAS trên máy chủ hoặc object storage.
4. Tạo bảng metadata, audit bất biến, scheduler state, distributed lock và maintenance state.
5. Tạo ZIP tạm, manifest, SHA-256; kiểm tra Zip Slip, ZIP bomb, symlink và tương thích.
6. Thiết lập scheduler và cơ chế chạy bù.
7. Xây quy trình staging restore, chuyển đổi nguyên tử và rollback.
8. Chạy đầy đủ bộ kiểm thử trong yêu cầu gốc trước khi mở nút Khôi phục.

## Trạng thái giao diện hiện tại

Menu `Hệ thống người dùng → Sao lưu và khôi phục` đã được dành sẵn. Giao diện chỉ hiển thị trạng thái và điều kiện kích hoạt; mọi nút thao tác đều bị vô hiệu hóa và không có API nguy hiểm phía sau.
