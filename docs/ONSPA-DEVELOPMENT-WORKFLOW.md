# Quy trình thay đổi ONSPA: PR → staging → web thử → nghiệm thu → main

Quy trình này là điểm tham chiếu cố định cho các lần làm việc sau. Assistant phải đọc tài liệu này và `AGENTS.md` khi bắt đầu, kiểm tra trạng thái thực tế rồi thực hiện trong phạm vi người dùng yêu cầu. Không thay cách làm, tạo nền tảng hoặc cuộc trò chuyện mới chỉ vì phiên làm việc thay đổi.

**Quy trình không phải quyền thường trực để sửa mã, cấp quyền, tạo credentials, merge hoặc deploy.** Chỉ dẫn cụ thể mới nhất của người dùng quyết định phạm vi mỗi lần. Lưu trên GitHub, CI đạt, preview hoạt động, người dùng nghiệm thu, merge và deployment là các trạng thái riêng biệt.

**Cập nhật 07/11/2026, bổ sung vào quy trình 06/11:** dùng [nhánh/web thử cố định](STAGING-WORKFLOW.md). **Chốt toàn bộ yêu cầu → thực hiện và kiểm tra → dot xác nhận đủ yêu cầu trước merge → merge `staging` khi được phép → đồng bộ đúng bản lên web thử → dot kiểm thử thực tế → bàn giao Duyên nghiệm thu → xét PR vào `main` → triển khai MAIN khi được phép.** CI xanh hoặc đã merge chưa đủ để bàn giao. Codespaces bên dưới là lịch sử/phương án dự phòng được cho phép riêng, không còn là mặc định để gửi link. Bổ sung tài liệu này không xác nhận PR hay phiên bản ứng dụng hiện tại đã đạt.

## 1. Chốt yêu cầu và nguồn mã

- Ghi rõ việc cần làm, phần giữ nguyên, tiêu chí kiểm tra và việc chưa được phép làm. Gom yêu cầu gốc, bổ sung và các lỗi người dùng đã báo vào **một checklist của chính yêu cầu/PR đang làm**, không chỉ kiểm lỗi mới nhất. Mỗi mục có kết quả mong đợi, cách kiểm, kết quả thực tế và bằng chứng gắn với commit/môi trường. Chỉ bỏ hoặc hoãn mục khi người dùng đã đồng ý và phải ghi lại. Khi người dùng yêu cầu chỉ lưu snapshot/tài liệu hoặc trì hoãn sửa lỗi, dừng sửa chức năng.
- Đọc mới repo `vuhuongduyen/shintung-production-web`, quyền hiển thị hiện tại, remote main/staging, nhánh/PR đang làm và head SHA. Không dựa riêng vào SHA nhớ từ lượt trước.
- Nếu đồng bộ từ web chính, xác minh phiên bản đang active và commit nguồn; ghi provenance, những tệp đã lọc và giới hạn. Không lấy source TEST cũ ghi đè tính năng web chính, không coi source là backup DB.
- Kiểm tra working tree trước thao tác. Bảo toàn thay đổi chưa commit; dùng checkout/worktree riêng khi cần. Không reset, clean, force-push hoặc ghi đè công việc khác để làm workspace sạch.
- Dùng nhánh riêng từ base vừa xác minh. Nếu đang tiếp tục một yêu cầu có nhánh/PR được chỉ định, dùng đúng nhánh/PR đó, không tạo bản trùng. Không tự gộp PR khác hoặc đổi main/default branch.

## 2. Thực hiện và kiểm tra có mục tiêu

- Chỉ sửa phần đã được yêu cầu. Giữ DB, uploads, tài khoản, quyền, khóa Sheet, Site identity và production ngoài phạm vi thay đổi nếu chưa được phép riêng.
- Cài dependencies theo lockfile khi cần. Chạy kiểm tra phù hợp: targeted tests trước, typecheck/build khi có thay đổi mã hoặc cấu hình liên quan; ghi rõ lint/browser/full suite đã chạy hay chưa.
- Khi test thất bại, phân loại harness/fixture, hợp đồng test cũ và nghiệp vụ chưa rõ. Ghi test/file, expected/actual, giả thuyết và phép kiểm chứng. Không rerun toàn bộ giống hệt nếu chưa có thay đổi hoặc lý do cụ thể; không xóa/skip/nới assertion để xanh.
- Tài liệu thuần túy không cần chạy lại test thủ công. Nếu workflow hiện hữu tự chạy do push, ghi nhận trung thực; không đổi workflow/settings hoặc dùng skip-ci để che checks.

