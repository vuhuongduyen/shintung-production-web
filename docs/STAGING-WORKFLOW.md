# Nhánh và web thử ONSPA cố định

Quy trình cập nhật 09/11/2026: **mỗi việc một PR → kiểm đủ yêu cầu và CI → merge `staging` khi được phép → đồng bộ web thử → QA chức năng/giao diện thực tế → Duyên nghiệm thu → PR vào `main` và cập nhật web chính khi được yêu cầu riêng**. Tài liệu này không cấp quyền merge, approve hoặc triển khai thường trực. Phải kiểm tra phạm vi được người dùng cho phép ở từng lượt; không đổi branch protection, quyền truy cập, secrets hoặc billing để thực hiện quy trình.

## Các đích riêng biệt

| Thành phần | Đích | Ý nghĩa |
|---|---|---|
| Mã đã hợp nhất | GitHub `main` | Không đồng nghĩa đã triển khai web chính |
| Mã ứng viên | GitHub `staging` | Không chứa dữ liệu runtime hoặc lớp guard chỉ dành QA |
| Web thử cố định | `https://onspa-thu-nghiem.shintung-vn-4458.chatgpt.site` | Site `appgprj_6aed30807a6c8191bfcc31f6ec1d4291`, DB/FILES riêng; giữ quyền chủ sở hữu hiện có |
| Web chính | `https://sanxuat.shintung-vn-4458.chatgpt.site` | Site `appgprj_6a8f9b8b6bc48191b07d8293bcb8402a`; không triển khai trong bước QA |

Trước mỗi thay đổi, đọc mới ref và working tree, bảo toàn công việc dở dang. Mốc khảo sát ban đầu: GitHub main `d8dbb1e031e540fec892509b577cd49c3d2cc442`, MAIN v810 source `d8d938c6f5804ba1cb13a38bda7d38414120e7bf`; hai SHA không giống nhau nên phải đối chiếu file/tree, không tự coi là khác nghiệp vụ hoặc tương đương. Báo cáo đối chiếu nguồn được ghi riêng khi có manifest kiểm chứng. Web thử v8 source `accf9e79c6a80b488f7a775c9e31cd090d09d374` là bản đang chạy tại lúc khảo sát, không phải bằng chứng đã nhận PR #7 hoặc nhánh mới. Đợt bootstrap ban đầu giữ nguyên PR #7. Yêu cầu sau đó đưa PR #7 lên web thử được thực hiện bằng ứng viên có CI nhắm `staging`, giữ lớp triển khai QA riêng; trạng thái GitHub và Site phải được đọc lại độc lập.

