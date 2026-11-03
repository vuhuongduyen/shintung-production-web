# Tiếp tục sửa lỗi PR #4 — 03/11/2026

Chỉ source/tests/docs trên nhánh `source-sync/live-v807-20261102`. Không merge, approve, triển khai hoặc cập nhật preview; không thay dữ liệu thật, quyền, secrets hoặc thiết kế báo sản lượng ngày/ngày hiệu lực.

## Mốc tiếp nhận đã xác minh

Checkout sạch và remote cùng `252dba8ee95c9d1719efe13bdd524266114492b1`. [CI 41432283056](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41432283056) completed/failure: 1.489 test, **1.429 pass / 60 fail**, đủ 246 file (221 đạt / 25 lỗi), không timeout/cancel/skip/todo/thiếu thống kê. TypeScript và ba build đạt. PR đã được sửa phần kết quả mới nhất; các mốc 62 lỗi/đang chờ trong phần lịch sử không phải trạng thái hiện tại.

## Fixture đã tái hiện và sửa

| Nhóm | Nguyên nhân và bằng chứng | Thay đổi, kiểm tra được giữ |
|---|---|---|
| Forecast (1 ca) | Fixture thành công thiếu `expectedRevision`, nhận 409 đúng tại `forecast-import.mjs:33`. | Đọc revision của dữ liệu giả trước nhập. Kiểm thêm thiếu/null/stale revision phải 409, mọi app_records và audit bất biến. Giữ lịch sử trước/sau và idempotency. Không bỏ guard CAS. |
| Tab chấm công (3 ca) | Snapshot có CV khác/Thu hồi nhân sự; các test riêng `production-hr-recalculation` và `actual-schedule-lookup` đã kiểm đúng thao tác này. Test danh sách tab vẫn chỉ đòi hai mục. | Kiểm đủ bốn tab cho manager/Admin, HR vẫn không có tab sản xuất. Mở rộng kiểm profile HR không được có cả hai thao tác bổ sung. Không đổi source hoặc grants. |
| Chọn ngày thu hồi (ca mới khi sang 03/11) | Form lấy ngày hiện tại; lịch giả chỉ có 02/11 nên không có ứng viên. | Chọn rõ ngày bắt đầu/kết thúc 02/11 trên form. Giữ giờ, employee IDs, một request, roster bất biến và readonly không có nút. Không đóng băng đồng hồ ứng dụng. |
| Màn điều chỉnh (1 ca) | Test tìm ô giờ ngay khi mở LSX, trong khi công đoạn đang `__choose__`. | Kiểm chưa có ô giờ trước lựa chọn, chủ động chọn dữ liệu toàn lệnh rồi kiểm ô giờ sửa được. Giữ Search/Enter/Back và các kết quả lọc. |
| Xuất lương (1 ca) | Nhãn giải thích hiệu suất đổi từ “Giờ hoàn thành Line” sang “Giờ công chuẩn HT (line đang chọn)”; toán tử/chia/nhân không đổi. | Đối chiếu nhãn của cột Hiệu suất. Giữ kiểm tổng quỹ, từng nhân viên, dịch, chống formula injection, PDF/capture; không sửa công thức hoặc giá trị. |
| Đơn vị giờ công (1 ca) | Fixture chỉ có HC/TC, thiếu `hours.total`, nên đơn vị trả null. | Bổ sung tổng 18/36 như fixture production-detail; giữ expected 0,18. Thêm trường hợp thiếu total vẫn null, không tự suy giờ nguồn. |

Đây là 7 ca test cũ, không phải 7 lỗi sản phẩm độc lập. Không xóa/skip test. Hai ca còn lỗi trong file attendance-controls giữ nguyên: bộ lọc HR mới khác hợp đồng select cũ; trường vệ sinh không còn max như test đòi. Chưa đủ căn cứ đổi quyền/giới hạn nên không nới assertion.

## Kiểm thử trước push

- Nhóm 11 file tác động và bảo vệ: **80 test / 78 pass / 2 fail / 0 cancelled / 0 skipped**. Hai lỗi là hai ca attendance-controls nêu trên; không có lỗi mới trong nhóm. Các ca FINAL nhập bù và mốc tương lai đều đạt.
- Nhóm thu hồi/xuất lương/chính sách riêng: 19/19 đạt; bảng xuất/giờ nguồn/FINAL: 18/18 đạt. Có giao nhau, không cộng các nhóm thành số test độc lập.
- `npm run typecheck` và `npm run build` đạt. Chưa lint/browser QA; không cập nhật runtime preview cũ. CI exact head sau push được ghi ở PR khi kết thúc, không dùng kết quả local thay kết quả CI.

## Hồi quy bổ sung: hủy nguồn cung của FINAL

Tái hiện qua `correctProduction` và DB Miniflare tạm: PACKING 100 lúc 08:30, FINAL 100 lúc 10:00. Trước sửa, cả preview và apply hủy riêng PACKING đều không từ chối (hai test `Missing expected rejection`). Đây là bằng chứng luồng xử lý thật, không chỉ helper; chưa phải kiểm HTTP/production.

`cancelStageWork` nay kiểm timeline báo công sau hủy trước khi ghi nghiệp vụ. Tại mỗi mốc FINAL còn lại, không cho hủy làm tăng phần vượt so với baseline; giữ nguyên thiếu hụt lịch sử đã có, tương thích nguyên tắc sẵn có trong sửa số lượng. Không xóa/sửa bản ghi cũ để ép hợp lệ, không tính PACKING ở tương lai để bù ngược. Các báo công hủy/void/đã trả lại không được tính.

Regression kiểm preview/apply từ chối giữ toàn bộ app_records, gồm audit hiện có; hủy cả PACKING+FINAL vẫn preview không ghi và apply thành công. Các quyền/Line/CAS/phiếu kho/thao tác phụ thuộc tiếp tục được kiểm bằng bộ hủy hiện hữu. Helper kiểm hủy FINAL và hủy nguồn cung dư hợp lệ, thiếu hụt lịch sử không đổi, không đột biến input. Đây bổ sung coverage API-function hủy; chưa bổ sung coverage API chỉnh sửa/remove-self của số lượng. Không suy rộng sang toàn bộ API hoặc audit receipt của HTTP wrapper.

