# Pro Plan: Tách đơn — thiết kế và kiểm chứng 03/11/2026

## Phạm vi đã chốt

Nhánh riêng từ main `39d667ac87ce4c118518129b005f0d477c807b20`. Quy trình: mã GitHub → draft PR → TEST/preview đúng commit → người dùng nghiệm thu → quyết định merge riêng → sau đó mới quyết định cập nhật web chính. Chưa merge, approve, tạo Site/DB hoặc triển khai. Không thay dữ liệu thật, grants, secrets, runtime config hoặc quy tắc FINAL.

Người dùng chọn chỉ tách dòng còn được sửa. Nút Tách đơn đặt cùng StandardToolbar, cần chọn đúng một dòng và quyền Sửa hiện hành. Dòng Đã chốt/Đã chuyển vẫn bị khóa, phải qua quy trình hiện có; không thêm đường mở khóa hoặc thu hồi. Với trạng thái Tạm hoãn/Hủy còn được sửa theo giao diện hiện tại, dòng mới giữ nguyên trạng thái của dòng nguồn, không tự khôi phục thành Dự kiến. Dòng đã liên kết In Transit nhưng trạng thái cũ không khớp cũng bị chặn, không tự ghi đè liên kết.

## Định danh và lưu

- `id` hiện hữu giữ nguyên; dòng mới có ID riêng. `planGroupId` trỏ dòng chính, `groupPlanId` giữ nhãn Plan ID tại lần tách đầu, `splitFromId` lưu dòng nguồn. Các lần đổi Line/ngày/lượng không đổi Plan ID chung của nhóm. Dữ liệu chưa tách giữ cách chuẩn hóa Plan ID cũ.
- Chỉ dòng chính giữ SL đề xuất. Dòng mới để SL kế hoạch trống, KHSX nhập số; không trừ dòng chính, không bắt tổng bằng đề xuất. Lưu ngày/Line khi lượng mới còn trống vẫn là nháp; chốt vẫn cần lượng dương và các điều kiện cũ. Giờ công tính từ lượng riêng × định mức, không từ đề xuất.
- Mã riêng chỉ trong Chi tiết; không thêm cột mã riêng trên bảng chính. Checkbox/ô nhập của các dòng cùng SKU có nhãn truy cập phân biệt bằng vị trí dòng.
- Chống click lặp bằng latch tại UI và revision/CAS tại backend; kế hoạch và audit cùng batch. ID/metadata nhóm không nằm trong whitelist sửa từ client. Dữ liệu trùng SKU cũ không có nhóm hợp lệ vẫn báo xung đột, không tự hợp nhất/xóa.
- Engine cập nhật thông tin đề xuất của dòng chính; giữ các lượng/ngày/Line đã nhập và các dòng con. Chốt/mở/chuyển liên kết theo ID dòng. In Transit và LSX cộng giới hạn theo dòng nguồn trong nhóm tách; các LSX bổ sung vẫn chia sẻ trần của chính dòng đó. Backlog/Capacity thay đúng dòng đã chuyển, không loại các anh em chỉ vì cùng Plan ID. Báo công thiếu ID nguồn/mã LSX không được tự gán cho mọi dòng trong nhóm.

## Tối ưu có kiểm chứng

Tách đơn trả đúng dòng chính và dòng mới cùng audit hiện hành để cập nhật cache, tránh gọi lại toàn bộ tuần/lịch sử. Nguồn thông báo là object chỉ trong bộ nhớ, không gửi server và không dùng cho xác thực: chỉ subscriber của chính component bỏ thông báo của chính lần split; cache chung vẫn bị invalidate và các subscriber/tab khác vẫn nhận thông báo. Cập nhật ngoại lai, focus/poll, lưu/chốt/chuyển khác giữ cơ chế cũ.

Mounted test kiểm sau split chỉ có một full GET ban đầu (không tính GET Capacity), không full GET bổ sung; một announce ngoại lai vẫn tạo GET tiếp theo và hiện lượng mới. Không bỏ xác thực, revision, daily-capacity confirmation hoặc audit.

### Đo local

Node24.19.0, Miniflare local, thư mục DB TEST mới riêng cho mỗi quy mô, dữ liệu giả 100/500 SKU, ba lượt mỗi quy mô. Kế hoạch ban đầu10/đề xuất10, định mức0,01; mỗi lượt tách rồi nhập5, chốt và chuyển dòng mới; có lịch sử/audit tích lũy. Capacity fixture dạng scalar đã xác nhận, không mô phỏng roster/HR phức tạp hoặc nhiều người dùng.

