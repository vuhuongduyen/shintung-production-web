# Báo sản lượng ngày và dữ liệu có hiệu lực

Nguồn kiểm tra: GitHub main d8dbb1e031e540fec892509b577cd49c3d2cc442, sau PR #6. Không thay source Site đang xử lý FINAL, không dữ liệu thật hoặc migration production.

## Quyết định đã chốt

- Báo phát sinh thành phẩm theo ngày sản xuất và ID từng LSX; 200 rồi 300 thành lũy kế500 trên lệnh1000. Không nhập số lũy kế thay phát sinh, không nhân đôi báo công cũ, không cộng sản lượng công đoạn trung gian thành thành phẩm.
- Không bắt chọn nhân viên, giờ theo lệnh hoặc báo từng công đoạn cho phiếu mới. Phiếu cũ giữ mô hình/căn cứ/nhân viên/giờ/audit cũ.
- Chia tiền, giờ nhân sự, phụ kho/CV khác và phép tính quỹ hiện hành giữ nguyên. Tổng hợp theo tháng sản xuất; không thêm phân bổ WIP giữa tháng.
- Sản lượng ngày nhân giờ chuẩn/SP có hiệu lực ngày sản xuất. Không dùng ngày nhập hoặc mức hiện hành để thay mức đã chốt của phiếu cũ.
- Duyên đã chọn: nếu thiếu căn cứ hiệu lực, vẫn ghi sản lượng và đối chiếu kho, nhưng báo **Thiếu căn cứ định mức**, chưa tính tiền phần đó; không coi thiếu là0 hoặc dùng mức hiện tại. Bổ sung căn cứ sau này phải có thao tác đối chiếu/audit rõ, không âm thầm sửa phiếu cũ.
- In Transit vẫn một dòng mỗi ID LSX. Không group theo Plan ID chung của các dòng Tách đơn. SX báo công và In Transit có thanh thể hiện lũy kế thành phẩm, số di chuyển theo tỷ lệ; thanh chỉ hiển thị, không phải slider được kéo để ghi dữ liệu.
- Mốc chuyển đổi: **ngày triển khai sau nghiệm thu** (Duyên đã xác nhận), không gán sẵn ngày production trong source. Chỉ bật khi deployment đã được duyệt có mốc rõ ràng; TEST dùng mốc giả minh bạch.

## Hợp đồng lưu và đối chiếu

Phiếu mới có reportingModel riêng, ID riêng, productionDate date-only Asia/Ho_Chi_Minh, số phát sinh, ID nguồn In Transit, người/giờ ghi, revision, idempotency key và snapshot căn cứ định mức. Thời điểm máy chủ nhận không thay ngày sản xuất; không bịa giờ nhập/xuất trạm cho phiếu chỉ có ngày. UI/compatibility phải phân biệt hai mô hình.

Giữ trạng thái chờ QLSX xác nhận và xác nhận theo quyền menu hiện có. Lũy kế đã duyệt và chờ duyệt trình bày riêng; tổng phát sinh hợp lệ giữ chỗ trong trần LSX để hai người không cùng vượt số lệnh. Xác nhận mới tạo/cập nhật đúng một phiếu kho theo report ID qua luồng hiện hành, không gửi Sheet hoặc ghi kho từ thao tác nhập/chọn dòng.

Không upsert theo khóa ngày+Plan ID: cùng ngày có thể có nhiều lần nhập, nhiều lệnh chung Plan ID phải độc lập. Sửa/hủy dùng CAS, lưu before/after; phiếu gốc/audit còn đối chiếu được. Mất phản hồi giữ bản nháp và cùng khóa, không tự retry bằng khóa mới. Dữ liệu thay trong lúc ghi phải báo stale, không ghi đè.

Đề xuất sửa/hủy sau kho: giữ guard hiện có, không tự sửa phiếu kho đã xử lý/đã nhận. Trước khi phát hành cần Duyên xem quy trình điều chỉnh kho liên quan; chưa tự mở quyền ghi hoặc tự đảo kho. Khi kho chưa xử lý, phải kiểm revision của báo công/lệnh/phiếu kho cùng transaction. Không tác động FINAL đang xử lý riêng.

## Dữ liệu hiệu lực và bảo toàn lịch sử

Khoảng hiệu lực date-only dùng [validFrom, validTo); đổi mức phải thêm version, không sửa/xóa version đã được phiếu tham chiếu. Phiếu lưu version/value/source/scope và ngày chọn. Hủy danh mục hiện tại không được xóa snapshot của chứng từ cũ. Khi không có căn cứ hiệu lực đã chứng minh, hiển thị thiếu căn cứ; không gán mức hiện tại rồi gọi đó là lịch sử.

