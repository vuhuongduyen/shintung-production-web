# Quy trình thay đổi ONSPA: PR riêng → kiểm đủ → staging → QA web thử → nghiệm thu → main

Quy trình này là điểm tham chiếu cố định cho các lần làm việc sau. Assistant phải đọc tài liệu này và `AGENTS.md` khi bắt đầu, kiểm tra trạng thái thực tế rồi thực hiện trong phạm vi người dùng yêu cầu. Không thay cách làm, tạo nền tảng hoặc cuộc trò chuyện mới chỉ vì phiên làm việc thay đổi.

**Quy trình không phải quyền thường trực để sửa mã, cấp quyền, tạo credentials, merge hoặc deploy.** Chỉ dẫn cụ thể mới nhất của người dùng quyết định phạm vi mỗi lần. Lưu trên GitHub, CI đạt, preview hoạt động, người dùng nghiệm thu, merge và deployment là các trạng thái riêng biệt.

**Cập nhật 06/11:** dùng [nhánh/web thử cố định](STAGING-WORKFLOW.md). PR mới vào `staging`; hợp nhất nhánh thử sau CI trong phạm vi được phép, triển khai QA riêng, Duyên nghiệm thu rồi mới xét PR vào main và deployment MAIN. Codespaces bên dưới là lịch sử/phương án dự phòng được cho phép riêng, không còn là mặc định để gửi link. Việc giữ nguyên PR #7 là giới hạn của lượt thiết lập 06/11, không phải trạng thái hiện tại.

**Cập nhật 09/11:** mỗi việc có PR riêng; kiểm đủ yêu cầu trước merge vào `staging`; sau merge phải tiếp tục đồng bộ đúng web thử và kiểm chức năng, dữ liệu, giao diện thực tế trước bàn giao. CI đạt hoặc deploy thành công không thay cho QA. **Không đồng bộ web chính khi phần cần đưa lên chưa đạt QA web thử; kể cả đã đạt, vẫn chờ Duyên yêu cầu riêng cho đúng phạm vi.** Các chỉ dẫn mặc định đồng bộ cả hai web ngày 22/10 và chỉ MAIN ngày 31/10 đã được thay thế.

## 1. Chốt yêu cầu và nguồn mã

- Ghi rõ việc cần làm, phần giữ nguyên, tiêu chí kiểm tra và việc chưa được phép làm. Khi người dùng yêu cầu chỉ lưu snapshot/tài liệu hoặc trì hoãn sửa lỗi, dừng sửa chức năng.
- Đọc mới repo `vuhuongduyen/shintung-production-web`, visibility, remote main/staging, nhánh/PR đang làm và head SHA. Không dựa riêng vào SHA nhớ từ lượt trước hoặc mặc định repo private; repo đang public tại lần cập nhật 09/11. Không đưa dữ liệu thật hoặc thông tin riêng tư vào tài liệu, diff và log công khai.
- Nếu đồng bộ từ web chính, xác minh phiên bản đang active và commit nguồn; ghi provenance, những tệp đã lọc và giới hạn. Không lấy source TEST cũ ghi đè tính năng web chính, không coi source là backup DB.
- Kiểm tra working tree trước thao tác. Bảo toàn thay đổi chưa commit; dùng checkout/worktree riêng khi cần. Không reset, clean, force-push hoặc ghi đè công việc khác để làm workspace sạch.
- Mỗi việc độc lập dùng một nhánh và PR riêng từ base vừa xác minh, mặc định nhắm `staging`; không trộn việc khác để tiện merge. Nếu tiếp tục cùng yêu cầu, cập nhật đúng nhánh/PR hiện hữu, không tạo bản trùng. Lỗi phát hiện sau khi PR đã merge cần PR sửa riêng, liên kết PR gốc. Không tự gộp PR khác hoặc đổi main/default branch.
- Lập checklist đầy đủ từ yêu cầu và các điều chỉnh sau đó: từng mục ghi kết quả mong đợi, phần giữ nguyên, cách kiểm và bằng chứng. Kiểm cả dữ liệu/lịch sử, ngày áp dụng, quyền và màn hình liên quan nếu bị tác động; không rút yêu cầu xuống chỉ còn phần test hiện có.
- Trong phạm vi đã được phép, chủ động tiếp tục đến bước kế tiếp và báo kết quả từng mốc có ý nghĩa; không chờ Duyên nhắc mới đọc CI, xử lý lỗi, triển khai QA hoặc kiểm sau triển khai. Không hỏi lại quyền đã rõ, nhưng không suy quyền sửa/push thành quyền merge/deploy. Khi thiếu quyền, dữ liệu, công cụ hoặc quyết định nghiệp vụ, nêu đúng bước bị chặn, phần đã xong và đầu vào cần thêm; không tự coi việc đã hoàn tất.

