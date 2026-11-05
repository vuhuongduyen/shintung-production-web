# CI tự động

## Trigger và tránh chạy trùng — bản nháp 05/11

Workflow `.github/workflows/ci.yml` chạy khi PR vào `main` được mở/cập nhật commit/mở lại (kể cả draft), và khi push vào `main`. Không chạy thêm push nhánh `source-sync/live-v807-20261102`; cùng lần cập nhật nhánh có PR chỉ cần lượt PR. Chuyển draft sang ready hoặc sửa mô tả không đổi commit nên không tự chạy lại. Nhánh chưa có PR cần kiểm local trước; mở PR mới sẽ chạy CI. Push main sau merge vẫn kiểm riêng commit main mới, không bỏ bước này để tiết kiệm.

Concurrency dùng workflow + số PR, hoặc ref main khi không có PR; commit mới hủy lượt cũ của cùng PR/main, không hủy PR khác. Không dùng skip-ci, lọc paths hoặc đổi assertions. Workflow mới chỉ có hiệu lực trên nhánh chứa nó; main và các nhánh cũ chưa thay đổi cho tới khi merge/cập nhật được phép, không gọi bản nháp là cấu hình toàn repo đã phát hành. Cơ chế nhóm/hủy theo [GitHub Docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency).

## Bước nhanh trước các shard

Node.js 24, `npm ci` theo lockfile giữ nguyên. Job **Kiểm tra kiểu dữ liệu** chạy `npm run test:ci-contract` rồi `npm run typecheck`. Lệnh nhanh gồm test cấu hình CI, chuẩn phản hồi nút dùng chung và cách ly snapshot TEST; không cần build, có Miniflare rỗng cho kiểm migration. Bản chuẩn bị local 19/19 trong khoảng 1,8–2,2 giây, không phải số phút billing GitHub.

Ba job **Build và kiểm thử (1/3)**, **(2/3)**, **(3/3)** chờ job trên. Nếu kiểm nhanh/TypeScript không đạt, mỗi shard chạy một bước báo lỗi rồi kết thúc trước checkout/cài deps/build; không trả success do skipped. Run đã bị cancel không khởi động thêm shard. Nếu đạt, cả ba vẫn `npm ci` → `npm run build` → runner đầy đủ; giữ fail-fast:false, timeout và tất cả tests. Quan hệ needs/if theo [GitHub Docs](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-jobs).

Giữ nguyên bốn tên check, không cấp quyền checks:write hoặc đổi settings. Đọc endpoint nhánh main ngày05/11 thấy protected=false, required_status_checks enforcement_level=off, contexts/checks rỗng; đây là quan sát tại main d8dbb1e, không là quyền merge hoặc xác nhận mọi tích hợp ngoài. Trước merge phải đọc lại trạng thái thật và vẫn cần nghiệm thu theo quy trình. Không mở quyền khi endpoint không truy cập được.

Gate lỗi vẫn dùng runner ngắn để báo đúng check failure; không hứa chi phí bằng0. Lượt đạt có thể tăng thời gian chờ do gate trước shard; chưa bỏ ba build/cài deps để tránh rủi ro fixture/Worker và artifact riêng tư. Tiết kiệm được nhắm vào lượt trùng sự kiện và lỗi hợp đồng sớm, không cam kết giảm một tỷ lệ tổng phút cố định. Test nhanh xuất hiện lại trong full suite; không cộng hai lần vào số tests độc lập.

Trên GitHub, job build/test dùng ba shard với `node scripts/ci/run-tests.mjs <shard> 3`. Danh sách file sắp xếp được phân chia theo chỉ số modulo, mỗi file thuộc đúng một shard; `fail-fast: false` giữ các shard khác chạy khi có lỗi. Chia job giúp giảm thời gian chạy liên tục sau khi lượt không chia shard bị runner shutdown (exit 143) trước thống kê cuối. Local không truyền tham số vẫn chạy toàn bộ danh sách.

Mỗi tiến trình Node kiểm thử có giới hạn V8 heap 2048 MiB; vượt giới hạn là lỗi, không phải bỏ qua. Giới hạn này tránh một diagnostic DOM/React quá lớn chiếm hết bộ nhớ runner. Mỗi file có giới hạn 180 giây: khi hết thời gian, cả nhóm tiến trình của file bị dừng và file được tính lỗi, sau đó tiếp tục file kế tiếp. Không dùng force-exit để biến test còn giữ handles thành đạt. Cuối lượt có `CI SUMMARY` gồm các file lỗi/timeout, tổng pass/fail/cancelled/skipped/todo mà Node đã báo và danh sách file thiếu thống kê cuối. Không suy đoán số test của file bị dừng; tổng báo cáo không phải tổng đầy đủ nếu danh sách đó khác rỗng.

Không lọc bỏ các test kế thừa, không dùng `continue-on-error`. Đặc biệt `tests/test-export-isolation.test.mjs` vẫn kiểm tra TEST từ chối kết nối remote và migrations tạo DB rỗng. Theo hợp đồng snapshot v807 được duyệt, JSON nền và hosting metadata phải khớp hash/bytes trong manifest; đường dẫn runtime/credential và JSON ngoài manifest bị từ chối. Có negative tests cho các kiểm tra này.

Phạm vi chưa bao phủ: lint, file benchmark/capture không mang đuôi `.test.mjs`, kiểm thử trình duyệt thật, production, và độ đầy đủ của mọi yêu cầu nghiệp vụ. Có test dùng DOM giả lập và Miniflare local; kết quả này không thay thế QA trình duyệt. Local pass không đồng nghĩa GitHub Actions pass.

Workflow chỉ có `contents: read`, không dùng `pull_request_target`, secrets production, bước deploy/merge/import dữ liệu hoặc thay quyền. Checkout không giữ credential. Không tải lên artifact chứa source/dữ liệu/log; log chuẩn của Actions nằm trong repo riêng tư. Việc chạy kiểm thử có thể tạo dữ liệu synthetic và bản build tạm trong runner, không nối DB production.

## Kiểm chứng thay đổi quy trình

- YAML được parse bằng js-yaml sẵn trong lockfile; test local kiểm trigger (push source-sync + PR chỉ một lượt, draft PR/main vẫn có), bốn tên check, Node/actions/readonly, gate failure/success/cancel, lệnh full suite và concurrency. Không có actionlint ở executor; không tuyên bố đã chạy actionlint hoặc mô phỏng toàn engine GitHub.
- Fault injection local tạo tạm component synthetic có FeedbackActionButton disabled thiếu reason: test nhanh báo18pass/1fail đúng nguyên nhân; file được dọn bằng finally, sau đó19/19 đạt. Không sửa/skip test hoặc đẩy fixture lỗi. Kiểm nhanh hỏng chưa phải kết quả full suite.
- Checkpoint ứng dụng a74ace7 đạt CI41965631284,1.806/1.806 trong294file; TypeScript/ba build/bốn checks success. Thay đổi quy trình không sửa app/handler/fixtures nghiệp vụ. CI đúng head workflow mới cần đọc riêng; browser có thể kiểm gói ứng dụng a74 song song, không chờ để chỉnh UI thêm.
- Gộp thay đổi liên quan sau quick/targeted/typecheck local vào một push. Không đẩy docs tiến độ thành nhiều commit trong khi đang chờ CI; cập nhật PR mô tả phù hợp. Không manual rerun cùng SHA nếu chưa có lý do hạ tầng cụ thể hoặc bản sửa. Không thay billing, quota hoặc mua thêm.
