# Căn cứ source web chính cho PR chấm công Excel

Ngày đối chiếu: 18/11/2026. GitHub main: d8dbb1e031e540fec892509b577cd49c3d2cc442. Web chính v848: 1484f325a2b13615a0418813ff124712debf587f.

Nhánh này đưa mã ứng dụng đang chạy về GitHub trước khi xét phần Excel. Đây không phải yêu cầu triển khai hoặc sao chép dữ liệu. Không chứa PR49/50/53, không lấy toàn bộ staging. Giữ workflow CI, quy trình GitHub và lệnh test của main hiện hữu. Không tự hợp nhất PR8/13.

Nguồn lấy từ repository của Site chính hiện hữu. Chỉ đưa source ứng dụng và dependency/config build cần thiết; giữ nguyên hosting MAIN. Không đưa DB, R2, tài khoản, secrets, nội dung app JSON khác baseline đã duyệt, tài liệu lịch sử riêng, gói ZIP hay trang QA. Các file source đổi được quét mẫu secret trước khi gửi.

PR chức năng Excel sẽ dựa trên nhánh này để diff riêng phần HR. Sau khi PR nền được duyệt và main cập nhật, retarget PR HR về main và chạy CI trên đúng cây mã. Không coi PR nền hoặc source snapshot là bằng chứng QA toàn bộ website. Chưa merge và chưa triển khai MAIN.

## Sửa kiểm thử CI sau đồng bộ nền

Source ứng dụng giữ nguyên v848. Không đổi workflow, không bỏ/skip test. Các lỗi được phân loại và sửa trong kiểm thử:

- Harness VM thiếu hook/cache/view-state mới: dùng dependency thật với hooks mô phỏng ổn định, giữ các assertion quyền, giữ dữ liệu và điều hướng.
- HR tháng 10 phụ thuộc ngày chạy: cố định ngày giả 09/11/2026; thêm kiểm tra đúng biên hết ngày 10/11 GMT+7, từ chối create/edit/cancel không đổi bản ghi. Không sửa hạn thật.
- Phụ kho bỏ danh sách ba tên theo chức năng MAIN: kiểm tất cả nhân viên đang làm thuộc Line; vẫn từ chối khác Line/nghỉ việc, bảo toàn bản cũ và không cho sao chép nhân viên hết điều kiện.
- Giờ công: dữ liệu giả bổ sung căn cứ lưu cùng phiếu; kiểm không lấy định mức hiện hành hoặc dự toán LSX thay lịch sử. API Giờ công có ngày hiệu lực tường minh. Lookup dùng căn cứ phiếu, không fetch menu hiện hành.
- Worker: test đăng nhập khai báo môi trường giả mở bảo trì; test riêng kiểm mặc định khóa và chặn toàn bộ ghi nghiệp vụ, không tác động DB/R2/network.
- Tiến độ, bộ nhớ hiển thị và phân trang: dùng test tương ứng source MAIN; thêm coverage pager, ACK, dữ liệu lưu theo quyền, định mức theo ngày và quỹ lương.

Các test sao chép từ chính checkout MAIN v848 đã đối chiếu diff; các sửa bổ sung chỉ dùng dữ liệu synthetic. Không thay runtime, cấu hình Site, quyền, DB hay R2.
