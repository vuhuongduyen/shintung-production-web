# Tình trạng bàn giao mã nguồn ONSPA

## Đã có trong mã nguồn

- Khung website ONSPA, header, menu ngang, menu trái và giao diện responsive.
- Các màn hình dữ liệu cơ bản, SKU Master, Lead Time và Safety Days.
- Các màn hình BOM và Phiếu thay đổi BOM.
- Khung và dữ liệu minh họa cho Kế hoạch sản xuất, Quản lý sản xuất và Quản lý kho.
- API bản ghi dùng Cloudflare D1 cùng schema/migration `app_records`.
- Dữ liệu JSON hiện đang dùng để dựng và minh họa một số màn hình.
- Script build, kiểm tra và cấu hình triển khai hiện tại.
- Tài liệu/thử nghiệm sao lưu Windows trong `public/windows-backup/` và `docs/BACKUP_RESTORE_HANDOFF.md`.

## Chưa đi kèm trong ZIP

- Dữ liệu thực tế đang lưu trong Cloudflare D1 của website hiện tại.
- Biến môi trường và cấu hình bí mật của môi trường đang triển khai.
- Mật khẩu, token, khóa API và thông tin đăng nhập.
- Lịch sử Git của môi trường Sites hiện tại.

## Chưa hoàn thiện để vận hành chính thức

- Chưa kiểm thử nghiệm thu đầy đủ toàn bộ nghiệp vụ và quyền người dùng.
- Chưa xác nhận đầy đủ quy trình nhập/xuất/chuyển kho và hoàn tác tồn bằng dữ liệu thực tế.
- Chưa hoàn tất kết nối toàn bộ dữ liệu Google Sheet/ERP hoặc nguồn dữ liệu trung tâm.
- Chưa có quy trình tự động sao lưu và khôi phục D1 đã được kiểm thử từ đầu đến cuối.
- Chưa cấu hình môi trường GitHub/Vercel/Cloudflare đích trong repository của người nhận.
- Một số màn hình vẫn dùng dữ liệu JSON minh họa; cần chuyển sang database/API trước khi vận hành nhiều người dùng.
- Build ứng dụng thành công. Bộ kiểm tra tự động còn hai lỗi kiểm tra cũ: Node không nạp trực tiếp module `cloudflare:` và kỳ vọng CSS scrollbar không còn khớp với CSS được tạo hiện tại. Đây không phải lỗi build nhưng cần cập nhật test trước khi thiết lập CI bắt buộc.

## Việc cần làm trước khi đưa vào sử dụng

1. Xuất riêng dữ liệu D1 hiện tại và kiểm tra khả năng khôi phục.
2. Tạo database cho môi trường mới, chạy migration và nhập dữ liệu.
3. Cấu hình đăng nhập, phân quyền và tài khoản quản trị bằng secret của môi trường.
4. Kiểm thử từng quy trình xác nhận/hủy xác nhận và lịch sử thay đổi.
5. Kiểm thử đồng thời nhiều người dùng và khả năng khôi phục khi có sự cố.
6. Chỉ chuyển sang link chính thức sau khi có biên bản nghiệm thu và bản sao lưu phục hồi được.