Script tái lập `node scripts/bench/pro-plan-split.mjs`; `--legacy-refresh` mô phỏng thêm full GET sau POST trên cùng mã cuối để cô lập chi phí lượt tải này. Đây là so sánh hai đường cập nhật trên cùng implementation, không gọi nó là benchmark hai bản production. Đã đo bản trước tối ưu riêng: split+kết quả100 dòng366,55ms và500 dòng544,97ms; lần đo đó có tải build/test đồng thời nên không dùng làm kết luận tốc độ chắc chắn.

Bảng dưới là median ms, chạy tuần tự sau khi build/test đã dừng. “Tách+cập nhật” gồm handler, serialize phản hồi POST và tải lại hoặc merge cache giả lập; không gồm HTTP, DOM/render hoặc thời gian click trình duyệt. Số prepare là số lần gọi db.prepare cho luồng split, không phải toàn bộ SQL execution.

| Dòng | Tách+cập nhật có full GET | Tách+cập nhật bằng phản hồi | Prepare cũ/mới | Lưu lượng mới | Tải lại riêng | Chuyển In Transit |
|---:|---:|---:|---:|---:|---:|---:|
| 100 | 345.71 | 241.52 | 35/19 | 295.24 | 200.68 | 234.71 |
| 500 | 647.18 | 340.50 | 35/19 | 414.25 | 391.23 | 360.36 |

Các bước lưu/tải lại/chuyển không được sửa để chạy nhanh hơn. Mẫu chỉ ba lượt có dao động; không có ngưỡng nghiệm thu đã chốt, không suy ra latency production. Audit vẫn chứa snapshot cả tuần nên payload POST split median khoảng88KB/429KB cho100/500 dòng; lượng lịch sử lớn vẫn là giới hạn cần theo dõi. Không nới audit để giảm số đo.

## Kiểm tra và giới hạn

Targeted trước tối ưu99/99; sau tối ưu bộ liên quan126/126 gồm API Plan/In Transit, quyền/receipt audit, backlog, mounted thao tác, cache/session và feedback. Typecheck/build exit0. Sau đó kiểm riêng hai request split đồng thời và Admin:3/3 đạt; kiểm liên kết báo công theo ID nguồn và chặn gộp theo Plan ID nằm trong helper4/4 đạt. Kết quả full CI phải đọc theo đúng commit sau push. Không skip, bỏ file hoặc đổi assertion của nghiệp vụ cũ để xanh.

Kiểm gồm lựa chọn0/1/2 dòng, click lặp, readonly/confirmed, exact Sửa và Admin, revision stale/concurrent, lưu/tải lại, đổi Line/ngày/lượng, tổng nhỏ/lớn hơn đề xuất, giữ Engine, capacity không đếm thiếu/trùng, chuyển riêng từng dòng, mở chốt anh em độc lập, LSX thêm chung đúng trần nguồn và hủy LSX không đổi lệnh anh em. Mọi fixture và benchmark là dữ liệu giả local.

Chưa chạy lint hoặc QA trình duyệt thật/responsive/full-app acceptance. Executor cloud hiện không có công cụ Codespaces/port-forward/browser được hỗ trợ, nên chưa có URL preview mới được kiểm chứng; URL lịch sử không phải bằng chứng nhánh này đang chạy. Cần chạy full ONSPA TEST đúng commit bằng Codespaces Private theo quy trình hiện có, bảo toàn DB/FILES và đánh giá adapter hiện trạng trước khi gửi người dùng. Không dùng localhost, mockup hoặc web trial cũ làm link nghiệm thu. Chưa đủ điều kiện merge chỉ dựa trên targeted tests.

## Rà soát phản hồi đến trễ trước nghiệm thu

Full CI đầu tiên của1e98222d2b67873d20f60454c74afaf180a6dc25/run41602971706 đạt1.522/1.522 test trong250file, không timeout/cancel/skip/todo/thiếu tổng kết; TypeScript và ba build đạt. Đây là kết quả của head trước bản bổ sung dưới đây.

Review sau đó tái hiện bằng mounted regression mới: GET revision1 khởi động trước split, trả về sau POST revision2 thì bảng bị lùi từ hai dòng còn một. DB không mất dữ liệu nhưng UI/cache bị cũ; test trước sửa thất bại1≠2. Không nghiệm thu chỉ dựa trên bộ CI cũ.

Sửa tại Pro Plan: load không áp snapshot revision thấp hơn; cache không lùi revision và chỉ nhận lượt force-read mới nhất; split response không ghi đè snapshot đã tải bằng hoặc mới hơn kết quả mutation. Không chặn refresh ngoại lai hoặc bỏ dữ liệu mới; không đổi backend revision/audit. Regression kiểm cả GET cũ trả sau POST mới, cache được dùng lại ở component thứ hai, và POST cũ trả sau GET ngoại lai có lượng mới80 cùng dòng mới khác. Targeted105/105 đạt, không skip/cancel; typecheck/build exit0. CI của commit bổ sung cần đọc riêng theo head mới nhất. Không cập nhật preview hoặc web chính.