Kết quả nhóm guard cuối: **27/27 pass**, 4 file `production-stage-cancel`, `production-final-limit`, `production-exit-restore`, `production-correction-volume`; không cancel/skip, 73 giây. Typecheck/build chạy lại sau sửa source đều đạt. Nhóm 80 test phía trên có giao nhau với nhóm này, không cộng tổng. Push nhóm có mục đích xác nhận guard mới, bảy ca cũ và residual; không rerun y nguyên.

## CI nhóm đầu ngày 03/11 và baseline Quay lại

[CI 41562320950](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41562320950), head `cbdebea20f64b9de88d529ce608c1542d2e45533`, đã completed/failure: **1.439 pass / 53 fail**, 1.492 test, 246 file (226 đạt / 20 lỗi), không cancel/skip/todo/timeout/thiếu thống kê. TypeScript và ba build đạt. Đối chiếu tên với 252dba8: đúng bảy ca cũ hết lỗi, không có tên lỗi mới; ba regression FINAL/hủy thêm đều đạt.

Nhóm Quay lại được xử lý tiếp, chỉ test/helper/JSON:

- Baseline cũ trỏ commit Site `b1820e3568f3c57841610235f06f168ff660d998`, trước snapshot được duyệt. Lấy fingerprint từ **snapshot nguồn v807 đã được duyệt** `c84775445ed3ef4c09fc583ac06b19881f9ae6d9`, không lấy source đang sửa làm chuẩn. Đối chiếu độc lập source hiện tại của app/page, labor-hours-master và weekly-capacity: callback/disabled/permission khớp snapshot này.
- Fingerprint chỉ loại `disabledExplanation` (nội dung giải thích), vẫn giữ các prop khác và bổ sung đối số quyền thứ ba của toolbar.action. Giữ kiểm số lượng và hash, thêm negative controls: đổi callback, bỏ điều kiện quyền, đổi đối số allowed, thay JSX disabled/onClick đều phải khác fingerprint. Đổi lời giải thích đơn thuần không làm sai kiểm hành vi. CI không cần checkout commit lịch sử để chạy test.
- Harness lịch sử Giờ công thiếu export `FeedbackActionButton`, nên đếm sai không có nút Quay lại. Dùng boundary fixture hiện hữu, giữ kiểm một nút, callback đóng, reset danh sách và dirty guard; bộ mounted riêng kiểm hành vi nút thật.
- Trước nhóm: 7 pass/4 fail trong file Quay lại; sau nhóm cùng mounted feedback: **28 pass/2 fail**, 30 test, không cancel/skip. Hai lỗi giữ nguyên: test muốn ẩn nút bị từ chối thay vì nút giải thích disabled; callback parent của Capacity không còn ở vị trí/cấu trúc cũ. Chưa thay hợp đồng giao diện hoặc quyền để xanh.

Không đổi mã ứng dụng từ cbdebea; typecheck/build và guard hủy/FINAL đã đạt cho source đó. Push phần kiểm thử này nhằm đo hai ca đã sửa và bảo đảm các kiểm âm mới hoạt động; không rerun y nguyên. Các lỗi Capacity/quyền/audit và kế hoạch chưa tự thay expected/công thức.

## CI baseline và hai ca workflow/portal

[CI 41563010554](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41563010554), head `831edd2b3ef8472202474d81b4c9ad1df1822dc4`, completed/failure: **1.442 pass / 51 fail**, 1.493 test, đủ 246 file; 226 đạt / 20 lỗi, không timeout/cancel/skip/todo/thiếu thống kê. TypeScript và ba build đạt. Hai ca Quay lại hết lỗi, negative control mới đạt, không có tên lỗi mới.

Hai ca tiếp theo chỉ sửa fixture:

1. `production-work-calendar-headcount`: test SSR không render portal của dialog xuất trạm. Khởi tạo DOM trước khi nạp Radix, mount component thật, kiểm dialog hiện diện và giữ nguyên count 12/12, 24 giờ đã lưu, không gọi callback thao tác hoặc thay input. Mọi request nếu phát sinh chỉ được là `preview-report` và dùng phản hồi giả. Dọn root/global/fetch sau test. Không dùng DOM này làm bằng chứng browser responsive QA.
2. `production-workflow`: test đòi approvedSchedules của read theo một report phải giống full read. Hợp đồng chuyên biệt đã được test `production-review-api` của snapshot xác nhận: events/employees/payrollEmployees/actualSchedules/approvedSchedules rỗng vì không cần cho xác nhận. Giữ so sánh toàn bộ report mục tiêu và progressOrders; thêm full read thực sự có lịch và quyền hai read bằng nhau. Các assertion HR/giờ công phía sau được chạy nguyên vẹn. Không sửa source API để tải dữ liệu thừa, không nới guard.

Chạy đủ ba file `production-workflow`, `production-review-api`, `production-work-calendar-headcount`: **40/40 pass**, không cancel/skip, 97,4 giây. Source ứng dụng không đổi từ cbdebea đã typecheck/build đạt. CI sau push xác minh hai ca cụ thể này và residual; chưa coi kết quả local là CI đạt.

## Các hợp đồng còn cần phân định trước khi sửa tiếp

Bảng này phân nhóm 49 mục còn lại sau khi loại hai ca đã đạt targeted khỏi mốc 51; kết quả CI cuối ghi tại PR. Số là mục TAP, không phải số lỗi sản phẩm độc lập. Không tự thay các expected dưới đây để làm xanh.