### Điều phối công việc, ưu tiên và phương án

- Mỗi việc có **một đầu mối chịu trách nhiệm, một cloud công việc và một PR riêng**. Dùng lại đúng cloud/PR đang làm việc đó; không mở bản trùng, chuyển sang cloud khác hoặc tạo thêm nền tảng khiến thông tin bị chia nhỏ. Việc tách PR để theo dõi không có nghĩa phải dựng một bản ứng dụng tách rời.
- Đầu mối phải nắm trạng thái thực của các việc đang chạy, phần phụ thuộc nhau, người/bước đang chờ và bước tiếp theo. Khi phát hiện phụ thuộc hoặc lỗi ngăn bàn giao, báo ngay tác động và phương án xử lý; không để Duyên tự phát hiện rồi nhắc.
- Khi Duyên đổi ưu tiên, chọn phương án mới hoặc yêu cầu dừng, chuyển chỉ đạo ngay tới các cloud liên quan. Xác định rõ phần nào dừng, phần nào tiếp tục và phần nào không còn cần. Giữ công việc dở dang, không xóa hoặc triển khai để “kết thúc” việc đã bị dừng.
- Đọc lại phản hồi và trạng thái thao tác để xác nhận việc cũ **đã dừng thật** hoặc tiếp tục đúng phạm vi; gửi lệnh dừng chưa phải bằng chứng đã dừng. Nếu một thao tác đã bắt đầu chưa kết thúc, báo đang chờ dừng an toàn và xác minh kết quả trước khi báo hoàn tất. Không để cloud tiếp tục phương án cũ chỉ vì chưa được nhắc lần nữa.
- Trong công việc đã được giao thực hiện trọn quy trình, đầu mối chủ động đi tiếp **sửa → kiểm đủ yêu cầu → merge staging khi đủ điều kiện → đồng bộ web thử → kiểm thao tác và giao diện thực tế → báo kết quả**. Có lỗi thì tiếp tục sửa và kiểm lại trong phạm vi đã được phép. Không dừng chờ Duyên ở mỗi mốc khi quyền đã rõ; các thao tác cần quyền/quyết định còn thiếu phải hỏi đúng phần đó, MAIN vẫn theo mục 6.
- Báo từng mốc có ý nghĩa hoặc blocker, nêu việc đã làm, đang làm thật, đang chờ gì và bước tiếp theo. Không nói “đang kiểm” khi đang chờ CI, quyền, dữ liệu hoặc chưa có thao tác kiểm chạy; không hứa hoàn tất khi trạng thái chưa được xác minh.
- Khi có nhiều cách, chọn và giải thích ngắn phương án **ít bước, nhanh và an toàn**, dựa trên phụ thuộc, khối lượng làm lại, rủi ro dữ liệu và khả năng kiểm. Ưu tiên xử lý nguyên nhân rồi kiểm chung các luồng liên quan trên web thử, vẫn giữ PR riêng; không dựng thêm bản tách hoặc thêm tầng công việc nếu không cần. Chỉ hỏi Duyên khi còn quyết định nghiệp vụ, đánh đổi đáng kể hoặc quyền cần cấp; không đổi phương án đã chọn mà không báo.

