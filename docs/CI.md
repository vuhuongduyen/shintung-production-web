# CI tự động

Workflow `.github/workflows/ci.yml` chạy khi PR vào `main` được mở/cập nhật/mở lại (kể cả draft), khi chuyển sang chờ review, và khi push vào `main` hoặc `source-sync/live-v807-20261102`. Push nhánh có PR đang mở có thể tạo hai lượt riêng; concurrency hủy lượt cũ cùng sự kiện/ref.

Các job độc lập dùng Node.js 24 (phù hợp engines >=22.13.0), `npm ci` theo lockfile:

- Kiểm tra kiểu dữ liệu: `npm run typecheck`.
- Build và kiểm thử: `npm run build`, sau đó `node scripts/ci/run-tests.mjs`, chạy tuần tự tất cả `tests/*.test.mjs` bằng Node test runner. Build trước vì test Worker render cần `dist/server`. Nếu build thất bại, bước test không chạy.

Trên GitHub, job build/test dùng ba shard với `node scripts/ci/run-tests.mjs <shard> 3`. Danh sách file sắp xếp được phân chia theo chỉ số modulo, mỗi file thuộc đúng một shard; `fail-fast: false` giữ các shard khác chạy khi có lỗi. Chia job giúp giảm thời gian chạy liên tục sau khi lượt không chia shard bị runner shutdown (exit 143) trước thống kê cuối. Local không truyền tham số vẫn chạy toàn bộ danh sách.

Mỗi tiến trình Node kiểm thử có giới hạn V8 heap 2048 MiB; vượt giới hạn là lỗi, không phải bỏ qua. Giới hạn này tránh một diagnostic DOM/React quá lớn chiếm hết bộ nhớ runner. Mỗi file có giới hạn 180 giây: khi hết thời gian, cả nhóm tiến trình của file bị dừng và file được tính lỗi, sau đó tiếp tục file kế tiếp. Không dùng force-exit để biến test còn giữ handles thành đạt. Cuối lượt có `CI SUMMARY` gồm các file lỗi/timeout, tổng pass/fail/cancelled/skipped/todo mà Node đã báo và danh sách file thiếu thống kê cuối. Không suy đoán số test của file bị dừng; tổng báo cáo không phải tổng đầy đủ nếu danh sách đó khác rỗng.

Không lọc bỏ các test kế thừa, không dùng `continue-on-error`. Đặc biệt `tests/test-export-isolation.test.mjs` vẫn kiểm tra TEST từ chối kết nối remote và migrations tạo DB rỗng. Theo hợp đồng snapshot v807 được duyệt, JSON nền và hosting metadata phải khớp hash/bytes trong manifest; đường dẫn runtime/credential và JSON ngoài manifest bị từ chối. Có negative tests cho các kiểm tra này.

Phạm vi chưa bao phủ: lint, file benchmark/capture không mang đuôi `.test.mjs`, kiểm thử trình duyệt thật, production, và độ đầy đủ của mọi yêu cầu nghiệp vụ. Có test dùng DOM giả lập và Miniflare local; kết quả này không thay thế QA trình duyệt. Local pass không đồng nghĩa GitHub Actions pass.

Workflow chỉ có `contents: read`, không dùng `pull_request_target`, secrets production, bước deploy/merge/import dữ liệu hoặc thay quyền. Checkout không giữ credential. Không tải lên artifact chứa source/dữ liệu/log; log chuẩn của Actions nằm trong repo riêng tư. Việc chạy kiểm thử có thể tạo dữ liệu synthetic và bản build tạm trong runner, không nối DB production.
