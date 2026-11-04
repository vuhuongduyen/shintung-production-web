# Trạng thái báo sản lượng ngày — 04/11/2026

Nhánh `feature/daily-output-effective-dates-20261104`, nền main sau PR #6 (`d8dbb1e031e540fec892509b577cd49c3d2cc442`). Bản phát triển, chưa merge/triển khai hoặc bật policy production. Quyết định và inventory tại [hợp đồng](DAILY-OUTPUT-EFFECTIVE-DATES-CONTRACT.md).

## Đã thực hiện trong source

- Báo công chỉ nhập số phát sinh và ngày giờ GMT+7 sửa được. Không chọn công đoạn, FINAL, nhân viên hoặc giờ theo lệnh. Mỗi phiếu và mỗi LSX độc lập; cùng Plan ID không gộp lệnh.
- Lũy kế chờ/đã duyệt và thanh tiến độ ở SX/In Transit. Bảo toàn baseline sản lượng legacy một lần khi nhận phiếu ngày; không cộng lại baseline sau refresh. Bảng SX mới phân trang 10 lệnh, tổng hợp được lập chỉ mục theo snapshot.
- Lưu có khóa lượt gửi, xác thực quyền Line, CAS lệnh/policy/mức/lịch sử, guard phantom import. Mất phản hồi/non-JSON giữ nháp và cùng khóa; không tự tạo phiếu mới. Bấm lặp không gửi hai lượt đồng thời.
- QLSX duyệt sản lượng không đòi giờ/công đoạn, tạo đúng một đề xuất kho; có stale-selection và lý do trễ theo ngày sản xuất. Tra cứu/kho/backfill dùng ngày sản xuất của mô hình mới; không dựng giờ xuất trạm.
- Sửa/hủy phiếu chưa xác nhận và chưa liên kết kho: xem before/after, kiểm phiên bản/CAS, giữ audit, hỗ trợ đối chiếu cùng khóa sau mất phản hồi. Khóa phiếu đã xác nhận/liên kết kho.
- Version định mức có ngày hiệu lực; snapshot trên phiếu; thiếu căn cứ vẫn ghi lượng nhưng không tính tiền. Payroll phiếu mới cộng từng phiếu theo ngày/tháng và Line đã ghi trên phiếu, giữ công thức chia quỹ/phụ kho/giờ nhân sự. Payroll legacy chưa đổi cách tính.
- Không tự bật production, không migration/seed production, không nối Sheet/DB thật, không thay grants hoặc secrets.

## Kiểm tra local đã có

- TypeScript và build local cuối đạt. Nhóm cuối 58/58 ca trọng tâm đạt, gồm API thực qua Worker, nhập/sửa mounted, định mức, xác nhận/kho/Sheet bằng dữ liệu giả, refresh In Transit và tương thích GET. Full local ở commit 8141320 đạt 1.582/1.582 ca trong 261 file, không timeout/cancel/skip. CI GitHub được mở sau khi tạo draft PR #7, phải đọc đúng head; không dùng local pass thay CI.
- Nhóm hồi quy rộng 93/93; nhóm sản lượng/API/kho 42/42; payroll/earned/export 21/21. Các nhóm này có giao nhau, không cộng thành tổng coverage.
- Kiểm thử mounted component nhập mới 3/3, điều chỉnh 2/2; đây là JSDOM, không phải Chrome/responsive QA.
- Đợt full local đầu: 260 file, 1.572 đạt/7 thất bại, không timeout/cancel/skip. Sáu ca thuộc harness In Transit chưa nhận display child mới, đã bổ sung đúng leaf hiển thị (targeted 25/25, giữ assertion request/quyền/refresh); một ca so sánh API legacy do trường policy null, đã sửa API bỏ field khi không có policy (targeted 3/3). CI đúng commit cuối vẫn phải được xác minh riêng.

## Số đo TEST

Node 24.19.0, Miniflare/D1 local trên cloud executor; không có request production. Chạy `node scripts/bench/daily-output.mjs` để tái lập trên DB mới riêng.

| Phép đo | Quy mô | Kết quả |
|---|---|---|
| Tổng hợp UI bằng quét toàn bộ mỗi lệnh | 500 lệnh, 10.000 phiếu; 1 warm-up, 5 mẫu | 116,258–118,998 ms |
| Tổng hợp UI bằng index một lần | Cùng dữ liệu, đối chiếu deepEqual kết quả | 20,128–25,045 ms |
| Lưu sản lượng | D1 có 502 lệnh, 10.000 phiếu; 5 mẫu | 98,144–121,096 ms; 8 SELECT + 1 batch/mẫu |
| Đối chiếu cùng khóa đã lưu | Cùng DB | 16,117–31,500 ms |
| Đọc workflow không tính giờ dẫn xuất | Cùng DB | 1.560,224 ms; chỉ là bối cảnh tải, không phải baseline thao tác lưu tương đương |

Node heap cuối phép đo khoảng 64,96 MiB; không phải peak Worker memory. Chưa đo CPU production, network hay thời gian render trình duyệt.

`node scripts/bench/daily-attendance.mjs` dùng 80 lệnh legacy/80 phiếu/160 event/4 nhân viên/1 tuần Capacity, ba DB TEST mới mỗi thao tác. Lưu HR trước thử scope 299–360 ms, sau 327–357 ms; phụ kho trước 309–346 ms, sau 303–368 ms, cùng 28 SELECT và 1 batch. Không chứng minh cải thiện, vì vậy **không giữ thay đổi scope đó** trong bản source. Kết quả không chứng nhận đã hết quá tải production hoặc đã tối ưu toàn bộ HR/phụ kho.

## Còn chặn nghiệm thu/phát hành

1. Chưa bảo toàn xong kết quả legacy payroll thiếu snapshot hoặc hoàn tất regression ngày hiệu lực toàn web (Leadtime/Safety/BOM/nhân sự/Engine). Inventory đã chỉ rõ, không được gọi là hoàn tất.
2. Chưa hỗ trợ sửa/hủy phiếu đã xác nhận/liên kết kho; giữ khóa an toàn, cần quy trình đối chiếu được duyệt.
3. Chưa có browser tool trong executor này. Cần full ONSPA + đúng Worker + dữ liệu giả trên môi trường được hỗ trợ, kiểm desktop/mobile, nhập/sửa/đóng/timeout và độ ổn định khung trước gửi link cho Duyên. Không dùng localhost hay mockup làm bằng chứng bản web đã kiểm.
4. Chưa có production cutover, không tự bật/migrate. Phải nghiệm thu rồi mới quyết định merge và Website phát hành chọn lọc.

Không thay thế nguồn Site bằng repo TEST hoặc tự triển khai. Không lấy build/local pass làm CI pass.

## Hồi quy snapshot Line/SKU bổ sung

Test độc lập đã tái hiện: đổi Line hiện tại của LSX từ A sang B làm mất hàng tiền của phiếu mới đã ghi ở A (expected 1 hàng, actual 0). Bản sửa dùng Line và thông tin SKU/LSX đã lưu trên phiếu cho payroll mới; lưu snapshot thông tin lệnh khi tạo. Line cũ vẫn xem được lịch sử của chính mình bằng snapshot, không nhận nội dung mới của Line khác; bản lịch sử chỉ xem, không ghi thêm. Duyệt/sửa bị chặn nếu Line/SKU/LSX hiện tại không còn khớp, cần đối chiếu rõ. Legacy current-only giữ nguyên, không đổi assertion lịch sử cho khớp code. Nhóm targeted cuối sau sửa: 69/69 đạt, TypeScript và build local đạt. Kết quả CI của head bổ sung phải đọc riêng từ checks PR #7, không lấy CI của 8141320 thay thế.

## Hồi quy mã nguồn LSX legacy bổ sung

Sáu test API bảo vệ mã viết thường/khoảng trắng, alias `orderCode`/`mo`, chuẩn hóa Unicode và import xảy ra giữa đọc/commit. Trước sửa năm tình huống mã legacy bị bỏ sót (không chặn vượt lượng); sau sửa sáu tình huống đều đạt. SQL lọc chặt mã ASCII; các ứng viên Unicode/khoảng trắng phức tạp chỉ đọc summary gọn rồi dùng normalizer chung, giữ guard trước commit. Guard này có thể phải đọc thêm ứng viên legacy phức tạp; không tuyên bố mọi tập lịch sử có cùng chi phí.

Đo lại sau bổ sung snapshot/guard: cùng 500 lệnh/10.000 phiếu, UI quét 116,285–131,544 ms so với index 20,575–23,450 ms; lưu 147,593–164,899 ms (8 SELECT + 1 batch), replay 19,195–41,823 ms, full read không giờ dẫn xuất 1.700,955 ms; Node heap cuối 58,91 MiB. Đây là lượt local khác với bảng mốc đầu, có biến động tải; không dùng chênh lệch thời gian giữa hai lượt để gọi là tối ưu backend. Giữ toàn bộ kiểm tra consistency, không bỏ guard để lấy số nhanh.

## Mốc tiếp theo: Nhật ký, hot path và bảo toàn kết quả đã biết

Các thay đổi sau mốc `cd30214` đang được kiểm tra, chưa phải nghiệm thu/phát hành:

- Nhật ký có hạng mục Sản lượng ngày riêng, ngày sản xuất và thời điểm ghi audit tách biệt, không cột công đoạn/giờ nhân công và không tải định mức hiện hành cho hạng mục này. Điều chỉnh hiển thị lượng/ngày giờ trước–sau. Lịch sử công đoạn vẫn tra cứu riêng.
- Xác nhận phiếu ngày chỉ đọc phiếu/lệnh, summary sản lượng liên quan và cursor; không tải nhân viên, Capacity, định mức hay toàn bộ workflow. Giữ kiểm quyền, snapshot đã chọn, lý do trễ, trần sản lượng và CAS chống xác nhận hai lần.
- Khi mô hình mới hoạt động, lưu HR/phụ kho giữ kiểm lịch/roster/overlap/quyền và CAS nhưng không đọc hoặc tính lại báo công công đoạn cũ. Test đối chiếu raw records trước–sau và replay/concurrent.
- Thêm lớp anchor ghi nhận **kết quả đang biết tại thời điểm chuẩn bị**, không giả tạo lịch sử hiệu lực. Bảo toàn giá trị hiển thị giờ/chuẩn/cumulative trong Nhật ký, mức và earned legacy; tháng trước tháng chuyển đổi dùng attendance/nhân sự đã quan sát. Đổi danh mục hiện tại không đổi các kết quả này trong fixture. Bất kỳ sửa bản ghi legacy nào làm anchor stale; không lấy mức hiện tại thay thế. Thiếu baseline tháng thì chặn tiền, không tính bằng số 0.
- Policy mới phải tham chiếu manifest bảo toàn hợp lệ; thiếu manifest thì chưa bật luồng mới. **Chưa có công cụ chuẩn bị/chốt snapshot production nhất quán hoặc thao tác kích hoạt.** Helper tạo snapshot hiện chỉ dùng trong TEST giả; không được dùng nó để seed production.
- Chưa hoàn tất hiệu lực nhân sự cho các tháng đóng sau chuyển đổi, bảo toàn khi lệnh legacy đổi Line hoặc biến mất, chủ động điều chỉnh tháng đã anchor, và inventory Engine/Safety/BOM/Leadtime toàn web. Test bảo toàn hiện có là bằng chứng phạm vi cụ thể, không bảo đảm toàn bộ lịch sử production.

Kiểm thử local ở mốc này: nhóm rộng 93/93 đạt; sau bổ sung guard thay đổi mọi trường legacy, nhóm bảo toàn/Worker/HR 9/9 đạt. TypeScript đạt trước lần thêm helper journal (sẽ kiểm lại cùng build); không cộng hai nhóm có giao nhau. CI được xác minh gần nhất vẫn là **cd30214, run 41798333999, 1.592/1.592 trong 263 file**, ba build và typecheck đạt; không áp kết quả đó cho thay đổi mới chưa push.

Đo xác nhận phiếu (Node24, Miniflare local, request qua Worker, dữ liệu giả; trước là cd30214): 0/1.000/10.000 phiếu không liên quan, trước lần lượt 466–724 / 613–721 / 1.535–2.672 ms; sau 204–233 / 193–235 / 349–385 ms. SELECT trước 36/42/96, sau 10 ở cả ba cỡ; một batch, đúng một đề xuất kho. Chưa gồm network/browser hoặc CPU/memory production. Script tái lập `scripts/bench/daily-review.mjs`.

