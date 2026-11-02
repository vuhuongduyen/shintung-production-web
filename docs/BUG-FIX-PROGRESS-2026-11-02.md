# Tiến độ sửa lỗi sau bàn giao 02/11/2026

Người dùng đã cho tiếp tục sửa và kiểm thử trên cloud. Chỉ cập nhật nhánh PR #4; không merge, triển khai web hoặc cập nhật preview runtime. Báo cáo `BUG-HANDOFF-2026-11-02.md` vẫn là bằng chứng lịch sử của 102 mục TAP thất bại, không phải kết quả của bản sửa này.

## Nhóm đã tái hiện và sửa

| Nhóm | Trước sửa | Sửa và kiểm chứng |
|---|---|---|
| Thông báo thao tác | Hai test lifecycle đòi tiêu đề viết hoa/câu hướng dẫn cũ; test role tìm chuỗi tĩnh dù source dùng error→alert, success→status. | Giữ kiểm tra ba ngôn ngữ, nội dung hướng dẫn quyền/Line, đóng/focus. Kiểm cả hai nhánh role thật thay regex tĩnh. Không thay lời thông báo hiện hành chỉ để khớp test. |
| Giải thích nút bị khóa | Kiểm tra toàn bộ component phát hiện các nút thiếu lý do hoặc nút native bị disabled không có đường giải thích. | Bổ sung lý do đúng điều kiện busy/quyền/đã hủy/chưa chọn; dùng FeedbackActionButton hiện hữu cho ba nút native. Giữ nguyên điều kiện disabled, callback và type. Kiểm thử mounted của component dùng chung giữ yêu cầu không gọi mutation khi bị khóa, không submit lặp và hoàn trả focus. |
| Giới hạn FINAL | Helper kiểm giới hạn đạt 6 test, nhưng test tích hợp không nhận rejection khi PACKING=500 và FINAL=1.000. Hai đường live/backfill không gọi helper. | Gọi helper hiện hữu trước bước ghi khi complete hoặc nhập bù có xuất trạm. Quy tắc FINAL không vượt công đoạn trước đã được xác nhận. Kiểm preview/save/live bị từ chối giữ nguyên toàn bộ app_records; xuất 500 vẫn hợp lệ. Không sửa importer ERP, ngoại lệ overlap, dữ liệu lịch sử hoặc công thức giờ. |

Bốn test thông báo và một test tích hợp FINAL từng lỗi ở baseline là phạm vi sửa lần này. Không gọi đây là năm lỗi sản phẩm độc lập. Không xóa/skip bài test hoặc nới giới hạn nghiệp vụ.

## Xác minh

- `npm run typecheck`: đạt.
- `npm run build`: đạt; cảnh báo build hiện hữu không được coi là nghiệm thu UI.
- Kiểm nhóm: action-feedback-lifecycle, global-action-feedback, action-feedback-mounted, production-final-limit, production-partial-exit, production-backfill, production-erp-stage. Kết quả local: **66 pass / 0 fail / 0 cancelled / 0 skipped**, 7 file, 99,2 giây. CI exact head ghi tại PR sau khi hoàn tất.
- Dữ liệu kiểm thử là fixture local tạm; không dùng DB/FILES production hoặc xác nhận báo công thật.
- Rà React: không thêm hooks, fetch, dependency hoặc thay state của nghiệp vụ; giữ callback và disabled guard, bổ sung khả năng giải thích của component chung. Chưa kiểm browser thật, lint hoặc cập nhật link preview.
- Các tài liệu thiết kế tháng 9 và FUNCTION_STATUS được AGENTS nhắc tới không có trong snapshot đã lọc. Không tự phục dựng nội dung; sửa FINAL dựa vào yêu cầu mới đã xác nhận, helper và regression hiện hữu.

## Còn lại

Các nhóm audit denied/quyền, ba sai khác Capacity, selector/tìm kiếm/điều phối và các lỗi khác trong bàn giao chưa mặc nhiên được giải quyết. Không thay quyền, bỏ audit hoặc đổi công thức để làm xanh. Full CI sau commit này dùng để đo ảnh hưởng và residual của các bản sửa cụ thể; không rerun y nguyên. PR vẫn draft, cần full-app preview đúng SHA và nghiệm thu trước khi xem xét merge riêng.

## CI đầu và fixture theo giới hạn FINAL

[Run 41426110730](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41426110730), head `35fced946f10b27d7edcd028be28ae4728f4fa14`: TypeScript và ba build đạt; 246 file chạy, 1.386 pass / 98 fail, 0 cancelled/skipped/timeout và không thiếu thống kê cuối. Đối chiếu tên test: hết đúng 5 ca lỗi mục tiêu, phát sinh một ca trong `production-stage-live.test.mjs`.

