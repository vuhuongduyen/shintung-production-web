# Trạng thái chức năng đang thay đổi

Báo sản lượng thành phẩm theo ngày đang ở nhánh phát triển riêng, chưa merge/triển khai. Chi tiết source, các kiểm thử, hiệu năng và phần còn chặn nghiệm thu ở [DAILY-OUTPUT-IMPLEMENTATION-STATUS.md](DAILY-OUTPUT-IMPLEMENTATION-STATUS.md).

Luồng mới được khóa mặc định nếu chưa có policy/mốc triển khai được duyệt. Lịch sử/công thức phụ kho và chia tiền cũ được giữ; chưa tuyên bố hoàn tất bảo toàn ngày hiệu lực toàn web. Không coi persisted synthetic TEST hoặc mounted JSDOM là đã nghiệm thu trình duyệt/production.

Source đã có luồng sửa/hủy trước Kho nhận và thu hồi sau Kho nhận, kèm queue/CAS/ACK và giữ lịch sử. Trước nhận cần phiếu gốc đã xuất và kết nối Kho đang hoạt động; chưa kiểm Google Sheets/browser thật hoặc triển khai script/công thức. Publish/activation snapshot và ngày hiệu lực toàn web vẫn đang hoàn thiện, không coi CI xanh là sẵn sàng phát hành.

Các chức năng không thuộc thay đổi này chưa được tái đánh giá toàn diện trong tài liệu này.