| Nhóm | Số mục | Expected / actual và hướng xử lý tiếp |
|---|---:|---|
| Audit và quyền ghi (gồm một kiểm JSX Line) | 21 | Test đòi toàn bộ records bất biến khi denied; wrapper hiện ghi website_action_audit. Cần chốt receipt denied rồi kiểm chính xác actor/route/status/outcome, mọi business record và audit cũ bất biến; không bỏ audit khỏi so sánh vô điều kiện. Kiểm JSX Line phải đối chiếu menu/ngoại lệ quyền riêng. |
| Quyền/menu và review | 5 | Test cũ đòi quyền/menu Line và state của review đơn; hiện dùng rights từ API, reviewSelected và busy/runner. Guard mới thiếu quyền đã có kiểm không request/refresh; cần chốt các ngoại lệ và trạng thái UI mong muốn trước thay kiểm cũ. Không cấp quyền mới. |
| Capacity | 3 | null ↔ 691.125; 674.975 ↔ 673.55; 670.3833333333333 ↔ 676.7166666666667. Cần đối chiếu công thức đã duyệt, không sửa số liệu theo actual. |
| Tổng kế hoạch/In Transit | 9 | Test cũ đọc bốn chỉ số theo vị trí; card mới có Pro plan, tồn tuần cũ, tồn In Transit, tổng, khả dụng, dư/thiếu. Fixture transit thiếu planStart/planEnd/lsxQty; còn khác hợp đồng partition theo filter. Cần xác định chỉ tiêu và tính fixture bằng tay trước cập nhật, không ánh xạ tùy tiện để giữ tổng xanh. |
| Tìm kiếm và UI/lifecycle | 11 | Plan ID rỗng (2): test muốn bỏ lọc, helper chặn; Quay lại (2): ẩn nút denied vs disabled explanation, parent Capacity không còn callback cũ; nhập bù (1): preview/apply cũ vs tự kiểm/save; thứ tự ngày sản lượng (1): tăng dần vs tháng mới trước; nhân viên/master-toolbar (2): Hủy/canCancel cũ vs ngày ngưng; HR lookup (1): select chỉ HR vs filter lịch sử nhiều loại; vệ sinh (1): max=2 vs không max; khôi phục nhân viên (1): restore=null khiến panel không mở. Tách yêu cầu hiển thị khỏi quyền, giờ công và vòng đời; không tự phục hồi quy trình cũ. |

Không có thao tác bị từ chối bởi công cụ trong nhóm này. Giới hạn còn lại là bằng chứng/hợp đồng nghiệp vụ và nghiệm thu, không phải thiếu credits. Chưa lint/browser hoặc preview đúng head; source sửa hồi tố/ngày hiệu lực và báo sản lượng ngày không thuộc nhóm này. Không merge/deploy dù đã sang ngày mới.

## Đối chiếu tiếp: receipt audit và hợp đồng UI đã có trong v807

Phần phân loại 49 mục phía trên là mốc chẩn đoán, không phải kết luận tất cả cần người dùng quyết định. Đối chiếu bổ sung xác nhận `tests/action-audit.test.mjs` và `worker/action-audit.mjs` không đổi từ snapshot `c84775445ed3ef4c09fc583ac06b19881f9ae6d9`: wrapper lưu receipt trước dispatch; 403 là `denied`, 400/409/410/422 là `failed`; identity từ phiên máy chủ. Alias `vthduyen` miễn receipt nhưng không miễn quyền nghiệp vụ.

- Test HTTP nay kiểm mọi business record và audit cũ bất biến; chỉ thêm đúng một receipt có ID khớp response, actor/updated_by, route/entity/line, httpStatus/outcome/evidence, reason, thời gian hoàn tất, operation/record và submitted input đúng request. So sánh snapshot dài chỉ nhận những receipt đã được kiểm đầy đủ, không loại cả entity audit. GET, sai origin/không phiên và business handler trực tiếp vẫn kiểm toàn bộ records bất biến.
- Thêm kiểm âm cho helper: sửa business record, sửa audit cũ, thêm receipt lạ, giả identity/route/status/outcome/input đều làm assertion thất bại. Thêm test đăng nhập alias `vthduyen`, chỉ có Xem, vẫn 403 khi reopen và toàn bộ app_records bất biến.
- Nhóm plan trước sửa: **5 pass/14 fail**; sau thay kiểm receipt: **19/19 pass** trước khi thêm ca alias. Không đổi source quyền, không bỏ kiểm status, revision, giá trị plan, transferred guard, same-origin hoặc quick-Line.
- Sau khi qua audit, test Line lộ fixture lấy lần nhập/điều chuyển từ tháng 9 đến ngày chạy tháng 11, vượt giới hạn 32 ngày. Fixture giờ báo công nay chỉ rõ `startedAt` của lần nhập tổng hợp vừa tạo và thời điểm kết thúc hiện tại; không bỏ giới hạn 32 ngày. Kiểm prop sessionLine dùng AST, không phụ thuộc vị trí prop sau khi thêm schedules.
- Test tổng hợp Site đòi phiếu thành phẩm trễ xuất một phần không cần lý do. Hai test độc lập `production-delay-reason` và `production-delay-api` đã có nguyên trạng ở snapshot quy định ngược lại: mỗi phiếu trễ cần lý do, kể cả một phần, không dùng lại lý do cũ. Test tổng hợp nay kiểm 422 + receipt đúng + business bất biến, sau đó mới xác nhận với lý do. Vẫn kiểm ngày hoàn thành vật lý không phụ thuộc thứ tự xác nhận; kiểm thông báo chỉ rõ công đoạn cuối trễ kế hoạch theo hợp đồng mới (không còn số ngày trong câu thông báo).
- Toolbar mặc định giải thích thao tác denied; chỉ `permissionFeedback:false` mới ẩn. Test SSR giữ một nút Back `aria-disabled`, thêm mounted test click/keyboard không gọi detail/parent callback hoặc submit và có thông báo quyền. Không ép native disabled vì nút denied cần nhận tương tác để giải thích.
- HR được lọc lịch sử nhiều loại theo test `actual-schedule-lookup` của snapshot. Harness attendance nay kiểm filter nhiều loại, giá trị giả không áp dụng, Line khóa, manager=false, không tab SX/không gọi save. Bộ mounted hiện hữu tiếp tục kiểm HR xem phụ kho nhưng không có Sửa/Hủy.

Một lượt local có Miniflare `fetch failed`/500 trước assertion mục tiêu; các tiến trình đã kết thúc rồi mới chạy lại tuần tự nhóm tác động. Không thay cấu hình DB hay bỏ test vì lỗi này. Kết quả targeted cuối và CI exact head ghi ở PR sau khi kết thúc; không coi local pass là CI pass. Lượt này chỉ sửa tests/helper/tài liệu, không sửa ứng dụng hoặc nghiệp vụ; không merge/deploy/preview.