### Quy tắc kho Duyên đã chốt sau bản đầu

1. Kho **chưa xác nhận**: QLSX tự sửa/hủy theo quyền hiện có; cập nhật đề xuất chờ kho và audit. Không bắt thu hồi chỉ vì QLSX đã xác nhận sản lượng.
2. Kho **đã xác nhận**: phải qua thu hồi, vẫn giữ sự kiện thu hồi, người/thời điểm và dữ liệu gốc; không tự đảo tồn.
3. Dòng Google Sheet vẫn còn khi thu hồi, giữ lượng gốc nhưng phải vô hiệu hóa để công thức tồn không cộng lượng. Không chỉ ẩn/tô màu, không xóa dòng.

**Chưa triển khai xong ba bước này.** Bản source hiện vẫn khóa sửa/hủy khi đã xác nhận hoặc liên kết kho; đây là blocker phát hành, không phải yêu cầu chưa được Duyên quyết định. Rà Sheet chỉ đọc header và công thức mẫu đã thấy SUMIF theo SKU/cột lượng đề xuất không lọc hủy: đổi trạng thái đơn thuần chưa đủ. Chưa ghi Sheet, chưa tuyên bố toàn workbook được kiểm. Cần giao thức version/ack chống race giữa web–Sheet, kiểm tombstone/thu hồi, công thức loại trừ đúng phạm vi và kiểm không đổi số cũ trước khi nghiệm thu.

Kết quả kiểm mốc tiếp theo: TypeScript, build local và `git diff --check` đạt. Nhóm rộng 93/93 và nhóm bổ sung signature/Worker/bảo toàn 9/9 đạt (có giao nhau, không cộng thành full suite). Chưa có browser QA hoặc CI của mốc mới tại thời điểm ghi.

Đo HR/phụ kho theo mô hình mới: `node scripts/bench/daily-attendance-context.mjs /path/to/baseline/scripts/local/production-workflow.mjs`, baseline cd30214. Mỗi cỡ có 2 DB mới/mỗi thao tác/mỗi phiên bản, snapshot chuẩn bị ngoài vùng đo; 4 nhân viên, 1 tuần Capacity và 2 event mỗi lệnh. 80 lệnh/phiếu: HR trước 364,854–367,139 ms, sau 203,165–258,607 ms; phụ kho trước 361,099–393,592 ms, sau 176,406–221,784 ms; SELECT 28 → 15. 2.000 lệnh/phiếu: HR 2.293,867–2.370,521 → 408,100–453,773 ms; phụ kho 2.583,219–3.456,821 → 473,484–803,926 ms; SELECT 51 → 25. Tất cả lưu 1 batch. Mẫu ít và có test/build chạy cùng máy trong một phần phép đo, nên chỉ là dấu hiệu local, không phải benchmark cô lập hoặc cam kết production. Không bỏ kiểm quyền/roster/overlap/consistency để đạt số đo. Không đo browser/network hoặc CPU/memory Worker.

### CI c9b0197 và chuẩn bị công thức kho

Run [41810929277](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41810929277) kết thúc: TypeScript và cả ba build đạt; **1.601 pass / 4 fail, 267 file**, không timeout/cancel/skip. Bốn fail cùng `tests/search-route-components.test.mjs`: tra cứu Nhân lực current/history bằng Enter/click vẫn đòi một GET `/api/production-standards`, actual không GET. Đã tái hiện local 29 pass/4 fail; đối chiếu `ProductionLaborJournal` và `laborJournal` không dùng định mức sản phẩm. Giữ toàn bộ assertion lọc/Line/ngày/không ghi, đổi expectation sang **không request nào**, chặn cả fetch thừa. Targeted sau sửa cùng kiểm công thức kho: **36/36 đạt**. Không sửa logic nghiệp vụ hoặc bỏ test để xanh.

Source `scripts/warehouse-sheet/ONSPA_STOCK_FORMULAS.gs` mới chỉ có helper thuần tạo **kế hoạch** đổi công thức; không gọi SpreadsheetApp, không đọc/ghi Sheet tự động. Với mẫu SUMIF SKU cột C → lượng đề xuất cột E đã đối chiếu, giữ nguyên từng khoảng hàng, tiêu chí SKU và phép toán, thêm loại trừ trạng thái M `ĐÃ HỦY THEO YÊU CẦU SX` hoặc V `KHO ĐỒNG Ý HỦY`. Giữ lượng/dòng gốc. Mẫu ngoài phạm vi (whole-column, range lệch, lượng ở cột khác, công thức hỗn hợp) trả blocked và nguyên văn, không tự sửa. Test VM/pure 3/3 đạt, **chưa phải kiểm recalculate trong Google Sheets và chưa tích hợp giao thức thu hồi**. Cần audit toàn bộ phạm vi công thức thực tế và nghiệm thu TEST trước mọi áp dụng riêng được duyệt.

### Đối chiếu policy và tránh nhân đôi payload lịch sử

Ba test mới tái hiện trước sửa (0/3): xác nhận vẫn ghi khi policy đã tắt trước request hoặc bị đổi ngay trước commit; thiếu manifest sau mốc chuyển đổi có thể đi vào validation/tính công đoạn cũ. Bản sửa kiểm policy/manifest trong xác nhận và guard CAS, khóa ghi legacy sau mốc được duyệt dù manifest thiếu; GET workflow/In Transit trả lỗi rõ thay vì âm thầm trả kết quả tính lại. Không có policy thì hành vi legacy giữ nguyên. Nhóm policy/xác nhận/HR đạt 14/14 sau sửa trước khi tối ưu payload; nhóm bảo toàn/policy sau tối ưu đạt 13/13. Không có dữ liệu production được sửa.

Anchor mới lưu SHA-256 của toàn bản ghi raw chuẩn hóa khóa (vẫn kiểm mọi trường) và hỗ trợ đọc signature JSON của anchor phát triển cũ. Hash kiểm theo lô tối đa 32; không gửi signature raw hoặc bản sao thứ hai của cây employees/hours ra client. Giữ đầy đủ giá trị trên phiếu và các scalar dùng Nhật ký. Test 200 phiếu × 20 nhân viên: hình dạng response còn lặp so với response gọn, cùng dữ liệu capture, 1.538.781 → 840.181 byte. Đây là so sánh cấu trúc JSON, không phải đo full baseline c9/peak heap/CPU production.

Run [41811988822](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41811988822) ở aab50a1: TypeScript/ba build đạt, **1.607 pass / 1 fail, 268 file**, không timeout/cancel/skip. Fail duy nhất `production-record-pages`: biến active tăng sau khi DB trả về và giữ 5 ms, nên đo độ chồng lấp completion, không đo request đang chờ. Đã đổi instrumentation tăng trước await và giảm trong finally, bỏ timer; vẫn giữ assertion 1 < maxActive ≤ 3, đủ/đúng thứ tự 1.500 bản ghi, 5 lượt đọc, cap 512 KiB, oversized-row và scope rỗng. Không đổi production reader hoặc giảm assertion. Kiểm nhóm cuối và CI head mới cần ghi riêng sau khi chạy.

### CI 1689e0c và source đồng bộ Sheet theo lô

CI [41813063933](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41813063933) của **1689e0cc6e56f62a9b63bf1f704b979fbcab713d** đã đạt TypeScript, ba build và **1.612/1.612 test trong 269 file**, không timeout/cancel/skip; các lỗi đo concurrency/GET thừa ở hai run trước đã qua.

Đọc chỉ công thức, không giá trị nghiệp vụ hoặc ghi Sheet: 13 cột `G,J,M,P,S,V,AB,AE,AH,AK,AN,AQ,AT`, hàng 4–1466 của tab TỒN KHO, theo grid metadata hiện hành. Có **11.080 ô công thức NHAP** khớp mẫu chuyển đổi, đều chưa loại trạng thái hủy; helper không gặp blocked trong phạm vi này. Không suy ra các cột khác/tab khác hoặc toàn workbook đã được chứng nhận. Không lưu grid hoặc dữ liệu thật vào repo, không áp dụng công thức.