Source đang bổ sung bảo toàn phần giờ trước ngày cutover ngay trong tháng chuyển đổi, cộng với phần sau mốc đang phát sinh; không đóng băng cả tháng. HR sửa ngược phần đã bảo toàn vẫn được lưu theo quyền nhưng cần đối chiếu trước khi thay số tính tiền. Ngày ngưng làm việc rõ sau mốc vẫn theo quy tắc chia lại quỹ hiện hành. Chưa có quyết định cho sửa ngược startDate/Line làm đổi điều kiện giữa hai phần; không tự áp một quy tắc mới. Chi tiết kiểm thử và giới hạn ngày/tháng ở tài liệu triển khai, chưa phải nghiệm thu production.

Riêng dữ liệu cũ chưa lưu snapshot: phải phân biệt **kết quả đang biết tại mốc bảo toàn** với **mức thực tế từng có trong quá khứ**. Có thể bảo toàn giá trị đang biết khi thay đổi mới bằng anchor có ngày ghi nhận và nguồn rõ; không tự suy ra lịch sử đã thiếu hoặc âm thầm tính lại dữ liệu cũ. Việc áp dụng anchor/snapshot cho production là bước chuyển đổi được duyệt sau, không chạy trong task phát triển.

## Inventory tác động từ source

| Nhóm | Điểm đọc/ghi hiện có | Rủi ro và công việc bắt buộc |
|---|---|---|
| SX, FINAL và nhập bù | production-workflow, production-stage-live, production-backfill, production-final-limit | Hai mô hình đồng tồn tại; không đổi guard FINAL cũ hoặc giờ legacy. Luồng mới không phụ thuộc staffing; phải cộng đủ sản lượng cũ còn hiệu lực vào trần. |
| QLSX/xác nhận | production-progress-review, production-review-selection, site-api review | Luồng sản lượng xác nhận lượng/ngày/căn cứ/version, không yêu cầu hours hoặc attendance. Luồng công đoạn cũ giữ lịch sử và khóa tại cutover; không nới quyền hay xác nhận lại legacy. |
| In Transit/kho | in-transit, warehouse-confirm, production-corrections | Một dòng/LSX; một phiếu kho/report. Không merge các dòng có Plan ID chung. Xử lý approved/pending/returned/cancelled và sửa/hủy không đếm đôi. |
| Nhật ký/tiến độ/báo cáo | production-output-summary, report-cumulative, journal-standards, detail-fields, output/payroll export | Phân biệt giờ thực tế legacy với giờ chuẩn kiếm được mới; không biến giờ chuẩn thành hours thực tế hoặc invent nhân viên. Ngày và tổng khớp kho/tháng. |
| Giờ công/SP | site-api labor-hours, site-labor-hours, production-standards, payroll-month/payroll | Phiếu mới giữ version/snapshot đúng ngày SX, tổng từng phiếu/ngày; thiếu căn cứ chặn tiền, không dùng mức hiện tại cho cả tháng. Legacy dùng anchor giá trị quan sát, không bịa lịch sử mức. Giữ HC/TC/quỹ/phụ kho; kỳ HR đã chốt/đã trả còn cần quy tắc riêng. |
| Leadtime | transit-leadtime, getTransit, leadtime_versions | Theo quyết định 05/11, Plan mới giữ nguồn Leadtime tại ngày chốt GMT+7; LSX chọn bậc MOQ theo lượng từ nguồn đã giữ. Thiếu hoặc malformed giữ thiếu, không fallback current. Legacy không có field giữ đường cũ/anchor; không tự dựng lịch sử thiếu. |
| Safety Days | safety_rule_groups/safety_rules trong page/engine | Có effectiveFrom/To, nhưng bản tính lại có thể đọc dữ liệu hiện tại. Cần bảo toàn căn cứ bản Engine/Plan đã lưu và xác định phạm vi áp dụng trước khi đổi. |
| BOM | bom-lifecycle, bom-bulk, bom-rules, engine | Có ngày hiệu lực, confirmationSnapshot và phiếu thay đổi; không tự sửa BOM đã chốt. Kiểm lookup theo ngày và snapshot kế hoạch cũ, nhất là hủy/khôi phục. |
| SKU/đơn vị/tên/Line | catalog, getPlan/getTransit enrichment | Join danh mục hiện tại có thể làm nhãn/căn cứ cũ đổi. Ưu tiên snapshot chứng từ đã chốt; dữ liệu mới dùng master hợp lệ, không xóa nguồn cũ. |
| Nhân sự/điều chuyển | employee-employment, employees history, monthly-attendance | startDate/endDate có semantics nhưng Line/name/danh mục hiện tại vẫn được join. Không đổi giờ chia tiền/phụ kho hoặc invent lịch sử Line. Cần đối chiếu các before/after và roster đã chốt. |
| Capacity/lịch thực tế | capacity accepted/history, schedules, monthly-attendance | Giữ lịch/roster/đã duyệt và semantics giờ; không xóa phụ thuộc payroll vì SX không nhập người nữa. Không bỏ guard vệ sinh/số người thực tế. |
| Engine/Plan/Forecast/định mức | engine, production-plan, plan-daily-load, planning-reports | Giữ snapshots đầu vào/đầu ra và Plan đã chốt; thay master không tự ghi đè kết quả cũ. Không replay Engine để tạo lịch sử còn thiếu. |
| Quyền/audit/backup | menu-action-access, action-audit, revision/CAS, source/full-backup | Dùng quyền menu hiện hữu; business history không phải auth grants. Không làm quyền cũ có hiệu lực ngược hoặc đưa secrets vào snapshot công khai. |

