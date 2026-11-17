# Khôi phục dữ liệu báo công giữa nhiều tab và giảm đọc SX

Nhánh riêng `fix/production-cache-isolation-fast-read-20261117`, từ staging `2cc01293d70c4b77bf065e8d54814947608d7ea3` sau PR #36. Baseline MAIN v834, source `2555f03d258f106a1504e8fba0d457cc21c2a8e3`.

## Vấn đề và thay đổi

Một tab đã mở trước có thể ghi lại toàn bộ snapshot cũ, làm mất dữ liệu menu/trang mới mà tab khác vừa lưu. IndexedDB nay hợp nhất từng khóa trong cùng transaction, giữ bản mới nhất theo thời gian. Khác tài khoản/quyền/Line không hợp nhất. Bản lưu v834 được chuyển một lần sang khóa mới; tab v834 còn mở không thể ghi đè khóa mới. Đăng xuất vẫn ẩn dữ liệu ngay và chỉ khôi phục sau xác minh lại cùng phạm vi.

SX báo công đọc song song chính sách, cursor và metadata SKU; metadata chỉ lấy SKU liên quan lệnh (giữ tương thích Unicode, record key và legacy). Loại sớm kế hoạch chưa đồng bộ trước chia cửa sổ, và loại lịch sử nhập đã duyệt trước khi dựng JSON tóm tắt. Chi tiết/workflow lịch sử giữ đường đọc đầy đủ. Không đổi công thức, quyền, dữ liệu đã lưu, schema, D1/R2 hoặc route ghi.

## Điều phối

Khi mở lại SX hoặc workspace báo công, yêu cầu cập nhật nền bắt đầu ngay cả khi memory cache chưa hết TTL 30 giây. Các lượt đang chạy vẫn gộp chung; chuyển sang trang đã tải trước tiếp tục dùng prefetch. Không chờ nhịp poll để cập nhật menu vừa mở.

PR #37 xử lý Tiến độ sản xuất và bộ nhớ trạng thái riêng của menu đó. Không sửa các tệp ứng dụng của PR #37: production-management, production-progress-review, production-progress-view-state, production-progress-read hoặc production-workflow. Tệp FUNCTION_STATUS thêm trạng thái ở vị trí riêng, tránh phần cuối PR #37.

PR #13 cũng sửa worker/site-api.mjs; thay đổi ở đây chỉ một đối số của route production-order-pages. Phải kiểm bản ghép, không thay toàn bộ tệp của PR khác. PR #8 chỉ quy trình/CI. Trước merge/deploy phải đọc lại head, staging và MAIN; chỉ phát hành delta lên source MAIN mới nhất, từng lần một.

## Kiểm chứng và giới hạn

- Tests cache: hai tab cùng quyền không mất menu khác, giá trị cũ không đè giá trị mới, đổi scope/đăng xuất/response trễ bị chặn, giới hạn dung lượng và hết hạn giữ nguyên.
- Tests API: tổng/danh sách/chi tiết và dữ liệu lưu trước/sau bằng nhau; metadata legacy/Unicode; 220 kế hoạch chưa đồng bộ không tạo thêm cửa sổ đọc; 1.400 phiếu nhập giả chỉ đưa 2 phiếu chờ vào scope tóm tắt. Đây là dữ liệu giả.
- TypeScript và build đạt. Kiểm thử mounted và full CI phải ghi kết quả riêng ở PR.
- Baseline một lần đọc SX trên MAIN: khoảng 14,5 giây / 25 lượt DB. Chưa đo tốc độ MAIN sau sửa; không dùng thời gian hoặc số lượt DB của fixture để tuyên bố đạt tốc độ thực tế.
- Chưa nghiệm thu đa tab với IndexedDB thật sau phát hành, đăng xuất/đăng nhập thật và các phiên Line A/B. Các kiểm thử scope tự động không thay thế nghiệm thu các phiên đó.

Mục tiêu nghiệm thu: sau xác minh đăng nhập, menu/trang/dữ liệu lần gần nhất hiện trước response nền; tab cũ không làm mất snapshot; response mới cập nhật đúng số liệu và không đặt lại trang; đo thời gian cập nhật trên web đang chạy và đối chiếu dữ liệu liên quan.
