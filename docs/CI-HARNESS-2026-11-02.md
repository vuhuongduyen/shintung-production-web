# Sửa thiết lập kiểm thử cho snapshot v807

Phạm vi được duyệt: chỉ harness, import/alias, dữ liệu giả và cách chạy CI. Không sửa mã ứng dụng, quyền, công thức, giới hạn Final hoặc dữ liệu nền.

Các nguyên nhân đã xác minh và thay đổi:

- Vite test server không đọc cấu hình ứng dụng nên thiếu alias `@`. Helper dùng alias vào gốc repo, tắt dependency discovery trong middleware test server.
- VM chạy trích đoạn source thiếu các phụ thuộc mới: audit, quyền điều hướng, Engine, capacity confirmation, backlog và week visibility. Nạp hàm thật từ source; chỉ stub các component trình bày không thuộc phạm vi hook/request harness. Không stub kết quả quyền hoặc công thức.
- JSDOM thiếu globals mà component sử dụng. Cung cấp constructor từ chính cửa sổ JSDOM, tránh dispatch Event khác realm.
- Hai test payroll policy/stage cancel hoàn thành assertion nhưng giữ Node BroadcastChannel (MessagePort). Fixture theo dõi kênh thật và đóng khi teardown. Kiểm thử mới xác minh gửi/nhận thật và kênh đóng sau teardown. Không dùng force-exit để báo đạt giả.
- Search test khi thất bại so sánh DOM với null tạo diagnostic React/Fiber quá lớn. Chuyển sang kiểm tra boolean với cùng điều kiện; vẫn thất bại nếu phần tử tồn tại. Teardown chạy cả khi assertion lỗi. Runner giới hạn heap 2048 MiB, giữ timeout và exit lỗi.
- Snapshot không chứa lịch sử Git của Site. Hai negative control về toolbar/session dùng fixture tổng hợp được ghi rõ, không giả là bản phục dựng commit lịch sử; kiểm tra source hiện tại và assertion quyền vẫn giữ.
- Export isolation cũ yêu cầu JSON rỗng/no hosting, trái hợp đồng snapshot được duyệt. Giữ nguyên kiểm tra remote bị chặn/migrations rỗng, thêm kiểm tra hash/bytes JSON nền và hosting metadata so với manifest, cấm đường dẫn runtime/credential, kiểm tra negative cases sửa JSON/thêm file.

Không tuyên bố tất cả lỗi còn lại là lỗi sản phẩm hoặc test lỗi thời. Các assertion về UI tìm kiếm, toolbar điều phối, menu Line, số liệu kế hoạch và các nhóm quyền/Final cần đánh giá hợp đồng riêng. Chúng tiếp tục chạy và có thể làm CI thất bại; không xóa, skip hoặc sửa kỳ vọng để tạo kết quả xanh. Chi tiết số lượng và link run cuối được ghi trong PR #4 để gắn đúng commit.

Chưa bao phủ lint hoặc QA trình duyệt thật. Test synthetic/Miniflare không xác nhận quyền thực tế hoặc số liệu production.

Sau lượt CI đầy đủ đầu tiên, bổ sung alias cho site-24hour/website-test-log-details, document JSDOM cho client audit trong cache-session fixture, toolbar.note và state/context hooks của fixture xuất báo cáo. Fixture xuất báo cáo đọc cấu trúc Fragment theo nội dung hiển thị; vẫn giữ kiểm tra không có preview tự phát, export đúng snapshot, reset/đóng và thêm test từ chối quyền không tạo report. Không thay chính sách quyền thực tế.
