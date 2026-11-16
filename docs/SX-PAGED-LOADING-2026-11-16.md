# SX báo công: tải nền và phân trang

## Nguồn và phạm vi

Ứng viên từ staging `ba5eef2924c44defd823568d0568287b59d03201`, sau PR #25–#30. MAIN được đọc lại là v826, source `bc80974c8c1d088128b50b36eb29cfa8dc8ace26`; không coi hai repository là cùng cây mã. Component danh sách đang sửa khớp baseline MAIN. Không đổi Site, DB/FILES, quyền, tài khoản, dữ liệu hoặc trigger Kho. Không sửa quy tắc tính tổng/trạng thái hay công thức tồn.

## Kết quả khảo sát trước sửa

- Trên phiên Line A thật: bảng còn kết quả trang cũ nhưng aria-busy=true, nút phân trang bị disabled.
- Trên phiên Admin thật: lúc chưa nhận dữ liệu không render bảng/phân trang; sau khi tải xong thấy danh sách và phân trang. Admin chuyển được sang trang 2 sau chờ. Không thấy điều kiện cố ý ẩn phân trang riêng Admin.
- Log MAIN ghi nhận một GET /api/production-order-pages hoàn tất trong 12.746 giây, cùng nhiều GET bị canceled. Đây là thời gian một request, không phải benchmark toàn bộ lượt mở màn hình.
- Luồng hiện tại hủy request mỗi khi focus/poll thay revision; khóa phân trang cả khi cập nhật nền hoặc đọc lỗi. API đọc đầy đủ SKU (kèm hash từng payload), và đọc Leadtime mỗi nhóm lệnh dù danh sách không dùng trường đó.
- Đọc chỉ xem toàn bộ cấu hình: 30 users, 31 personal permission records, 6 department permission records. 17 user được vào SX báo công (2 Admin, 2 Quick Line, 13 user còn lại); 13 chưa có quyền menu. Không thay quyền. Không công bố định danh/dữ liệu user tại repository công khai.

## Thay đổi

- Bộ nhớ trang chỉ trong phiên trình duyệt: khóa theo user/Line + URL đầy đủ gồm trang/lọc/sắp xếp; TTL 30 giây, tối đa 12 mục. Đổi phiên/quyền xóa bộ nhớ; ghi nghiệp vụ làm mất hiệu lực dữ liệu cũ. Không dùng localStorage, Service Worker hoặc cache chung máy chủ.
- Tái sử dụng request đang chạy khi focus/poll, giữ hàng đang xem và loại phản hồi trang/lọc cũ bằng generation. Hết 25 giây thì báo lỗi và cho thử lại. 401/403 xóa hàng/caches.
- Phân trang vẫn hiện và dùng được khi cập nhật nền/lỗi đọc. Bản nháp/chi tiết đang mở vẫn giữ khóa có chủ đích. Không cho báo công trên hàng của trang cũ trong lúc chuyển sang trang khác.
- Sau khi trang hiện tại tải xong, tải trước đúng một trang kế tiếp của cùng bộ lọc/Line. Không tải toàn bộ báo công. Lần mở lạnh chưa có cache vẫn cần mạng; không hứa luôn có dữ liệu khi đóng web/offline.
- API chỉ đọc metadata SKU mà danh sách/chi tiết sử dụng, không chuyển hoặc hash lịch sử SKU không liên quan. Bỏ hai lượt đọc Leadtime mỗi nhóm lệnh ở riêng luồng phân trang. Giữ cursor chống đọc trộn, kiểm quyền backend, liên kết báo công cũ và tổng toàn bộ bộ lọc.

## Kiểm tra và giới hạn

- 29 ca mục tiêu: backend/client/mounted, gồm Admin, Line A/B, user chỉ xem, focus khi request chậm, dữ liệu nhớ, tải trước, timeout/retry, 401/403 và dữ liệu lịch sử. Bản ghi trong fixture giữ nguyên trước/sau.
- 37 ca hồi quy: Quick Line, import thưa, session, loading, read performance và In Transit; 24 hợp đồng CI nhanh. Typecheck/build đạt trước cập nhật ghi chú trạng thái cuối; chạy lại trước commit.
- Browser MAIN chỉ xác minh lỗi bản cũ và cấu hình quyền; không giả đăng nhập/đổi mật khẩu user khác. Chưa nghiệm thu sửa trên web chạy thật, chưa đo tốc độ sau triển khai, chưa coi đã thử trực tiếp đủ 17 user.
- Không tạo phiếu thử trên MAIN, không sửa/duyệt/hủy phiếu thật. Chưa merge hoặc triển khai bản sửa. PR riêng kế tiếp sau #30.