Kiểm trước push nhóm receipt/UI: 9 file **94 test / 91 pass / 3 fail**, không cancel/skip. Hai fail kế thừa là callback Back Capacity và trường vệ sinh; một fail ở GET quyền do Miniflare fetch failed/500 (ca này đã đạt ở lượt 40 test trước). Kiểm riêng Line sau sửa fixture/AST: **3/3**; delay API/helper **3/3**; Site tổng hợp sau bổ sung lý do cho cả phiếu lịch sử đầu: **1/1**, 39,6 giây. Mounted Back/filter mục tiêu **3/3**, kiểm âm helper **1/1**. Có giao nhau giữa các lượt, không cộng thành tổng test độc lập. Không chạy lại toàn bộ local; CI sau commit nhằm xác minh nhóm vừa sửa và đo residual trên runner, không phải rerun không có thay đổi. TypeScript/build sẽ đọc kết quả exact head từ CI; chưa lint/browser.

## Chốt nhóm receipt và hoàn tất harness quyền

CI head `25a4460cf5de28afede20894476259547ae913ee`, run [41566185983](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41566185983), completed/failure: **1.469 pass / 27 fail / 1.496 test**, đủ 247 file (234 đạt/13 lỗi). TypeScript và ba build đạt; không timeout/cancel/skip/todo/thiếu tổng kết. So với cdc9eab: 22 tên lỗi cũ hết lỗi, không có tên lỗi mới; ba ca kiểm mới đạt. Lỗi Miniflare GET local không xuất hiện trên CI.

Hoàn tất nhóm cùng nguyên nhân còn sót:
- `business-menu-views`: kiểm từng denied request có đúng receipt, quyền/scopes/business/audit cũ bất biến; GET riêng vẫn hoàn toàn không ghi. 2/2 đạt.
- `permission-denial-feedback`: dùng `reviewSelected` và confirm trong day-review thực tế thay hàm review đơn đã bỏ. Cả API right và menu right đều bắt buộc; denied không request/refresh; chỉ busy chuyển true/false. Editor work không đổi state hoặc đọc form khi thiếu quyền.
- Fixture quick-Line mang `quickLinePermissions` như phiên API thật, thay nhãn kind đơn thuần. Không suy quyền manager của Lịch SX thành quyền Báo công: test độc lập `menu-action-access` nguyên trạng trong snapshot và AGENTS 22/10 đã quy định quyền theo từng menu. Kiểm manager vẫn thao tác tại mode schedule nhưng không tự có work. Không đổi grants/source ứng dụng.
- Nhóm ba file business-menu-views, permission-denial-feedback, menu-action-access: **35/35 pass**, không cancel/skip, 18,4 giây. Commit tiếp chỉ tests/tài liệu; CI xác minh bốn mục cũ còn lại và residual, không rerun y nguyên.

Nhóm chưa xử lý sau phần này dự kiến còn Capacity (3), kế hoạch/In Transit (9), menu Line (2), UI/lifecycle (9). Phải đọc kết quả CI cuối để chốt số; tiếp tục truy yêu cầu và tính độc lập trước thay assertion/công thức. Chưa phải 23 lỗi sản phẩm xác nhận. Chưa lint/browser, không merge/deploy/preview.

## Vòng đời nhân viên: ngày ngưng thay Hủy chung

`tests/employee-employment.test.mjs` nguyên trạng từ snapshot c847754 quy định ngày bắt đầu bao gồm/ngày ngưng loại trừ, Hủy master nhân viên phải bị từ chối và chỉ khôi phục tường minh. Hai test cũ còn yêu cầu Hủy nhân viên hoặc prop canCancel đã bỏ.

Sửa fixture basic-master: vẫn giữ toàn bộ kiểm SKU/labor cancellation, thêm Hủy employee bị từ chối và record bất biến; lưu ngày ngưng qua saveEmployee, giữ tên, kiểm history before/after, version tăng, ngày trước ngưng còn làm/ngày ngưng không làm và stale save không ghi. Toolbar kiểm guard Sửa theo allowed/current/cancelled, trường endDate và giải thích ranh giới ngày, giữ load/import/lookup assertions. Cho phép disabledExplanation chen giữa prop nhưng giữ nguyên biểu thức quyền.

Trước: 2 ca lỗi ở hai file. Sau: basic-master + employee toolbar + employment **14/14 pass**, không cancel/skip, 12,3 giây. Chỉ tests/docs, không đổi nghiệp vụ hoặc dữ liệu thật. CI sau push xác minh hai ca cùng residual; chưa lint/browser, không merge/deploy/preview.

## In Transit: fixture đủ dữ liệu và sáu chỉ tiêu có phép tính độc lập

Mốc trước nhóm này: head 0e78c4b, CI 41568475640 đã completed/failure, **1.475 pass/21 fail**, đủ 247 file, không timeout/cancel/skip/todo/thiếu thống kê; TypeScript/ba build đạt. Hai ca vòng đời nhân viên hết lỗi, không tên lỗi mới.

Đối chiếu `plan-transit-backlog.test.mjs` của snapshot: tồn thay kế hoạch đã chuyển, không cộng hai lần; tồn tuần cũ là phần của tổng tồn, không phải phần ngoài bộ lọc. Card hiện có sáu nhãn: Pro plan, tồn tuần cũ, tổng tồn In Transit, tổng cần xếp, khả dụng, dư/thiếu. Test cũ đọc bốn ô theo vị trí và repartition theo bộ lọc; đổi sang giữ đủ sáu chỉ tiêu của tuần khi chỉ lọc bảng. Vẫn kiểm các hàng/pagination/export theo đúng filter và tổng tải tuần không đổi.