## 3. Lưu GitHub và mở draft PR

- Trước push, rà diff, secrets/runtime data và trigger triển khai liên quan. Không đưa `.env`, credentials, DB dump, uploads, sessions hoặc backups vào GitHub. Nếu có trigger deploy ngoài quyền được giao, dừng trước bước gây deploy và báo cụ thể.
- Commit/push không force vào nhánh và repo được chỉ định; không tự đổi quyền hiển thị hoặc mở rộng dữ liệu được phép đưa lên. Đọc lại remote SHA và tệp đã đưa lên; không coi lệnh push chưa xác minh là thành công.
- Mở hoặc cập nhật **draft PR bằng tiếng Việt**: vấn đề, thay đổi, provenance nếu có, kết quả kiểm tra, lỗi đã biết và phần chưa kiểm. Giữ nội dung bàn giao còn đúng; không tự đánh dấu ready hoặc gửi review Approve.
- CI failed vẫn có thể lưu snapshot/tài liệu khi người dùng chấp nhận lưu để xử lý sau. Phải ghi rõ **chưa đủ nghiệm thu/ready merge**, không biến kết quả local thành CI pass.
- Push và CI build **không tự tạo link test**. Bước preview phải được thực hiện và xác minh riêng.

## 4. Preview toàn bộ ONSPA từ đúng commit

Mặc định dùng **Site thử cố định** trong [STAGING-WORKFLOW.md](STAGING-WORKFLOW.md), D1/R2 và tài khoản bền vững. Chỉ dùng lại **GitHub Codespaces có sẵn, cổng 5173 Private** với Miniflare TEST nếu được yêu cầu riêng. Không dùng web trial cũ, mockup/component fixture hoặc giao diện sao chép để thay cho bản PR cần nghiệm thu. Không mặc định yêu cầu tài khoản Cloudflare riêng hoặc tạo Site/DB cloud mới.

### Mốc lịch sử để tìm lại, không phải xác nhận hiện trạng

- Codespace từng dùng: `spooky-poltergeist-p7pj9xpvjj96f9rj5`.
- URL lịch sử: `https://spooky-poltergeist-p7pj9xpvjj96f9rj5-5173.app.github.dev` — Private, cần đăng nhập GitHub có quyền và Codespace/server đang chạy.
- Full app PR #3 từng được xem ở mốc `91a942004861528dc1dfd607a0b89521b4d4fd50`. Đây không phải bằng chứng URL đang chạy PR #4 hay head mới nhất.
- Lệnh phát triển từng dùng: `CLOUDFLARE_CF_FETCH_ENABLED=false npm run dev`. Đây là ghi nhận lịch sử, không phải lệnh bảo đảm chạy được mọi commit. Không tự chuyển sang main hoặc chép nguyên source PR #3.
- `5174/report-review.html` là fixture riêng, không phải full-app preview được chấp nhận.

### Các điểm kiểm riêng khi dùng Codespaces dự phòng

Với Site thử cố định, thực hiện đồng bộ và kiểm thử sau merge tại mục 5.2 và [STAGING-WORKFLOW.md](STAGING-WORKFLOW.md); không áp dụng yêu cầu cổng/Miniflare bên dưới cho Site có D1/R2 riêng.

