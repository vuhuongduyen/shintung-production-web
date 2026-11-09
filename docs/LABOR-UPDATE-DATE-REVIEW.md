# Giờ công: hiệu lực hoặc ngày cập nhật của từng phiên bản

Quy tắc người dùng xác nhận 09/11/2026: lấy từ menu Giờ công, ưu tiên ngày hiệu lực; nếu không có thì ngày cập nhật của chính phiên bản (GMT+7). Không lấy mức mới nhất áp lùi toàn bộ lịch sử. Audit thao tác thật không đổi; trường Ngày hiệu lực là mốc nghiệp vụ độc lập, cho phép sửa có lý do theo API hiện có.

## Phạm vi bản sửa
- Tạo timeline chỉ đọc từ master và labor_hours_history, gồm dòng PDF khởi tạo với mốc cập nhật đã lưu. Phiên bản hiệu lực đã công bố giữ ưu tiên cho chính revision đó.
- Mức cũ chỉ dùng từ ngày cập nhật của nó; mức mới không ghi đè khoảng trước. Mức 0 là hợp lệ, khoảng không có dữ liệu và lịch sử hiệu lực sai/chồng lấn vẫn báo thiếu.
- Menu/PDF/Plan mới/phiếu mới và luồng sửa ngày sản xuất dùng cùng nguồn. Đường chốt/ghi giữ CAS cho cả payload, ngày cập nhật và tập lịch sử đã đọc.
- Sửa số lượng cùng ngày giữ snapshot phiếu cũ, kể cả snapshot thiếu; Plan chốt/chuyển giữ căn cứ đã lưu. Giờ thực tế vẫn lấy từ SX đã báo.
- Không migration, không backfill, không thay dữ liệu QA hoặc MAIN.

## Preview trước xử lý dữ liệu cũ
Xuất dữ liệu được phép đọc thành JSON với ba mảng `labor` (key/payload/updatedAt), `history` (key/payload/updatedAt) và `reports`. Chạy:

`node scripts/verification/labor-rate-preview.mjs /absolute/path/export.json`

Kết quả ghi stdout, không sửa input, không kết nối DB/network. Không đưa export/preview dữ liệu thật vào GitHub. Các trạng thái:
- `preserve-saved-basis`: giữ căn cứ đã lưu.
- `review-required-locked`: có đề xuất nhưng phiếu đã xác nhận/khóa; không tự cập nhật.
- `proposed-only`: chỉ đề xuất cho bản thiếu căn cứ.
- `unresolved`: thiếu ngày/nguồn hợp lệ hoặc nguồn mâu thuẫn.

Preview có lịch sử giá trị, ngày hiệu lực, ngày thao tác, lý do và nguồn ngày dùng. Phải đối chiếu từng nhóm trước thao tác ghi riêng. Một giá trị lớn không tự chứng minh là test: chỉ loại bản được đánh dấu test rõ ràng; không tự suy từ trị số, xóa audit hoặc lấy bản sửa áp lùi tùy ý. Trường hợp 106TG01 có lần nhập 16 phải đối chiếu/mốc sửa riêng trước triển khai; bản nháp này không tự sửa dữ liệu đó.

## Còn phải kiểm trước phát hành
- Preview trên export QA hiện tại để đối chiếu 264 phiếu/227 dòng thiếu mà PCB quan sát; các số này là báo cáo hiện trường, không phải kết quả tái đếm của PR.
- Xác nhận dấu hiệu/mốc sửa cho lần nhập sai so với bản sửa, đặc biệt 106TG01.
- Full CI exact head, review độc lập và bản ghép QA giữ guard/PR11/PR12.
- Kiểm browser PDF và trường ngày bằng thao tác thực, readback ngày app nhận; giới hạn mobile hosted phải nêu rõ.