- LSX giả có planStart/planEnd/lsxQty/completedQty, không dùng nguyên row kế hoạch làm LSX. Phản hồi capacity synthetic có backlogRows tương ứng; read API thật không bị ghi đè các backlogRows do server trả. Không tính capacity/giờ nguồn bằng giá trị actual của UI.
- Phép tính tay giữ rõ: 30 giờ lệnh chọn +20 giờ lệnh khác=50. Sau chuyển và readback: Pro plan20+tồn30=50, khả dụng100, dư50. POST thành công một mình không đổi card; rejected/uncertain vẫn giữ card cũ. 22 LSX tồn vẫn giữ tải 518,5/552 giờ và cảnh báo vượt tải, mở lịch sử/phân trang không cộng lặp.
- Ca độc lập mới kiểm tên cả sáu chỉ tiêu và tổng **10/8/14/24/100/76**: 10 plan + (8 tồn cũ+6 tồn tuần này)=24, dư100−24=76. Tồn cũ8 không cộng lần hai vào24. Input bất biến.
- Fixture API có lịch accepted/synced thật trong Miniflare: 20 người ×5 giờ thứ Hai=100 giờ, các ngày khác không làm; thêm chuẩn laborHour=1 của SKU giả để backlog có giờ. Không seed runtime/production. Giữ retry/idempotency, lịch sử và rows. Trạng thái đang chờ response kiểm tại hàng đang hiển thị thay vì chỉ số cột trạng thái đã bỏ khỏi export.
- Receipt của từng POST được kiểm correlation/actor/route/entity/status/outcome/evidence/input; lỗi giữ mọi business record bất biến. Thành công chỉ cho phép thay ba entity dự kiến (plan, audit plan, transit), mọi audit cũ (kể cả production_plan_audit) vẫn bất biến. So sánh cuối chỉ thêm đúng các receipt đã kiểm, capacity/labor/users/scopes không đổi. Thêm kiểm âm chặn sửa audit cũ hoặc đưa website_action_audit vào mutable allowlist.

Trước: 9 ca lỗi trong file In Transit. Sau: nhóm backlog/receipt ban đầu **31/31**; nhóm năm file gồm quyền plan/business views/helper/backlog/transferred **54/54**, không cancel/skip,48,6 giây. File transferred cuối sau thêm ca tên sáu chỉ tiêu **26/26**,12 giây. Các lượt giao nhau, không cộng tổng. Chỉ tests/helper/docs, không đổi ứng dụng/công thức/quyền. CI sau push xác minh 9 ca cũ, hai ca mới và residual; chưa lint/browser, không merge/deploy/preview.

## Capacity: tách bản đã duyệt khỏi bản đang sửa

CI In Transit e73d292, run41569814022 đã completed/failure: **1.486 pass/12 fail/1.498 test**,247 file(239 đạt/8 lỗi),không timeout/cancel/skip/todo/thiếu tổng kết; TypeScript/ba build đạt. Đúng9tên lỗi cũ hết lỗi,hai regression mới đạt,không tên lỗi mới.

Ba ca Capacity không phải bằng chứng công thức sai: `capacity-accepted.test.mjs`, `capacity-accepted.mjs` và readPlan/mutatePlan đều nguyên trạng snapshot c847754, quy định kế hoạch hiển thị lịch/giờ đã duyệt gần nhất trong khi bản sửa đang chờ. Test cũ đòi null hoặc so với giờ draft chưa duyệt. Không đổi số giờ/công thức nguồn.

Sửa kiểm thử hai mốc: capture giờ đã duyệt trước sửa; pending vẫn bằng giờ đó, retainedApproval=true và khác giờ draft; sau review mới bằng giờ draft được duyệt. Giữ assertions giờ OT, HC, lịch sử thay đổi người/giờ và editCount. Kế hoạch đã chốt giữ nguyên capacityBasis; kế hoạch chốt sau review mới dùng cơ sở mới.

Việc giữ số hiển thị không mở quyền ghi: chốt lệnh mới khi pending vẫn bị CAS raw-capacity từ chối **409 capacityChanged**; thêm so sánh toàn bộ app_records bất biến sau từ chối. Giữ guard trước lần duyệt đầu tiên capacityUnconfirmed. Không chuyển thành cho phép chốt pending.

Targeted capacity+capacity-accepted **32/32 pass**,không cancel/skip,22,3giây. Chỉ test/docs;CI sau push xác minh3ca cũ và residual. Chưa lint/browser,không merge/deploy/preview.

## Nhập bù: xác nhận đúng hợp đồng quick-save, không hồi phục nút cũ

Mốc CI trước:3957d7d/run41570480854 completed/failure, **1.489 pass/9 fail/1.498 test**,247file(240đạt/7lỗi),không timeout/cancel/skip/todo/thiếu tổng kết; TypeScript/ba build đạt. Ba ca Capacity hết lỗi,không tên lỗi mới.

Đối chiếu `production-backfill.test.mjs` nguyên trạng snapshot c847754: quick save không cần preview riêng, nhưng đòi confirmedAllocations đúng donor và consent; phân công thay đổi hoặc thiếu đồng ý không được ghi. Test DOM cũ đòi nút Kiểm tra nhân viên/Xem ảnh hưởng/Ghi nhập bù đã bỏ, không còn mô tả luồng đó.

Chỉ cập nhật DOM test: auto-inspect và chọn người không gọi mutation; giữ remaining1000/max1000 và người không đủ điều kiện bị khóa. Hiển thị đúng donor LSX/công đoạn/thời gian; nút Đồng ý chuyển và lưu gửi save với resolveAssignments=true, người B và chính xác allocation được hiển thị. Double-click chỉ một save và một callback thành công. Kiểm hai vòng DOM độc lập: thành công và HTML502 khi lưu. Vòng lỗi không gọi onSaved, không lộ JSON parse error, không thể click/retry để gửi save thứ hai khi chưa rõ kết quả. HTML lỗi lúc inspect vẫn có retry an toàn. Không thêm preview/apply vào luồng quick-save hoặc bỏ consent.

Targeted DOM+API backfill **18/18 pass**,không cancel/skip,146,9giây; DOM mới10,3giây. Giữ các test cũ backend stale preview, quyền/Line, giờ ngoài khoảng, donor locked, repair và idempotency. Chỉ test/docs,không đổi ứng dụng,DB hoặc quyền.

