# Xác nhận sản lượng theo ngày — PR giao diện

Theo mẫu Duyên chốt 17/11/2026: giữ Hiển thị, Tra cứu, Tất cả LSX; bỏ Cập nhật dữ liệu khỏi toolbar Tiến độ (tải nền và Thử lại khi lỗi vẫn hoạt động). Chế độ xác nhận dùng bảng phẳng, nhóm ngày hoàn thành cũ đến mới; mỗi phiếu có nút Xác nhận, không gộp hai phiếu cùng LSX/ngày. Giữ phân trang 20 phiếu và điều kiện lọc hiện có.

Dùng nguyên đường ghi, snapshot/version, quyền, lý do trễ và kiểm tra backend. Phiếu công đoạn lịch sử còn chờ có mục riêng dùng trình kiểm tra cũ; không giả làm phiếu sản lượng ngày. Không sửa DB/R2/schema/dữ liệu/quyền.

Nguồn: staging 0a44b027 (PR38); MAIN kiểm trước sửa là v836 b98164c1. PR39 chỉ sửa production-order-pages.mjs và test/docs, không trùng mã ứng dụng của PR giao diện này. Không merge hoặc triển khai trong công việc tạo PR.

Kiểm thử: 8 ca mounted về nhóm ngày, phiếu riêng, quyền, lý do trễ, chống bấm đúp, lỗi giữ dòng, khôi phục trang/lọc và tải nền ngay; TypeScript/build. Kiểm UI trình duyệt bản mới còn chờ, không tuyên bố nghiệm thu production.

Tốc độ xác nhận được tách thành PR khác: hiện luồng chờ tải lại danh sách sau khi POST đã lưu. PR này chỉ thay giao diện, không tuyên bố giảm thời gian lưu.