1. Kiểm tra Codespace thực tế, repo/branch, working tree và SHA. Bảo toàn công việc/dữ liệu đang có; chạy đúng commit cần review, không chỉ đúng tên nhánh.
2. Đọc scripts/config và skill runtime/browser hiện có trước khi launch. API trả Forbidden thì ghi đúng thao tác/đích và dừng đường bị từ chối; không tự mở quyền hoặc đi vòng kiểm soát. Chỉ dùng desktop/session được phép và công cụ hỗ trợ; phải xác minh browser tool thật sự thao tác được, không suy từ trạng thái “connected”.
3. Kiểm host/origin, port forwarding và auth của chính snapshot. PR #4 v807 có allowlist localhost ở Vite/API; cần adapter phù hợp được kiểm riêng trước khi dùng host forwarded. Không mở wildcard, bỏ kiểm tra origin, tự public port hoặc copy PR #3 wholesale để cho chạy. Nếu cần thay adapter/quyền/access/credentials ngoài phạm vi hiện có, báo thay đổi cụ thể và xin phê duyệt riêng trước khi thực hiện.
4. Giữ cổng **Private**. DB/FILES dùng Miniflare local, không remote production binding, tài khoản thật, Sheet secret hoặc dữ liệu production. Không reset `.local-data`, không seed/import mặc định. Dữ liệu mẫu phải synthetic và được tạo/import tường minh trong phạm vi cho phép.
5. Xác minh đăng nhập TEST, phục hồi phiên khi reload và dữ liệu cần xem. TEST local-owner không chứng minh quyền production; session có thể phụ thuộc tiến trình. Không tự tạo/reset tài khoản hoặc chuyển credentials qua chat/log.
6. Khởi chạy server trong phiên được giữ lại khi đã đủ điều kiện. Kiểm HTTP/API, nhãn TEST, full shell/navigation và chức năng cần nghiệm thu. Kiểm desktop/mobile bằng browser thật khi có công cụ; nếu chưa có browser, ghi rõ chưa QA và không tuyên bố nghiệm thu UI.
7. Mở chính URL forwarded và kiểm quyền truy cập trước khi gửi. Gửi URL cùng SHA, phạm vi dữ liệu TEST, trạng thái server và giới hạn. Không gửi localhost của executor như link người dùng có thể truy cập. Giữ server đến khi review/bàn giao hoặc nêu rõ khi phải dừng.

Assistant chịu trách nhiệm chuẩn bị và xác minh rồi gửi link; không mặc định đẩy các lệnh kỹ thuật cho người dùng. Chỉ yêu cầu người dùng bước đăng nhập, cấp access hoặc quyết định thật sự còn thiếu, giải thích ngắn vì sao cần bước đó.

## 5. Kiểm đủ yêu cầu trước merge, kiểm web thử trước bàn giao

### 5.1. Điều kiện bắt buộc trước mọi lần merge

- **dot chịu trách nhiệm đối chiếu toàn bộ checklist của yêu cầu/PR**, kể cả các yêu cầu bổ sung và phần liên quan có thể bị hồi quy. Báo cáo của người triển khai, đọc source, build hoặc CI xanh riêng lẻ không thay thế kết quả kiểm đủ yêu cầu.
- Ghi từng mục là **Đạt / Chưa đạt / Chưa kiểm / Bị chặn**. Mục Đạt phải có bằng chứng đúng candidate: bước thao tác hoặc test, expected/actual, commit/tree và môi trường. Không đánh dấu Đạt từ suy đoán hoặc từ bản cũ.
- Chạy các kiểm tra tự động áp dụng cho thay đổi và đợi CI của đúng head/base/merge tree. Với thay đổi chức năng, phải kiểm cả luồng nghiệp vụ và giao diện thực tế của candidate trong môi trường thử được phép trước merge; không dùng dữ liệu hay kết nối MAIN để thử. Nếu chưa có môi trường/công cụ/quyền kiểm, báo Bị chặn và chưa merge. Tài liệu thuần túy kiểm nội dung, liên kết và diff; ghi rõ các bài kiểm ứng dụng không áp dụng, không giả nhận đã chạy.
- **Còn bất kỳ yêu cầu trong phạm vi Chưa đạt, Chưa kiểm hoặc Bị chặn thì chưa merge**, giữ draft và xử lý trước. Không lấy việc sẽ kiểm sau merge làm lý do bỏ kiểm trước merge; không lách checks, branch protection hoặc tự Approve PR.
- Khi có commit mới, đổi base hoặc xử lý xung đột, đối chiếu lại toàn bộ checklist, kiểm lại phần bị ảnh hưởng và xác minh bằng chứng còn áp dụng cho candidate mới. Không dùng kết quả của commit/tree cũ để kết luận bản mới đạt.
- Ngay trước merge, đọc lại PR, head, base, cây mã được CI kiểm và kết quả checks. Báo rõ số mục đạt/tổng số mục, mục chưa đạt/chưa kiểm/bị chặn và kết luận **Đủ điều kiện kỹ thuật** hoặc **Chưa đủ điều kiện**. Chỉ merge khi đủ điều kiện và đã có quyền merge đúng PR/đích trong phạm vi người dùng cho phép; kết luận kỹ thuật không tự cấp quyền merge.