Tám ca còn lại cần bằng chứng riêng, không ép expected theo source:
- Plan ID rỗng(2): test coi như bỏ lọc, UI chặn. Quy tắc repo cấm SKU/LSX/tên rỗng không xác định ngoại lệ Plan ID. Lựa chọn: cho rỗng bỏ lọc hay báo thiếu/giữ kết quả; ảnh hưởng phạm vi tra cứu.
- Back Capacity(1): test đòi parent callback về summary, component chỉ khai báo Back lookup/detail. Cần xác định chuyển summary bằng Back hay điều hướng menu; ảnh hưởng thoát màn/draft.
- Thứ tự sản lượng(1): test tăng ngày toàn cục, source tháng mới trước/ngày trong tháng tăng. Chưa có yêu cầu lịch sử độc lập chọn thứ tự. Không đổi dữ liệu productionDate hoặc công thức giờ.
- Menu Line A/B(2): test chỉ SX báo công, snapshot mở thêm đường đọc. Cần chốt danh sách màn chỉ đọc của Line; hiển thị menu không cấp quyền ghi, backend scope/grants vẫn phải giữ.
- Vệ sinh(1): selector cũ không có ngày/nhóm, test còn đòi HTMLmax=2; UI mới có nhãn ngày/nhóm và không max. Cần đối chiếu giới hạn theo roster/approved workers/lịch thực tế, không dùng chuỗi khoảng dự kiến làm giới hạn.
- Khôi phục nhân viên sau hủy xuất(1): picker chỉ render khi restore khác null nhưng mọi nơi khởi tạo/reset đều null. Test và API hỗ trợ chọn continuous/return. Cần xác định phải hiện picker trước hủy, mặc định chọn ai, và liên tục hay quay lại; đây có thể là bug UI nhưng sửa mặc định có thể đổi phân công/giờ, không coi là selector đơn thuần.

Đã thử tìm yêu cầu lịch sử qua Personal Context một lần: dịch vụ trả không khả dụng trong cuộc trò chuyện này. Không thử vòng lặp hoặc suy diễn câu trả lời. Có thể tiếp tục đối chiếu lịch sử/fixture độc lập; chưa có cơ sở tự thay quyền/luồng khôi phục hoặc thứ tự hiển thị. Chưa lint/browser/full-app nghiệm thu;không merge/deploy/preview.

## Hủy xuất trạm: lựa chọn phân bổ lại nhân viên theo yêu cầu đã đối chiếu

Bằng chứng người dùng được chuyển trong bàn giao: khi hủy xuất trạm phải hỏi “Phân bổ lại NV?”, có thể chọn người từ lệnh khác như Packing; hủy các thao tác gọn và không bắt nhập lý do riêng. Không tự chọn mặc định làm đổi phân công/giờ.

Xác nhận bug UI: state restore khởi tạo/reset null; picker còn nằm trong nhánh danh sách cũ, trong khi lệnh công đoạn hiện dùng ProductionCorrectionGrid. Vì vậy picker không thể xuất hiện. Sửa bằng một phần lựa chọn chung cho cả hai nhánh khi chỉ hủy một Xuất trạm (đúng giới hạn API), mặc định tắt và không có người chọn sẵn. Bật mới hiện picker continuous/return hiện hữu; chưa chọn ai thì không gửi request. Nhân viên ở Packing vẫn có thể chọn theo lịch/Line hiện hữu; backend giữ xác thực, preview, CAS và tính giờ.

Mọi thay đổi bật/tắt/người/cách khôi phục đều xóa preview, kể cả quay về cùng lựa chọn trước. Bỏ chọn gửi preview không có restore; không tự apply. Khi chọn phân bổ lại dùng luồng cancellation-only đã có thông báo các bản sửa giờ/số lượng chưa lưu không đi cùng lần hủy; tránh lựa chọn restore bị bỏ qua trong batch sửa. Không đổi backend, không tự chuyển nhân viên, không thêm lý do bắt buộc: vẫn dùng lý do mặc định sẵn có, UI không hỏi textarea.

Test mounted kiểm mặc định tắt/không request, bật không người không request, chọn N từ Packing mới gửi preview với restore đúng, chọn lại buộc preview mới, bỏ phân bổ không có restore và không có apply tự động. Giữ test borrowed roster, đổi continuous/return, ngày quay lại, không ghi khi chỉ chọn và dịch Anh/Trung. Sửa selector chọn đúng nút Hủy thao tác thay nút đầu của section. Thêm dịch nhãn mới.

Typecheck/build đã exit0. Test UI mới đạt; nhóm guard API/FINAL local đang kiểm tiếp, kết quả cuối đọc tại PR theo exact head. Chưa browser/responsive hoặc full-app preview đúng commit; không cập nhật runtime/merge/deploy.

Kiểm cuối nhóm phân bổ lại: UI mounted **2/2 pass**, exit0,3,2giây; API restore/cancel/FINAL **26/26 pass**, không cancel/skip,71,4giây; typecheck/build exit0. Các lượt UI trước đã pass assertion nhưng tiến trình không thoát: preview POST mở BroadcastChannel của Node trong data-sync; JSDOM.close không đóng channel đó. Harness theo dõi native channel do test tạo, đóng chúng và khôi phục global khi cleanup; tắt file watch không cần cho SSR test. Không dùng process.exit/unref hoặc skip để che treo. Đã dừng các tiến trình test sở hữu bị treo; lượt cuối thoát sạch. Đây không phải kiểm browser/responsive.

Bằng chứng yêu cầu mới đã giải quyết phần hợp đồng khôi phục trong danh sách tám ca trước. Bảy ca còn lại (Plan ID rỗng2, Back Capacity1, thứ tự tháng/ngày1, menu Line2, giới hạn UI vệ sinh1) vẫn chưa tự đổi expected/quyền/thứ tự/giới hạn. CI exact head sau push ghi tại PR; chưa merge/deploy/preview.

## Cleanup DOM sau CI phân bổ lại

CI head2fe406b/run41573944402 completed/failure: **1.491 pass/8 fail/1.499 test**,247file,TypeScript/ba build đạt. Ca khôi phục nhân viên đã hết lỗi và file thoát sạch; tuy nhiên phát hiện lỗi mới cấp file headcount: cả11assertion pass rồi asynchronous activity ném `dispatchEvent ... not of type Event` sau test. Không coi đây là giảm lỗi ròng hoặc gán lỗi này thành lỗi nghiệp vụ.

Đối chiếu mã Radix focus-scope đang cài: unmount autofocus dispatch CustomEvent trong timer0. Harness headcount trả global CustomEvent/Event về Node trước khi timer đó chạy, tạo event sai realm cho JSDOM. Sửa thứ tự cleanup: unmount và đợi lượt timer trong act khi DOM constructors còn đúng, rồi mới khôi phục fetch/act/global. Thêm listener/assertion sự kiện `focusScope.autoFocusOnUnmount` đã xảy ra và thuộc đúng DOM trước teardown. Không bắt/nuốt exception, không sleep dài,skip,process.exit hoặc bỏ assertion dữ liệu.

