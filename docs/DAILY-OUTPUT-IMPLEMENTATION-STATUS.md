# Trạng thái báo sản lượng ngày — 04/11/2026

Nhánh `feature/daily-output-effective-dates-20261104`, nền main sau PR #6 (`d8dbb1e031e540fec892509b577cd49c3d2cc442`). Bản phát triển, chưa merge/triển khai hoặc bật policy production. Quyết định và inventory tại [hợp đồng](DAILY-OUTPUT-EFFECTIVE-DATES-CONTRACT.md).

## Đã thực hiện trong source

- Báo công chỉ nhập số phát sinh và ngày giờ GMT+7 sửa được. Không chọn công đoạn, FINAL, nhân viên hoặc giờ theo lệnh. Mỗi phiếu và mỗi LSX độc lập; cùng Plan ID không gộp lệnh.
- Lũy kế chờ/đã duyệt và thanh tiến độ ở SX/In Transit. Bảo toàn baseline sản lượng legacy một lần khi nhận phiếu ngày; không cộng lại baseline sau refresh. Bảng SX mới phân trang 10 lệnh, tổng hợp được lập chỉ mục theo snapshot.
- Lưu có khóa lượt gửi, xác thực quyền Line, CAS lệnh/policy/mức/lịch sử, guard phantom import. Mất phản hồi/non-JSON giữ nháp và cùng khóa; không tự tạo phiếu mới. Bấm lặp không gửi hai lượt đồng thời.
- QLSX duyệt sản lượng không đòi giờ/công đoạn, tạo đúng một đề xuất kho; có stale-selection và lý do trễ theo ngày sản xuất. Tra cứu/kho/backfill dùng ngày sản xuất của mô hình mới; không dựng giờ xuất trạm.
- Sửa/hủy phiếu chưa xác nhận và chưa liên kết kho: xem before/after, kiểm phiên bản/CAS, giữ audit, hỗ trợ đối chiếu cùng khóa sau mất phản hồi. Khóa phiếu đã xác nhận/liên kết kho.
- Version định mức có ngày hiệu lực; snapshot trên phiếu; thiếu căn cứ vẫn ghi lượng nhưng không tính tiền. Payroll phiếu mới cộng từng phiếu theo ngày/tháng, giữ công thức chia quỹ/phụ kho/giờ nhân sự. Payroll legacy chưa đổi cách tính.
- Không tự bật production, không migration/seed production, không nối Sheet/DB thật, không thay grants hoặc secrets.

## Kiểm tra local đã có

- TypeScript và build local cuối đạt. Nhóm cuối 58/58 ca trọng tâm đạt, gồm API thực qua Worker, nhập/sửa mounted, định mức, xác nhận/kho/Sheet bằng dữ liệu giả, refresh In Transit và tương thích GET. CI GitHub cho commit cuối chưa chạy tại thời điểm ghi tài liệu; không dùng local pass thay CI.
- Nhóm hồi quy rộng 93/93; nhóm sản lượng/API/kho 42/42; payroll/earned/export 21/21. Các nhóm này có giao nhau, không cộng thành tổng coverage.
- Kiểm thử mounted component nhập mới 3/3, điều chỉnh 2/2; đây là JSDOM, không phải Chrome/responsive QA.
- Đợt full local đầu: 260 file, 1.572 đạt/7 thất bại, không timeout/cancel/skip. Sáu ca thuộc harness In Transit chưa nhận display child mới, đã bổ sung đúng leaf hiển thị (targeted 25/25, giữ assertion request/quyền/refresh); một ca so sánh API legacy do trường policy null, đã sửa API bỏ field khi không có policy (targeted 3/3). CI đúng commit cuối vẫn phải được xác minh riêng.

## Số đo TEST

Node 24.19.0, Miniflare/D1 local trên cloud executor; không có request production. Chạy `node scripts/bench/daily-output.mjs` để tái lập trên DB mới riêng.

| Phép đo | Quy mô | Kết quả |
|---|---|---|
| Tổng hợp UI bằng quét toàn bộ mỗi lệnh | 500 lệnh, 10.000 phiếu; 1 warm-up, 5 mẫu | 116,258–118,998 ms |
| Tổng hợp UI bằng index một lần | Cùng dữ liệu, đối chiếu deepEqual kết quả | 20,128–25,045 ms |
| Lưu sản lượng | D1 có 502 lệnh, 10.000 phiếu; 5 mẫu | 98,144–121,096 ms; 8 SELECT + 1 batch/mẫu |
| Đối chiếu cùng khóa đã lưu | Cùng DB | 16,117–31,500 ms |
| Đọc workflow không tính giờ dẫn xuất | Cùng DB | 1.560,224 ms; chỉ là bối cảnh tải, không phải baseline thao tác lưu tương đương |

Node heap cuối phép đo khoảng 64,96 MiB; không phải peak Worker memory. Chưa đo CPU production, network hay thời gian render trình duyệt.

`node scripts/bench/daily-attendance.mjs` dùng 80 lệnh legacy/80 phiếu/160 event/4 nhân viên/1 tuần Capacity, ba DB TEST mới mỗi thao tác. Lưu HR trước thử scope 299–360 ms, sau 327–357 ms; phụ kho trước 309–346 ms, sau 303–368 ms, cùng 28 SELECT và 1 batch. Không chứng minh cải thiện, vì vậy **không giữ thay đổi scope đó** trong bản source. Kết quả không chứng nhận đã hết quá tải production hoặc đã tối ưu toàn bộ HR/phụ kho.

## Còn chặn nghiệm thu/phát hành

1. Chưa bảo toàn xong kết quả legacy payroll thiếu snapshot hoặc hoàn tất regression ngày hiệu lực toàn web (Leadtime/Safety/BOM/nhân sự/Engine). Inventory đã chỉ rõ, không được gọi là hoàn tất.
2. Chưa hỗ trợ sửa/hủy phiếu đã xác nhận/liên kết kho; giữ khóa an toàn, cần quy trình đối chiếu được duyệt.
3. Chưa có browser tool trong executor này. Cần full ONSPA + đúng Worker + dữ liệu giả trên môi trường được hỗ trợ, kiểm desktop/mobile, nhập/sửa/đóng/timeout và độ ổn định khung trước gửi link cho Duyên. Không dùng localhost hay mockup làm bằng chứng bản web đã kiểm.
4. Chưa có production cutover, không tự bật/migrate. Phải nghiệm thu rồi mới quyết định merge và Website phát hành chọn lọc.

Không thay thế nguồn Site bằng repo TEST hoặc tự triển khai. Không lấy build/local pass làm CI pass.
