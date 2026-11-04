# Khôi phục tải Hệ thống báo công — 04/11/2026

## Phạm vi và nguồn

Nhánh riêng từ GitHub main `e83c854631bb77ecd48c0c2a59e7b67fc1547027` sau PR #5. Xử lý tải chung để tiếp tục nhập bù FINAL; không đổi mô hình báo sản lượng/ngày, công thức, quyền, FINAL, kho, dữ liệu hoặc cấu hình production. Không lấy các sửa lưu đang dở từ nhánh `fix/workflow-save-performance-20261104` vào bản này.

Thông tin sự cố được bàn giao: GET workflow vượt CPU và có lần vượt bộ nhớ trên production. Không gửi lượt tải nặng để tái hiện trên production. Source GitHub này chưa được coi là bản đã phát hành trên Site; project Website phải đối chiếu source hiện hành trước khi áp dụng chọn lọc.

## Nguyên nhân và sửa hẹp

- Home tải cả work và full khi đăng nhập, sau mỗi 45 giây và khi focus, dù chưa mở menu cần dữ liệu. Màn work còn tự tải full sau lượt work. Giữ preload mã component, chuyển tải dữ liệu cho reader của workspace đang hoạt động. Focus/poll và invalidation của workspace hoạt động vẫn giữ.
- Khi tìm các lệnh bị ảnh hưởng bởi một biến động nhân sự, mốc thời gian toàn lịch sử được dựng lại cho từng lệnh, rồi mỗi khoảng lại quét toàn bộ sự kiện. Dựng mốc một lần cho mỗi biến động và dùng chỉ mục sự kiện từng lệnh, giữ nguyên các mốc và thứ tự kết quả.
- Tính giờ gọi lại việc tìm phân công toàn bộ sự kiện ở mỗi khoảng. Chỉ mục phân công giữ đúng các sự kiện nguồn/đích của lệnh. Bước effectiveAttendance toàn cục vẫn giữ để không mất quan hệ supersedes/approvedFrom.
- Các báo công lặp lại kiểm tra hiện diện/lịch và cạnh giờ giống nhau. Memoize trong đúng một lần đọc với cùng calendar/events/Line; tối đa 20.000 khóa hiện diện mỗi policy. Không cache qua request, người dùng hoặc lần ghi. Chính sách raw journal và HR projection của Line được tách đúng như baseline.
- Ghi chú giờ/pending attendance tái sử dụng dữ liệu hiệu lực và sự kiện từng lệnh trong request. Không đổi các phép cộng, làm tròn, điều kiện xác nhận hay nội dung audit.
- GET `view=work` dùng projection validation đã có, bỏ bản sao display lớn `sourceSnapshot`, `overlapWarnings`, `laborNotes`, `history` trong dữ liệu đọc; không xóa trên DB. Giữ giờ lưu, sản lượng, stage/import timeline, trạng thái, roster và quyền. Full GET vẫn giữ chi tiết. Work mở full khi người dùng yêu cầu Chi tiết/Phân công và tiếp tục refresh đúng profile khi đang xem; không chạy thêm GET work trước full.

Backend POST không thay luồng ghi, idempotency, CAS, confirmation, audit hoặc side effect kho. Thay đổi helper giờ dùng cùng thuật toán; các phép kiểm nghiệp vụ vẫn chạy.

## Kiểm chứng local

- Nhóm workflow/loading: 37/37 đạt.
- Nhóm FINAL, nhập bù, stage lifecycle, quyền và UI: 47/47 đạt.
- Nhóm API GET/mounted và projection bổ sung: 15/15 đạt; GET không ghi dữ liệu, unauthenticated 401, Line B không đọc được A, work nhẹ và full phục hồi bản sao display.
- Nhóm cache/session, sửa/hủy, API xác nhận, lịch sử, payroll, mượn Line, giờ và stage-save: 62/62 đạt.
- Các nhóm có ca trùng, không cộng thành số test duy nhất. Typecheck và build cuối đạt exit 0; vẫn có cảnh báo phân loại tuyến vinext hiện hữu. CI đúng commit phải đọc kết quả riêng. Không dùng các kết quả này để tuyên bố browser/production đã nghiệm thu.

### Số đo

Node/Miniflare TEST local; DB mới riêng mỗi quy mô, 3 lượt mỗi profile/phiên bản. Baseline là code đọc và helper giờ/journal ở main e83c854; cùng dữ liệu và actor QLSX. Dữ liệu giả có 100 hoặc 500 LSX, cùng số báo công, 2 sự kiện/lệnh và 40 ghi nhận HR cũ. Có lượt chạy kiểm thử khác cùng môi trường, nên đây là phép đo định hướng, không phải SLA hoặc tải cloud tương đương production. CPU là process CPU, không phải số đo CPU isolate Workers; không đo được peak memory production.

| Quy mô | Profile | Median wall trước → sau | Median process CPU trước → sau |
|---|---|---|---|
| 100 LSX, 240 sự kiện | work | 195,3 → 196,3 ms | 132,5 → 109,9 ms |
| 100 LSX, 240 sự kiện | full | 490,5 → 251,4 ms | 429,8 → 212,0 ms |
| 500 LSX, 1.040 sự kiện | work | 356,5 → 312,6 ms | 218,3 → 193,0 ms |
| 500 LSX, 1.040 sự kiện | full | 4.756,3 → 622,2 ms | 4.757,2 → 512,8 ms |

Deep equality toàn bộ kết quả trước/sau đạt ở mỗi lượt cho cả full và work không projection. Đối chiếu thêm HR, Admin, Quick Line A/B trên cả hai profile đạt. Fixture API riêng có snapshot/warnings lớn: response work **31.080 byte**, full **732.197 byte**, giữ nguyên dữ liệu DB; đây là tác dụng projection, không phải phép đo CPU ở bảng trên. Không khẳng định work nhỏ luôn nhanh hơn; full vẫn có kích thước phụ thuộc toàn bộ lịch sử.

## Bàn giao và giới hạn

Chưa browser QA: executor không có công cụ browser/computer được hỗ trợ; lần Chromium CLI trước trong cùng môi trường timeout cả trang tối giản. Không lặp cách không hỗ trợ hoặc đưa localhost thành link nghiệm thu. Không cập nhật Codespaces đang dùng, tạo Site/DB, thay credentials hay mở cổng public. Cần browser TEST full app đúng head: mở các menu, nhập bù FINAL preview/save bằng dữ liệu giả, kiểm nguồn/công đoạn trước và các mốc FINAL tương lai, xác nhận/kho giả, refresh/focus, chuyển tab, Chi tiết/Phân công, desktop/mobile và lỗi tải có retry.

Giữ draft PR đến bước xem xét/preview; chưa merge hoặc deploy. Khi phát hành chọn lọc phải đọc lại active commit/deployment success và log tải thật. Chưa chứng minh đã loại bỏ hoàn toàn exceededMemory hoặc tất cả menu production đã phục hồi. Dữ liệu full rất lớn vẫn có thể cần phân trang/detail endpoint ở đợt tiếp theo có thiết kế riêng; không âm thầm cắt lịch sử để làm nhẹ.