Đây là inventory đã đọc source, không phải tuyên bố đã sửa xong mọi nhóm. Các nhóm phải có regression riêng trước khi ghi trạng thái hoàn tất.

## Bộ kiểm tra trước phát hành

1. 200+300/1000, khác ngày/tháng, cùng ngày nhiều phiếu, hai LSX chung Plan ID, số0/số âm/vượt trần, lệnh hủy/chưa đồng bộ.
2. Snapshot mức ngày D trước/sau đổi mức hoặc hủy master; ngày nhập khác ngày SX; thiếu/overlap/range rỗng; backfill không có bằng chứng không tự chọn mức hiện tại.
3. Hai người ghi đồng thời, sửa stale, double click, timeout sau commit, non-JSON; không mất draft/ghi trùng.
4. QLSX xác nhận/từ chối/sửa/hủy, pending/approved/returned/cancelled; kho pending/posted; audit actor/quyền Line, không nới guard legacy.
5. Payroll giữ phụ kho/giờ/chia quỹ và theo tháng; tổng giờ chuẩn = tổng từng phiếu có mức đúng ngày; không WIP. Đổi master tương lai không đổi snapshot/kết quả đã bảo toàn.
6. Thanh tiến độ desktop/mobile/bàn phím, số không tràn/đè, không có thao tác kéo ghi dữ liệu. Một dòng In Transit/LSX.
7. Typecheck/build/full CI; benchmark fake data lớn và giữ v810. Browser full app/đúng Worker bằng dữ liệu giả trước gửi preview. Không merge/deploy/migration production trong task này.

## Bổ sung giao diện và ranh giới triển khai

Giữ nút **Báo công** tại cột thao tác đầu bảng. Mở trực tiếp hộp nhập SL phát sinh, ngày giờ mặc định hiện tại GMT+7 và cho sửa. `productionLocalDateTime`/`productionAt` là thời gian sản xuất do người dùng chọn; `productionDate` phải khớp ngày GMT+7 đó, là căn cứ định mức/tháng. `reportedAt`/`recordedAt` vẫn là thời gian máy chủ thực sự nhận thao tác. Không tạo `startedAt`/`completedAt` hay giờ nhân công cho phiếu mới.

API mới chỉ hoạt động khi có policy được duyệt, đúng mô hình và ngày triển khai đã đến. Source không tạo policy production, không tự bật theo ngày hiện tại. Khi đã bật, các command công đoạn cũ bị từ chối; nghỉ/phụ kho/điều chuyển nhân sự và lịch vẫn giữ nghiệp vụ hiện hành. Lịch sử công đoạn cũ chỉ để tra cứu/đối chiếu, không phải điều kiện để ghi sản lượng mới.

QLSX sửa/hủy theo quyền hiện có khi Kho chưa nhận, kể cả phiếu đã được QLSX xác nhận. Phiếu chưa liên kết kho cập nhật theo guard/revision; phiếu đã có đề nghị kho chờ đi qua intent và ACK đối soát: lượng cũ còn hiệu lực tới ACK, lượng tăng giữ chỗ, không coi gửi request là đã đồng bộ Sheet. Kho đã nhận thì phải thu hồi trước; không tự đảo tồn hoặc sửa lịch sử nhận gốc. Source/tests có giao thức giả, chưa nghiệm thu Google thực tế.

Các version định mức mới có ngày hiệu lực do người có quyền nhập, giữ audit before/after. Không dùng thời gian tải PDF hoặc configuredAt để tự dựng lịch sử. Cùng ngày đã có version thì báo xung đột, không ghi đè version. Cập nhật phiếu cùng ngày giữ cả snapshot thiếu căn cứ; đổi ngày sản xuất thì đối chiếu version ngày mới. Chưa có thao tác tự điền lại căn cứ thiếu vào các phiếu đã ghi.