## 2. Thực hiện và kiểm tra có mục tiêu

- Chỉ sửa phần đã được yêu cầu. Giữ DB, uploads, tài khoản, quyền, khóa Sheet, Site identity và production ngoài phạm vi thay đổi nếu chưa được phép riêng.
- Cài dependencies theo lockfile khi cần. Chạy kiểm tra phù hợp: targeted tests trước, typecheck/build khi có thay đổi mã hoặc cấu hình liên quan; ghi rõ lint/browser/full suite đã chạy hay chưa.
- Trước push, chạy `npm run test:ci-contract`, TypeScript và test nhóm tác động; build khi thay mã cần biên dịch. Gom các bản sửa có liên quan vào một lần push sau bằng chứng local; không push tiến độ nhỏ liên tục làm hủy CI. Bước nhanh không thay full CI hoặc browser.
- Khi test thất bại, phân loại harness/fixture, hợp đồng test cũ và nghiệp vụ chưa rõ. Ghi test/file, expected/actual, giả thuyết và phép kiểm chứng. Không rerun toàn bộ giống hệt nếu chưa có thay đổi hoặc lý do cụ thể; không xóa/skip/nới assertion để xanh.
- Tài liệu thuần túy không cần chạy lại test thủ công. Nếu workflow hiện hữu tự chạy do push, ghi nhận trung thực; không đổi workflow/settings hoặc dùng skip-ci để che checks.

## 3. Lưu GitHub và mở draft PR

- Trước push, rà diff, secrets/runtime data và trigger triển khai liên quan. Không đưa `.env`, credentials, DB dump, uploads, sessions hoặc backups vào GitHub. Nếu có trigger deploy ngoài quyền được giao, dừng trước bước gây deploy và báo cụ thể.
- Commit/push không force vào đúng repo và nhánh được chỉ định, giữ nguyên visibility/quyền truy cập. Đọc lại remote SHA và tệp đã đưa lên; không coi lệnh push chưa xác minh là thành công.
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

Adapter QA cố định cho Codespace cũ và giới hạn Host/Origin/role: [CODESPACE-PRIVATE-PREVIEW-TEST.md](CODESPACE-PRIVATE-PREVIEW-TEST.md). Đây là lựa chọn TEST cần kiểm actual forwarding; không tự có link đang chạy hoặc thay allowlist Vite/production.

### Kiểm web thử cố định trước bàn giao

Sau merge staging, thực hiện đầy đủ mục 5 và [quy trình triển khai QA](STAGING-WORKFLOW.md). Link Site có sẵn chỉ chứng minh địa chỉ tồn tại, chưa chứng minh bản sửa đã chạy hoặc đã đạt QA. Gửi link để cùng kiểm khi còn lỗi phải ghi rõ “chưa đạt/chưa kiểm xong”, không bàn giao như đã hoàn tất.

### Các điểm phải xác minh riêng khi được phép dùng Codespaces