Source đồng bộ kho mới lập index một cột J một lần mỗi lô, làm mới nếu số hàng đổi, và vẫn đọc lại đúng dòng đích. Trước từng ghi có TextFinder chỉ trong cột J, exact/case-sensitive/literal, để phát hiện ID trùng/đổi vị trí mới phát sinh; không dựa index cũ để ghi. Thêm guard reportId trên dòng đích, giữ SKU/LSX/nguồn/trạng thái nhận, khóa lượng dòng đã nhận, revision ack, giới hạn 50 lượt và document lock. API sử dụng theo [tài liệu TextFinder chính thức](https://developers.google.com/apps-script/reference/spreadsheet/text-finder), không chạy Apps Script trên Sheet thật.

VM TEST 1.000 dòng/50 phiếu: 23.050 ô fetch thay hình dạng cũ 1.072.050 ô; vẫn có 50 tìm kiếm ID mới trên server. Đây là giảm payload đọc mô phỏng, **không đo latency hoặc CPU Google Sheets và không tuyên bố không còn quét ID**. Test trước sửa tái hiện 2 fail (quét full lặp, ID dòng đích đổi vẫn ack); sau có guard ID trùng giữa lô, append lặp một dòng, đủ ack, mọi ô ngoài ngày dự kiến bất biến. Hồi quy kho local cuối **23/23 đạt**, không skip/cancel. Bản TXT trước bị lệch guard correction/revision so với GS, nay đồng nhất và có test byte equality. Thay đổi source này chưa triển khai hoặc áp dụng lên kết nối thực tế; CI head bổ sung phải đọc riêng.

## Bổ sung sau ea83107: LSX lưu trữ và đầu vào snapshot nhất quán

Ba test pure tái hiện payroll mất hàng khi LSX không còn trong `orders` (0/3 trước sửa). Bản sửa dựng ngữ cảnh **chỉ đọc** từ phiếu ngày hoặc basis legacy đã chứng minh, giữ ID LSX riêng dù chung Plan ID; không tạo bản ghi In Transit. Thiếu mức vẫn có hàng chặn tiền, legacy không có căn cứ không được tự dựng lệnh. Khi LSX chuyển Line, Worker giữ ngữ cảnh snapshot của Line cũ nhưng không trả các trường hiện tại của Line khác. Đã kiểm qua Worker: xóa LSX không xóa phiếu lịch sử, không tự tạo lại lệnh; báo thêm vào LSX không tồn tại vẫn 404. Giờ/SL/tiền/quỹ của fixture tháng trước cutover giữ từng giá trị khi bỏ toàn bộ orders hiện hành. Không bao phủ việc xóa/sửa trái luồng mọi phiếu nguồn hoặc nhân sự tháng đóng sau cutover.

Payroll lập nhóm reports theo transitId một lần; không quét toàn bộ reports lặp cho từng order. Script `scripts/bench/payroll-history.mjs` so với helper ở baseline cd30214, pure JS Node24, dữ liệu giả, 1 warm-up/5 mẫu xen kẽ, deepEqual toàn kết quả và input không đổi: 50 lệnh/1.000 phiếu, 4,121–5,748 → 3,267–4,372 ms; 500 lệnh/10.000 phiếu, 137,881–153,304 → 31,302–37,172 ms. Không phải thời gian Worker/DB/browser hoặc peak memory.

`production-legacy-snapshot.mjs` bổ sung **helper nội bộ**, chưa có HTTP route/CLI triển khai hoặc thao tác production:

- Copy allowlist 14 nhóm đầu vào workflow vào entity snapshot trong **một batch atomic**, giữ nguyên byte payload và metadata; không copy auth_accounts/auth_sessions, cấu hình kết nối hoặc credentials. Không tạo DB/table/cloud resource mới.
- Chỉ Admin hiện hành không giới hạn Line; đòi sourceId do máy chủ cung cấp từ định danh file build riêng (`sourceSnapshot.metadata.snapshotId`), không từ request client. Kiểm tương thích source trước khi tính; baseline JSON/code đổi thì phải snapshot mới, không tính số cũ bằng code mới. Chưa tích hợp adapter build này vào route nào.
- Adapter chỉ đọc nguồn đã chốt; preview giữ đúng thời điểm capture và không dùng live master sau đó. Kiểm source live bằng count + join payload/metadata chính xác để bắt thay đổi/phát sinh/thay thế dù số hàng không đổi; bỏ qua entity không thuộc nguồn tính.
- Kết quả chỉ `captured`/`preview`, **không publish complete, không tạo anchor/policy hoặc kích hoạt**. Bản policy trỏ đến snapshot chưa complete vẫn bị khóa. Cần triển khai chốt anchor theo lô + kiểm atomic cuối, kiểm quy mô lớn và bước activation riêng sau nghiệm thu. Không xem helper preview là đã hoàn thiện toàn bộ cutover.

Kiểm local: nhóm rộng payroll/ngày/legacy/journal/lookup **128/128**, nhóm Worker/snapshot/orphan cuối **15/15** (có giao nhau); TypeScript và build đạt. Test snapshot có idempotency, mất/đổi source build, lỗi batch rollback, nguồn live thay đổi, phantom và source guard; không đọc/ghi DB thật. CI đúng head bổ sung phải kiểm riêng; ea83107 trước đó đã đạt 1.617/1.617, 270 file.


## CI cda5889 và luồng thu hồi đang phát triển

CI [41818025046](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41818025046) đúng head `cda5889586f9cf7dea07c6c3e4ddc9be7f0defaf`: TypeScript, ba build và **1.626/1.626 test, 272 file**, không fail/cancel/skip/timeout. Đây là checkpoint LSX lưu trữ/snapshot đầu vào, không phải chứng nhận các phần bổ sung dưới đây.

Source thu hồi bổ sung queue yêu cầu, quyết định Kho và ACK qua bridge đã xác thực sẵn. Không thêm quyền hoặc endpoint công khai. Phiếu đã nhận chỉ hủy hiệu lực sau khi Kho đồng ý và Sheet chứng minh giữ dòng gốc, giữ lượng gốc, công thức loại lượng khỏi tồn. Trước ACK, báo cáo/kho vẫn giữ lượng có hiệu lực; chỉ ghi yêu cầu/quyết định. Hoàn tất giữ số lượng và người/thời điểm xác nhận gốc trên phiếu đã hủy, ghi riêng lịch sử thu hồi, tính lại đúng LSX từ các phiếu còn hiệu lực. Phiếu mới/LSX chung Plan ID khác không bị ghi đè; LSX lưu trữ không tự tạo lại. Khi hủy phiếu ngày cuối, không được phục hồi completedQty cache cũ.

Source Apps Script có menu quyết định bằng email Google hiện hành, kiểm quyền sửa trước/sau xem xét, giữ dòng/ghi chú và E/N/R/S. Chỉ cập nhật trạng thái vô hiệu hóa khi đúng ID/SKU/LSX/lượng và công thức tồn cho SKU đã loại trạng thái hủy; thiếu dòng gốc không tạo dòng thay thế. Mất phản hồi giữ mã quyết định/lượt ACK, không quyết định lại; di chuyển dòng chỉ đổi vị trí quan sát, không tạo thao tác mới. Source này **chưa cài lên Sheet**, công thức thật chưa được thay, không có ghi dữ liệu production.

Bổ sung hồi quy điều chỉnh: preview phải ràng buộc cả nội dung đề xuất. Test trước sửa tái hiện đổi quantity sau preview vẫn ghi được; bản sửa thêm fingerprint vào expectedRevision, giữ kiểm phiên bản/quyền/CAS và bắt xem lại lượng, ngày giờ hoặc lý do khác.

Giới hạn chặn nghiệm thu vẫn còn: sửa/hủy trực tiếp khi Kho chưa xác nhận chưa hoàn thiện; UI yêu cầu/theo dõi thu hồi chưa nối đủ; công thức Sheet thực tế cần kế hoạch triển khai/đối soát riêng; chưa QA browser đúng Worker, chưa benchmark riêng luồng thu hồi hoặc recalculate Google Sheets. Snapshot mới chỉ captured/preview, chưa publish/activation; ngày hiệu lực toàn web và bảo vệ tháng đóng sau cutover chưa hoàn tất. Không merge/triển khai từ checkpoint này.

Kiểm local checkpoint thu hồi: nhóm rộng **80/80**; nhóm thu hồi cuối **15/15** (có giao nhau, thêm race insert giữa batch), nhóm Nhật ký **6/6**; không fail/cancel/skip. Replay bridge chỉ cho phép metadata kết nối `lastContactAt` cập nhật, mọi bản ghi nghiệp vụ/audit cũ vẫn bất biến. TypeScript/build đạt trước bổ sung nhãn Nhật ký thuần; test Nhật ký chạy sau thay đổi nhãn. CI commit mới cần đọc riêng, không lấy 1.626 test của cda5889 làm kết quả source mới.


### CI 975f5fe và giao diện yêu cầu thu hồi

CI [41825813749](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41825813749) đúng `975f5fe856ea3e22697af6cb145cd0019ec17ec7` hoàn tất: TypeScript, ba build, **1.659/1.659 test, 275 file**, 0 fail/cancel/skip/timeout, đủ summary. Ba shard lần lượt 578/450/631 test. Đây là checkpoint backend/Sheet trước giao diện bổ sung dưới đây.

Giao diện Điều chỉnh phiếu ngày đã xác nhận có thao tác **Yêu cầu thu hồi**, chỉ nhập lý do và xem đối chiếu số/người/thời điểm Kho đã nhận từ máy chủ. Không gửi quantity/day/time để sửa ngầm. Preview không ghi; xác nhận chỉ báo đã gửi yêu cầu, không báo đã đảo kho. Lỗi 503/non-JSON giữ nguyên lý do và mã thao tác, đối chiếu bằng đúng body cũ. Trạng thái pending/approved-awaiting-sheet lấy từ nhật ký đã được phân quyền và tải sẵn, không gọi N request theo từng dòng; khóa yêu cầu thứ hai, hiển thị rõ chờ đối soát. Kho chưa nhận vẫn bị backend trả hướng dẫn sửa/hủy trực tiếp, **luồng sửa/hủy này chưa xong**, không được xem giao diện yêu cầu là thay thế.

Mounted/pure UI **7/7**: không quyền, chờ kho, preview bắt buộc, không tự sửa lượng, retry sau overload, trạng thái lịch sử bất biến/thứ tự đảo, chặn yêu cầu lặp. Đây là JSDOM, chưa kiểm hình ảnh/focus thật desktop/mobile. TypeScript/build của phần UI đạt.

Phép kiểm hot path thu hồi bằng Miniflare local, Node24, dữ liệu giả, **một mẫu cho mỗi quy mô**, không chạy production:

| Phiếu không liên quan | Yêu cầu preview+apply | Kho quyết định preview+apply | ACK hoàn tất |
| --- | --- | --- | --- |
| 0 | 180,71 ms; 14 SELECT | 129,15 ms; 13 SELECT | 94,15 ms; 7 SELECT |
| 1.000 | 167,90 ms; 14 SELECT | 147,60 ms; 13 SELECT | 164,95 ms; 7 SELECT |

Mỗi ô có đúng một batch ghi atomic. Test bảo vệ số lượt đọc không tăng, không tải toàn workforce/nhân viên/all events và các phiếu không liên quan còn nguyên; không khẳng định SQLite không quét index/CPU tăng, không suy ra p95 hoặc thông lượng. Không có baseline luồng thu hồi trước vì đó là chức năng mới; không đo Apps Script/Sheet, mạng người dùng, peak memory hay nhiều phiếu cùng LSX. Thời gian mẫu trong CI có thể khác; không dùng latency làm assertion.

Nhóm kết hợp cuối UI/backend/điều chỉnh: **29/29**, không fail/cancel/skip; thêm một mẫu hiệu năng lặp cho mục đích hồi quy count, không dùng để khẳng định cải thiện latency. CI đúng commit UI phải kiểm riêng sau push.


### Cố định thời điểm quan sát snapshot

Test thực tế qua reader In Transit xác nhận Leadtime đang hiển thị có được lấy vào anchor, không mặc định null khi raw LSX không có trường này. Tuy nhiên đã tái hiện lỗi khác: giữ nguyên toàn bộ source, chỉ để đồng hồ qua mốc một phiên bản Leadtime tương lai thì cùng preview snapshot đổi **4 → 9**. Trước sửa test thất bại; sau sửa reader snapshot truyền `capturedAt` vào lựa chọn Leadtime, không dùng giờ chạy lại. Reader nhân sự của snapshot cũng dùng ngày GMT+7 quan sát để một endDate tương lai không làm nhân viên biến mất khi kiểm lại. Reader live vẫn theo ngày hiện tại, không đổi quyền hay ghi lịch sử.

Nhóm snapshot/giữ lịch sử/Leadtime/GET recovery/lifecycle nhân viên **14/14** đạt. Gồm đổi live master, phiên bản tương lai tới hiệu lực, endDate qua ngày, raw nguồn bất biến, preview không publish/activation. Đây là bảo vệ thời điểm cho snapshot chuẩn bị; chưa phải hoàn tất ngày hiệu lực Engine/Safety/BOM hoặc triển khai snapshot production. Không có thao tác DB/Sheet thật.

CI UI [41827063274](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41827063274) đúng `2f532eca4b3d2b83e1babc3c4e069cf56c6003d6` completed/success: TypeScript, ba build, **1.665/1.665 test, 276 file**, không fail/cancel/skip/timeout, đủ summary; shard 558/557/550. Bản sửa thời điểm snapshot phía trên có TypeScript/build local đạt, 7/7 snapshot cuối deepEqual toàn package preview qua mốc thời gian; CI commit mới phải kiểm riêng.

## Sửa/hủy trước Kho nhận và rà lại ACK từ dòng Sheet

Bổ sung theo quyết định đã chốt: QLSX được sửa/hủy phiếu đã QLSX xác nhận **khi Kho chưa nhận**, không cần Kho duyệt thu hồi. Ghi intent cùng ID ổn định và preview; lượng/tiền hiện tại vẫn dùng phiếu cũ đến khi ACK. Phần tăng được giữ chỗ trên phiếu để lệnh khác/lượt báo thêm không vượt trần. Không lấy số giữ chỗ làm sản lượng hoặc tiền đã hoàn thành. Sheet chỉ sửa lượng đề xuất/ngày của dòng chưa nhận; hủy giữ dòng và lượng gốc nhưng vô hiệu trạng thái. Trước/sau và người quyết định giữ trong request/event riêng.

- Chặn xác nhận Web và ghi đè generic records trong lúc đang đối soát. Nếu Sheet đã nhận trước khi sửa, ghi nhận đúng số/người/thời điểm nhận, hủy intent sửa, giải phóng giữ chỗ và báo phải thu hồi; không áp số mới lên hàng đã nhận. Audit `confirm` của Kho vẫn được ghi.
- CAS kiểm report, receipt, LSX, policy/manifest, scope báo cáo và kết nối đã đối chiếu; ACK đúng request/revision/ngày/lượng/Sheet. LSX giảm trần trong lúc chờ thì không hoàn tất edit vượt trần. Hai intent cùng lúc hoặc Kho nhận ngay trước batch chỉ một nhánh thắng, không có request/event/giữ chỗ mồ côi.
- Script lưu marker prepared/applied/acknowledged và giờ áp dụng đầu tiên. Mất phản hồi sau commit không tạo command/phiếu mới; thử lại từ marker của dòng gốc. Chặn Kho xác nhận giữa lúc Sheet đã sửa và Web chưa ACK. Không đổi quyền/tạo token.
- **Giới hạn rõ:** cần kết nối đang hoạt động và phiếu gốc đã đồng bộ trước; nếu lần xuất ban đầu chưa xong, báo chờ và chưa ghi intent. Dòng gốc mất hoặc nhận hàng sau một lượt Sheet chưa rõ kết quả phải đối soát, không tạo dòng thay thế/ghi đè. Chưa có kiểm Google Sheets/browser thật; cần triển khai đồng bộ bộ script và công thức đã nghiệm thu, không chỉ Worker.

Rà soát độc lập ACK đã được tái hiện bằng VM: duplicate sau mất phản hồi vẫn gửi ACK, còn di chuyển một dòng duy nhất phải được nhận đúng. Trước sửa 2 fail/1 pass; sau kiểm ID duy nhất toàn cột J trước cả ACK xác nhận và ACK thu hồi. Dòng ambiguous không được gửi/stamp; giữ retry dòng duy nhất di chuyển, cùng proof và timestamp. Footer tiếp tục các dòng khác, không đọc ghi chú cho toàn bộ N dòng khi tìm pending correction: fixture 1.000 dòng khác chỉ đọc note đúng dòng cần đối soát.

**Lỗi đọc gọn được tìm thêm:** `json_extract(true)` đưa boolean thành số 1 trong `json_object`, làm predicate strict của phiếu ngày không nhận đúng loại; có thể lấy lại lượng đã báo làm baseline legacy. Sửa cách dựng JSON boolean tại SQL, không nới predicate hoặc quyền. Test Worker 200 đã xác nhận + 300 mới phải có baseline 0 và hoàn thành 500. Khi thay chính phiếu đang sửa, giữ một placeholder đã hủy để không hồi sinh cache completedQty của phiếu đó. Giữ baseline legacy thực sự đã có căn cứ.

Kiểm local trước bước cuối: nhóm rộng daily/kho/nhật ký/In Transit **154/154**; nhóm pending quyền/receipt/CAS/audit cuối **10/10**; nhóm Sheet/nhật ký cuối **29/29**, có giao nhau, không cộng thành tổng. TypeScript/build mốc trước cuối đạt; phải kiểm lại sau các guard/metadata cuối. Chưa có CI của source bổ sung tại thời điểm ghi mục này.

Benchmark có script tái lập `node --test scripts/bench/daily-matched-scope.mjs`, TEST Miniflare, một mẫu/quy mô, không tải build song song trong phép đo. **Bổ sung kiểm baseline 0 và lũy kế = phiếu cũ + 200**; phép đo trước 1c29 chỉ kiểm lượng phiếu trả về/số bản ghi nên không đủ chứng minh ngữ nghĩa baseline. Không dùng số trước đó làm so sánh cải thiện:

| Phiếu cùng LSX | Đọc scope | Summary | Lưu tăng 200 | SELECT/batch |
| --- | --- | --- | --- | --- |
| 0 | 19,60 ms | 2 byte | 142,61 ms | 9 / 1 |
| 100 | 25,46 ms | 68.491 byte | 140,31 ms | 9 / 1 |
| 1.000 | 87,09 ms | 685.891 byte | 200,09 ms | 9 / 1 |

Đây là handler trực tiếp và DB local, không gồm HTTP/auth wrapper, mạng/Sheet, p95/CPU/peak memory hoặc trên 1.000 phiếu cùng LSX. Không suy ra production hết quá tải. Source vẫn chưa đủ phát hành: còn hoàn thiện publish/activation snapshot trong TEST, ngày hiệu lực toàn web, browser/Worker và đối soát Sheet thực tế.

Kiểm cuối source bổ sung: **45/45** pending API/UI/Sheet/nhật ký đạt; có giao nhau với nhóm rộng 154, không cộng gộp. TypeScript/build cuối đạt; GS/TXT byte-equal và diff whitespace sạch. CI đúng head mới sẽ ghi riêng sau push. Không có browser/Sheet thật được chạy.

## Chốt snapshot theo lô và mô phỏng kích hoạt TEST

Source mới bổ sung helper **nội bộ** `production-legacy-publication.mjs`; không HTTP route, nút Admin bật production, migration hoặc tự chạy trên menu. Chỉ chốt các anchor của báo công/payroll đã quan sát, **không phải backup đầy đủ hoặc chứng nhận ngày hiệu lực toàn web**.

1. Tính package một lần trên source đã đóng băng, đúng build và capturedAt. Kế hoạch giữ hash/tổng từng nhóm và từng lô; không cho trùng khóa, bỏ lô hoặc đổi nội dung.
2. Ghi tuần tự tối đa **8 anchor / 128 KiB mỗi lô** trong một batch atomic, kèm bản kiểm chứng byte-exact; cập nhật tiến độ cùng batch. Runtime chưa dùng mốc staging. Mất phản hồi thử lại đúng lô, không ghi đè anchor khác. Metadata giới hạn 256 KiB/2.048 lô; vượt giới hạn báo cần kế hoạch phân trang, không bỏ dữ liệu.
3. Hoàn tất chỉ đổi manifest thành complete trong cùng hàng rào SQL kiểm **nguồn live không đổi**, đủ số anchor và mọi payload còn khớp bản kiểm chứng. Phantom, sửa nguồn, thiếu/thêm/sửa anchor hoặc batch lỗi không có complete giả; không sửa bản ghi nguồn.
4. Kích hoạt mô phỏng chỉ nằm trong `tests/helpers/activate-prepared-daily-policy.mjs`, không import từ runtime; cần simulation=true và marker DB fixture cô lập. Driver kiểm lại source/anchor ngay trong batch, ghi mốc chuyển đổi cố định và policy cùng nhau, đúng ngày TEST đã chọn. Lượt cũ replay không bật lại một policy bị thay đổi, không ghi đè mốc khác.
5. Runtime đọc policy và mốc cố định trong **một SELECT với hai lookup khóa**, không tăng round-trip. Khi đã có mốc mà policy bị xóa/tắt/trỏ mốc khác, fail closed trước khi tính/ghi legacy; không âm thầm quay lại mô hình cũ. Đây là guard dữ liệu, không thay grant/tài khoản.

Kiểm riêng **10/10** publication/TEST activation: quyền/build, partial/out-of-order, retry, rollback cả batch, thay/phát sinh nguồn ngay trước final batch, thiếu/thêm/sửa anchor, kiểm lại trước activation, không policy tự bật, policy bị xóa không mở lại legacy. Authenticated Worker handler trên DB Miniflare đọc đúng anchor; đổi mức hiện tại 0,1→9 và tên/Line nhân viên không đổi basis, giờ, baseline tháng hoặc raw report đã lưu. Không gọi đó là bằng chứng 0,1 là mức thực tế của quá khứ. Nhóm rộng **38/38** gồm pending/legacy/policy/attendance (có giao nhau với các nhóm trước), TypeScript/build mốc này đạt; kiểm enum lỗi kết nối cuối và source cuối ghi riêng.

Benchmark cold chuẩn bị/chốt có script tái lập `node --test scripts/bench/legacy-publication.mjs`, một mẫu/quy mô, DB mới hoàn toàn giả:

| LSX/phiếu legacy | Anchor / lô | Copy source | Tính kế hoạch | Ghi toàn bộ lô | Final / kích hoạt TEST |
| --- | --- | --- | --- | --- | --- |
| 50 | 101 / 13 | 33,89 ms | 302,26 ms | 1.024,20 ms | 17,01 / 27,80 ms |
| 500 | 1.001 / 126 | 43,08 ms | 955,01 ms | 10.054,13 ms | 31,75 / 42,49 ms |

Mỗi lô chỉ một SELECT manifest và một batch ghi, không tải/tính lại workflow theo từng lô. Khoảng 10 giây là tổng 126 lượt ở Node/Miniflare, **không phải thời gian một request lưu sản lượng**, không đo Worker CPU, peak memory, p95, HTTP/Google hoặc quy mô lớn hơn. Khởi tạo vẫn phải tính một lần toàn nguồn, chưa chứng minh an toàn tài nguyên production. Cần adapter build riêng và kế hoạch phát hành được nghiệm thu; không dùng driver TEST làm đường kích hoạt thật.

CI f83ea23 [41834282113](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41834282113) kết thúc failure vì runner shard1 nhận shutdown/exit143, không có CI SUMMARY; chưa xác định nguyên nhân shutdown. Hai shard đủ summary 529/529 và 687/687; shard bị ngắt có 345/345 trong 63 file đã đủ summary. Tổng 1.561 pass/248 file đủ summary, 1 file dở, 29 file chưa bắt đầu; không coi CI đạt. File dở production-plan-notices có một subtest ok trước ngắt, chạy riêng local đủ **4/4 và thoát bình thường**. Không sửa/bỏ assertion hoặc manual rerun giống hệt; checkpoint source mới có lý do kiểm toàn bộ gồm publication và immutable-cutover guard.

Lỗi trạng thái kết nối Kho tắt được trả 409 (đã biết chưa ghi) thay vì 503 để client không khóa bản nháp thành kết quả chưa rõ; timeout/5xx/non-JSON thật vẫn giữ nonce và đối chiếu lượt cũ.

Kiểm source cuối publication: nhóm targeted **30/30** đạt; TypeScript/build đạt. Đo lại lưu sản lượng cùng script sau marker lookup gộp: 0/100/1.000 phiếu cùng LSX, đọc 16,90/30,65/69,55 ms, lưu tăng 200 là 122,06/180,09/203,00 ms; 9 SELECT, một batch, baseline 0 và tổng cũ+200 đúng. Một mẫu/quy mô local, không phải before/after hoặc cam kết latency. CI commit mới phải kiểm riêng.

## Kiểm cuối publication và bổ sung hàng rào phiếu kho

CI commit `2c4ecf81ec2f10dc178104b2694f20fa8efe9b27`, run [41839367227](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41839367227), đã **đạt 1.699/1.699 kiểm thử trong 279 file**, không fail/cancel/skip/todo; TypeScript và ba build đạt. Đây là kết quả của checkpoint trước nhóm bổ sung dưới đây, không tự gán cho head mới.

- Tái hiện API `/api/records` có thể sửa lượng phiếu sản lượng ngày trực tiếp (200 thay vì 409). Chặn sửa, hủy/khôi phục hoặc tạo lại phiếu quản lý bởi báo sản lượng qua API chung, đối chiếu cả ID liên kết cũ/mới và khóa `SX:`. Phiếu kho nhập tay vẫn giữ hành vi cũ. Kiểm thử Worker/auth giữ dữ liệu nghiệp vụ và audit đúng hợp đồng, không đổi quyền.
- Thu hồi phải có bằng chứng phiếu gốc đã xuất; request, quyết định và ACK ràng buộc Sheet ban đầu. Lọc lệnh thuộc Sheet khác **trước LIMIT 50** để không làm đói các phiếu hợp lệ. Setup bình thường vốn đã chặn đổi file đang liên kết; test lỗi phục hồi cấu hình chỉ fault-inject vào DB giả, không tuyên bố API cho phép đổi Sheet. ACK sai Sheet bị từ chối, khôi phục đúng kết nối giả thì hoàn tất đúng một lần.
- Phiếu chờ sửa/hủy vẫn hiện trong danh sách chờ Kho với trạng thái rõ ràng, nhưng không được chọn/xác nhận. Preview gặp 409 bị bỏ, xóa chọn và tải lại thay vì giữ nút commit cũ. Mounted JSDOM kiểm ba tình huống, không phải browser QA.
- Snapshot bổ sung danh sách công đoạn LSX đã quan sát. Sau đổi danh mục SKU, lịch sử vẫn trả danh sách cũ; so sánh array theo giá trị và deep clone để không alias. Sửa rõ nguồn riêng làm mất hiệu lực projection trường đó, không ghi ngược dữ liệu cũ.

Kiểm local nhóm tổng hợp **44/44** (pending/withdrawal/legacy publication/preservation/warehouse UI) đạt; thêm kiểm clone/explicit process edit **2/2** trong cùng file, có giao nhau. TypeScript/build cuối đạt. Kiểm script Sheet bằng VM được ghi riêng theo file; không chạy Apps Script hay sửa Sheet thật. CI nhóm bổ sung phải đọc theo commit mới sau push.

Phép đo trong test thu hồi, một mẫu/quy mô Miniflare, 0/1.000 report không liên quan: preview+lưu request 121,78/114,14 ms, 14 SELECT/1 batch; preview+quyết định 121,85/118,53 ms, 13 SELECT/1 batch; ACK 78,01/78,10 ms, 7 SELECT/1 batch. Đây không phải CPU/heap/p95/HTTP/Google và không chứng minh production hết quá tải.

Vẫn chặn phát hành vì chưa có browser/Google Sheets thật, adapter kích hoạt production, bảo vệ tháng đóng sau cutover và ngày hiệu lực toàn web. Đang rà lại việc tính legacy trên full GET; chưa bỏ phép tính nào chỉ dựa trên suy đoán. Không merge, deploy, bật policy hoặc ghi DB/Sheet thật.

## Rà Safety theo ngày và phần ngày hiệu lực còn lại

Tái hiện trực tiếp hàm dùng trong `app/page.tsx`: xác nhận phiên bản mới tự chuyển bản trước sang `Hết hiệu lực`, giữ `confirmedAt` và khoảng ngày cũ; lookup cũ bỏ trạng thái đó nên cùng ngày lịch sử trả `undefined` thay vì V1. Test trước sửa **1 fail / 1 pass**. Sửa hẹp cho phép phiên bản hết hiệu lực có thời điểm xác nhận hợp lệ tham gia đúng khoảng ngày đã lưu; hủy, xóa, nháp hoặc thiếu/sai căn cứ vẫn bị loại. Giữ nguyên quy tắc biên ngày inclusive của Safety hiện có: tại ngày hai bản cùng biên, bản có ngày bắt đầu mới hơn thắng. Không chuyển Safety sang semantics định mức lao động khác, không sửa `effectiveTo`, không tính lại hoặc ghi Engine/Plan cũ.

Nhóm Safety/basic master/planning import/hiển thị GMT+7 **16/16** đạt; kiểm riêng cuối Safety **2/2**, có giao nhau. Dữ liệu giả, VM chạy hàm lookup thật từ source, không phải browser QA. Phần hiệu lực này không khôi phục lịch sử đã thiếu và không chứng nhận toàn Engine/BOM.

Rà chỉ đọc còn cho thấy:

- `production-plan.mjs` giữ laborHour của dòng đã chốt/đã chuyển, còn draft dùng master hiện tại. Plan kéo dài nhiều ngày dùng một laborHour trên dòng; chưa có phân bổ lượng từng ngày để áp hai mức xuyên biên. Không tự tạo bình quân hoặc chia lượng; cần kiểm thiết kế phân bổ trước khi triển khai phần này.
- Engine đã có lookup Leadtime/Safety theo tuần và lưu kết quả; không replay snapshot cũ để thay bằng kết quả lookup mới. BOM có confirmationSnapshot/phiếu thay đổi nhưng live projection nguồn được thiết kế riêng, chưa đủ căn cứ đổi toàn bộ sang raw snapshot.
- Anchor attendance hiện bảo vệ tháng trước tháng cutover. Tháng chứa cutover và các tháng mới vẫn cần bảo vệ phần dữ liệu cũ mà không chặn HR bổ sung hợp lệ hay khóa cứng cả tháng; chưa tìm được hợp đồng chốt tháng trong component payroll. Đây là phần còn làm, không gọi mọi tháng đã bất biến.
- Đối chiếu tiếp **call site** API cho thấy policy ngày active đã tắt `includeDerivedHours` cho cả full và work. Mặc định helper còn tính khi chuẩn bị snapshot là có chủ đích, không chứng minh màn hình runtime vẫn tính công đoạn. Các phép cộng lịch sử từ dữ liệu đã lưu vẫn còn để tra cứu; chưa loại chúng khi chưa chứng minh kết quả tương đương.

Probe pure synthetic cho tháng chứa cutover đã xác nhận khoảng trống: cutover 04/11, ca 03/11 có 7 giờ 40 phút, capture không sinh monthly baseline tháng 11. Đổi `employee.startDate` hiện tại sang 01/12 khiến monthlyAttendance tháng 11 mất người đó (7,6667 giờ → không còn người, không báo issue). Không có DB thật được mở hay sửa. Phải bổ sung bảo vệ prefix trước mốc chuyển đổi cùng kiểm luồng HR bổ sung/sửa có audit, không dùng cách đóng băng cả tháng làm mất dữ liệu mới. Đây là lỗi bảo toàn chưa giải quyết, chặn nghiệm thu, không chỉ là câu hỏi chốt tháng.

Điểm cần chốt nếu phát sinh điều chỉnh HR về trước cutover: giữ kết quả đã bảo toàn và lập phiên bản điều chỉnh được duyệt riêng, hay cho người có quyền sửa lại kết quả cũ qua chính luồng HR hiện tại? Cả hai đều phải giữ bản gốc/audit; chưa tự khóa quyền HR hoặc âm thầm bỏ qua một sửa đổi đã lưu. Việc bảo vệ khỏi thay master hiện tại là yêu cầu đã chốt, không hỏi lại.

CI nhóm kho `3b975110ff5386d975428ee796a6f5ef1b847124`, run [41845095269](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41845095269), đã đạt **1.704/1.704 trong 279 file** (587 + 451 + 666), không fail/cancel/skip/todo, không file thiếu summary. TypeScript và ba build đạt. Source Safety tiếp theo phải kiểm CI riêng; không gán mốc 1.704 cho source chưa push.

## Bỏ projection công đoạn trên màn sản lượng; đo API sau kích hoạt TEST

Tìm thấy effect của ProductionManagement vẫn gọi `projectLiveStages` hoặc `projectIncidentStages` ở chế độ work, kể cả khi policy ngày active. Thêm guard `dailyMode`, có dependency để chuyển policy đúng; luồng stage/incident cũ giữ nguyên. Test chạy chính callback từ source chứng minh chế độ ngày không gọi cả hai hàm và không schedule setStageState; luồng legacy vẫn nhận đủ đầu vào. Nhóm effect/daily board/loading **31/31** đạt, không phải nghiệm thu browser hoặc số đo thời gian render.

Mở rộng script tái lập `node --test scripts/bench/legacy-publication.mjs`: sau chốt đủ anchor/kích hoạt DB fixture, gọi **siteApi thật bằng Request/Response và session giả**, đối chiếu từng report.hours, trạng thái/căn cứ earned với anchor và kiểm mọi production record/in_transit trước–sau GET bất biến. Không dùng direct helper mặc định để suy ra đường đi API.

| LSX/phiếu legacy | Full GET / SELECT / JSON | Work GET / SELECT / JSON |
| --- | --- | --- |
| 50 | 552,29 ms / 33 / 211.058 byte | 462,34 ms / 29 / 165.426 byte |
| 500 | 753,33 ms / 36 / 2.051.261 byte | 624,34 ms / 31 / 1.607.028 byte |

Một mẫu/quy mô Node24/Miniflare, đã gồm session handler và parse JSON, không gồm mạng/trình duyệt/Google, không CPU/peak memory/p95 hoặc cam kết tải production. Payload work vẫn lớn theo lịch sử; cần phân tách dữ liệu sâu hơn sau khi chứng minh mọi consumer dùng projection gọn đúng, không tự xóa lịch sử. Test script **1/1** đạt và thoát bình thường; script benchmark không thuộc danh sách tests/*.test.mjs cấp cao nhất của CI nên không cộng vào tổng CI.

Đo riêng API xác nhận (ba mẫu/quy mô, không chạy build hay benchmark khác đồng thời): 0/1.000/10.000 report không liên quan có thời gian 218,02–252,10 / 190,06–219,32 / 194,37–285,47 ms; cố định **12 SELECT/1 batch**, đúng lượng 200 và chỉ một phiếu kho. Đây là số đo TEST hiện tại, không so before/after hay chứng nhận Sheet/browser.

CI Safety `0693e496f64717a0fc34f59a5fd57ea709eeccfc`, run [41846383446](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41846383446), đã đạt **1.706/1.706 trong 280 file** (533 + 510 + 663), không fail/cancel/skip/todo hoặc file thiếu summary; TypeScript và ba build đạt. Nhóm projection/benchmark bổ sung tiếp: kiểm local 31/31, kiểm callback cuối 2/2 có giao nhau, TypeScript/build đạt; CI của commit bổ sung phải kiểm riêng sau push.

## Bảo toàn giờ phần trước ngày chuyển đổi trong cùng tháng

Checkpoint trước `6a84ffd00bb1afa06cdde424d2524acb5c490168` đạt CI [41847594250](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41847594250): **1.708/1.708 trong 281 file**, TypeScript/ba build đạt. Phần bổ sung dưới đây chưa được gán kết quả CI đó.

Lỗi tháng cutover đã được tái hiện và sửa trên source TEST: capture thêm baseline từ ngày đầu tháng đến **trước ngày chuyển đổi**. Ví dụ cutover 04/11 giữ giờ 03/11 theo căn cứ đã quan sát; ngày 04/11 trở đi tiếp tục tính từ dữ liệu mới. Không đóng băng cả tháng hoặc tự chốt các tháng tương lai. Ngày đầu tháng là cutover thì không có phần cũ và giữ phép tính tháng hiện có.

- Thêm khoảng date-only `[dateFrom, dateUntil)` vào monthlyAttendance, mặc định vẫn cả tháng. Không suy ra ngày hiệu lực từ thời điểm ghi hoặc điền mức/giờ lịch sử đã thiếu.
- Full GET đối chiếu phần trước mốc bằng luồng HR/lịch hiện tại **và căn cứ nhân sự/Line LSX đã bảo toàn**. Đây là tính toán trên các dữ liệu đã đọc, không thêm truy vấn riêng theo người/phiếu, không ghi lại anchor. Cờ integrity/livePrefixMatches được tính lại, không dùng trạng thái đã lưu như bằng chứng vĩnh viễn. Work profile không làm phép đối chiếu này.
- Khi phần cũ còn khớp cả dữ liệu hiện hành, giữ thứ tự cộng của phép tính tháng gốc. Kiểm deep-equal toàn kết quả và ranh giới hệ số: cộng lại hai số float theo nhóm khác có thể lệch ~2e-15 và đổi bậc quỹ; không làm tròn/nới assertion để che vấn đề.
- Khi thay master làm mất giờ cũ, giữ số prefix và cộng phần sau mốc đúng một lần. Placeholder “chưa có lịch phân công trong tháng” được giải quyết khi người đó có phân công ở phần còn lại theo quy tắc cũ; lịch thiếu thật, người không có phân công hoặc nhãn trùng vẫn giữ bằng chứng chặn tiền, không đổi null thành 0.
- HR vẫn có thể lưu sửa ngày cũ theo quyền hiện có. Nếu phép tính giờ/lịch trước mốc đổi, giữ số gốc, báo cần đối chiếu và chặn tính/xuất tiền; không âm thầm ghi đè hoặc bỏ qua sự kiện đã lưu. Raw report và baseline lưu DB không đổi.
- Giữ quy tắc chia tiền hiện hành cho ngày ngưng làm việc rõ ràng thuộc phần mới và việc hủy ngày ngưng dự kiến. Test so toàn kết quả/quỹ với thuật toán cũ, có quỹ thực trả và người đủ điều kiện nhận chia lại. Không đánh đồng thao tác này với sửa ngược startDate hoặc Line không có ngày hiệu lực đã chứng minh.
- Thêm capability `cutoverMonthAttendance` vào manifest/driver TEST và kiểm policy. Mốc cũ thiếu capability không được chứng nhận đã bảo toàn tháng cutover; không tự migrate/bật policy hoặc quay lại ghi legacy.
- Kiểm tra toàn cục chỉ chạy phía server. Line A chỉ nhận baseline/cờ kiểm của A; nhân viên mượn từ B giữ giờ được phép xem nhưng không nhận startDate/endDate/history/version nhân sự B qua baseline prefix mới. Không đổi grant/menu/quyền lưu HR.

Đã có **13/13 ca pure + 1/1 API có xác thực**, dữ liệu giả. Ca API chạy POST sửa nhân viên (có before/after history), POST HR sửa ngày cũ, GET trước–sau và đọc bằng user Line A. Các ca pure gồm đổi startDate/Line/name, ca mới sau mốc, HR cũ/mới, lịch cũ thay, thiếu baseline/capability, mượn người xuyên mốc, placeholder/nhãn trùng và đối chiếu chính xác giờ/quỹ. Đây không phải browser QA. Kiểm hồi quy rộng/typecheck/build cuối và CI mới được ghi riêng sau khi hoàn tất.

**Chưa tự quyết:** nếu HR cố ý sửa ngược phần giờ/lịch đã bảo toàn hoặc thay startDate/Line làm khác điều kiện chia tiền giữa hai phần, cần chọn phiên bản điều chỉnh được duyệt riêng hay cho luồng HR hiện tại thay kết quả tháng đang mở kèm before/after rõ. Hiện giữ số gốc và chặn tiền ở chỗ mâu thuẫn; quyền lưu HR không bị khóa. Không hỏi lại yêu cầu bảo toàn dữ liệu vốn đã được chốt. Việc ngưng làm việc có ngày rõ sau mốc đã kiểm theo công thức cũ, không chờ quyết định mới.

**Giới hạn:** phạm vi prefix là trước **ngày** cutover, không tuyên bố đã khóa từng thời điểm trong cùng ngày triển khai hoặc mọi tháng sau đó. Phiếu legacy đã có anchor riêng vẫn giữ giờ/định mức quan sát. Cơ chế ngày hiệu lực nhân sự sau cutover, chốt/điều chỉnh tháng tiếp theo và toàn web còn phải hoàn thiện; không dùng sửa prefix để tuyên bố tất cả lịch sử đã bất biến. Anchor vẫn có giới hạn 128 KiB/record và publication fail closed nếu vượt, chưa chứng minh phân trang cho danh sách nhân sự lớn.

Rà tiếp chỉ đọc: Leadtime In Transit có precedence hiện hành “master hủy ⇒ null” và mặc định tra thời điểm hiện tại; các LSX trước cutover được anchor riêng. Chưa tự đổi các LSX mới sang ngày mở/chốt/bắt đầu khi chưa xác định đúng ngày nghiệp vụ. Plan draft dùng mức hiện tại, dòng chốt/chuyển giữ mức; một dòng kéo dài nhiều ngày chưa có lượng mỗi ngày để nhân hai mức, không tự chia lượng/bình quân. BOM có confirmationSnapshot/sourceSnapshots, nhưng live lookup nguồn SKU có hợp đồng riêng; chưa sửa live lookup thành lịch sử tùy tiện. Nhân sự lưu before/after theo recordedAt, chưa đủ để coi là validFrom nghiệp vụ.

Kiểm cuối nhóm tháng cutover: hồi quy rộng **63/63** (payroll/export/attendance/policy/snapshot/publication/API), kiểm thêm bộ pure cuối **13/13** có giao nhau; TypeScript và build source cuối đạt. Test publication cũ vẫn so mọi giá trị baseline đã lưu; chỉ tách cờ kiểm livePrefixMatches được tính lại theo master và kiểm rõ integrity phải matched. Không bỏ kiểm dữ liệu cũ cho test xanh.

Đo cuối cùng `node --test scripts/bench/legacy-publication.mjs`, chạy riêng sau build/test: 50/500 LSX, 4 nhân viên giả, full API GET 463,42/739,86 ms (33/36 SELECT), work GET 364,27/562,76 ms (29/31 SELECT), không batch ghi. JSON full 212.482/2.052.686 byte; work 165.453/1.607.055 byte. Số truy vấn giữ như checkpoint trước, thêm kiểm prefix không gọi DB theo người/phiếu; một mẫu không chứng minh latency được cải thiện. Chuẩn bị 102/1.002 anchor, 13/126 lô, tổng ghi 1.018,49/11.126,31 ms; là cold preparation, không phải request lưu HR/sản lượng. Script **1/1** đạt, so giờ/status/earned từng phiếu với anchor và production records GET trước–sau bất biến. Không browser/network/Google/p95/CPU/peak memory hoặc bằng chứng cho quy mô nhân sự lớn. CI commit mới phải đọc riêng sau push.

## Kiểm tiếp BOM: đơn vị/mẫu số/hao hụt lịch sử có căn cứ

CI `a2274d9e8de2005adfb7e8f0a047d43c1b72dcf3` [41856830003](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41856830003) đã **đạt 1.722/1.722 trong 283 file** (549 + 505 + 668), không fail/cancel/skip/todo hoặc thiếu summary; TypeScript và ba build đạt. Đây là mốc sửa tháng cutover, trước nhóm BOM dưới đây.

Tái hiện bằng chính đoạn projection trong `app/page.tsx`, không phải mô phỏng lại công thức: dòng lịch sử được dựng khi thiếu dòng đã ngưng lấy `unit` từ danh mục **hiện tại**, còn denominator/waste từ dòng phiếu thay đổi có thể là **giá trị mới**. Fixture có bản trước 2 kg / mẫu số 3 / hao hụt 1%, phiếu thay thế mẫu số 10 / 9%, danh mục hiện tại chiếc: trước sửa trả chiếc / 10 / 9%, đổi danh mục sang thùng còn đổi tiếp đơn vị của cùng lượng cũ. Hai test đầu đều fail, không có API/DB thật được dùng.

Source bổ sung helper chỉ đọc `bomHistoricalMeasure`: dùng đúng `sourceSnapshots[SKU]`, mã và lượng cũ khớp, cùng ngày hiệu lực đã ghi nếu có, phải có **duy nhất** một dòng trước phù hợp. Lấy đơn vị/mẫu số/hao hụt từ bản đó; không đổi oldQty trên phiếu. Nếu thiếu, mơ hồ, lượng mâu thuẫn hoặc đơn vị gốc còn thiếu thì hiển thị thiếu căn cứ; không dùng master hiện tại hoặc suy từ giá trị thay thế. Mẫu số bỏ trống trong bản nguồn duy nhất vẫn theo default 1 của schema BOM hiện có; không mặc định 1 khi hoàn toàn thiếu bản nguồn. Không tự tạo ngày đã thiếu.

Kiểm thêm các rủi ro cùng view:
- Phiếu hàng loạt dùng danh sách skus, không chỉ sku đầu tiên; chọn SKU thứ hai vẫn dùng bản nguồn của chính SKU đó.
- Một dòng đã ngưng ở ngày khác không được che mất lần thay đổi đang xem; đối chiếu cùng mã và ngày hết hiệu lực, hiểu cả ISO/dd-mm display. Không sinh lại dòng đã lưu cùng mốc.
- Dòng dựng từ chứng từ cũ không trở thành lượng đang dùng chỉ vì thiếu ngày hết hiệu lực. Đây là phân loại projection đọc trên UI, không đổi bomLineActive của backend hoặc dữ liệu BOM.
- Lịch sử 31/10 và 04/11 sắp theo ngày nghiệp vụ chuẩn hóa; chuỗi dd/mm trước đó chọn tháng cũ làm latest. Ngày chưa rõ nằm sau ngày đã biết, không gán ngày giả.
- Giữ nguyên hợp đồng **nguồn SKU hiện hành** của live lookup, kể cả dòng ngưng đã lưu. Sửa này chỉ bảo vệ bộ đơn vị/mẫu số/hao hụt của dòng lịch sử dựng lại, không tự thay toàn bộ live-source projection hay lượng dùng Engine.

Ghi chú căn cứ nằm ở ô hiện có (title/tên truy cập), không thêm banner/cột hoặc thay bố cục. **9/9** ca projection từ source và **28/28** nhóm BOM/source/bulk/lifecycle/hierarchy/reconciliation đạt; có giao nhau, không cộng gộp. TypeScript/build cuối đạt. Dữ liệu giả và VM, chưa browser desktop/mobile. Không có route/lượt fetch/write mới; không đo hoặc tuyên bố tốc độ render được cải thiện. DB/save/confirmation/undo/permissions không sửa; raw before-image và dòng phiếu được test bất biến. CI đúng commit bổ sung sẽ kiểm sau push.

## Chặn dùng bản tải gọn khi chuyển sang Payroll/nhật ký/điều chỉnh

CI BOM `56e6b0c4d6359188501ecc6b9d0a369c925db58f` [41860127276](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41860127276) đã **đạt 1.731/1.731 trong 284 file** (691 + 519 + 521), không fail/cancel/skip/todo hoặc file thiếu summary; TypeScript/ba build đạt. Đây là checkpoint trước phần client dưới đây.

Mounted test tái hiện chuyển **cùng instance** ProductionManagement từ work sang payroll: profile vẫn work, số request full **0**, trong khi Payroll đã hiện. Work profile không chứa đầy đủ anchor báo công/payroll. Đây là đường có thể đi vào phép tính current-only; bằng chứng trước sửa xác nhận sai profile/Payroll hiện sớm, không tuyên bố đã chứng minh ghi sai tiền hoặc API bypass trên production.

Source sửa profile theo mọi mode, không chỉ work. Gắn bằng chứng full/work riêng trong WeakMap theo response thực sự đọc/cache; không thêm cờ client vào DB/JSON hay quyền mới. Màn cần full không dựng business view từ response work trong lúc chờ/lỗi. Cờ full không bị hạ xuống work nếu dùng lại cùng object full trong cache. Bản merge chỉ từ write đã được server ACK giữ profile của dữ liệu đầu vào; không ép remount toàn component hoặc đổi sở hữu bản nháp. Reader vẫn hoãn đọc khi hidden/đang giữ form, loại phản hồi cũ bằng revision và dùng cache còn mới.

**4/4 mounted JSDOM** đã đạt:
1. Work → Payroll yêu cầu đúng một full read; trong lúc chờ không dựng Payroll/không gọi `/api/production-standards` để fallback về mức hiện tại. Sau full hiển thị 0,1 đã bảo toàn, không 9 của master giả.
2. Full 503/non-JSON hiện lỗi/thử lại, không lấy light data làm Payroll. Thử lại đọc full, không lén gọi current standards.
3. Full trả trễ sau khi quay lại work không ghi đè bảng đang mở.
4. Full cache còn mới dùng lại qua work/Payroll với **một HTTP workflow read tổng**, không hạ profile hoặc tạo lượt fetch lặp.

Đây là kiểm component/cache với fetch giả, không phải browser + Worker/network QA. Không thay API, công thức tiền, quyền hay source lịch sử. TypeScript/build của nhóm này đạt; kiểm regression rộng và CI của commit mới ghi riêng khi xong. Giới hạn nghiệm thu browser/Sheet và các câu hỏi ngày nghiệp vụ còn giữ nguyên.

Kiểm cuối profile: **54/54** trong nhóm client loading/render, daily board/projection, detail và mounted transition đạt (gồm bốn ca trên), TypeScript/build đạt, không log React/DOM exception sau khi bổ sung Element đúng cho harness JSDOM. Không lấy thời gian chạy test làm benchmark render. CI đúng head mới sẽ đọc sau push; các checkpoint trước vẫn được giữ riêng.

## Kiểm tiếp toàn bộ quỹ tháng và chi tiết hoàn công ty

Checkpoint client `3e1a43b0b379eeeca3b199c39467bfd4374161ac`, CI [41863820549](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41863820549), đã **đạt 1.735/1.735 trong 285 file** (709 + 536 + 490), không fail/cancel/skip/todo hoặc file thiếu summary. TypeScript và ba build đạt. Không tạo run thay thế trong thời gian chờ; các bước test đã hoàn tất và run kết thúc success.

Bổ sung hồi quy chỉ đọc: so **deep-equal toàn bộ** kết quả `payrollFundHistory` trước–sau thay đổi danh mục, gồm tổng từng Line/công ty, lũy kế, chi tiết từng người hoàn quỹ, tên/Line nhà/Line làm việc/giờ/lý do/số tiền. Fixture có khoản thực trả và hoàn công ty dương, không chỉ so các tổng bằng 0. Sau capture, xóa LSX khỏi đầu vào hiện hành, đổi tên/Line/ngày bắt đầu/trạng thái nhân viên, bỏ lịch/sự kiện đang dùng và đổi mức hiện tại; kết quả quan sát cũ vẫn giữ nguyên và raw fixture không bị ghi lại. Nếu thiếu anchor giờ, các tổng tiền phải thiếu căn cứ/null cùng lý do, không âm thầm dùng mức hiện hành hay trả 0. Nhóm preservation/fund-history **10/10** đạt local; đây là bằng chứng pure helper, không phải nghiệm thu Worker/browser hoặc dữ liệu thật.

Thêm script tái lập `node --test scripts/bench/legacy-fund-history.mjs`, **1/1** đạt trên Node v24.19.0, dữ liệu giả, 17 người và khoản mượn người xuyên Line. Hai quy mô: 50 LSX/1.000 phiếu/1 tháng và 500 LSX/10.000 phiếu/12 tháng. Ba mẫu mỗi dạng đầu vào, chạy riêng:

| Quy mô | Capture một lần | Tính từ đầu vào cũ (wall) | Tính từ anchor sau đổi master (wall) |
| --- | --- | --- | --- |
| 50/1.000/1 | 219,66 ms | 11,53–21,66 ms | 5,28–8,74 ms |
| 500/10.000/12 | 1.666,36 ms | 609,56–715,32 ms | 365,44–422,39 ms |

CPU tiến trình Node lần lượt 13,15–41,12/6,18–11,67 ms và 626,18–840,31/378,72–452,97 ms. Mọi mẫu so chính xác cùng kết quả và dữ liệu gốc bất biến. Đây là **hai dạng đầu vào khác nhau cho cùng kết quả**, không phải số đo tăng tốc API trước/sau. Không DB/HTTP/Worker CPU/Google/browser/mạng/peak memory/p95, không stress production hoặc chứng nhận tải thật. Script benchmark nằm ngoài danh sách test cấp cao nhất của CI.

Tra cứu quyết định Leadtime/kế hoạch nhiều mốc bằng Personal Context trả “Personal context is unavailable for this conversation.” Không đổi ngày nghiệp vụ hoặc tự suy ra phân bổ lượng; giữ các câu hỏi đã liệt kê ở trên để xem xét sau. Không có browser được hỗ trợ trong phiên này, nên chưa đủ điều kiện gửi link nghiệm thu hay phát hành. Không merge/triển khai/ghi DB hoặc Sheet thật. Commit tài liệu/kiểm thử bổ sung sẽ có CI riêng; không gán số 1.735 của checkpoint trước cho head mới.

## Phiếu legacy thiếu ngày không tự mất điều kiện chặn khi LSX rời đầu vào

Checkpoint `9cc828e55dbe3aa18465c48e7cb7128b8ed881d0` đạt [CI 41867701873](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41867701873): **1.736/1.736 trong 285 file** (709 + 536 + 491), TypeScript/ba build đạt; không fail/cancel/skip/todo, timeout hoặc thiếu summary.

Rà tiếp tái hiện lỗi kỹ thuật bằng fixture: một phiếu đã duyệt thiếu ngày khiến quỹ chưa được tính; sau capture/attach anchor và bỏ LSX khỏi đầu vào hiện tại, guard chỉ tìm trong live orders nên mất cảnh báo. Trước sửa test fail: fund null trở thành 3.000.000 và issues rỗng. Source nay dùng Line từ căn cứ lịch sử đã lưu cho phiếu có anchor; phiếu legacy chưa có anchor vẫn theo scope live-order cũ, không suy lịch sử từ nhãn Line trên phiếu. Phiếu hủy/voided/chưa duyệt không tạo blocker này. Không tự tạo ngày, sửa phiếu hoặc thay công thức/quyền.

Bổ sung kiểm cả LSX mất và LSX hiện tại chuyển Line C/SKU khác; toàn result/people bằng trước. Nhóm payroll/preservation/fund/cutover **39/39** local đạt. Guard lập Map LSX một lần và kiểm thiếu ngày trước lookup thay vì tìm orders.some cho từng report đã có ngày; không thêm fetch/SQL/write.

Benchmark tái lập `node --test scripts/bench/payroll-undated-scope.mjs`, Node v24.19.0, so source thực của baseline 9cc828e với bản sửa, 3 mẫu đảo thứ tự trước/sau. 50 LSX/1.000 phiếu: 4,01–8,91 ms trước, 3,76–6,69 ms sau; 500 LSX/10.000 phiếu: 43,25–68,81 ms trước, 33,60–35,74 ms sau. CPU tiến trình tương ứng quy mô lớn 44,43–69,48 và 33,73–36,06 ms. Mọi trường đầu ra deep-equal, input bất biến; fixture cố ý không có nhân sự/lịch nên giữ nguyên các cảnh báo thiếu giờ, không tuyên bố đã đo chia tiền đầy đủ. Pure payrollMonth, không API/Worker CPU/browser/network/peak-memory/p95 hoặc cam kết production. **1/1** đạt, nằm ngoài CI tests cấp cao nhất.

Đã chuẩn bị [các ví dụ/lựa chọn cần Duyên xem](DAILY-OUTPUT-DECISIONS-TO-REVIEW.md), không tự chốt HR sửa ngược, ngày Leadtime hoặc chia lượng kế hoạch qua hai mức. Hai tài liệu thiết kế 23/09 được AGENTS nhắc không có trong snapshot này; tiếp tục theo source, quyết định hiện có và ghi rõ khoảng thiếu bằng chứng, không tuyên bố đã đọc chúng.

## Harness QA full app trên cloud khác, chỉ loopback

Theo yêu cầu chuẩn bị cho workspace có Chromium: [hướng dẫn](DAILY-OUTPUT-LOOPBACK-QA.md), script `scripts/verification/daily-output-loopback.mjs`. Dùng Worker/assets thật từ build, Miniflare DB/R2 volatile mới, migrate/seed tường minh chỉ trong fixture. Bind 127.0.0.1, external Worker fetch bị chặn, không credential/Sheet/binding cloud hoặc proxy fake-Admin. Tài khoản password giả được tạo riêng mỗi lần chạy, đăng nhập/session/quick-Line qua API hiện hành. Không gỡ Secure, không đổi auth hay cấu hình app.

HTTP smoke **1/1** đạt: full HTML/login/assets trả 200, anonymous không đăng nhập, password Admin/HR/QLSX/Kho và quick-Line có session đúng/không nâng Admin, Line A chỉ nhận A; hai phiếu mới 200 đã duyệt/300 chờ, sibling chung Plan ID, lịch A/B và phiếu cũ có basis. Có một tên dùng quy tắc phụ kho cố định trong source với ID giả; không sao chép hồ sơ thật. Đây là HTTP qua loopback, chưa phải browser QA. Source JSON baseline tương thích trong build vẫn được giữ nguyên; không gọi tất cả danh mục trong app là dữ liệu giả.

TypeScript/build cuối đã đạt. Gói source đúng commit/manifest được chuẩn bị sau commit để môi trường Chromium build lại; không mang DB/FILES/session/node_modules/dist vào gói. Không chạy preview public hoặc cập nhật preview của Duyên. CI commit mới và bàn giao Library ghi riêng trong PR/kết quả; không lấy checkpoint trước làm kết quả head mới.

## Xuất báo cáo và giải thích số liệu lịch sử

Checkpoint `cbaa86d60dbc1577c317d0471cb5230e46ef021e` đạt [CI 41871459656](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41871459656): **1.739/1.739 trong 286 file** (560 + 618 + 561), TypeScript/ba build đạt; không fail/cancel/skip/todo, timeout hoặc thiếu summary. Gói QA cbaa86d giữ nguyên để browser workspace kiểm riêng, không bị thay thế bởi phần bổ sung dưới đây.

Bổ sung kiểm bảo toàn đến tận đầu ra: report model tháng, mọi entry XML giải nén trong XLSX và projection dùng để in bằng nhau trước–sau thay master/xóa LSX khỏi đầu vào, gồm nhãn người cũ, từng ô giờ/tiền, tổng quỹ/hoàn công ty và lịch sử khoảng tháng. Đây không phải so byte ZIP có timestamp, dựng PDF bằng browser hoặc nghiệm thu file trên Excel thật. Đầu vào/raw fixture không đổi. Nếu thiếu anchor giờ, export tháng bị chặn; lịch sử vẫn ghi trạng thái thiếu căn cứ, các ô tiền null/hiển thị —, XML không ghi số 0 thay thiếu.

Kiểm trace so mọi giá trị số, nguồn và khoản đóng góp với kết quả quan sát trước capture; so toàn nội dung trace giữa hai lần đã có anchor, trước và sau đổi master. Việc gắn căn cứ ban đầu có chủ đích bổ sung nhãn/ngày/nguồn từng phiếu thay vì một dòng LSX aggregate, không gọi phần bổ sung bằng chứng đó là lỗi số liệu hoặc xóa assertion cho xanh.

Có một sai lệch chú thích được chứng minh: công thức `Giờ công chuẩn HT` vẫn tuyên bố luôn dùng định mức hiện hành, trong khi chính trace/phiếu đã dùng snapshot hoặc căn cứ legacy được bảo toàn. Test mới fail với lời cũ. Sửa **chỉ lời giải thích** sang nhân SL đã xác nhận với mức theo căn cứ hiển thị từng dòng; giữ phân biệt giờ chuẩn với giờ thực tế. Có VI/EN/ZH thật cho cùng key. Không đổi phép nhân, chọn version, quỹ, quyền, dữ liệu hoặc request. Phần chữ này cần kiểm lại browser trên SHA mới; không gán kết quả QA giao diện cbaa86d cho toàn head sau đó.

Nhóm artifact/trace/fund/policy **22/22** local đạt (gồm 5 ca artifact mới và kiểm dịch bằng module translator thật). Kiểm PDF/export cũ, typecheck/build và CI của head bổ sung ghi riêng sau khi hoàn tất.

Benchmark giả `node --test scripts/bench/payroll-export-preservation.mjs`, Node v24.19.0, ba mẫu/quy mô. 50 người/Line (100 tổng): chuẩn bị report 0,95–6,13 ms, encode XLSX 5,39–43,25 ms, tổng 6,57–44,19 ms, 15.783 byte. 500 người/Line (1.000 tổng): chuẩn bị 1,48–3,17 ms, encode 41,32–60,26 ms, tổng 42,80–63,43 ms, 79.006 byte. CPU tiến trình 8,38–48,97 / 46,50–96,49 ms. Giải nén/kiểm sau khoảng đo: đủ từng ID, mỗi ô tiền đúng khoản trả của người đó và tổng thực trả từng Line, input bất biến; **1/1** đạt. Đây không phải before/after tối ưu, không PDF/browser/DB/network/Worker CPU/p95/peak-memory hoặc chứng nhận 1.000 người qua publication anchor. Chưa có bằng chứng cần đổi encoder hoặc bỏ kiểm dữ liệu để tăng tốc.

Kiểm cuối nhóm xuất/trace: **31/31** trong artifact mới, export/PDF cũ, trace, fund, policy, mounted Payroll và legacy preservation đạt; TypeScript/build đạt. PDF ở đây là test Node/canvas có kiểm ô/chữ và mounted là JSDOM, không phải browser nghiệm thu. Phạm vi source chạy thay đổi chỉ một mô tả công thức và bản dịch tương ứng; không có thay đổi API, JSON/DB, tiền, quyền, CSS/bố cục hoặc luồng kho. CI của commit mới được đọc riêng sau push. Gói Library cbaa86d không bị sửa; cần rebuild/kiểm phần chữ ở head bổ sung để nghiệm thu đúng phiên bản.

## Snapshot scope lớn và chẩn đoán file thông báo trong CI

CI `a9bebf912f5c98fb40a24316d5a668679dd5b71c`, [41874042619](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41874042619), kết thúc **failure/chưa chạy đủ**. TypeScript và ba build đạt; shard1 606/606 trong 96 file, shard3 597/597 trong 95 file. Shard2 chỉ 385/385 trong 65 file có summary, dở production-plan-notices và 30 file chưa chạy. Tổng 1.588 pass có summary trong 256 file, không phải full pass. Runner nhận shutdown/exit143 sau khoảng 26 giây trong file dở, không CI TIMEOUT/180 giây hoặc assertion not ok trong log đó. Checkpoint cbaa86d 1.739/1.739 vẫn giữ riêng.

### Harness thông báo: đã tái hiện lỗi kiểm focus sớm

Ba lượt local qua đúng `runFile` đạt 4/4 mỗi lượt (2.979–3.188 ms), chưa đủ giải thích CI. Diagnostic cache mới: tắt optimizeDeps discovery riêng lẻ vẫn có lần bị SIGKILL sau ca đầu. Đổi **chỉ cách in lỗi identity** sang boolean, giữ điều kiện so sánh, giúp thấy ca thứ hai fail vì kiểm focus ngay sau Escape (3/4, không phải callback sai hoặc không đóng panel). Có thể việc inspect DOM/React lớn làm khó chẩn đoán; chưa chứng minh đó là toàn bộ nguyên nhân runner shutdown/OOM và không dùng memory.peak toàn container làm peak riêng của test.

Dependency đang khóa `@radix-ui/react-focus-scope/dist/index.mjs` thực hiện trả focus/unmount bằng setTimeout(...,0). Harness nay chờ đúng identity focus tối đa 500 ms, dọn task DOM sau unmount, giữ đủ các kiểm Escape/context/inactive/outside/callback và khung bảng. Các so sánh DOM dùng boolean/độ dài + từng identity để lỗi không in cả cây React; không xóa, skip hoặc nới kết quả kỳ vọng. Dùng helper SSR có sẵn để bỏ scan client không cần thiết, không đổi workflow/runner timeout hoặc dependency.

**10 lượt cache mới liên tiếp**, mỗi lượt 4/4, 2.708–3.143 ms và tự thoát. Đây là chẩn đoán có mục tiêu, không rerun toàn CI giống hệt. Cần đọc CI đúng head mới, chưa gọi nguyên nhân shutdown đã được loại trừ hoàn toàn.

### Tái hiện và sửa SQLITE_TOOBIG trên scope 10.000 phiếu

Mở rộng fixture có sẵn từ 1.000 lên 10.000 phiếu cùng LSX, tất cả dữ liệu giả: source a9bebf9 gộp toàn bộ summary vào một cell JSON và `readDailyOrderReports` trả `D1_ERROR: string or blob too big: SQLITE_TOOBIG`, trước bước lưu. Tổng thời gian test khoảng 31,86 giây gồm seed, **không phải latency request**. Không có bằng chứng production có cùng số phiếu hoặc đây là nguyên nhân duy nhất của log quá tải.

Source bổ sung `production-summary-scope.mjs`:
- Metadata khóa theo cửa sổ 1.000 + một khóa nhìn trước; tải summary tối đa **512 KiB JSON/phần**, gồm dấu phân cách, không tải payload lớn một cell. Tối đa ba phần độc lập đọc cùng lúc. Không đọc lại full workflow, workforce, staffing hoặc công đoạn.
- Giữ thứ tự khóa lưu và chỉ số số học của reports trong import, Boolean JSON và quy tắc stored report ghi đè cùng ID. Normalizer Unicode/whitespace và phân biệt LSX chung Plan ID giữ nguyên.
- CAS đối chiếu **nguyên chuỗi SQL của từng phần** theo khoảng khóa, cộng phạm vi rỗng và tail; không dùng count/hash xấp xỉ. CTE materialized giữ một nguồn so sánh trong transaction. Thêm/sửa/xóa ở đầu/giữa/cuối, qua ranh giới trang hoặc sau khóa cuối đều làm guard không khớp. Chưa khớp không ghi report/event/kho.
- Chặn rõ nếu một summary vượt 512 KiB, tổng hai nguồn vượt **8 MiB**, hoặc quá **32 phần**; chưa lưu và không cắt bớt phiếu/lịch sử. Đây là giới hạn kỹ thuật để kiểm dung lượng/binding an toàn, không phải chứng nhận xử lý vô hạn. Decode sau kiểm budget tổng; không thay schema/migration, dữ liệu, phép tính hoặc quyền.

Ca mới kiểm trang theo byte, cửa sổ khóa >1.000, floating JSON 1.0, Unicode, chỉ số import 10/11 đúng thứ tự, duplicate ID ưu tiên stored, scope rỗng/phantom, thay/xóa ở nhiều khoảng, cap và lưu thật/CAS race. Hồi quy rộng daily/preservation/notices **111/111** đạt trước bổ sung cap byte tổng; kiểm cuối trên source đã có cap **22/22** (scope/legacy-match/review/notices), TypeScript/build đạt. Có giao nhau, không cộng các tổng thành số ca khác nhau.

HTTP smoke trên **Worker đã build** **1/1** đạt: password/session thật của tài khoản giả, assets và phân quyền Line; POST sản lượng +100 không có giờ/công đoạn, mức .2 đúng ngày, gửi lại cùng mã chỉ có một report mới và không external fetch. Đây là HTTP loopback, chưa browser QA.

### Đo cuối cùng trên source có cap và giữ idempotency

`ONSPA_TEST_MATCH_REPORT_COUNTS=0,100,1000,10000 node --test scripts/bench/daily-matched-scope.mjs`, Node v24.19.0/Miniflare, chạy riêng sau build/test, một mẫu/quy mô. Biến này chỉ dành cho script benchmark, không cấu hình runtime/policy. Default vẫn 0/100/1.000; tùy chọn lớn là hồi quy lỗi thật, không biến lỗi thành expected pass.

| Phiếu cùng LSX | Đọc scope | Lưu +200 | SELECT/batch lưu | Retry cùng mã | SELECT/batch retry |
| --- | --- | --- | --- | --- | --- |
| 0 | 16,92 ms | 104,40 ms | 9/1 | 22,11 ms | 2/0 |
| 100 | 28,43 ms | 112,59 ms | 10/1 | 12,43 ms | 2/0 |
| 1.000 | 83,97 ms | 205,65 ms | 11/1 | 18,08 ms | 2/0 |
| 10.000 | 753,11 ms | 1.524,80 ms | 38/1 | 17,47 ms | 2/0 |

Summary 10.000 phiếu là 6.868.891 byte; tổng đúng 10.000+200, legacy baseline vẫn 0, report mới chỉ một, retry cùng report ID/không batch ghi. **1/1** benchmark đạt, tổng 35,40 giây chủ yếu seed nằm ngoài khoảng đo đọc/lưu. Trước sửa 10.000 fail, sau sửa đã xử lý đúng; không dùng các mẫu nhỏ khác thời điểm để tuyên bố tăng tốc. Không HTTP/auth/browser/network/Google/Worker CPU/peak memory/p95 hoặc cam kết production hết quá tải. Không giảm số SELECT bằng cách bỏ kiểm consistency.

Gói cbaa86d và a9bebf9 không có bản phân trang này. Sau push cần browser kiểm lại đúng head mới: lưu/tải lại/gửi lại, QLSX xác nhận, sửa/hủy và các lỗi stale; không lấy QA gói cũ thay nghiệm thu. Ba quyết định HR/Leadtime/kế hoạch nhiều mức vẫn giữ nguyên trạng thái chờ, không tự chốt. Không merge/deploy/ghi DB hoặc Sheet thật.

## Browser tìm thấy modal dịch hai lần; chuẩn bị quyền QA đúng

Checkpoint 5783408: workflow 41879590911 SUCCESS, 1.749/1.749 trong 288 file. Metadata job/check-run có độ trễ; đã đọc lại cả bốn job completed/success, không rerun vì độ trễ. Gói source 578 vẫn giữ nguyên, không thay artifact đang QA.

Browser độc lập trên 578, viewport 390 px: modal SL ở x=-163/y=-15,16/rộng358. CSS có đồng thời individual translate -50% -50% của DialogContent/Tailwind và transform translate(-50%,-50%) của .production-modal. Đây là bằng chứng browser, không phải đo JSDOM trong executor này.

Sửa hẹp `.production-modal[data-slot="dialog-content"]`: giữ translate -50% -50%, reset transform về none. Chỉ hai Radix modal sản lượng/điều chỉnh dùng selector này; plain legacy .production-modal giữ transform cũ. Không thay global Dialog, width/max-height, navigation/CSS bảng/font hoặc che body overflow. Dùng individual translate còn tránh để animation transform tạo thêm phần dịch tâm. Cần browser kiểm thực desktop/mobile theo đúng SHA bổ sung, chưa gọi là đã nghiệm thu bằng JSDOM.

Ca cascade trên Board thật tái hiện fail trước sửa: transform còn translate(-50%,-50%) khi translate riêng đã có. Sau sửa test kiểm một offset, fixed/top/left giữ nguyên và legacy plain không bị reset. JSDOM chỉ kiểm cascade, với individual translate mô phỏng đúng utility đã đo bởi browser; không dùng nó để xác nhận pixel/animation. Nhóm Board/HTTP/withdraw-view/notices **11/11**, TypeScript/build đạt; kiểm thêm correction/HTTP ghi riêng khi xong.

Trong lúc đo API quy mô lớn phát hiện fixture QA chưa seed department_permissions: QLSX USER bị 403 đúng backend. Sửa **fixture**, không mở quyền ứng dụng: seeding fresh volatile DB từ các template permissionProfiles chuẩn hiện có. HTTP thực trên Worker build kiểm non-admin roles/grants, HR từ chối xác nhận và Kho từ chối điều chỉnh không đổi phiếu; QLSX xác nhận 100 với reviewedBy QA_QLSX; HR nghỉ/QLSX phụ kho được lưu mà toàn raw report cũ và mới không đổi. Không dùng alias/Admin bypass. Không thay quyền thật hoặc tự chứng nhận user production.

Đo bổ sung `node scripts/bench/daily-confirm-correction.mjs`, Node24/Miniflare/session giả + actual siteApi Request/Response, một mẫu mỗi quy mô; QLSX dùng quyền bộ phận chuẩn, isAdmin=false. Kết nối/bridge chỉ giả trong DB local, không Google/Apps Script/công thức thật. Hai lỗi input fixture lúc chuẩn bị (thiếu quyền và thiếu sku trong ACK) bị backend chặn, đã sửa dữ liệu giả theo hợp đồng, không sửa backend để cho qua.

| Phiếu cùng LSX | Xác nhận QLSX | Preview sửa đã duyệt | Gửi sửa | Retry cùng mã | ACK giả | Retry ACK |
| --- | --- | --- | --- | --- | --- | --- |
| 1.000 | 403,14 ms /16 SELECT | 402,75/23 | 467,59/23 | 113,77/7 | 249,86/13 | 29,27/3 |
| 10.000 | 1.763,27 ms /43 SELECT | 1.316,77/50 | 1.725,04/50 | 93,51/7 | 1.489,51/40 | 34,93/3 |

Xác nhận/gửi sửa/ACK mỗi phase 1 batch; preview/retry không batch. Lượng 200 giữ đến ACK rồi 300; chỉ một receipt, tổng LSX count+300, từng raw report không chọn bằng trước. Đọc so dữ liệu trước/sau dùng readRecordPages để không tự tạo full response lớn trong benchmark. Không before/after speedup, browser/network/Google/Worker CPU/peak-memory/p95; fixtures seed ngoài khoảng đo. Đây là kiểm auth/session API Node, không test password/browser (password đã có HTTP smoke riêng). Chưa tuyên bố stock Sheet thật đã vô hiệu hay công thức production được sửa.

Kiểm cuối nhóm modal/fixture: **17/17** (Board/cascade, corrections, withdrawal view, notices và HTTP role/write/denial), TypeScript/build đạt. Script benchmark trong repo chạy hoàn tất cả hai quy mô, không thay các raw report không chọn. Browser desktop/mobile chưa chạy trong executor này: cần workspace browser độc lập đo lại modal sản lượng và điều chỉnh ở đúng SHA bổ sung; không lấy cascade JSDOM thay pixel. Checkpoint 578/gói cũ không bị ghi đè. Chỉ CSS scoped và công cụ/dữ liệu QA thay đổi, không backend/quyền thật/công thức/kho hoặc policy production. CI mới sau push được đọc riêng.

## Bổ sung kiểm chứng kích hoạt và bàn giao sáng hôm sau

Checkpoint `b5c822e6d0e05982217a84d25b4b66e3e77eb312`: CI 41885732618 hoàn tất SUCCESS, **1.750/1.750 trong 288 file**, TypeScript và ba build đạt, cả bốn check-runs completed/success. Parent báo browser độc lập trên đúng b5: modal đầy đủ ở desktop/390 px; lưu, hủy trước lưu, tải lại và thử lại sau mất phản hồi đạt với dữ liệu giả. Không suy rộng thành nghiệm thu toàn bộ báo cáo, quyền thật, kho/Sheets hoặc tốc độ production.

Bổ sung sáu ca fault-injection vào production-legacy-publication, không sửa runtime hoặc helper để test đạt: phantom nguồn, anchor đổi, manifest đổi, activation cạnh tranh ngay trước batch; lỗi SQL rollback marker và policy; mất phản hồi sau commit retry đọc đúng marker không có batch mới. Mọi source/history raw record giữ nguyên, chỉ cho phép chính thao tác cạnh tranh giả xuất hiện trong trường hợp fault. File **16/16**; nhóm snapshot/publication/preservation/cutover attendance/history artifacts **46/46**, không fail/cancel/skip/todo. TypeScript/build đạt. CI commit bổ sung đọc riêng sau push, không lấy CI b5 thay kết quả mới.

Checklist mới [DAILY-OUTPUT-ACTIVATION-READINESS.md](DAILY-OUTPUT-ACTIVATION-READINESS.md) tổng hợp chứng cứ, cap và điều kiện chặn. Driver kích hoạt vẫn chỉ TEST, chưa adapter production, không chỉ dẫn dùng helper hay tạo marker TEST ở DB thật. Bảo toàn lịch sử không đồng nghĩa có thể tự tái tạo lịch sử thiếu hoặc rollback bằng tắt cờ sau khi đã có phiếu mới. Ba câu hỏi HR/Leadtime/kế hoạch vẫn ở tài liệu lựa chọn, chưa tự quyết. Chưa merge/triển khai/ghi DB hoặc Sheets thật.
