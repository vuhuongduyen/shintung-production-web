# Quy trình thay đổi ONSPA: PR → link test → nghiệm thu → merge

Quy trình này là điểm tham chiếu cố định cho các lần làm việc sau. Assistant phải đọc tài liệu này và `AGENTS.md` khi bắt đầu, kiểm tra trạng thái thực tế rồi thực hiện trong phạm vi người dùng yêu cầu. Không thay cách làm, tạo nền tảng hoặc cuộc trò chuyện mới chỉ vì phiên làm việc thay đổi.

**Quy trình không phải quyền thường trực để sửa mã, cấp quyền, tạo credentials, merge hoặc deploy.** Chỉ dẫn cụ thể mới nhất của người dùng quyết định phạm vi mỗi lần. Lưu trên GitHub, CI đạt, preview hoạt động, người dùng nghiệm thu, merge và deployment là các trạng thái riêng biệt.

## 1. Chốt yêu cầu và nguồn mã

- Ghi rõ việc cần làm, phần giữ nguyên, tiêu chí kiểm tra và việc chưa được phép làm. Khi người dùng yêu cầu chỉ lưu snapshot/tài liệu hoặc trì hoãn sửa lỗi, dừng sửa chức năng.
- Đọc mới repo private `vuhuongduyen/shintung-production-web`, remote main, nhánh/PR đang làm và head SHA. Không dựa riêng vào SHA nhớ từ lượt trước.
- Nếu đồng bộ từ web chính, xác minh phiên bản đang active và commit nguồn; ghi provenance, những tệp đã lọc và giới hạn. Không lấy source TEST cũ ghi đè tính năng web chính, không coi source là backup DB.
- Kiểm tra working tree trước thao tác. Bảo toàn thay đổi chưa commit; dùng checkout/worktree riêng khi cần. Không reset, clean, force-push hoặc ghi đè công việc khác để làm workspace sạch.
- Dùng nhánh riêng từ base vừa xác minh. Nếu đang tiếp tục một yêu cầu có nhánh/PR được chỉ định, dùng đúng nhánh/PR đó, không tạo bản trùng. Không tự gộp PR khác hoặc đổi main/default branch.

## 2. Thực hiện và kiểm tra có mục tiêu

- Chỉ sửa phần đã được yêu cầu. Giữ DB, uploads, tài khoản, quyền, khóa Sheet, Site identity và production ngoài phạm vi thay đổi nếu chưa được phép riêng.
- Cài dependencies theo lockfile khi cần. Chạy kiểm tra phù hợp: targeted tests trước, typecheck/build khi có thay đổi mã hoặc cấu hình liên quan; ghi rõ lint/browser/full suite đã chạy hay chưa.
- Trước push, chạy `npm run test:ci-contract`, TypeScript và test nhóm tác động; build khi thay mã cần biên dịch. Gom các bản sửa có liên quan vào một lần push sau bằng chứng local; không push tiến độ nhỏ liên tục làm hủy CI. Bước nhanh không thay full CI hoặc browser.
- Khi test thất bại, phân loại harness/fixture, hợp đồng test cũ và nghiệp vụ chưa rõ. Ghi test/file, expected/actual, giả thuyết và phép kiểm chứng. Không rerun toàn bộ giống hệt nếu chưa có thay đổi hoặc lý do cụ thể; không xóa/skip/nới assertion để xanh.
- Tài liệu thuần túy không cần chạy lại test thủ công. Nếu workflow hiện hữu tự chạy do push, ghi nhận trung thực; không đổi workflow/settings hoặc dùng skip-ci để che checks.

## 3. Lưu GitHub và mở draft PR

- Trước push, rà diff, secrets/runtime data và trigger triển khai liên quan. Không đưa `.env`, credentials, DB dump, uploads, sessions hoặc backups vào GitHub. Nếu có trigger deploy ngoài quyền được giao, dừng trước bước gây deploy và báo cụ thể.
- Commit/push không force vào nhánh được chỉ định, dùng repo private. Đọc lại remote SHA và tệp đã đưa lên; không coi lệnh push chưa xác minh là thành công.
- Mở hoặc cập nhật **draft PR bằng tiếng Việt**: vấn đề, thay đổi, provenance nếu có, kết quả kiểm tra, lỗi đã biết và phần chưa kiểm. Giữ nội dung bàn giao còn đúng; không tự đánh dấu ready hoặc gửi review Approve.
- CI failed vẫn có thể lưu snapshot/tài liệu khi người dùng chấp nhận lưu để xử lý sau. Phải ghi rõ **chưa đủ nghiệm thu/ready merge**, không biến kết quả local thành CI pass.
- Push và CI build **không tự tạo link test**. Bước preview phải được thực hiện và xác minh riêng.

