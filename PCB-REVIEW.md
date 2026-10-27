# PCB — Đối chiếu nền TEST v749

Ngày kiểm tra: 27/10/2026 (GMT+7). Chỉ bản sao, chưa push, tạo PR, merge hoặc triển khai.

## Nguồn và phương pháp
- Site source v749: `f66cb2701613eda59dc3880af5eedcc8b3a9764e`; metadata mới nhất vẫn v749; deployment đã xác minh succeeded. Checkout không có thay đổi chưa commit.
- Nền v745: `082ae9695affd8694da0077010956eb0213be4d9`; dùng ZIP đã làm sạch và đối chiếu delta đầy đủ từ Git, không dùng v745 thay cho source mới.
- GitHub main đối chiếu: `a00b50e188b576154d2ee260064722468fe5adad`; import gốc `c6fc5834474581bb994063be196efee57727f9d2`. API compare: ahead 2 commits, đúng 2 tệp của PR #1.
- SHA blob của SHA256SUMS nền khớp GitHub. Hai tệp menu sau ghép khớp toàn bộ blob GitHub: app/page.tsx `b3585b0506351d61b2fbf1aa8392b40bfa30bf5c`; navigation-labels.ts `b4208c94a38cb9b8fe2081969300ebb38fc2cab7`.
- Không tải toàn bộ checkout remote GitHub để kiểm từng blob. Diff dựng từ ZIP nền có manifest khớp và patch PR #1; giới hạn này được ghi trong DIFF-SUMMARY.json.

## Thay đổi giữ lại từ Site
Có 11 tệp thay đổi giữa Site v745 và v749: ghép 10 tệp mã/test; không mang docs/FUNCTION_STATUS.md chứa lịch sử nội bộ vào TEST. Thay bằng báo cáo này.
- Logic khóa báo công theo hostname và thời gian, giao diện banner và đồng hồ hết hạn.
- Hủy báo công theo ngày, lưu trước/sau, kiểm tra xung đột và liên kết kho.
- Chuyển lệnh mới có đối chiếu và kiểm tra phạm vi.
- Đã giữ PR #1: menu tiếng Việt Hệ thống báo công, nhãn Anh/Trung và khóa phân quyền không đổi.

## Phân biệt TEST với production
Giữ nguyên config/local-test.json, config/local-files.json, vite.config.ts, .env.example và package-lock.json của nền TEST. Chỉ DB/FILES Miniflare local. Không có .openai/hosting.json, CI/CD, uploads, DB dump, tài khoản thật hoặc khóa kho. Các hostname mới thay bằng main.example.invalid / trial.example.invalid. Chức năng chỉ dành cho production không kích hoạt trên localhost; kiểm thử gọi hàm với hostname giả và dữ liệu tổng hợp. Không tự tạo tương đương thao tác trên Site thật.

Các ngoại lệ cá nhân, dữ liệu JSON nền và màn minh họa cũ vẫn giữ cách làm sạch v745. Gói không phải bản sao nghiệp vụ đầy đủ với dữ liệu thật và không dùng để ghi đè production. Mã tích hợp vẫn có thể tồn tại nhưng không có thông tin kết nối thật. Không thay khóa hoặc kết nối trên web chính.

## Kiểm thử thực hiện
- TypeScript: PASS. Build: PASS (cảnh báo chunk lớn và phân loại route của Vinext).
- 11/11 test: khóa/hết hạn GMT+7; hủy giữ ERP/audit; xung đột và phiếu kho chặn hủy; chuyển lệnh đúng phạm vi/không ghi trùng/giữ dữ liệu khác; cấu hình TEST chặn remote và biến môi trường cloud; migration lặp lại vẫn 0 bản ghi; không có manifest production/dữ liệu JSON nền.
- Dùng dependency đã cài tương ứng lockfile; không chạy lại npm ci trên máy mới.
- Chưa nghiệm thu trình duyệt hoặc chạy toàn bộ test lịch sử đã loại khỏi bản xuất.

## Cách PCB đối chiếu
1. Kiểm SHA256SUMS.txt và SOURCE-PROVENANCE.json.
2. Đọc DIFF-SUMMARY.json và UPDATE-FROM-GITHUB-MAIN.patch (patch chỉ mã/test/package, metadata bàn giao đọc riêng).
3. Trên thư mục TEST độc lập: npm ci; npm run test:export; npm run typecheck; npm run build.
4. Nếu cần xem UI: npm run db:init; npm run test:account; npm run dev. Tạo tài khoản TEST mới, không nhập DB hay credentials production.
5. Ghi nhận giới hạn local/hostname trước khi duyệt. Việc duyệt gói không tự đẩy GitHub hoặc phát hành Site.