1. Kiểm tra Codespace thực tế, repo/branch, working tree và SHA. Bảo toàn công việc/dữ liệu đang có; chạy đúng commit cần review, không chỉ đúng tên nhánh.
2. Đọc scripts/config và skill runtime/browser hiện có trước khi launch. API trả Forbidden thì ghi đúng thao tác/đích và dừng đường bị từ chối; không tự mở quyền hoặc đi vòng kiểm soát. Chỉ dùng desktop/session được phép và công cụ hỗ trợ; phải xác minh browser tool thật sự thao tác được, không suy từ trạng thái “connected”.
3. Kiểm host/origin, port forwarding và auth của chính snapshot. PR #4 v807 có allowlist localhost ở Vite/API; cần adapter phù hợp được kiểm riêng trước khi dùng host forwarded. Không mở wildcard, bỏ kiểm tra origin, tự public port hoặc copy PR #3 wholesale để cho chạy. Nếu cần thay adapter/quyền/access/credentials ngoài phạm vi hiện có, báo thay đổi cụ thể và xin phê duyệt riêng trước khi thực hiện.
4. Giữ cổng **Private**. DB/FILES dùng Miniflare local, không remote production binding, tài khoản thật, Sheet secret hoặc dữ liệu production. Không reset `.local-data`, không seed/import mặc định. Dữ liệu mẫu phải synthetic và được tạo/import tường minh trong phạm vi cho phép.
5. Xác minh đăng nhập TEST, phục hồi phiên khi reload và dữ liệu cần xem. TEST local-owner không chứng minh quyền production; session có thể phụ thuộc tiến trình. Không tự tạo/reset tài khoản hoặc chuyển credentials qua chat/log.
6. Khởi chạy server trong phiên được giữ lại khi đã đủ điều kiện. Kiểm HTTP/API, nhãn TEST, full shell/navigation và chức năng cần nghiệm thu. Kiểm desktop/mobile bằng browser thật khi có công cụ; nếu chưa có browser, ghi rõ chưa QA và không tuyên bố nghiệm thu UI.
7. Mở chính URL forwarded và kiểm quyền truy cập trước khi gửi. Gửi URL cùng SHA, phạm vi dữ liệu TEST, trạng thái server và giới hạn. Không gửi localhost của executor như link người dùng có thể truy cập. Giữ server đến khi review/bàn giao hoặc nêu rõ khi phải dừng.

Assistant chịu trách nhiệm chuẩn bị và xác minh rồi gửi link; không mặc định đẩy các lệnh kỹ thuật cho người dùng. Chỉ yêu cầu người dùng bước đăng nhập, cấp access hoặc quyết định thật sự còn thiếu, giải thích ngắn vì sao cần bước đó.

## 5. Kiểm đủ trước merge staging và tiếp tục đến QA web thử

### Trước merge vào staging

- Đối chiếu từng mục trong checklist yêu cầu với thay đổi và bằng chứng kiểm. Ghi rõ đạt/không đạt/chưa kiểm; không bỏ sót rồi coi CI xanh là đủ. Mục không áp dụng phải có lý do.
- Đọc lại diff toàn PR và các màn hình/luồng bị ảnh hưởng. Kiểm lỗi gốc, hồi quy, dữ liệu hiện có và trường hợp biên liên quan; đọc kết quả review độc lập khi công việc có review. Không merge khi còn lỗi, ý kiến review chưa xử lý hoặc phần yêu cầu chưa được kiểm trong giai đoạn trước merge. Các phép kiểm bắt buộc trên Site sau triển khai phải được liệt kê là bước còn chờ, không ghi đã đạt sớm.
- Đọc mới PR/head/base và bốn check CI của đúng revision tới terminal. CI `pull_request` kiểm merge tree; đối chiếu tree với ứng viên thực sự sẽ merge. Nếu base/head thay đổi hoặc giải quyết xung đột, kiểm lại phần bị tác động và bằng chứng cây mới.
- Chỉ merge đúng PR vào `staging` khi các điều kiện trên đạt và yêu cầu của Duyên đã bao gồm bước merge đó. Không tự Approve, lách branch protection/settings hoặc bỏ checks. Nếu chỉ được lưu tài liệu/snapshot, giữ PR chờ quyền merge.
- Đọc lại commit/tree trên `staging` sau merge và báo đúng mốc **đã merge staging, chưa hoàn tất QA web thử**.

### Sau merge staging, trước bàn giao

