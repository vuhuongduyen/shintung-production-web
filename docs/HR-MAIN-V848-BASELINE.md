# Căn cứ source web chính cho PR chấm công Excel

Ngày đối chiếu: 18/11/2026. GitHub main: d8dbb1e031e540fec892509b577cd49c3d2cc442. Web chính v848: 1484f325a2b13615a0418813ff124712debf587f.

Nhánh này đưa mã ứng dụng đang chạy về GitHub trước khi xét phần Excel. Đây không phải yêu cầu triển khai hoặc sao chép dữ liệu. Không chứa PR49/50/53, không lấy toàn bộ staging. Giữ workflow CI, quy trình GitHub và lệnh test của main hiện hữu. Không tự hợp nhất PR8/13.

Nguồn lấy từ repository của Site chính hiện hữu. Chỉ đưa source ứng dụng và dependency/config build cần thiết; giữ nguyên hosting MAIN. Không đưa DB, R2, tài khoản, secrets, nội dung app JSON khác baseline đã duyệt, tài liệu lịch sử riêng, gói ZIP hay trang QA. Các file source đổi được quét mẫu secret trước khi gửi.

PR chức năng Excel sẽ dựa trên nhánh này để diff riêng phần HR. Sau khi PR nền được duyệt và main cập nhật, retarget PR HR về main và chạy CI trên đúng cây mã. Không coi PR nền hoặc source snapshot là bằng chứng QA toàn bộ website. Chưa merge và chưa triển khai MAIN.
