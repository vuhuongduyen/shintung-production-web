# CI tự động

Workflow `.github/workflows/ci.yml` chạy khi PR vào `main` được mở/cập nhật/mở lại (kể cả draft), khi chuyển sang chờ review, và khi push vào `main` hoặc `source-sync/live-v807-20261102`. Push nhánh có PR đang mở có thể tạo hai lượt riêng; concurrency hủy lượt cũ cùng sự kiện/ref.

Hai job độc lập dùng Node.js 24 (phù hợp engines >=22.13.0), `npm ci` theo lockfile:

- Kiểm tra kiểu dữ liệu: `npm run typecheck`.
- Build và kiểm thử: `npm run build`, sau đó `node scripts/ci/run-tests.mjs`, chạy tuần tự tất cả `tests/*.test.mjs` bằng Node test runner. Build trước vì test Worker render cần `dist/server`. Nếu build thất bại, bước test không chạy.

Mỗi file có giới hạn 180 giây: khi hết thời gian, cả nhóm tiến trình của file bị dừng và file được tính lỗi, sau đó tiếp tục file kế tiếp. Không dùng force-exit để biến test còn giữ handles thành đạt. Cuối lượt có `CI SUMMARY` gồm các file lỗi/timeout, tổng pass/fail/cancelled/skipped/todo mà Node đã báo và danh sách file thiếu thống kê cuối. Không suy đoán số test của file bị dừng; tổng báo cáo không phải tổng đầy đủ nếu danh sách đó khác rỗng.

Không lọc bỏ các test kế thừa, không dùng `continue-on-error`. Đặc biệt `tests/test-export-isolation.test.mjs` vẫn được chạy: giả định không có hosting manifest và JSON nghiệp vụ phải rỗng có thể xung đột snapshot Site v807 đã được duyệt giữ. Lỗi đó cần đánh giá riêng, không thay nghiệp vụ hoặc test trong thay đổi CI này.

Phạm vi chưa bao phủ: lint, file benchmark/capture không mang đuôi `.test.mjs`, kiểm thử trình duyệt thật, production, và độ đầy đủ của mọi yêu cầu nghiệp vụ. Có test dùng DOM giả lập và Miniflare local; kết quả này không thay thế QA trình duyệt. Local pass không đồng nghĩa GitHub Actions pass.

Workflow chỉ có `contents: read`, không dùng `pull_request_target`, secrets production, bước deploy/merge/import dữ liệu hoặc thay quyền. Checkout không giữ credential. Không tải lên artifact chứa source/dữ liệu/log; log chuẩn của Actions nằm trong repo riêng tư. Việc chạy kiểm thử có thể tạo dữ liệu synthetic và bản build tạm trong runner, không nối DB production.
