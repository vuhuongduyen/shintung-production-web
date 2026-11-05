# Quyết định ngày hiệu lực và phần còn chờ đối chiếu

Cập nhật 05/11: Duyên cho HR nhập bổ sung trước ngày trả sản lượng (thường trước ngày 10 tháng sau), chốt Leadtime theo ngày chốt Plan và tách kế hoạch qua nhiều mức/có công thức khi bấm kết quả. Không dùng câu về HR để cho phép đổi kỳ đã chốt/đã trả.

Đây là ví dụ dữ liệu giả, không phải lỗi hoặc số liệu đã xác minh trên production. Không tự áp phương án vào dữ liệu thật. Các yêu cầu đã chốt (bảo toàn lịch sử, nhập sản lượng không công đoạn, chia tiền/phụ kho cũ, xử lý kho) không được hỏi lại.

## 1. HR nhập muộn và phần lịch sử đã bảo toàn

HR nhập muộn sau ngày làm việc được phép; test USER HR nhập ngày 05/12 cho ngày 05/11 (sau cutover 04/11) đã cập nhật giờ tính thử tháng 11, không ghi lại báo công hoặc baseline cũ. Không tự khóa HR sau ngày làm việc hoặc tự chọn ngày 10 làm hạn cứng.

Phần còn cần nguồn trạng thái tin cậy: source hiện chỉ có báo cáo tính thử, chưa có marker phân biệt kỳ đã chốt/đã trả với kỳ chưa trả. Vì vậy chưa tự mở lại prefix đã bảo toàn. Cần xác định cách nhận diện kỳ chưa trả trước khi áp dụng sửa ngược vào phần đó; không hỏi lại quyền nhập HR đã chốt.

Ví dụ chốt chuyển đổi ngày 04/11, đã bảo toàn 03/11 là 8 giờ. Sau đó HR sửa 03/11 thành 7 giờ hoặc sửa ngày bắt đầu/Line làm khác điều kiện chia tiền. Hệ thống vẫn lưu thao tác HR và audit theo quyền; phép tính hiện giữ số quan sát cũ, báo cần đối chiếu và chặn tiền tại phần mâu thuẫn. Không âm thầm thay 8 thành 7 hoặc bỏ thao tác HR.

| Lựa chọn | Kết quả và ảnh hưởng |
| --- | --- |
| Phiên bản điều chỉnh được duyệt riêng | Giữ bản 8 giờ; lập bản điều chỉnh 7 giờ có người duyệt, lý do, chênh lệch tiền và trạng thái đối chiếu. Có thể xem số gốc và số sau điều chỉnh; cần thêm bước nghiệp vụ duyệt. |
| Cho HR mở lại kỳ để sửa theo luồng hiện tại | Kỳ phải có trạng thái mở lại rõ ràng, before/after và người cho phép; báo cáo tính lại theo bản được mở. Phải xác định xử lý tiền đã chốt/đã trả và việc khóa lại; không được gọi số tính lại là số gốc không đổi. |

Đề xuất để xem xét: phiên bản điều chỉnh riêng cho phần đã bảo toàn, không cấp thêm quyền trong source hiện tại. Ngày ngưng làm việc rõ ràng sau mốc và hủy ngày ngưng dự kiến đã được kiểm theo công thức hiện có, không nằm trong câu hỏi này.

## 2. Leadtime — đã chốt ngày 05/11

Duyên chọn **ngày chốt kế hoạch**. Không hỏi lại mốc Plan/mở LSX/bắt đầu SX. Source mới dưới policy sản lượng active lưu căn cứ Leadtime riêng của từng dòng khi chốt; chuyển In Transit giữ căn cứ đó, không tra master mới để thay kết quả đã lưu. Có ngày GMT+7, thời điểm/người chốt và phiên bản nếu đã có chứng cứ. Căn cứ thiếu/chồng lấn giữ thiếu, không lấy mức hiện tại hoặc ngày mở LSX để bịa lịch sử. Lệnh cũ/anchor trước chuyển đổi giữ nguyên.

## 3. Kế hoạch qua nhiều mức — đã chốt ngày 05/11

Duyên chọn **tách kế hoạch** và nhấn vào kết quả để xem công thức/các số liệu căn cứ. KHSX dùng Tách đơn hiện có để nhập lượng và khoảng ngày từng dòng; không tự chia đều, bình quân mức hoặc trừ số lượng dòng chính. Các dòng giữ Plan ID chung và định danh riêng trong Chi tiết. Tổng lượng không bắt buộc bằng đề xuất theo yêu cầu Tách đơn đã chốt.

Source dưới policy mới phát hiện khoảng kế hoạch có nhiều mức, chưa cho chốt cho tới khi tách; giờ chưa đủ căn cứ hiển thị thiếu, không thành số 0 giả. Kết quả mỗi dòng mở Chi tiết: lượng × giờ/SP, khoảng ngày và phiên bản làm căn cứ. Dòng đã chốt giữ basis, chuyển In Transit/backlog dùng lại, không đổi theo master hiện tại. Có kiểm source CAS khi chốt để không lưu căn cứ trộn nếu master/policy vừa đổi.

## Điều kiện còn lại trước phát hành

Các quyết định trên không cấp quyền merge/triển khai. Còn phải tự kiểm trình duyệt full ONSPA/đúng Worker bằng dữ liệu giả, kiểm script/công thức Sheet trong môi trường được phép và nghiệm thu. Không cập nhật DB/Sheet thật để minh họa các ví dụ này.