### 5.2. Sau merge staging: đồng bộ và kiểm thực tế trên web thử

1. Đọc lại commit/tree thực tế của `staging` sau merge. Chỉ tái sử dụng bằng chứng CI khi cây mã được kiểm khớp; nếu khác, kiểm lại ứng viên thực tế trước khi tiếp tục.
2. Đồng bộ đúng thay đổi ứng dụng đã merge vào **Site thử cố định hiện có**, trong checkout của Site thử và phạm vi triển khai QA được phép. Giữ hosting identity, DB/FILES, tài khoản, dữ liệu và lớp cách ly QA. Không tự sao chép dữ liệu MAIN, reset/seed hoặc bật kết nối kho/Sheet thật.
3. Chờ deployment QA `succeeded`, đọc lại version/source đang active và đối chiếu manifest thay đổi ứng dụng với commit GitHub sau merge. Giải thích phần overlay QA khiến SHA Site khác SHA GitHub; không gọi hai bản giống nhau chỉ vì cùng tên nhánh.
4. **dot chạy lại bài kiểm thực tế trên chính URL QA sau đồng bộ trước khi bàn giao.** Đối chiếu toàn bộ checklist; kiểm các luồng trong phạm vi từ đầu đến cuối, dữ liệu sau lưu/reload, quyền UI và API, số liệu/lịch sử/ngày hiệu lực, nhánh lỗi/từ chối/điều chỉnh khi có, và desktop/mobile đối với phần giao diện. Kiểm hồi quy các phần liên quan; không chỉ mở trang, đăng nhập hoặc thấy build xanh.
5. Ghi bằng chứng sau merge riêng: URL, version/source, commit ứng dụng, thời điểm, dữ liệu thử, bước kiểm, expected/actual và trạng thái từng mục. Kiểm trước merge không thay cho kiểm Site đã triển khai; dữ liệu thử không đủ hoặc chức năng chưa bật thì ghi Chưa kiểm/Bị chặn.
6. Nếu còn lỗi hoặc thiếu bằng chứng, **chưa bàn giao và chưa báo hoàn tất**. Ghi lỗi cụ thể, sửa qua nhánh/PR đúng quy trình, kiểm trước merge, đồng bộ lại QA rồi kiểm lại. Không sửa trực tiếp web thử thành một bản lệch GitHub và gọi là đã xong.

### 5.3. Bàn giao Duyên nghiệm thu và xét merge main

- Chỉ gửi kết luận “đã kiểm đủ, sẵn sàng nghiệm thu” sau khi toàn bộ mục trong phạm vi đạt trên web thử đúng bản sau merge. Có thể gửi link điều tra khi cần, nhưng phải ghi rõ chưa phải bản bàn giao.
- Bàn giao URL cố định, PR/commit, version QA, checklist có bằng chứng, kết quả thực tế và giới hạn được nêu rõ. Duyên nghiệm thu đúng phiên bản đó; không đẩy việc phát hiện lỗi cơ bản sang người dùng.
- Trước merge `main`, cần Duyên nghiệm thu bản QA, quyền merge phù hợp và toàn bộ điều kiện tại mục 5.1. PR promotion chỉ chứa thay đổi ứng dụng đã nghiệm thu; không gom thêm mã chưa thử hoặc overlay QA. Nghiệm thu không tự đồng nghĩa cho phép merge/deploy.
- Sau merge `main`, đối chiếu mã ứng dụng thực tế với bản QA đã nghiệm thu và kiểm CI main. Nếu khác, dừng bàn giao/phát hành, đồng bộ lại đúng bản vào QA trong phạm vi được phép và kiểm lại phần ảnh hưởng. Nếu trùng, ghi bằng chứng đối chiếu và kiểm chạy lại luồng chính trên QA; không publish lại chỉ để đổi số version. Giữ nguyên bước phê duyệt triển khai MAIN ở mục 6.

