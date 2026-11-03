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
