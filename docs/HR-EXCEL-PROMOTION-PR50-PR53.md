# Đồng bộ Excel HR lên nền web chính v848

## Phạm vi
PR chức năng dựa trên PR nền #54 (sync/main-v848-for-hr-20261118), không lấy toàn bộ staging. Nền ứng dụng: MAIN v848, source 1484f325a2b13615a0418813ff124712debf587f. GitHub main cũ: d8dbb1e031e540fec892509b577cd49c3d2cc442.

Ghép phần nhập/hủy Excel của PR49 (phụ thuộc còn thiếu trên MAIN), tự kiểm tra và lưu khi chọn file, nhận diện TRVS của PR50, nút chuyển dòng và Thêm dòng/Lưu của PR53. Giữ nhập thủ công, quyền HR, lưu nguyên giờ vắng và tính trừ nghỉ theo lịch, chống trùng, hủy theo lần nhập và không ghi đè dữ liệu cũ.

## Ghép phần dùng chung
- production-management: giữ nguyên nhánh ACK/tải nền Phụ kho v848; thêm nhánh HR và timer riêng.
- production-workflow: giữ bỏ đọc lệnh cho Phụ kho; bổ sung đọc chấm công HR theo nhân viên. Không thay luồng sản lượng, snapshot chuẩn giờ hoặc quyền QLSX.
- local server: chỉ bổ sung bảo vệ entity hr_absence_import, không mang các thay đổi loại entity không thuộc HR từ staging.
- Không đổi Site/hosting, D1/R2, migration, dữ liệu, tài khoản, CI hay cấu hình quyền.

## Bằng chứng và giới hạn
- Nền: TypeScript/build đạt, 4/4 kiểm thử cô lập source/dữ liệu đạt.
- Ứng viên HR: TypeScript/build đạt; 65 kiểm thử giao diện/tra cứu/parse/loại nghỉ đạt; 13 kiểm thử API nhập/hủy/chống trùng/quyền/giao dịch đạt; 7 kiểm thử Phụ kho/tải nền giữ bản nháp đạt. Dữ liệu kiểm thử chỉ ở DB tạm cô lập.
- Fixture của nhánh main cũ thiếu daily-output và mock hook giữ trạng thái. Dùng fixture synthetic và harness hiện có của staging đã kiểm, không bỏ assertion; chạy lại nhóm liên quan đạt.
- QA v31 đã kiểm nút và bàn phím của PR53. Ứng viên ghép v848 này chưa được triển khai hoặc nghiệm thu trên trình duyệt; không dùng kết quả QA cũ thay nghiệm thu ứng viên mới.
- PR HR tạm nhắm nhánh nền để diff chỉ có phần chức năng. Sau khi #54 được duyệt/merge, retarget về main và chạy đầy đủ CI đúng merge tree trước khi xét merge. Không tự merge, không triển khai MAIN trong lượt tạo PR này.
