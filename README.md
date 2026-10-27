# ONSPA — nền TEST v749, giữ PR #1

Nguồn: web chính ONSPA, version **749**, commit gốc **f66cb2701613eda59dc3880af5eedcc8b3a9764e**. Đối chiếu metadata Sites và Git ngày 27/10/2026 (GMT+7): version 749 gắn commit này; deployment `succeeded`.

Đây là bản sao đã làm sạch, không phải commit nguyên trạng và không chứa dữ liệu/tài khoản/quyền thực tế. Không có Git remote, CI/CD, cấu hình triển khai Site hay khóa kho thật. Không có thao tác push GitHub hoặc triển khai nào được thực hiện khi xuất gói.

## Chạy local

Cần Node.js >=22.13 và npm, có Internet để tải dependency theo lockfile. Các dependency của Vinext/Cloudflare có executable theo hệ điều hành; hãy chạy `npm ci` trên máy đích, không chép node_modules từ máy khác.

```sh
npm ci
npm run db:init
npm run test:account
npm run dev
```

Mở http://127.0.0.1:5173. Lệnh `test:account` hỏi tên và mật khẩu TEST mới; không có mật khẩu mặc định trong gói. DB/FILES local nằm trong `.local-data/`, được Git bỏ qua. `db:init` chỉ tạo/migrate DB local rỗng; không nạp dữ liệu thật. File `.env.example` chỉ có chú thích và giá trị mẫu; không cần khóa cloud để chạy TEST. Không đặt biến DATABASE_URL, CLOUDFLARE_API_TOKEN hoặc khóa production vào môi trường local.

```sh
npm run typecheck
npm run build
```

`npm run dev` là cách chạy local được hỗ trợ trong gói này. Build tạo output kiểm tra; đưa lên GitHub chỉ lưu source, không tự làm website hoạt động trên GitHub Pages. Muốn hosting ở nơi khác cần thiết kế cấu hình backend D1/SQLite, FILES, xác thực và secrets riêng; chưa có cấu hình triển khai ở đây.

## Cấu trúc

- `app/`, `components/`, `lib/`, `hooks/`: giao diện và nghiệp vụ.
- `worker/`, `scripts/local/`: API và môi trường local.
- `db/schema.ts`, `drizzle/*.sql`, `drizzle/meta/`: schema, lịch sử migration; không phải DB dump. Migration 0006 là quy tắc lịch sử xóa snapshot tồn kho, chỉ chạy trong DB local mới khi làm theo hướng dẫn này.
- `package.json`, `package-lock.json`: dependency; lockfile giữ nguyên từ commit gốc.
- `config/local-*.json`: TEST loopback, không remote.
- `SOURCE-PROVENANCE.json`, `EXPORT-CHANGES.json`, `SHA256SUMS.txt`: nguồn gốc và danh mục kiểm tra.

## Những gì đã làm sạch trong bản sao

Dữ liệu JSON nền SKU/BOM/giờ công/tồn kho/nhu cầu và danh sách tài khoản nhúng được làm rỗng. Tên nhân viên, username ngoại lệ, email và mã hàng minh họa được thay bằng giá trị mẫu; các ngoại lệ cá nhân cần cấu hình lại khi thử ở môi trường riêng. Ba tên phụ kho là ba tên mẫu, không phải nhân viên thật. Một số màn hình minh họa tĩnh cũ chứa dữ liệu thật được thay bằng thông báo không có dữ liệu mẫu. Các màn hình nghiệp vụ lấy dữ liệu từ API vẫn có source.

Bỏ fixture/test lịch sử, báo cáo bàn giao cũ, seed dữ liệu, QA capture, công cụ restore/deploy và gói backup Windows. Bỏ `.openai/hosting.json`; Vite chỉ có binding local mẫu. Plugin snapshot source trả null trong bản xuất, nên chức năng tải bản sao source qua web không hoạt động trong gói này. Tích hợp kho/đồng bộ môi trường dùng địa chỉ `.invalid` và Sheet ID mẫu; không kết nối kho thật.

Giữ mã xử lý nghiệp vụ, không xuất bản ghi từ DB, tài khoản, session, uploads hay bí mật. Không đưa `node_modules`, build output, DB local tạo lúc kiểm tra, `.git`, cache hoặc file môi trường thật vào ZIP. Không nhập lại dữ liệu từ ZIP/backup cũ.

## Phạm vi xác minh

Đã đối chiếu commit; kiểm tra cú pháp/TypeScript và build; chạy migration trên DB TEST mới (0 bản ghi); quét mẫu secret và kiểm tra danh mục ZIP. Đã kiểm tra HTTP local: trang chủ trả 200; API test-environment xác nhận TEST, remote=false và yêu cầu tạo tài khoản mới. Build có cảnh báo chunk lớn của Vite. Không có kiểm thử nghiệp vụ với dữ liệu thật, nghiệm thu mọi màn hình hoặc thử triển khai GitHub/hosting mới. Bộ test lịch sử không nằm trong gói vì có fixture và thông tin nội bộ; không tuyên bố đã chạy toàn bộ bộ test đó trên bản đã làm sạch.

Web chính và web thử, DB, tệp, tài khoản và quyền đang chạy không bị sửa bởi việc xuất này.


## Cập nhật nền TEST v749
Giữ menu tiếng Việt “Hệ thống báo công” đã merge tại PR #1. Chỉ cập nhật mã; không có dữ liệu từ DB. `config/local-test.json`, `config/local-files.json`, `.env.example`, Vite local và lockfile giữ nguyên nền TEST. Các tính năng khóa/hủy báo công và chuyển lệnh có source mới, nhưng cổng hostname được đổi thành main.example.invalid / trial.example.invalid: không kích hoạt trên localhost và không kết nối Site thật. Kiểm thử mô phỏng gọi hàm trực tiếp với dữ liệu tổng hợp trên Miniflare local.

Chạy `npm run test:export` để chạy 11 kiểm thử mục tiêu. Đọc PCB-REVIEW.md, DIFF-SUMMARY.json và UPDATE-FROM-GITHUB-MAIN.patch trước khi cập nhật repo. Đây là bản sao độc lập: chưa push/PR/merge/deploy. Không dùng gói để ghi đè production.
