# Bổ sung quyền SKU Master cho nttvy và htndiem

Theo yêu cầu ngày 19/11/2026, bổ sung Xem, Thêm, Sửa, Xóa, Xác nhận, Hủy xác nhận, Hủy, Xuất dữ liệu trong `Dữ liệu cơ bản / SKU Master` cho hai tài khoản `nttvy`, `htndiem`.

Quyền được bổ sung khi máy chủ xác thực tài khoản đang hoạt động; không thay role, ghi đè bản ghi quyền cá nhân/bộ phận, hay mở quyền thao tác menu khác. Tài khoản Line, tài khoản ngưng/xóa, hoặc bản ghi quyền cá nhân ngưng hoạt động không nhận phần bổ sung. Admin giữ toàn quyền theo cơ chế hiện có. Kiểm tra trạng thái SKU, revision và quy trình xác nhận vẫn giữ nguyên.

Nguồn khai báo duy nhất là `lib/sku-master-user-grants.mjs`, được dùng bởi principal máy chủ, khả năng xác nhận SKU và màn đối chiếu quyền. Đây là chính sách bổ sung trong source: muốn bỏ một quyền bổ sung riêng phải cập nhật chính sách này; không coi việc bỏ checkbox ở bản ghi quyền cá nhân là thu hồi chính sách. Ngưng quyền cá nhân vẫn chặn toàn bộ phần bổ sung.

PR được chuẩn bị từ GitHub main c120e9d8d9a582fe0e81e325dabae81f6808cee0; web chính đã đối chiếu là v850. Chưa đọc bảng quyền thực tế bằng phiên Admin, chưa kiểm UI đăng nhập hai tài khoản và chưa áp dụng trên production. Kiểm thử dùng dữ liệu synthetic riêng, bao gồm principal đã xác thực, SKU capability, phạm vi menu, Admin, ngưng quyền và tính bất biến của các bản ghi dữ liệu khi đọc.
