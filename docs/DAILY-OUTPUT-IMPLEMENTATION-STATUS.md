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