**Chưa đủ điều kiện phát hành:** source đã có anchor/payroll/cutover-month, regression lịch sử Leadtime/Safety/BOM/nhân sự và inspector chỉ đọc; kết quả CI không thay đối chiếu dữ liệu thật, browser hoặc nghiệm thu Sheet. Chưa adapter ghi production hoặc nguồn trạng thái kỳ HR đáng tin để áp sửa ngược vào phần đã bảo toàn. Anchor giữ giá trị quan sát, không chứng nhận mức quá khứ đã thiếu. Xem DAILY-OUTPUT-ACTIVATION-READINESS.md và DAILY-OUTPUT-DECISIONS-TO-REVIEW.md; không gọi toàn bộ hồi tố web đã hoàn tất.

## Làm rõ kho và bảo toàn — quyết định bổ sung

- Kho chưa xác nhận: QLSX được sửa/hủy trực tiếp bằng quyền điều chỉnh hiện có, đồng bộ đúng đề xuất chờ kho và giữ audit. Không áp khóa chỉ vì QLSX đã xác nhận phiếu.
- Kho đã xác nhận: thu hồi trước, luôn giữ lịch sử thu hồi. Sheet giữ dòng và lượng gốc, đánh dấu vô hiệu để công thức tồn không ghi nhận lượng; không xóa hoặc chỉ ẩn dòng.
- Source đã có giao thức intent/ACK, race/version/replay và kiểm ID duy nhất toàn cột bằng dữ liệu giả. Đây không phải bằng chứng Google thật đã sửa công thức/recalculate hoặc ACK/thu hồi thành công; các bước thật vẫn chờ nghiệm thu/quyền riêng. Không thay Sheet production trong phát triển.
- Anchor kết quả legacy là giá trị current-only đã quan sát, không có ý nghĩa xác nhận đó là định mức đúng lịch sử. Thiếu căn cứ phải thể hiện thiếu; không tự điền giá trị. Chốt snapshot và kích hoạt production là bước riêng sau nghiệm thu, không tự thực thi bởi source mới.


## Plan và Leadtime — quyết định 05/11 đã triển khai trên nhánh nháp

- Leadtime theo **ngày chốt Plan**, không ngày mở LSX/ngày SX/master hiện tại. Giữ đầu vào và các bậc MOQ để LSX chọn đúng lượng; không áp mức của tổng Plan cho mọi LSX. Field căn cứ null/hỏng vẫn thiếu, legacy vắng field giữ đường cũ.
- Plan đi qua hai mức giờ/SP phải **Tách đơn**; KHSX nhập lượng/ngày từng dòng, không tự chia hoặc bình quân. Tổng không bắt buộc bằng đề xuất. Plan ID chung, mã dòng riêng chỉ trong Chi tiết; chỉ tách dòng còn sửa được.
- Bấm kết quả Giờ công mở công thức, lượng, mức, khoảng ngày/phiên bản chứng minh. Thiếu mức giữ null/cảnh báo, không thành 0; giữ ngoại lệ chốt thiếu labor đã có, không thêm khóa mọi SKU thiếu history.
- Chốt/transfer giữ căn cứ riêng từng dòng và CAS; LSX bổ sung chỉ sao chép tham chiếu/căn cứ Plan, không nhận nhầm lượng chờ, mã CSV, kho hoặc ngoại lệ nhập lịch sử của nguồn.
- HR được nhập muộn trước trả sản lượng, không tự đặt ngày 10 thành hạn cứng. Chưa tự cho phép đổi kỳ đã chốt/đã trả; cách nhận diện và điều chỉnh phần prefix đã bảo toàn còn chờ quyết định.

Các đoạn inventory mô tả rủi ro cần kiểm, không là quyền thay dữ liệu thật hoặc cam kết hoàn tất mọi luồng. Chốt release vẫn theo checklist riêng.


## Tạo LSX bổ sung và khôi phục sau reload

Lượt mới qua public API giữ request key + revision của cursor tài khoản; chỉ batch thành công mới ghi LSX/audit/receipt/cursor. Tạo thêm LSX trước hết tra kết quả chưa đối soát của principal server; có kết quả thì hiện/chọn dòng đó và ACK metadata, không tạo dòng khác. Clearing pending không reset revision, nên packet cũ không tạo trùng sau ACK. Không lưu nháp/note/tài khoản/session của cơ chế này ở browser. Dữ liệu chưa từng lưu không thể tự khôi phục và không auto-submit; dữ liệu/receipt cũ không bị ghi đè hoặc tự backfill. Quyền In Transit hiện hành giữ nguyên, recovery không cấp quyền từ việc xem menu hoặc từ dữ liệu client. Tiêu chí/range đo và test ở tài liệu triển khai/loopback QA, không là bảo đảm production đã bật.
