# Pro Plan: thông báo không đẩy bảng — 04/11/2026

Yêu cầu nghiệm thu: các dải cảnh báo hiện/mất dưới toolbar làm giao diện nhảy; giữ cảnh báo ảnh hưởng quyết định, bỏ thông báo thực sự thừa. Làm trên PR #5, base2deb2a180ea82d7228b5e4871932f4239c8c420e. Chưa cập nhật preview đang dùng, merge hoặc triển khai web chính.

## Thay đổi

Hai cảnh báo về kiểm tải theo ngày và Capacity chưa được đồng ý chuyển vào nút cảnh báo nhỏ trên toolbar. Slot có kích thước cố định156×36px, cao44px ở màn hình hẹp; khi không có nội dung, nút ẩn và không nhận focus, slot giữ chỗ để toolbar không đổi cách xuống hàng. Không giữ một dải trống trên bảng. Khung chi tiết mở theo yêu cầu qua portal ngoài luồng bố cục, tự giới hạn theo viewport và có cuộn riêng, không có animation dịch chuyển.

Giữ nội dung thiếu lịch/giờ công của lần lưu gần nhất, cảnh báo thay đổi căn cứ Capacity của kế hoạch đã chốt (phiên bản/giờ cũ-mới và chênh lệch), lỗi đọc dữ liệu và lỗi lưu kèm Thử lưu lại. Cảnh báo Capacity chưa đồng ý chỉ áp dụng cho dòng Dự kiến có Line, là dòng có thể chốt mới; không nhắc khi danh sách chỉ còn Hủy/Tạm hoãn/Đã chuyển. Không tự xóa cảnh báo quan trọng theo timeout. Đổi tuần xóa ghi chú kiểm tải của tuần cũ.

Bỏ dải “đang xử lý” lặp lại trạng thái toolbar, dải “đã tự lưu” không cần thiết. Chờ/đang tự lưu vẫn có trạng thái nhỏ tại cùng slot; lỗi lưu vẫn tồn tại để người dùng thử lại. Thông báo kết quả thao tác vốn đã nổi và hộp xác nhận vượt tải theo ngày được giữ. Không đổi backend, quyền, điều kiện chốt, công thức, dữ liệu hay audit. View tracking giữ cảnh báo lỗi dữ liệu cũ của nó.

## Accessibility và kiểm thử

Nút native có nhãn/expanded/controls; thông báo số lượng qua live region polite. Panel có tên truy cập, close, Escape, click/focus ngoài để đóng, không trap focus; đóng bằng nút trả focus về trigger. Nếu toàn bộ thông báo biến mất khi đang mở, không để focus trên nút ẩn. Đổi tuần hoặc workspace inactive đóng panel. Retry không tự chạy khi cảnh báo xuất hiện/mở panel.

- Unit/mounted component4/4 đạt: node slot/table và thứ tự sibling giữ nguyên khi thông báo thêm/bớt; không có banner dài trong normal flow; portal; focus, Escape, outside, context/inactive, retry.
- Nhóm hồi quy53/53 và nhóm kiểm guard36/36 đạt (có ca trùng, không cộng thành số test duy nhất), gồm chốt/decline xác nhận quá tải, exact Sửa/Admin và partial transfer. Integration kiểm Capacity warning hết sau dữ liệu xác nhận, không tạo/xóa sibling banner; chỉ dòng Hủy không hiện nhắc chốt mới. Harness hook cũ thêm đúng boundary component hiển thị, không bỏ assertion nghiệp vụ; component thật kiểm riêng.
- Typecheck/build exit0. Backend không đổi; CI đúng commit sau push phải đọc riêng.

Các kiểm DOM/CSS trên xác minh cấu trúc và ràng buộc kích thước, **không phải số đo pixel trình duyệt**.

## Browser QA chưa hoàn tất — chưa gửi link nghiệm thu

Đã thử Chromium154 local với Pro Plan thật và handler thật trên DB Miniflare mới chỉ chứa dữ liệu giả; không dùng DB/FILES đang có hoặc Site. Lượt harness đầu vướng cache React dùng chung, đã tách cache. Sau đó CLI browser không xuất được DOM/screenshot, kể cả trang HTML tối giản; chưa thu được kết quả đo vị trí bảng ở1440/390/360. Một lượt test đồng thời bị dừng do tài nguyên; khi chạy riêng, component4/4 đạt. Không coi các lần khởi động browser là QA đạt.

Đã dừng harness QA riêng. Preview Duyên đang dùng không bị đổi source, restart, thay cổng hay dữ liệu. Chưa gửi URL test mới. Cần kiểm bằng phiên browser được hỗ trợ trước nghiệm thu: tách dòng, sửa SL và chờ autosave, cho hai cảnh báo xuất hiện rồi hết, mở/đóng panel bằng chuột/bàn phím, so sánh vị trí bảng/độ rộng cột/scroll trước-sau ởdesktop và mobile, kiểm chữ/nút/scroll dễ đọc. Chỉ cập nhật preview khi Duyên xác nhận sẵn sàng; không merge/deploy.

## Kiểm CI và nút giữ chỗ

CI12726ac877438c7d394fc4cdc25fc969005acfaa/run41755976858 hoàn tất:1.528 đạt/1 thất bại/1.529 test trong251file; không timeout/cancel/skip/todo/thiếu tổng kết. TypeScript và ba build đạt. Lỗi duy nhất: quy chuẩn native disabled button trong global-action-feedback yêu cầu giải thích nhưng nút giữ chỗ rỗng đang dùng disabled.

Nút này vốn ẩn hoàn toàn, aria-hidden và tabIndex=-1; disabled không cần thiết và không có một thao tác “bị khóa” nào để giải thích. Bỏ thuộc tính đó, giữ nguyên ẩn/focus và thêm guard onOpenChange chỉ cho mở khi workspace active và có thông báo. Test click chương trình vào placeholder rỗng, sau đó thêm cảnh báo, kiểm panel vẫn đóng; không có bất kỳ hành động lưu nào. Không sửa/miễn quy chuẩn test chung. Unit component+global feedback12/12 đạt, typecheck/build exit0. CI của commit bổ sung đọc riêng; browser QA vẫn chưa hoàn tất, không gửi link nghiệm thu.