**Điều kiện bắt buộc:** không đưa phần chưa đạt QA web thử lên web chính. Kể cả đã đạt QA, vẫn chờ Duyên yêu cầu riêng cho đúng phần được phép. Kiểm chi tiết theo [checklist trước merge và sau triển khai](ONSPA-DEVELOPMENT-WORKFLOW.md#5-kiểm-đủ-trước-merge-staging-và-tiếp-tục-đến-qa-web-thử); không dùng chỉ dẫn MAIN hoặc đồng bộ hai web cũ để bỏ qua bước này.

## Một lần thay đổi

1. Mỗi việc độc lập tạo một nhánh và PR riêng vào `staging` từ baseline đã kiểm chứng; cùng việc đang làm thì tiếp tục PR hiện hữu, không tạo trùng. Lập checklist đủ yêu cầu và phần giữ nguyên. Lỗi phát hiện sau merge cần PR sửa riêng. Nếu có thay đổi đồng thời, đọc lại base, không reset/force-push hoặc đè nhánh của người khác.
2. Kiểm local theo tác động, rà toàn diff và đối chiếu từng yêu cầu với bằng chứng, xử lý lỗi/review còn mở trước merge; phân biệt kiểm trước merge và QA Site phải chạy sau deploy. Gom push. Chờ bốn check CI đúng revision kết thúc: gate nhanh + TypeScript, ba build/test đầy đủ. Không coi check của revision/base cũ là kiểm bản mới.
3. Khi checklist trước merge đầy đủ, không còn lỗi/chưa kiểm ở bước đó, CI đạt và đã được phép merge vào nhánh thử, hợp nhất đúng PR vào `staging`. Đọc lại SHA/tree thật sau merge. CI pull_request kiểm merge commit; chỉ tái sử dụng kết quả nếu cây mã đã kiểm trùng cây mã ứng viên. Nếu cây khác vì base thay đổi hoặc xử lý xung đột, cần kiểm ứng viên đó trước QA, không gán CI cũ.
4. Sau merge, chủ động tiếp tục chuẩn bị bản QA trong phạm vi triển khai đã được phép, không coi merge là hoàn tất. Nếu thiếu quyền/công cụ, báo đúng blocker và bước cần tiếp tục. Dùng workflow Sites trong **checkout của Site thử hiện có**. Lấy đúng thay đổi ứng dụng đã kiểm, giữ nguyên hosting identity, guard QA, kết nối bị chặn và dữ liệu của Site thử. Build/publish riêng vào đúng Site QA, rồi đọc lại version/source/deployment đến `succeeded`. GitHub push hoặc merge không tự cập nhật Site.
5. Assistant dùng browser thật trên đúng URL và phiên bản active để kiểm toàn bộ checklist: chức năng đầu-cuối, dữ liệu/lịch sử và mốc áp dụng nếu bị ảnh hưởng, lưu rồi tải lại, quyền, giao diện desktop/mobile và lỗi mạng/console liên quan; kiểm Worker/API khi cần. Đối chiếu cả tình huống lỗi Duyên đã nêu. CI/build hoặc deploy thành công không thay QA thực tế. Còn lỗi/chưa kiểm thì báo QA chưa đạt/chưa hoàn tất, sửa qua PR riêng rồi kiểm lại, không bàn giao như đã xong. Khi đạt, gửi URL cố định, version, source SHA, provenance, bằng chứng và giới hạn để Duyên nghiệm thu đúng bản đó. Không thay app đang nghiệm thu mà không thông báo.
6. Chỉ khi phần cần đưa lên đã đạt QA web thử, Duyên đã nghiệm thu và có yêu cầu riêng đưa đúng phần đó vào GitHub main, tạo PR promotion riêng. So sánh diff của chính bản đã nghiệm thu; không gom thêm thay đổi chưa thử chỉ vì đang nằm trên `staging`. Không tự approve PR. CI PR vào `main` vẫn chạy đầy đủ; merge main và triển khai MAIN là hai quyền/bước riêng.
7. Chỉ khi Duyên yêu cầu riêng cập nhật web chính cho phần đã đạt QA, Website lấy chọn lọc mã ứng dụng đã nghiệm thu, giữ cấu hình MAIN, dữ liệu, quyền và secrets rồi triển khai đúng phạm vi. Đọc lại version/source active và kiểm chức năng/giao diện bị tác động. Nếu staging thay đổi sau nghiệm thu, kiểm lại phần tác động; không tự coi bản mới đã được duyệt.

Mỗi việc giữ một đầu mối, một cloud công việc và PR riêng; không tạo lại việc đang có. Khi đổi ưu tiên/phương án, chuyển chỉ đạo tới các cloud liên quan, xác minh việc cũ đã dừng hoặc tiếp tục đúng phạm vi rồi báo lại. Chọn phương án ít bước và an toàn dựa trên phụ thuộc; PR riêng không bắt buộc dựng bản ứng dụng tách rời. Chi tiết tại [điều phối công việc](ONSPA-DEVELOPMENT-WORKFLOW.md#điều-phối-công-việc-ưu-tiên-và-phương-án).

Chủ động theo dõi và báo các mốc có ý nghĩa: lưu PR, kết quả kiểm/blocker, merge staging, deploy QA và QA thực tế. Không chờ Duyên hỏi mới tiếp tục bước đã được phép; không hỏi lại quyền đã rõ, không mở rộng sang MAIN. Phân biệt đang làm với đang chờ, nêu bước tiếp theo và chỉ hỏi khi cần quyết định hoặc quyền còn thiếu. Thay đổi thuần tài liệu ghi rõ không đổi ứng dụng, không cần deploy hay QA giao diện chỉ để lưu quy trình.

## Tách cấu hình, dữ liệu và tài khoản

`.openai/hosting.json` trong mã GitHub hiện vẫn là metadata MAIN được kiểm bởi hợp đồng snapshot. **Không dùng trực tiếp checkout GitHub để publish QA**, và không đổi tệp này thành ID QA rồi gộp trở lại MAIN. Cấu hình Site đích và các guard QA nằm trong repository triển khai của Site QA, ngoài diff ứng dụng được promotion. Không đưa source credential, session, hash tài khoản, DB dump, R2 files, dữ liệu snapshot hoặc cấu hình Sheet vào GitHub, kể cả khi repo được người dùng chủ động để public.

Web thử giữ D1/R2 và tài khoản thử bền vững. Không seed, reset hoặc nhập lại dữ liệu mỗi lần khởi động/deploy. Bản sao dữ liệu/quyền được người dùng cho phép là một snapshot độc lập, không tự đồng bộ dữ liệu thật khi merge mã. Tài khoản đăng nhập được giữ theo cơ chế đã kiểm; không hứa phiên không bao giờ hết hạn. Đừng thay bằng harness Miniflare volatile hoặc Admin giả.

Không suy cách ly từ việc không có env vars: cấu hình Sheet có thể ở `app_records`. Giữ chặn kết nối kho thật, inbound/outbound tích hợp và đường `/environment-refresh`/API sao chép dữ liệu thật ở QA. Không lấy guard QA hoặc cấu hình kết nối thử đưa lên MAIN. Năm tệp còn chờ theo bàn giao v8 là giới hạn dữ liệu cần xử lý riêng; lượt thiết lập CI không chứng nhận đã đầy đủ tệp hoặc đã nghiệm thu dữ liệu.

## CI và phút GitHub

Workflow nhận PR vào `main` và `staging` khi opened/synchronize/reopened, kể cả draft; chỉ nhận push vào `main`. Như vậy một push nhánh làm việc có PR không tạo thêm run push trùng. Merge staging tái sử dụng bằng chứng cây mã của CI PR khi trùng; push trực tiếp staging không phải đường phát hành đã kiểm. Main sau merge vẫn được kiểm riêng. Không dùng skip-ci, lọc test theo file thay đổi, sửa billing, thêm secrets hoặc tắt assertion.

Các bước `CI SOURCE` ghi checkout SHA, tree SHA, head/base và nhánh đích bằng Git thực tế; từ chối checkout/merge parents sai. Thông tin chỉ nhận diện mã, không chứa request body hoặc credential. Mỗi job giữ cùng danh tính check, Node 24, npm lockfile và quyền contents:read. Gate lỗi làm các shard báo failure trước bước tốn phút; gate đạt vẫn chạy đầy đủ. Workflow không có bước deploy/merge/import.

PR cũ vẫn giữ nguyên đích cho đến khi có quyết định chuyển. Nếu đổi base của PR, phải kiểm lại CI cho merge tree mới; sửa mô tả/chuyển ready không thay cho kiểm tra revision. Khi cấu hình chỉ ở nhánh thử, không tuyên bố main hoặc các nhánh cũ đã tự nhận cấu hình mới.

## Bằng chứng và quay lui

Mỗi bản QA ghi: GitHub head/base/merge-tree đã kiểm và run; source MAIN làm baseline; danh sách/hash thay đổi ứng dụng; danh sách/hash overlay QA được giữ; Site QA source/version/deployment và dữ liệu snapshot; kết quả tự kiểm/browser; Duyên đã nghiệm thu gì; main/production còn chờ quyền nào. Metadata source Site khác GitHub vì có lớp QA phải được giải thích, không gọi byte-identical.

Lưu version QA trước khi cập nhật. Quay lui source chỉ dùng version tương thích schema/dữ liệu hiện tại; không tự restore DB, xóa snapshot hoặc đảo các thao tác nghiệp vụ. MAIN có kế hoạch quay lui riêng do Website kiểm tra. Nếu thiếu nguồn, file, quyền/công cụ hoặc deployment thất bại, giữ đúng Site/branch và báo chính xác; không tạo lại Site, đổi nền tảng hoặc gửi link chưa tự kiểm.

Tham chiếu: [CI](CI.md), [quy trình đầy đủ](ONSPA-DEVELOPMENT-WORKFLOW.md), [GitHub: pull_request kiểm merge commit](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#pull_request), [lọc nhánh đích PR](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow#using-filters-to-target-specific-branches-for-pull-request-events).
