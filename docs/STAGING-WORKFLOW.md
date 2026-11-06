# Nhánh và web thử ONSPA cố định

Quy trình từ 06/11/2026: **PR → nhánh `staging` → web thử → Duyên nghiệm thu → PR vào `main` → Website cập nhật web chính**. Tài liệu này không cấp quyền merge, approve hoặc triển khai thường trực. Phải kiểm tra phạm vi được người dùng cho phép ở từng lượt; không đổi branch protection, quyền truy cập, secrets hoặc billing để thực hiện quy trình.

## Các đích riêng biệt

| Thành phần | Đích | Ý nghĩa |
|---|---|---|
| Mã đã hợp nhất | GitHub `main` | Không đồng nghĩa đã triển khai web chính |
| Mã ứng viên | GitHub `staging` | Không chứa dữ liệu runtime hoặc lớp guard chỉ dành QA |
| Web thử cố định | `https://onspa-thu-nghiem.shintung-vn-4458.chatgpt.site` | Site `appgprj_6aed30807a6c8191bfcc31f6ec1d4291`, DB/FILES riêng; giữ quyền chủ sở hữu hiện có |
| Web chính | `https://sanxuat.shintung-vn-4458.chatgpt.site` | Site `appgprj_6a8f9b8b6bc48191b07d8293bcb8402a`; không triển khai trong bước QA |

Trước mỗi thay đổi, đọc mới ref và working tree, bảo toàn công việc dở dang. Mốc khảo sát ban đầu: GitHub main `d8dbb1e031e540fec892509b577cd49c3d2cc442`, MAIN v810 source `d8d938c6f5804ba1cb13a38bda7d38414120e7bf`; hai SHA không giống nhau nên phải đối chiếu file/tree, không tự coi là khác nghiệp vụ hoặc tương đương. Báo cáo đối chiếu nguồn được ghi riêng khi có manifest kiểm chứng. Web thử v8 source `accf9e79c6a80b488f7a775c9e31cd090d09d374` là bản đang chạy tại lúc khảo sát, không phải bằng chứng đã nhận PR #7 hoặc nhánh mới. Đợt bootstrap ban đầu giữ nguyên PR #7. Yêu cầu sau đó đưa PR #7 lên web thử được thực hiện bằng ứng viên có CI nhắm `staging`, giữ lớp triển khai QA riêng; trạng thái GitHub và Site phải được đọc lại độc lập.

## Một lần thay đổi

1. Tạo nhánh tính năng từ baseline đã kiểm chứng, mở PR vào `staging`. Nếu có thay đổi đồng thời, đọc lại base, không reset/force-push hoặc đè nhánh của người khác.
2. Kiểm local theo tác động, gom push. Chờ bốn check CI đúng revision kết thúc: gate nhanh + TypeScript, ba build/test đầy đủ. Không coi check của revision/base cũ là kiểm bản mới.
3. Khi được phép merge vào nhánh thử và CI đạt, hợp nhất vào `staging`. Đọc lại SHA/tree thật sau merge. CI pull_request kiểm merge commit; chỉ tái sử dụng kết quả nếu cây mã đã kiểm trùng cây mã ứng viên. Nếu cây khác vì base thay đổi hoặc xử lý xung đột, cần kiểm ứng viên đó trước QA, không gán CI cũ.
4. Chuẩn bị bản QA bằng workflow Sites trong **checkout của Site thử hiện có**. Lấy đúng thay đổi ứng dụng đã kiểm, giữ nguyên hosting identity, guard QA, kết nối bị chặn và dữ liệu của Site thử. Build/publish riêng vào đúng Site QA, rồi đọc lại version/source/deployment đến `succeeded`. GitHub push hoặc merge không tự cập nhật Site.
5. Assistant kiểm Worker và browser trước khi gửi link, gồm dữ liệu, quyền, chức năng tác động, desktop/mobile và lỗi mạng liên quan. Gửi cùng URL cố định, version, source SHA, provenance và giới hạn; Duyên nghiệm thu đúng bản đó. Không thay app đang nghiệm thu mà không thông báo.
6. Khi được phép đưa bản đã nghiệm thu vào GitHub main, tạo PR promotion riêng. So sánh diff của chính bản đã nghiệm thu; không gom thêm thay đổi chưa thử chỉ vì đang nằm trên `staging`. Không tự approve PR. CI PR vào `main` vẫn chạy đầy đủ; merge main và triển khai MAIN là hai quyền/bước riêng.
7. Website lấy chọn lọc mã ứng dụng đã nghiệm thu, giữ cấu hình MAIN, dữ liệu, quyền và secrets; triển khai sau phê duyệt phù hợp. Đọc lại version/commit active. Nếu staging thay đổi sau nghiệm thu, kiểm lại phần tác động; không tự coi bản mới đã được duyệt.

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