1. Chủ động tiếp tục đồng bộ đúng thay đổi đã merge sang **Site thử hiện có** trong phạm vi đã được phép. Nếu quyền triển khai QA chưa có, hỏi đúng quyền còn thiếu; không dừng im lặng ở “đã merge”. Giữ guard QA, cấu hình, DB/FILES, tài khoản và dữ liệu hiện có; không seed/reset, chép dữ liệu MAIN hoặc mang cấu hình MAIN sang QA.
2. Theo dõi deployment tới terminal, đọc lại Site/version/source đang active và đối chiếu manifest với commit/tree ứng viên. Source Site có overlay QA nên phải ghi ánh xạ và khác biệt, không tuyên bố cùng SHA khi chưa đúng.
3. Kiểm thực tế trên **chính URL web thử đang chạy bản đó**, bằng browser thật và API/Worker khi cần. Theo checklist yêu cầu, thử chức năng từ đầu đến cuối, dữ liệu hiển thị/lưu/tải lại, quyền, ngày hiệu lực/lịch sử nếu có; kiểm giao diện desktop/mobile, toolbar, bảng, modal và thông báo ở phần bị ảnh hưởng. Xem lỗi mạng/console liên quan. Test local, DOM giả lập, ảnh cũ hoặc build đạt không thay bước này.
4. Đối chiếu cả trường hợp lỗi người dùng đã nêu với kết quả mong đợi. Ví dụ phần Giờ công phải kiểm đúng mốc áp dụng, lịch sử và các nơi dùng số giờ; không kết luận dữ liệu cũ đã đúng chỉ vì công thức hoặc test mới đạt.
5. Nếu còn lỗi, thiếu dữ liệu/công cụ để kiểm hoặc kết quả chưa rõ, ghi **QA chưa đạt/chưa hoàn tất**, báo blocker và tiếp tục sửa trong phạm vi được phép. Bản sửa sau merge đi bằng PR riêng, kiểm lại trước merge rồi triển khai và QA lại. Không bỏ bước vì đã có một lần CI/QA đạt ở bản trước.
6. Chỉ bàn giao bản sửa như hoàn tất khi checklist đạt và có bằng chứng chức năng/giao diện trên bản active. Gửi Duyên URL, version/source, các mục đã kiểm, kết quả, giới hạn còn lại và trạng thái MAIN. Duyên nghiệm thu đúng bản đó; nếu có thay đổi sau QA/nghiệm thu, kiểm lại phần bị ảnh hưởng trước khi dùng kết quả cũ.

## 6. Chặn web chính cho tới khi QA đạt và có yêu cầu riêng

- **Tuyệt đối không đồng bộ, triển khai hoặc đưa phần chưa đạt QA web thử lên MAIN.** `staging` có commit, bốn check CI xanh, merge thành công, deploy QA `succeeded` hoặc một hạng mục khác đã đạt đều không thay kết quả QA của chính phần cần phát hành.
- Sau khi phần đó đạt QA và Duyên nghiệm thu, chỉ chuẩn bị/merge PR promotion vào `main` khi được yêu cầu đúng phạm vi; triển khai MAIN vẫn cần yêu cầu riêng. Không suy “làm tiếp”, “đồng bộ web thử” hoặc chấp nhận bản QA thành quyền cập nhật web chính.
- Trước promotion/deploy, đọc lại yêu cầu, diff, SHA/tree và phiên bản QA đã đạt. Chỉ lấy phần đã thử và được duyệt, không gom cả staging có thêm thay đổi chưa đạt. Xác minh trigger tự động trước merge/push để tránh deploy ngoài phạm vi.
- Dùng đúng nguồn, commit, Site và cấu hình MAIN hiện hữu; bảo toàn DB/FILES, tài khoản, quyền, secrets và dữ liệu. Không đưa guard QA sang MAIN, không thực hiện sửa dữ liệu/backfill ngoài phạm vi.
- Theo dõi deployment tới terminal. Chỉ báo web chính đã cập nhật khi deployment **succeeded**, đọc lại version/source active khớp nguồn được duyệt và kiểm lại chức năng/giao diện bị tác động. GitHub push, build, saved version hoặc merge không thay thế bằng chứng triển khai.

## 7. Một nơi làm việc và checklist bàn giao

Dùng lại môi trường/cuộc trò chuyện người dùng đã chọn; không tự tạo chat, Codespace hay nền tảng mới. Nếu không gửi được tới đích đó, nói rõ chưa chuyển thành công, giữ bản bàn giao trong PR/tài liệu và không tuyên bố đã gửi. Không đưa định danh hội thoại hoặc log lỗi công cụ dài vào repo.

