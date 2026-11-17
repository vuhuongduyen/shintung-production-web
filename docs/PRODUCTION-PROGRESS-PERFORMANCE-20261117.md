# Tiến độ sản xuất: giữ trạng thái và giảm đọc lặp — 17/11/2026

## Phạm vi và nguồn

- Nhánh riêng `fix/production-progress-fast-restore-20261117`, từ `staging` 692bcc65ac2b46078ac2dcb518467dadb2a27b14. Không merge/publish trong công việc này.
- MAIN lúc kiểm: v833, source dfbd11873f01c2f9e9f8f7bc8a28acfed9570200, deployment succeeded. Bản v834 / 2555f03d258f106a1504e8fba0d457cc21c2a8e3 đã lưu, chưa có deployment tại lần đối chiếu cuối.
- Bốn tệp liên quan production-management, production-progress-review, production-progress-read và production-display-store của v833 trùng staging. production-workflow khác hai đoạn tối ưu stageHourSegments đã có trong PR36; thay đổi này không sửa hai đoạn đó.
- PR đang mở khi bắt đầu: #36 (cache/session/tải nền), #13 (Leadtime/Engine), #8 (CI). PR36 head kiểm tích hợp: b5a80fa22f15af25085e6a449b5293fe654b0953.

## Thay đổi

Menu giữ phạm vi Đang xử lý/Tất cả/Hoàn thành, bộ lọc đang nhập và đã áp dụng, chế độ tra cứu và trang đang xem trong display store hiện có, vốn được kích hoạt theo tài khoản/quyền/Line đã xác minh. Khôi phục snapshot hiển thị không cấp quyền xác nhận; phản hồi 401/403 vẫn loại dữ liệu. Không giữ phiếu đã chọn, hộp thoại hoặc bản nháp nghiệp vụ. Mỗi lần mở/kích hoạt Tiến độ yêu cầu dữ liệu mới ngay, kể cả cache chưa hết 30 giây; các lượt tải đồng thời vẫn dùng chung request, tab ẩn không tự tải. Tải nền thành công giữ trang/bộ lọc; lỗi giữ bảng đã tải và cho Thử lại.

Đọc progress toàn bộ tái sử dụng ba tập report/event/history đã đọc trong cùng request cho In Transit. Không thêm cache máy chủ xuyên request; phân trang/giới hạn byte không đổi. Active-order membership dùng Set theo đúng thứ tự định danh transitId → LSX/orderCode/mo → Plan (loại Plan tách), giữ pending 0 sản phẩm, lịch sử chờ đối chiếu và giới hạn Line. Bỏ tính nhóm tuần đã lưu trữ khi menu đang dùng phạm vi do máy chủ xác định.

Không đổi schema/migration, D1/R2, quyền, route ghi, phiếu hoặc căn cứ lịch sử. Không tạo Site, không ghi trên MAIN.

## Phối hợp PR36

Tệp mã chung duy nhất là scripts/local/production-workflow.mjs: nhánh này sửa điều kiện productionReads; PR36 sửa hai đoạn stageHourSegments khác vị trí. Đã áp dụng delta vào checkout kiểm thử riêng tại head PR36, không xung đột. docs/FUNCTION_STATUS.md được bổ sung cuối tệp; PR36 bổ sung đầu tệp. Không ghi lên nhánh PR36 và không đưa commit PR36 vào nhánh này.

Khôi phục route/tab sau đăng nhập lại và việc giữ snapshot khi chủ động đăng xuất thuộc PR36. Nhánh này bổ sung trạng thái riêng của Tiến độ trên cơ chế đó; không tuyên bố riêng nhánh này khắc phục toàn bộ đăng xuất/đăng nhập. Khi được phép phát hành: hoàn tất PR36 trước; đọc lại staging/PR/MAIN, áp dụng delta của PR này lên đúng bản mới, chạy kiểm lại rồi chỉ triển khai một lượt sau khi lượt kia kết thúc. Không thay nguyên tệp MAIN bằng tệp staging.

## Bằng chứng kiểm thử

- 38 ca liên quan đạt trên nhánh riêng (36 ca trong lượt tổng hợp và 2 ca tra cứu/tải ngay bổ sung); 24/24 hợp đồng CI; TypeScript và build đạt.
- Mẫu đọc progress toàn bộ: trước 18, sau 12 lượt DB; riêng report/event/history mỗi nhóm từ 4 xuống 2 (metadata + payload). Test hồi quy mới thất bại đúng assertion 4 != 2 trên baseline staging, đạt trên bản sửa. Không suy ra số giây hoặc p95 production từ mẫu này.
- Parity 1.200 lệnh / 900 phiếu so thuật toán cũ: trùng kết quả cho toàn bộ/Line A/Line B, gồm code Unicode, thứ tự định danh, Plan tách, pending 0, phiếu hủy/void và orphan.
- API so tổng lượng đã duyệt/chờ, mốc thời gian, giờ HC/TC, dấu vân tay xác nhận; records trước/sau không đổi. Các ca workspace giữ căn cứ V1/V2/thiếu căn cứ và detail đầy đủ vẫn đạt.
- Mounted: giữ trang 2 khi mở lại và khi response bị trì hoãn; lỗi 503 giữ bảng; thử lại cập nhật dữ liệu mà không đổi trang; khôi phục đúng scope all; đổi quyền/Line không giữ bảng cũ; 401/403 loại snapshot; tra cứu và trang giữ lại, chi tiết/phiếu đã chọn không giữ.
- Trình duyệt thật, fixture local 45 lệnh giả lập, mạng giả lập chậm 1,8 giây: chọn trang 2 → đóng/mở lại vẫn hiện dòng 21–40 với dữ liệu lần 1; response mới cập nhật lần 2 tại trang 2; reload trình duyệt khôi phục dòng 21–40 và snapshot lần 2 trước response mới. Đây là kiểm cơ chế hiển thị, không đo API MAIN.
- Bản ghép cục bộ trên PR36: 36/36 ca progress/cache/workspace/summary/batch/stage-hour đạt; TypeScript và build đạt. Không merge nhánh remote.

## Đối chiếu sau khi mở PR

PR36 đã merge vào staging 2cc01293d70c4b77bf065e8d54814947608d7ea3; MAIN v834 đã triển khai thành công từ chat kia. PR37 vẫn nháp, không merge/triển khai. Bộ kiểm tải ngay tái hiện trước sửa chỉ có 1 request khi mở lại cache còn mới, sau sửa có request thứ 2 ngay; nhấn Cập nhật khi đang tải không tạo request thứ 3. Nhóm 31 ca client/profile/mounted và TypeScript/build đạt sau sửa này.

## Chưa nghiệm thu

Chưa triển khai bản sửa; chưa đo tải nền thật sau sửa trên MAIN, chưa kiểm đăng nhập thật Line A/B hoặc đối chiếu toàn bộ phiếu thật sau phát hành. Browser fixture không thay cho QA toàn ứng dụng/ba ngôn ngữ/mobile. Full GitHub CI của PR riêng cần theo dõi đúng head. Không coi tốc độ đã đạt yêu cầu cuối cùng chỉ vì test/build xanh.