## 4. Preview toàn bộ ONSPA từ đúng commit

Mặc định ưu tiên tái sử dụng **GitHub Codespaces có sẵn, cổng 5173 Private**, chạy full app với Miniflare DB/FILES TEST local. Không dùng web trial cũ, mockup/component fixture hoặc giao diện sao chép để thay cho bản PR cần nghiệm thu. Không mặc định yêu cầu tài khoản Cloudflare riêng hoặc tạo Site/DB cloud mới.

### Mốc lịch sử để tìm lại, không phải xác nhận hiện trạng

- Codespace từng dùng: `spooky-poltergeist-p7pj9xpvjj96f9rj5`.
- URL lịch sử: `https://spooky-poltergeist-p7pj9xpvjj96f9rj5-5173.app.github.dev` — Private, cần đăng nhập GitHub có quyền và Codespace/server đang chạy.
- Full app PR #3 từng được xem ở mốc `91a942004861528dc1dfd607a0b89521b4d4fd50`. Đây không phải bằng chứng URL đang chạy PR #4 hay head mới nhất.
- Lệnh phát triển từng dùng: `CLOUDFLARE_CF_FETCH_ENABLED=false npm run dev`. Đây là ghi nhận lịch sử, không phải lệnh bảo đảm chạy được mọi commit. Không tự chuyển sang main hoặc chép nguyên source PR #3.
- `5174/report-review.html` là fixture riêng, không phải full-app preview được chấp nhận.

### Các điểm phải xác minh trước khi gửi link

1. Kiểm tra Codespace thực tế, repo/branch, working tree và SHA. Bảo toàn công việc/dữ liệu đang có; chạy đúng commit cần review, không chỉ đúng tên nhánh.
2. Đọc scripts/config và skill runtime/browser hiện có trước khi launch. API trả Forbidden thì ghi đúng thao tác/đích và dừng đường bị từ chối; không tự mở quyền hoặc đi vòng kiểm soát. Chỉ dùng desktop/session được phép và công cụ hỗ trợ; phải xác minh browser tool thật sự thao tác được, không suy từ trạng thái “connected”.
3. Kiểm host/origin, port forwarding và auth của chính snapshot. PR #4 v807 có allowlist localhost ở Vite/API; cần adapter phù hợp được kiểm riêng trước khi dùng host forwarded. Không mở wildcard, bỏ kiểm tra origin, tự public port hoặc copy PR #3 wholesale để cho chạy. Nếu cần thay adapter/quyền/access/credentials ngoài phạm vi hiện có, báo thay đổi cụ thể và xin phê duyệt riêng trước khi thực hiện.
4. Giữ cổng **Private**. DB/FILES dùng Miniflare local, không remote production binding, tài khoản thật, Sheet secret hoặc dữ liệu production. Không reset `.local-data`, không seed/import mặc định. Dữ liệu mẫu phải synthetic và được tạo/import tường minh trong phạm vi cho phép.
5. Xác minh đăng nhập TEST, phục hồi phiên khi reload và dữ liệu cần xem. TEST local-owner không chứng minh quyền production; session có thể phụ thuộc tiến trình. Không tự tạo/reset tài khoản hoặc chuyển credentials qua chat/log.
6. Khởi chạy server trong phiên được giữ lại khi đã đủ điều kiện. Kiểm HTTP/API, nhãn TEST, full shell/navigation và chức năng cần nghiệm thu. Kiểm desktop/mobile bằng browser thật khi có công cụ; nếu chưa có browser, ghi rõ chưa QA và không tuyên bố nghiệm thu UI.
7. Mở chính URL forwarded và kiểm quyền truy cập trước khi gửi. Gửi URL cùng SHA, phạm vi dữ liệu TEST, trạng thái server và giới hạn. Không gửi localhost của executor như link người dùng có thể truy cập. Giữ server đến khi review/bàn giao hoặc nêu rõ khi phải dừng.

Assistant chịu trách nhiệm chuẩn bị và xác minh rồi gửi link; không mặc định đẩy các lệnh kỹ thuật cho người dùng. Chỉ yêu cầu người dùng bước đăng nhập, cấp access hoặc quyết định thật sự còn thiếu, giải thích ngắn vì sao cần bước đó.

## 5. Người dùng nghiệm thu rồi mới xét merge

