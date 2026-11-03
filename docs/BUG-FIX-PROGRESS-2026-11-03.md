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