Kiểm hai file headcount+restore cuối **13/13 pass**,exit0,8,1giây,không cancel/skip; lượt trước13/13 cũng đạt trước bổ sung assertion sự kiện. Mã ứng dụng không đổi từ2fe406b đã typecheck/build đạt. CI sau push xác minh cleanup cụ thể và residual,không rerun y nguyên. Chưa browser/preview đúnghead;không merge/deploy.

## Back Capacity: giả thuyết callback cấp cha — đã thay thế bởi đối chiếu PCB494 bên dưới

Đối chiếu độc lập trong app/page.tsx: màn capacity-calendar truyền onNavigateSummary, callback chuyển activeChild sang capacity-summary. WeeklyCapacity khai báo prop nhưng không còn action gọi nó; test pcb493 đã quy định Back parent/lookup/detail và giữ draft. Đây là giả thuyết ban đầu; test PCB494 sau đó chứng minh callback còn lại không đồng nghĩa cần có nút Back cấp cha. Không dùng đoạn lịch sử này làm thiết kế cuối.

Khôi phục duy nhất Back cấp cha khi callback có mặt trong màn calendar. Disable khi busy hoặc dirty, không lưu/xóa draft hoặc submit; lookup Back vẫn được StandardToolbar ưu tiên để đóng tra cứu trước. Không thêm Back cấp cha vào summary hoặc mở menu/quyền ghi.

Kiểm mounted lấy chính biểu thức action từ source, chạy qua StandardToolbar thật: chỉ một Back; sạch gọi parent đúng một lần; dirty/busy không callback/submit; lookup/detail ưu tiên đúng callback và không gọi parent. Đối chiếu app callback trỏ summary. Fingerprint v807 của mọi action cũ giữ nguyên: chỉ loại đúng một navigation action mới có mounted guard test riêng, không regenerate baseline hoặc bỏ kiểm business callbacks/permissions.

Targeted pcb493 + mounted feedback + retained render **39/39 pass**, không cancel/skip,18,6giây; typecheck/build exit0. Đây là kiểm code/mounted toolbar, chưa browser/full-app navigation hoặc responsive QA. Không merge/deploy/preview. Phần mô tả PR được người dùng cho phép cập nhật riêng đã ghi đúng CI mốc fa28e9c; CI của commit mới cần đọc riêng, không gán kết quả mốc cũ cho bản này.

## Đối chiếu cuối Back PCB493/PCB494 và profile quick-Line

CI phát hiện test độc lập PCB494 yêu cầu rõ calendar không có Back cấp cha, lookup có đúng một Back nội bộ. Hợp đồng này đã có trong snapshot v807; các thay đổi trước của file PCB494 chỉ là harness, không đổi assertion. Vì vậy giả thuyết callback cũ bị bỏ sót ở mục trước là sai: không thêm lại nút, trả source WeeklyCapacity/app navigation về đúng fa28e9c. Callback prop cũ được giữ tương thích, không tự xóa API component.

Sửa test PCB493 cũ mâu thuẫn PCB494: giữ kiểm SKU, detail/lookup; kiểm không có toolbar gọi parent callback. Giữ nguyên test PCB494 và fingerprint v807 đầy đủ của mọi action cũ, không cần ngoại lệ navigation nữa. Mounted test lấy hai biểu thức Back lookup/detail từ source thật, chạy StandardToolbar thật: chỉ một Back, chỉ đóng lớp tương ứng, không submit hoặc network. Back riêng dialog vệ sinh không bị trộn với hai lớp toolbar chính.

Profile quick-Line nguyên trạng v807 có nhãn “xem toàn bộ Quản lý sản xuất; chỉ báo công Line của mình”, gồm tám quyền Xem và hai quyền Thêm/Lưu Báo công. Test API Line độc lập đã kiểm session thật đúng mười grants, scope A/B, thiếu manager/hr/confirm/correct và từ chối các ghi khác Line/quyền quản lý. Fixture matrix cũ chỉ gán kind=line và đòi duy nhất SX báo công. Nay dùng profileForUser thật và expected menu đọc của hợp đồng đó, không đổi profile,grants,API hoặc quyền dữ liệu thật. Thêm kiểm đúng hai quyền ghi hiện hữu, các action quản lý vẫn false, không mở menu ngoài production; tài khoản chỉ điều phối mở calendar nhưng không mở summary hoặc các menu báo công.

Kiểm tổng hợp sáu file (PCB493,PCB494,mounted feedback,matrix,menu-action-access,Line API): **64/64 pass**,exit0,76,5giây,không cancel/skip. Mã runtime cuối giống fa28e9c (đã typecheck/build/CI đạt các bước đó); các thử nghiệm điều hướng trước đã được bỏ, không đưa lên web. Không đổi UI về Back ngoài hợp đồng v807. Bốn ca còn thiếu quy tắc: Plan ID rỗng2,thứ tự ngày/tháng sản lượng1,giới hạn người vệ sinh1. Chưa nới assertion để xanh hoặc đổi các quy tắc đó.

Mô tả PR đã được người dùng cho phép cập nhật riêng với mốc fa28e9c1.491/7 và đã đọc lại khớp. Kết quả đó gắn rõ commit, không áp cho commit mới. CI bản mới cần đọc riêng; không merge/approve/deploy/preview.

## Thứ tự tháng sản lượng: yêu cầu người dùng ngày 19/10

Sau khôi phục môi trường, checkout ban đầu ở main sạch. Đã fetch và trở lại đúng nhánh PR4/head8ec69dd mà không ghi đè thay đổi dở dang. CI của head đó đã hoàn tất:1.496pass/4fail/1.500test,247file; TypeScript/ba build đạt,không timeout/cancel/skip/todo/thiếu tổng kết. Back theo PCB494 và menu quick-Line không còn lỗi.

Bằng chứng mới từ yêu cầu người dùng ngày19/10: menu Sản lượng và giờ công hiển thị tháng từ mới tới cũ, ví dụ10–9–8. Quy tắc này giải quyết mâu thuẫn test đang đòi09 trước10; không cung cấp quy tắc thứ tự ngày trong tháng.

