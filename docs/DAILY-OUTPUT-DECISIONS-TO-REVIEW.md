# Các lựa chọn cần Duyên xem trước khi hoàn thiện ngày hiệu lực

Đây là ví dụ dữ liệu giả để quyết định, không phải lỗi hoặc số liệu đã xác minh trên production. Không tự áp phương án vào dữ liệu thật. Các yêu cầu đã chốt (bảo toàn lịch sử, nhập sản lượng không công đoạn, chia tiền/phụ kho cũ, xử lý kho) không được hỏi lại.

## 1. HR cố ý sửa ngược phần giờ đã bảo toàn

Ví dụ chốt chuyển đổi ngày 04/11, đã bảo toàn 03/11 là 8 giờ. Sau đó HR sửa 03/11 thành 7 giờ hoặc sửa ngày bắt đầu/Line làm khác điều kiện chia tiền. Hệ thống vẫn lưu thao tác HR và audit theo quyền; phép tính hiện giữ số quan sát cũ, báo cần đối chiếu và chặn tiền tại phần mâu thuẫn. Không âm thầm thay 8 thành 7 hoặc bỏ thao tác HR.

| Lựa chọn | Kết quả và ảnh hưởng |
| --- | --- |
| Phiên bản điều chỉnh được duyệt riêng | Giữ bản 8 giờ; lập bản điều chỉnh 7 giờ có người duyệt, lý do, chênh lệch tiền và trạng thái đối chiếu. Có thể xem số gốc và số sau điều chỉnh; cần thêm bước nghiệp vụ duyệt. |
| Cho HR mở lại kỳ để sửa theo luồng hiện tại | Kỳ phải có trạng thái mở lại rõ ràng, before/after và người cho phép; báo cáo tính lại theo bản được mở. Phải xác định xử lý tiền đã chốt/đã trả và việc khóa lại; không được gọi số tính lại là số gốc không đổi. |

Đề xuất để xem xét: phiên bản điều chỉnh riêng cho phần đã bảo toàn, không cấp thêm quyền trong source hiện tại. Ngày ngưng làm việc rõ ràng sau mốc và hủy ngày ngưng dự kiến đã được kiểm theo công thức hiện có, không nằm trong câu hỏi này.

## 2. Ngày chọn Leadtime cho LSX mới

Ví dụ Plan chốt 03/11 khi mức là 2 ngày, mở LSX 05/11 khi mức là 4 ngày, bắt đầu SX 06/11. Các LSX cũ trước mốc đã có anchor quan sát; câu hỏi dưới đây chỉ cho chứng từ mới hoặc lần điều chỉnh có căn cứ.

| Mốc lựa chọn | Ảnh hưởng |
| --- | --- |
| Ngày chốt Plan | Giữ cam kết từ lúc lập/chốt kế hoạch; LSX mở muộn vẫn dùng 2 ngày. Cần liên kết phiên bản Plan thực sự đã chốt. |
| Ngày mở LSX | Dùng mức 4 ngày có hiệu lực khi tạo cam kết LSX; không thay khi master đổi sau đó. |
| Ngày bắt đầu SX | Chưa chốt mục tiêu cho tới lúc SX bắt đầu; việc đổi ngày bắt đầu cần quy tắc sửa căn cứ và audit. |
| Luôn dùng mức hiện tại | Mục tiêu có thể đổi sau mỗi lần sửa/hủy master. Đây là hành vi một số lookup hiện có; nếu vẫn cần, nên tách rõ chỉ tiêu tham khảo hiện tại với cam kết đã lưu, không ghi đè lịch sử. |

Chưa tự chọn mốc hoặc xử lý hủy master thành hủy chứng từ cũ. Thiếu lịch sử thì ghi thiếu căn cứ, không tự dùng recordedAt hoặc ngày nhập để tạo ngày hiệu lực.

## 3. Một dòng kế hoạch kéo qua hai mức giờ công/SP

Ví dụ dòng Pro Plan dự kiến 1.000 SP từ 02–05/11, mức 0,1 giờ/SP trước 04/11 và 0,2 từ 04/11. Dòng hiện không có số lượng kế hoạch cho từng ngày nên không biết bao nhiêu SP thuộc mỗi mức.

| Lựa chọn | Ảnh hưởng |
| --- | --- |
| KHSX tách dòng và nhập lượng/ngày | Dùng chức năng Tách đơn hiện có, hai dòng giữ cùng Plan ID và định danh riêng trong Chi tiết. Tính tải từng phần theo ngày tương ứng; cần người lập kế hoạch xác định lượng, không tự chia đều. |
| Một căn cứ cho cả dòng theo một mốc đã chọn | Dòng giữ nguyên lượng; cần chốt rõ mốc như ngày bắt đầu/chốt Plan. Giờ kế hoạch có thể khác giờ chuẩn kiếm được từ sản lượng thực tế theo từng ngày. |
| Thêm lượng kế hoạch mỗi ngày | Chính xác hơn cho tải ngày nhưng là thay đổi nhập liệu/kiểm soát rộng hơn; chưa nằm trong quy tắc đã chốt. |

Đề xuất để xem xét: dùng Tách đơn thủ công khi cần chia tải theo hai mức, không tự chia lượng hoặc lấy bình quân. Báo sản lượng thực tế vẫn luôn dùng đúng mức của từng ngày trên phiếu, không phụ thuộc lựa chọn kế hoạch này.

## Điều kiện còn lại trước phát hành

Các lựa chọn trên không cấp quyền merge/triển khai. Còn phải tự kiểm trình duyệt full ONSPA/đúng Worker bằng dữ liệu giả, kiểm script/công thức Sheet trong môi trường được phép và nghiệm thu. Không cập nhật DB/Sheet thật để minh họa các ví dụ này.