Mỗi lần bàn giao phải điền riêng từng trạng thái, dùng “chưa thực hiện/chưa xác minh” khi chưa có bằng chứng:

| Mục | Nội dung cần ghi |
|---|---|
| Điều phối | Đầu mối/cloud công việc/PR đang dùng, ưu tiên mới nhất, xác nhận dừng hoặc tiếp tục, phụ thuộc và bước tiếp theo; không ghi định danh hội thoại riêng tư |
| Yêu cầu và phạm vi | Checklist từng yêu cầu, đạt/không đạt/chưa kiểm và bằng chứng; việc được phép/hoãn |
| Nguồn/GitHub | Repo và visibility đã đọc, branch, PR riêng, head/base/merge-tree, readback; provenance nếu sync |
| Kiểm tra | Lệnh/phạm vi, local hay CI, run link, pass/fail/cancel/skip/timeout; phần chưa kiểm |
| Lỗi đã biết | Báo cáo lỗi và blockers; không đồng nhất số test fail với số lỗi sản phẩm |
| Web thử | URL cố định, Site/version/source active, ánh xạ commit/tree và deployment terminal; nếu Codespaces thì ghi Private/server |
| Cô lập dữ liệu/auth | DB/FILES QA độc lập, dữ liệu/tài khoản được giữ, guard/tích hợp bị chặn; local TEST nếu dùng Codespaces |
| QA/nghiệm thu | Browser thật trên bản active, checklist chức năng/dữ liệu/giao diện desktop/mobile; Duyên nghiệm thu bản nào hay chưa |
| Merge | Staging và main ghi riêng: quyền, chưa làm/đã merge đúng PR, commit/tree nếu có |
| Deploy | QA và MAIN ghi riêng: quyền, chưa làm/pending/failed/succeeded; active version/source và kết quả kiểm sau deploy |

Không báo “xong” chỉ vì đã push, CI đạt, merge hoặc deploy. Nếu chưa đủ QA, dùng đúng trạng thái còn chờ và nêu bước tiếp theo; phần chỉ sửa tài liệu ghi rõ không thay ứng dụng và QA/deploy ứng dụng không áp dụng.

Tài liệu liên quan: [CI](CI.md), [bàn giao lỗi đã biết](BUG-HANDOFF-2026-11-02.md), [chẩn đoán và hướng xử lý](CI-RESIDUAL-DIAGNOSIS-2026-11-02.md). Báo cáo lỗi là mốc lịch sử; luôn đọc kết quả của head hiện tại khi quyết định bước tiếp theo.


## Tiết kiệm phút GitHub — cập nhật bản nháp 05/11

Theo [cấu hình CI](CI.md), nhánh làm việc gửi lên GitHub rồi mở/cập nhật PR để chạy một lượt kiểm; không dùng push nhánh source-sync tạo thêm lượt full trùng PR. Main vẫn được kiểm sau merge. PR draft vẫn chạy; sửa mô tả/chuyển ready không tạo CI mới nếu commit không đổi. Bốn check giữ tên, gate nhanh/TypeScript đi trước ba shard; khi gate đạt vẫn chạy đủ toàn bộ test cuối. Lỗi gate không được coi là full suite đạt.

Trình tự xử lý lỗi: đọc đúng log/head → nhóm nguyên nhân → sửa → quick + targeted trước/sau + kiểm cần thiết → gom push → theo dõi đúng run tới terminal. Không rerun giống hệt chỉ để thử may mắn, không bỏ test/assertion/skip-ci hoặc đổi quyền/billing. Báo source, local, CI và browser riêng; cấu hình mới trong PR chưa tự cập nhật main hay cấp quyền merge/deploy. Nghiệm thu ứng dụng có thể làm song song trên checkpoint app có manifest khớp; phải ghi chính xác SHA/phạm vi và kiểm diff nếu head chỉ đổi tooling/docs.
