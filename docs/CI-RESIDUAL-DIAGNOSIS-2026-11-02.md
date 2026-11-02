# Chẩn đoán và hướng xử lý lỗi CI

Mốc phân loại: commit `36f05f00ef0187f9aa02fe83a96a69ce04a28852`, [run 41412853278](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41412853278). 246 file, 1.372 pass, 111 fail, không timeout/cancel/skip. Số dưới đây cộng theo file; không phải 111 lỗi sản phẩm độc lập. Một file có thể có nhiều nguyên nhân, một assertion thất bại có thể chặn các assertion sau.

| Nhóm/file mẫu | Lỗi tại mốc trên | Expected → actual | Phân loại và phép kiểm chứng tiếp theo |
|---|---:|---|---|
| Audit: production-plan-permissions, business-menu-views, line-auth, production-examples, production-quantity-sync, site-api | 21 | Toàn bộ records bất biến → khác audit; line-auth còn một so khớp cấu trúc JSX | Hợp đồng cũ xung đột audit hiện tại. `worker/site-api.mjs:119` bọc mutation bằng audit; `worker/action-audit.mjs:27` ghi receipt trước/sau, kể cả denied. Không loại audit vô điều kiện. Nếu giữ audit, cần kiểm đúng một receipt với actor/route/status/outcome đúng, mọi bản ghi cũ và dữ liệu nghiệp vụ bất biến; thêm negative test phát hiện ghi trái phép. Chưa đổi assertion này. |
| Capacity | 12 | Confirm fixture thành công → thiếu acknowledgement vệ sinh; sau đó thiếu startDate nhân viên | Fixture chắc chắn thiếu điều kiện. Bổ sung rõ tại các lệnh synthetic thành công, không tự chèn vào helper; giữ tests thiếu/sai Line/phiên bản. Sau sửa còn 3 khác biệt số liệu nêu dưới. |
| Điều phối: allocation compact/queue/stable/workspace | 14 | Nút Rút/tất cả controls/request cũ → node/request không có hoặc luồng chọn hàng khác | Trộn selector cũ và hợp đồng giao diện. Dựng từng trạng thái sender/receiver bằng fixture; xác minh hành động hiện tại có cùng side effect trước khi đổi selector. Giữ assertion không đổi draft, không gọi API khi thiếu quyền, không hủy cả offer. |
| Tìm kiếm: action-feedback-production, search-enter, search-route-components | 22 | Chỉ apply khi Search/Enter; không request phụ → dữ liệu đổi sớm, Line không đổi, có đọc production-standards | Chưa rõ sản phẩm hay fixture. Chạy từng ca với nhật ký GET/POST, dữ liệu đang nhập/đã áp dụng và đúng toolbar. Không thay kỳ vọng giữ kết quả chỉ vì source hiện khác. |
| Nhãn/cấu trúc: action-feedback-lifecycle/global, pcb493-single-back/employee-toolbar, hr-attendance-entry/controls, production-detail/exit-restore/backfill/correction/headcount/payroll-export | 22 | Chữ HOA, tab cũ, details hoặc nhãn cũ → sentence case, thêm CV khác/Thu hồi, popover/luồng mới | Một phần kiểm cấu trúc cũ, một phần hành vi chưa rõ. Đối chiếu thiết kế đã duyệt; ưu tiên DOM/role và kết quả hành động thay regex source, nhưng giữ nội dung/quyền và assertion hành vi tương đương. Chưa tự nới assertion. |
| Quyền: permission-denial-feedback, menu-permission-matrix | 5 | Hàm review/biến giao diện; Line chỉ thấy menu cũ → reviewSelected/rights API; menu Lịch SX hiện với Line | Fixture thiếu mode/rights đã sửa bằng hàm productionMenuRights thật. Test vẫn báo false != true ở quyền cũ. Hàm review từng phiếu đã bỏ; thay hợp đồng “không đổi bất kỳ state nào” cần quyết định vì reviewSelected hiện bật/tắt busy ngay cả denied. Thêm test đường mới cả ba tổ hợp thiếu quyền phải không request/refresh. |
| Kế hoạch/báo cáo/workflow: production-plan-transferred-display, table-report, production-workflow | 11 | Card/cột/tổng cũ hoặc unit 0.18 → thêm backlog/card, unit null hoặc danh sách khác | Kiểm dữ liệu và công thức bằng bộ nhỏ, tách lỗi đọc card theo vị trí khỏi sai tổng. Không sửa công thức/expected cho xanh. |
| production-final-limit | 1 | API phải từ chối Final vượt Packing → Missing expected rejection | Ưu tiên cao: test helper đạt nhưng đường workflow không từ chối như kỳ vọng. `assertFinalExitLimit` có trong lib/tests, không thấy gọi trong scripts/local workflow. Cần quyết định quy tắc Final, rồi mới được sửa nghiệp vụ; giữ ca không ghi khi bị từ chối và ca partial hợp lệ. |
| forecast-import, basic-master, production-profile-cache | 3 | Lưu/hủy/làm mới theo hợp đồng cũ → revision conflict, bắt nhập ngày ngưng thay Hủy, reference cache giữ nguyên | Ba nguyên nhân độc lập. Đối chiếu CAS, vòng đời nhân viên và generation cache; không bỏ concurrency guard hoặc thay quyền. |

## Kết quả kiểm thử tập trung của bản sửa tiếp theo

- Capacity + cleaning reminder + employment: **32 pass / 3 fail**, 35 test; không cancel/skip. Trước sửa file Capacity có 12 fail, sau sửa còn 3; toàn bộ assertion được giữ.
- Xác nhận không có vệ sinh được truyền tường minh cho đúng Line trong fixture thành công. Test thiếu acknowledgement, sai Line, revision cũ, có lịch vệ sinh, ngày bắt đầu/kết thúc vẫn chạy.
- Nhân viên giả có startDate `2026-01-01`, trước tuần fixture `2026-09-21`. Không sửa dữ liệu thật hoặc logic ngày hiệu lực.
- Permission denial: **17 pass / 3 fail**, 20 test. Hết ReferenceError mode; fixture dùng quyền tính từ source thật, không gán quyền để xanh. Test mới chạy chính reviewSelected + runner + adapter thật, kiểm cả ba tổ hợp thiếu quyền đều không gửi request/refresh.

Ba blocker Capacity sau khi sửa fixture (giữ nguyên expected):

| Ca | Expected | Actual |
|---|---:|---:|
| Plan waits for KHSX… khi đang điều chỉnh | null | 691.125 |
| aggregate leave… confirmation history | 674.975 | 673.55 |
| counted leave rows… old totals | 670.3833333333333 | 676.7166666666667 |

## Thứ tự xử lý đề xuất

1. Chốt quy tắc Final và audit trước vì liên quan an toàn số liệu/quyền. Chưa có quyền sửa nghiệp vụ trong lượt CI.
2. Gỡ các fixture còn thiếu điều kiện với test âm đi kèm; chỉ chạy file tác động và test guard liên quan.
3. Tách nhóm selector/nhãn khỏi hành vi tìm kiếm, điều phối; cập nhật selector chỉ khi chứng minh cùng thao tác và giữ assertion kết quả.
4. Kiểm ba sai khác Capacity và tổng kế hoạch bằng fixture tính tay nhỏ sau khi xác nhận công thức mong muốn.
5. Chỉ chạy full CI sau bản sửa cụ thể để đo residual của head mới; không rerun y nguyên. Build/typecheck xanh không phải nghiệm thu nghiệp vụ, không merge/deploy.