Nguyên nhân ca mới đã xác minh: fixture O2 nhập CUT nhưng chưa xuất CUT rồi kỳ vọng FINAL 100 thành công để kiểm giờ làm thứ Bảy. Guard trả đúng “CUT đã xuất 0”. Bổ sung bước xuất CUT 100 qua API workflow thật vào chiều thứ Sáu, kiểm `stageQuantity=100` và `reportedQuantity=0`, rồi giữ nguyên toàn bộ assertion giờ công, retry, quyền, kho và Final của ca cũ. Không sửa source/guard hoặc bỏ assertion. Đây là sửa dữ liệu giả để ca overtime có đủ tiền đề đã được yêu cầu, không phải ngoại lệ mới cho FINAL.

Kiểm lại riêng `production-stage-live` và `production-final-limit`: **11 pass / 0 fail / 0 cancelled / 0 skipped**, 27,9 giây. Không đổi mã ứng dụng kể từ typecheck/build đã đạt. Push fixture nhằm xác nhận residual sau sửa có nguyên nhân rõ; không rerun y nguyên.

## Nhóm tiếp theo: thời điểm FINAL, tìm kiếm và điều phối

Mốc trước nhóm này là `5b3270446148042efb2aa003da790f7dc94c7bbb`, CI 41427129289: 1.387 pass / 97 fail, 246 file, không timeout/cancel/skip; TypeScript và build đạt.

- **FINAL nhập bù:** tái hiện qua `mutateProductionWorkflow` với Miniflare giả: PACKING 500 lúc 08:30, FINAL 500 lúc 11:00, thêm FINAL 100 lúc 09:00. Trước sửa cả preview và save nhận sai; sau sửa kiểm lũy kế tại thời điểm nhập và mọi lần FINAL sau đó, cả hai từ chối và toàn bộ app_records giữ nguyên. PACKING bổ sung trước FINAL sau vẫn cho phép; PACKING sau mốc vi phạm không được bù ngược. Test thay thế report loại chính report cũ khỏi timeline chỉ kiểm helper, chưa phải nghiệm thu API chỉnh sửa. Không tuyên bố đã kiểm HTTP/browser hay toàn bộ đường sửa/hủy.
- **Tìm kiếm:** 22 ca lỗi trước sửa chủ yếu do selector theo thứ tự cột cũ, đọc cả bảng đang hidden, đếm thiếu lần tải bổ sung workflow/standards và fixture thiếu attendance. Đối chiếu các regression `actual-schedule-lookup` và `production-client-loading` của snapshot để cập nhật harness; giữ kiểm Enter, dropdown đang mở, bộ lọc tháng/Line, số lần fetch và bảo toàn bản nháp. Kết quả nhóm mở rộng 88/90 đạt. Hai ca Plan ID rỗng vẫn lỗi: test muốn bỏ lọc, helper hiện chặn nội dung rỗng; chưa đủ bằng chứng chọn hợp đồng nên chưa đổi source/assertion.
- **Điều phối:** giữ workspace trong lúc Capacity đang tải để không mất khung; số chờ loại đề nghị hết hạn/ngoài nhóm. Nối helper chuẩn hóa thông báo 403 hiện hữu vào cache thật, giữ status và xóa dữ liệu giữ lại khi bị từ chối. Không thay quyền backend. Harness dùng portal thật, chọn phân bổ trước hủy, hết TTL mới yêu cầu refresh, tách cache giữa các fixture và kiểm trạng thái/audit metadata trong lịch sử. Bộ 4 file trước sửa 25 pass / 14 fail; các ca này được kiểm lại trong nhóm cuối.
- **Cache workflow:** giữ kiểm light không phục vụ full, full mới có thể phục vụ work; bổ sung xác minh mutation/session invalidation và force fetch thay giả định mọi profile phải có object khác nhau.

Kiểm local cuối nhóm: **102 pass / 0 fail / 0 cancelled / 0 skipped**, 9 file (FINAL, compact/queue/stable/workspace allocation, profile cache, Capacity retained lifecycle, configured flow, storage), 174,2 giây. Nhóm tìm kiếm riêng: **88 pass / 2 fail**, 5 file. Typecheck và build đạt. Không chạy lại toàn bộ local; CI sau push đo residual của nhóm thay đổi cụ thể này. Không xóa/skip test, không sửa công thức Capacity hoặc miễn audit. Chưa chạy lint/browser và chưa cập nhật preview. Kết quả CI đúng commit được ghi tại PR khi terminal, không đồng nhất local pass với CI pass.
