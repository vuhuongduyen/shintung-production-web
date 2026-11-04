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