- Người dùng phải mở **full-app test link của đúng commit** và xác nhận các tiêu chí đã thống nhất. Ghi nhận lỗi/giới hạn còn chấp nhận hay chưa; nếu có commit mới sau nghiệm thu, nêu thay đổi và kiểm lại phần bị ảnh hưởng.
- Trước merge, đọc mới PR/head/base và trạng thái CI; xác nhận yêu cầu merge dành cho đúng PR tại thời điểm thực hiện. Nghiệm thu preview không tự đồng nghĩa cho phép merge. Không tự Approve PR hoặc coi quy trình này là lời cho phép merge tương lai.
- Nếu CI còn fail hoặc chưa đủ điều kiện nghiệm thu, giữ draft và báo blockers. Không lách branch protection/settings hoặc bỏ checks. Không tự merge trong lượt chỉ lưu snapshot/tài liệu.

## 6. Deployment MAIN là bước riêng

- Merge không mặc nhiên là cho phép deploy Site. Chỉ triển khai MAIN khi có yêu cầu/phạm vi được phép riêng; xác minh trigger tự động trước merge/push nếu có nguy cơ triển khai ngoài phạm vi.
- Dùng đúng nguồn, commit, Site và cấu hình hiện hữu; không đụng trial, DB/FILES, quyền hoặc secrets ngoài yêu cầu. Theo dõi deployment đến terminal.
- Chỉ báo web đã cập nhật khi deployment **succeeded** và đọc lại phiên bản/commit active khớp nguồn dự định. GitHub push, build, saved version hoặc merge không thay thế bằng chứng deployment.

## 7. Một nơi làm việc và checklist bàn giao

Dùng lại môi trường/cuộc trò chuyện người dùng đã chọn; không tự tạo chat, Codespace hay nền tảng mới. Nếu không gửi được tới đích đó, nói rõ chưa chuyển thành công, giữ bản bàn giao trong PR/tài liệu và không tuyên bố đã gửi. Không đưa định danh hội thoại hoặc log lỗi công cụ dài vào repo.

Mỗi lần bàn giao phải điền riêng từng trạng thái, dùng “chưa thực hiện/chưa xác minh” khi chưa có bằng chứng:

| Mục | Nội dung cần ghi |
|---|---|
| Yêu cầu và phạm vi | Việc được phép, việc hoãn, giới hạn còn giữ |
| Nguồn/GitHub | Repo private, branch, PR, exact head SHA, readback; provenance nếu sync |
| Kiểm tra | Lệnh/phạm vi, local hay CI, run link, pass/fail/cancel/skip/timeout; phần chưa kiểm |
| Lỗi đã biết | Báo cáo lỗi và blockers; không đồng nhất số test fail với số lỗi sản phẩm |
| Preview | Full-app URL, exact SHA, Private, server đang chạy hay chưa xác minh |
| Cô lập dữ liệu/auth | DB/FILES TEST local, nguồn synthetic, không production/Sheet secret; giới hạn quyền/session |
| QA/nghiệm thu | Browser thật hay giả lập; desktop/mobile; người dùng đã nghiệm thu commit nào hay chưa |
| Merge | Chưa yêu cầu/chưa làm/đã merge đúng PR, commit nếu có |
| Deploy | Chưa yêu cầu/chưa làm/pending/failed/succeeded; active version/commit readback nếu có |

Tài liệu liên quan: [CI](CI.md), [bàn giao lỗi đã biết](BUG-HANDOFF-2026-11-02.md), [chẩn đoán và hướng xử lý](CI-RESIDUAL-DIAGNOSIS-2026-11-02.md). Báo cáo lỗi là mốc lịch sử; luôn đọc kết quả của head hiện tại khi quyết định bước tiếp theo.


## Tiết kiệm phút GitHub — cập nhật bản nháp 05/11

Theo [cấu hình CI](CI.md), nhánh làm việc gửi lên GitHub rồi mở/cập nhật PR để chạy một lượt kiểm; không dùng push nhánh source-sync tạo thêm lượt full trùng PR. Main vẫn được kiểm sau merge. PR draft vẫn chạy; sửa mô tả/chuyển ready không tạo CI mới nếu commit không đổi. Bốn check giữ tên, gate nhanh/TypeScript đi trước ba shard; khi gate đạt vẫn chạy đủ toàn bộ test cuối. Lỗi gate không được coi là full suite đạt.

Trình tự xử lý lỗi: đọc đúng log/head → nhóm nguyên nhân → sửa → quick + targeted trước/sau + kiểm cần thiết → gom push → theo dõi đúng run tới terminal. Không rerun giống hệt chỉ để thử may mắn, không bỏ test/assertion/skip-ci hoặc đổi quyền/billing. Báo source, local, CI và browser riêng; cấu hình mới trong PR chưa tự cập nhật main hay cấp quyền merge/deploy. Nghiệm thu ứng dụng có thể làm song song trên checkpoint app có manifest khớp; phải ghi chính xác SHA/phạm vi và kiểm diff nếu head chỉ đổi tooling/docs.
