# Khôi phục TEST

Gói dữ liệu không chứa mã nguồn hoặc dependencies. Ghép cùng folder nguồn ONSPA, cài dependencies theo README của Project (Node >=22.13). Không chứa mật khẩu TEST hoặc phiên đăng nhập; đặt tài khoản/mật khẩu riêng trên máy mới.

Giải nén ZIP vào thư mục riêng. Trong các lệnh dưới thay PROJECT và BUNDLE bằng đường dẫn tuyệt đối; TARGET phải là thư mục **chưa tồn tại**, nằm dưới `PROJECT/.local-data/restore-tests/`.

```text
node BUNDLE/restore/import-d1.js PROJECT BUNDLE TARGET
node BUNDLE/restore/upload-r2.js PROJECT BUNDLE TARGET
node BUNDLE/restore/verify-restore.js PROJECT BUNDLE TARGET
```

Script import kiểm checksum, tạo cấu trúc từ schema SQLite đã đọc thật và nhập tất cả cột. `database/schema.sql` là nội dung migration nguồn, không phải bản dump SQL dữ liệu giả. Raw JSON giữ nguyên chuỗi payload và dấu xóa. Mọi thời gian xuất dùng UTC (Z).

Chỉ gói đầy đủ/R2 có tệp gốc. Gói D1 vẫn kèm manifest để biết tệp cần bổ sung. Không tự ghi đè database hoặc bucket đang sử dụng. Không kết nối R2/D1 trực tuyến. Sau khi verify thành công cần cấu hình môi trường đích riêng nếu muốn chạy ứng dụng với bản khôi phục; script không tự đổi cấu hình preview.

Các bản ghi backup đang chuẩn bị trong snapshot là trạng thái tại thời điểm chụp, không phải tác vụ sẽ được chạy lại sau restore. Thư mục backups/ trong R2 không được lồng vào gói.

## R2 metadata / format

`ONSPA-FULL-v2` lưu `httpMetadata` và `customMetadata` trên từng object trong `manifests/backup-manifest.json`. `cacheExpiry` được lưu ISO 8601 UTC, phục hồi dưới dạng `Date`; so sánh metadata theo tên trường, không theo thứ tự. Verify v2 kiểm bytes, kích thước, D1, số object **và** metadata; chỉ khi tất cả đạt mới xuất `verified:true`.

Gói `ONSPA-FULL-v1` **không có metadata nguồn**: mặc định upload/verify từ chối. Chỉ khi chủ động chấp nhận **khôi phục bytes-only**, thêm `--legacy-bytes-only` vào **cả** lệnh upload-r2 và verify-restore. Khi đó kết quả ghi `verified:false`, `metadataVerified:false`, `metadataStatus:"unknown"`; không được xem là bản khôi phục đầy đủ. Không thay đổi ZIP hay checksum gói cũ. Không áp dụng tùy chọn này cho production.
