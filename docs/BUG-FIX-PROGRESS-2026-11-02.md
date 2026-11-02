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
