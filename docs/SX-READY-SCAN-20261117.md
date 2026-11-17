# Lọc lệnh chưa đủ điều kiện trước đọc tóm tắt SX

Bổ sung sau PR #38, từ staging `0a44b027514ee5563e815030fc00cac673b86b9a`. MAIN v836 đã giữ được trang/dữ liệu khi mở lại nhưng lượt đọc Admin vẫn quét bốn cửa sổ trước khi hiển thị danh sách nhỏ, khoảng 8–10 giây ở các mẫu đo.

`normalizeTransit` chỉ nhận lệnh đã đồng bộ khi có mã LSX, số lượng dương và ngày mở. Nhãn đồng bộ đã lưu chưa đủ bảo đảm điều kiện đó. Truy vấn directory nay bỏ sớm các trường chắc chắn rỗng hoặc lượng bằng không. Dạng dữ liệu khác vẫn được kiểm bằng bộ chuẩn hóa hiện có; không tự viết lại hay thay chuẩn hóa dữ liệu cũ.

Kiểm thử: tạo 240 kế hoạch có nhãn đồng bộ nhưng thiếu mã/ngày mở hoặc lượng rỗng/0; danh sách/tổng và records trước/sau phải bằng nhau, chỉ một cửa sổ tóm tắt. Kiểm cột legacy, giá trị falsy và số dạng chuỗi. Chưa dùng fixture để khẳng định tốc độ MAIN. Không đổi tệp ứng dụng PR #37, DB/R2, schema, quyền, lịch sử hoặc route ghi. Chỉ triển khai delta trên MAIN mới nhất sau CI, rồi đo lại Admin/Line và kiểm bảo toàn số liệu.