## 6. Deployment MAIN là bước riêng

- Merge không mặc nhiên là cho phép deploy Site. Chỉ triển khai MAIN khi có yêu cầu/phạm vi được phép riêng; xác minh trigger tự động trước merge/push nếu có nguy cơ triển khai ngoài phạm vi.
- Dùng đúng nguồn, commit, Site và cấu hình hiện hữu; không đụng trial, DB/FILES, quyền hoặc secrets ngoài yêu cầu. Theo dõi deployment đến terminal.
- Chỉ báo web đã cập nhật khi deployment **succeeded** và đọc lại phiên bản/commit active khớp nguồn dự định. GitHub push, build, saved version hoặc merge không thay thế bằng chứng deployment.

## 7. Một nơi làm việc và checklist bàn giao

Dùng lại môi trường/cuộc trò chuyện người dùng đã chọn; không tự tạo chat, Codespace hay nền tảng mới. Nếu không gửi được tới đích đó, nói rõ chưa chuyển thành công, giữ bản bàn giao trong PR/tài liệu và không tuyên bố đã gửi. Không đưa định danh hội thoại hoặc log lỗi công cụ dài vào repo.

Mỗi lần bàn giao phải điền riêng từng trạng thái, dùng “chưa thực hiện/chưa xác minh” khi chưa có bằng chứng:

| Mục | Nội dung cần ghi |
|---|---|
| Yêu cầu và phạm vi | Checklist đầy đủ của cùng yêu cầu/PR; việc được phép, việc hoãn đã được đồng ý, giới hạn còn giữ |
| Kiểm trước merge | Đạt/tổng số mục; Chưa đạt/Chưa kiểm/Bị chặn; expected/actual và bằng chứng đúng candidate; kết luận của dot |
| Nguồn/GitHub | Repo, branch, PR, head/base/merge/tree thực tế, readback; provenance nếu sync |
| Kiểm tra | Lệnh/phạm vi, local hay CI, run link, pass/fail/cancel/skip/timeout; phần chưa kiểm |
| Lỗi đã biết | Báo cáo lỗi và blockers; không đồng nhất số test fail với số lỗi sản phẩm |
| Preview | URL Site thử cố định, source/version active, commit ứng dụng và overlay QA; quyền truy cập đã xác minh |
| Cô lập dữ liệu/auth | D1/R2 và tài khoản QA riêng hoặc Miniflare dự phòng; nguồn dữ liệu thử đã được phép, không kết nối MAIN/Sheet thật |
| QA sau merge | Đã đồng bộ đúng commit chưa; kết quả browser thật, desktop/mobile, lưu/reload, quyền, nghiệp vụ và hồi quy; bằng chứng từng mục |
| Nghiệm thu của Duyên | Phiên bản/commit đã nghiệm thu hoặc chưa; giới hạn đã chấp nhận nếu có |
| Merge | Chưa yêu cầu/chưa làm/đã merge đúng PR, commit nếu có |
| Deploy | Chưa yêu cầu/chưa làm/pending/failed/succeeded; active version/commit readback nếu có |

Tài liệu liên quan: [CI](CI.md), [bàn giao lỗi đã biết](BUG-HANDOFF-2026-11-02.md), [chẩn đoán và hướng xử lý](CI-RESIDUAL-DIAGNOSIS-2026-11-02.md). Báo cáo lỗi là mốc lịch sử; luôn đọc kết quả của head hiện tại khi quyết định bước tiếp theo.