Chỉ sửa test: fixture có một ngày trong mỗi tháng nay kiểm10 trước09; SSR kiểm tiêu đề10 trước09. Thêm ca ba tháng có hai ngày tháng10, đảo đầu vào, kiểm các nhóm tháng liền nhau theo10–9–8, map lượng từng productionDate và tổng51 bất biến. Không khẳng định ngày nào trước ngày nào trong tháng10. Giữ toàn bộ kiểm unit54/300=0,18, thiếu giờ/pending chưa tính unit, canceled không tính và gộp nhiều exit cùng LSX/ngày. Không đổi source UI/helper hoặc công thức để khớp test.

Targeted production-detail+production-output-finished **22/22 pass**,exit0,4,6giây,không cancel/skip. Chỉ test/docs; CI exact head sau push cần đọc riêng. Plan ID trống(2ca) và trần số người vệ sinh(1ca) vẫn chưa có yêu cầu rõ, không tự đổi quy tắc hoặc quyền. Chưa browser/preview/merge/deploy.

## Hai quyết định cuối: Plan ID trống và trần vệ sinh theo sắp xếp ban đầu

CI mốc trước sửa (05e1b5a, run41580943636): 1.498 đạt /3 thất bại /1.501 test,247 file; TypeScript và ba build đạt. Ba ca còn lại không được bỏ qua: hai ca tìm kiếm Plan ID và một ca trần vệ sinh.

Người dùng đã chọn Plan ID rỗng phải báo đúng “Vui lòng nhập Plan ID” và giữ danh sách đang xem. Dùng chung callback Tìm/Enter; trường hợp trống hoặc chỉ có khoảng trắng không thay applied filter, trang hoặc kết quả và không tải lại toàn bộ. Mounted test kiểm đúng phần thông báo, giữ BETA đang lọc, ALPHA không xuất hiện; sau đó nhập Plan ID hợp lệ vẫn tìm được ALPHA và Xóa lọc chủ động mới khôi phục hai dòng. Giữ các kiểm SKU/LSX/tên.

Người dùng chốt vệ sinh theo số người thực tế của ngày, bổ sung “theo sắp xếp ban đầu của lịch sx thực tế”. Ánh xạ trong source là danh sách có tên của đúng ngày/Line tại giờ bắt đầu ca HC, cộng/trừ biến động thực tế đã có hiệu lực tại mốc đó; không lấy số workers của Capacity hoặc nhãn hiển thị dự kiến dạng khoảng. Biến động phát sinh sau mốc đầu ca không tăng trần. Dùng lại eligibleStaff/effectiveAttendance và ranh giới ngày làm việc của nhân viên; nghỉ dự kiến chưa xác nhận không tự trừ. Ngày mới mở kế thừa roster theo quy tắc hiện có. Thiếu roster hoặc thiếu nhân viên có tên thì báo chưa đủ dữ liệu khi lưu vệ sinh, không đoán bằng số Capacity. Các nhóm vệ sinh đồng thời chia sẻ cùng trần; nhóm nối tiếp có thể dùng lại số người.

Giao diện đặt max theo cùng helper, không tự sửa/xóa draft nếu vượt trần; bấm Lưu báo lỗi và không gọi save. Backend kiểm lại bằng calendar/events hiện tại và directory có ngày hiệu lực trước mọi ghi lịch/history/recalculation, giữ kiểm quyền/phiên bản/lý do và giao dịch hiện có. Lịch không có người vệ sinh dương không phát sinh truy vấn directory thêm. Không đổi công thức giờ công, FINAL hoặc quyền. Fixture API thứ Bảy cũ chỉ có workers:2 nay bổ sung hai nhân viên giả có tên/roster để kiểm đúng nguồn mới, giữ đủ assertion thêm/sửa/xóa và planning bất biến.

Kiểm chứng cục bộ: action-feedback-production12/12 (gồm Plan ID click/Enter và vệ sinh mounted), attendance-controls18/18, helper mới7/7, workflow API29/29. Ca API mới kiểm vượt trần, không quyền, vắng thực tế xuất hiện sau lúc lập draft, hủy vắng, số thực tế vượt workers scalar vẫn hợp lệ, cập nhật ngày thôi việc và stale version; các lần từ chối giữ nguyên toàn bộ app_records của lời gọi trực tiếp. Helper kiểm sai ngày/Line, người đến sau đầu ca, pending/cancel, thiếu tên, đếm duy nhất, nhóm chồng thời gian và ngày mới mở. API bổ sung được chạy lại riêng sau khi thêm kiểm thay directory và đạt1/1. Typecheck và build exit0. Bộ hồi quy tìm kiếm/hiển thị headcount/cách ly snapshot được kiểm riêng. Đây là code/mounted/API giả lập local, chưa nghiệm thu browser, chưa cập nhật preview.

Sau push cần đọc CI đúng commit để kết luận toàn bộ; không dùng kết quả cục bộ thay CI. Không merge, approve, deploy, đổi preview hoặc dữ liệu thật. Mô tả PR giữ kết quả lịch sử đã được cho phép cập nhật; số hiện tại ghi trong tài liệu và kết quả CI theo commit.

Rà tương thích sau đó phát hiện scheduleDay/normalizedWorkDay vốn mặc định HC08:00 khi lịch cũ thiếu giờ bắt đầu. Helper vệ sinh giữ đúng mặc định này; thêm regression so sánh có/không có vắng thực tế lúc08:00, helper8/8 đạt. Đây là chỉnh tương thích có nguyên nhân riêng, không đổi mốc đầu ca hoặc dùng scalar fallback.

CI bad0cccfeb37d6ded7a9fc4b279a23a603819b5d đã hoàn tất success: run41588229499, 248/248 file và1.510/1.510 test đạt (shard1:463,shard2:549,shard3:498), không failed/timeout/cancel/skip/todo/thiếu tổng kết; TypeScript và cả ba build đạt. Ba ca fail của05e1b5a đã được xử lý theo quyết định người dùng, không phải skip/loại file. Sau khi bổ sung tương thích HC08:00, typecheck local vẫn exit0; CI của commit bổ sung phải đọc riêng, không suy từ bad0ccc.
