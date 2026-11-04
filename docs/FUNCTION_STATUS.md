# Trạng thái chức năng đang thay đổi

Báo sản lượng thành phẩm theo ngày đang ở nhánh phát triển riêng, chưa merge/triển khai. Chi tiết source, các kiểm thử, hiệu năng và phần còn chặn nghiệm thu ở [DAILY-OUTPUT-IMPLEMENTATION-STATUS.md](DAILY-OUTPUT-IMPLEMENTATION-STATUS.md).

Luồng mới được khóa mặc định nếu chưa có policy/mốc triển khai được duyệt. Lịch sử/công thức phụ kho và chia tiền cũ được giữ; chưa tuyên bố hoàn tất bảo toàn ngày hiệu lực toàn web. Không coi persisted synthetic TEST hoặc mounted JSDOM là đã nghiệm thu trình duyệt/production.

Source đã có luồng sửa/hủy trước Kho nhận và thu hồi sau Kho nhận, kèm queue/CAS/ACK và giữ lịch sử. Trước nhận cần phiếu gốc đã xuất và kết nối Kho đang hoạt động; chưa kiểm Google Sheets/browser thật hoặc triển khai script/công thức. Đã có helper chốt snapshot theo lô và driver kích hoạt chỉ trong TEST, giữ mốc để policy lỗi không mở lại legacy. Chưa có adapter kích hoạt production; ngày hiệu lực toàn web và QA thật vẫn đang hoàn thiện. Không coi CI xanh là sẵn sàng phát hành.

Các chức năng không thuộc thay đổi này chưa được tái đánh giá toàn diện trong tài liệu này.

Checkpoint publication `2c4ecf8` đã đạt CI 1.699/1.699 (279 file). Source bổ sung tiếp hàng rào phiếu kho quản lý bởi sản lượng ngày: không sửa vòng qua API chung, thu hồi/ACK đúng Sheet gốc, loại phiếu chờ đối soát khỏi xác nhận và bỏ preview stale. Snapshot công đoạn legacy đã được kiểm khi danh mục SKU đổi. Kiểm local và CI của từng checkpoint được tách trong tài liệu triển khai; chưa nghiệm thu browser/Sheet thật, chưa đủ phát hành.

Checkpoint `6a84ffd` đạt CI 1.708/1.708 (281 file). Nhóm đang bổ sung giữ giờ trước ngày cutover ngay trong tháng đó, còn phần sau mốc tiếp tục cập nhật; có đối chiếu HR/lịch và chặn tiền khi sửa ngược cần quyết định, không khóa quyền lưu HR. Ngưng làm việc có ngày rõ sau mốc vẫn dùng công thức hiện có. Mốc cũ thiếu capability tháng cutover không đủ bật policy mới. Đây không phải cơ chế tự chốt mọi tháng hoặc xác nhận toàn web đã có ngày hiệu lực đầy đủ; xem kết quả từng checkpoint và các giới hạn trong tài liệu triển khai.

Checkpoint tháng cutover `a2274d9` đạt CI 1.722/1.722 (283 file). Rà BOM tìm thêm projection dựng lịch sử lấy nhầm đơn vị hiện tại và mẫu số/hao hụt mới; source đã tách căn cứ bản trước duy nhất, thiếu thì báo thiếu thay vì bịa. Kiểm cả SKU thứ hai của phiếu hàng loạt, nhiều mốc ngưng và thứ tự ngày qua tháng; không thay live-source lookup, ghi dữ liệu hoặc quyền. Nhóm BOM local 28/28, TypeScript/build đạt; CI head mới và browser được tách riêng. Chưa đủ nghiệm thu toàn web/production.

Checkpoint BOM `56e6b0c` đạt CI 1.731/1.731 (284 file). Phát hiện và sửa chuyển mode trong cùng workspace vẫn giữ profile work khi vào Payroll: màn cần full nay chờ đúng bản có anchor, lỗi cho thử lại và không fallback current standard từ dữ liệu gọn. Mounted JSDOM 4/4 kiểm cả phản hồi trễ và dùng cache full không fetch lặp; không phải browser QA. Công thức, API và quyền không đổi; xem trạng thái CI head cuối trong PR/tài liệu triển khai.

Kiểm tiếp giữ cảnh báo phiếu legacy đã xác nhận thiếu ngày khi LSX rời đầu vào hoặc đổi Line, không tự mở tính tiền và không bịa ngày. Nhóm liên quan 39/39 local đạt. Đã chuẩn bị harness full Worker/assets loopback với DB/FILES/session giả volatile và auth bình thường để workspace Chromium tự QA; HTTP smoke đạt không đồng nghĩa browser đã nghiệm thu. Các lựa chọn HR/Leadtime/kế hoạch có ví dụ tại DAILY-OUTPUT-DECISIONS-TO-REVIEW.md; không tự chốt hoặc phát hành.
