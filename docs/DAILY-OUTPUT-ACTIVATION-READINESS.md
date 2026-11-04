# Bàn giao kiểm chứng và điều kiện kích hoạt báo sản lượng ngày

Đây là checklist chuẩn bị, không phải lệnh chạy hoặc quyền kích hoạt. Source hiện chỉ có driver kích hoạt trong `tests/helpers/activate-prepared-daily-policy.mjs`; chưa có adapter production. Không dùng helper TEST trên DB thật, không tạo marker TEST trên production. Giữ quy trình [PR → kiểm thử → nghiệm thu → merge → phát hành riêng](ONSPA-DEVELOPMENT-WORKFLOW.md).

## Phần adapter đã chuẩn bị độc lập

`scripts/local/production-activation-readiness.mjs` cung cấp `inspectDailyActivation` nội bộ, **chỉ đọc**; chưa được nối vào HTTP, CLI hoặc lúc khởi động. Driver ghi vẫn chỉ ở tests/helpers. Actor/build phải đến từ ngữ cảnh máy chủ đáng tin khi có adapter được duyệt; kết quả không phải quyền ghi hoặc giấy duyệt triển khai.

- Hai SELECT với snapshot hoàn tất: đọc manifest có cap 256 KiB, rồi kiểm đồng thời manifest còn nguyên, nguồn/copy đủ, anchor còn khớp và chưa có policy/activation. Không đọc full workflow, tạo snapshot mới, ghi audit/policy hoặc trả raw payload nhân sự/định mức trong chẩn đoán.
- Từ chối trước DB nếu thiếu quyền Admin toàn cục, sai snapshotId hoặc thiếu sourceId máy chủ. Manifest sai build/ngày GMT+7/capability/cấu trúc lô/budget phải báo chưa đủ điều kiện. Record lỗi hoặc nguồn thay đổi không tự sửa để cho qua.
- `technicalChecksPassed=true` chỉ mô tả lần đọc đó. `mayActivate=false`, `productionActivationAvailable=false`, `requiresAtomicRevalidation=true` luôn giữ nguyên. Kết quả cũ không dùng được thay guard trong transaction; TEST driver vẫn kiểm lại độc lập.
- Các blocker chỉ là mã kỹ thuật, ví dụ `source-changed`, `anchors-changed`, `source-copy-incomplete`, `activation-already-exists`; không bao gồm dữ liệu cá nhân hoặc payload thật. Đã có policy/activation thì cần đọc lại đúng lượt, không ghi đè qua đường preflight.
- TEST tổng hợp preflight → thiếu marker bị chặn → kích hoạt cô lập bằng driver cũ → preflight không còn cho là chưa kích hoạt. Bổ sung race ngay trước SELECT cuối, malformed/staging/oversize/wrong build, qua ngày, nguồn thay sau preflight; so mọi record trước–sau và chặn mọi SQL ngoài SELECT ở inspector.

Đây là phần kiểm tra đầu vào của adapter, **chưa phải adapter ghi production hoàn chỉnh**. Hai SELECT là số truy vấn đã kiểm, không phải chứng nhận độ trễ/tải dữ liệu thật. Không tự tạo đường ghi production để làm đầy checklist khi còn thiếu quyết định, nghiệm thu và quyền triển khai.

## Checkpoint đã kiểm

- `b5c822e6d0e05982217a84d25b4b66e3e77eb312`: [CI 41885732618](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41885732618) đạt 1.750/1.750 trong 288 file, TypeScript và ba build đạt. Không dùng kết quả này thay CI của commit bổ sung sau đó.
- Browser độc lập đúng b5: hộp thoại đầy đủ ở desktop và 390 px; lưu, hủy trước lưu, tải lại và thử lại sau mất phản hồi đạt trên dữ liệu giả. Đây chưa phải nghiệm thu mọi quyền, báo cáo, kho, Sheets hoặc tải production. Không tự cập nhật preview đang dùng.
- Gói b5 có manifest/hash riêng, không DB/FILES/session/dependencies/dist. Các mẫu danh mục JSON đã được duyệt nằm trong source; không phải dump runtime production. Tài khoản/quyền phòng ban của harness chỉ được tạo trong DB giả volatile theo profile hiện có, không chứng nhận quyền từng user thật.

## Các bằng chứng kỹ thuật cần giữ khi chuẩn bị adapter

| Ranh giới | Bằng chứng và tiêu chí |
| --- | --- |
| Chụp nguồn | `production-legacy-snapshot.mjs`: cùng sourceId của build máy chủ, ngày chuyển đổi hợp lệ, nguồn nghiệp vụ chốt nhất quán. Không nhận sourceId do client tự đặt hoặc tạo lịch sử hiệu lực không có chứng cứ. |
| Đối chiếu giá trị | `production-legacy-preservation.test.mjs`, `production-history-artifacts.test.mjs`, các test cutover/payroll: so từng giá trị báo công, giờ, quỹ, ô báo cáo/XLSX, nhãn/Line và raw records; có trường hợp thiếu LSX, thiếu snapshot/định mức và tháng chuyển đổi. Anchor là kết quả quan sát, không xác nhận định mức quá khứ đúng. Thiếu căn cứ phải giữ thiếu, không lấy master mới hoặc 0 thay thế. |
| Chốt lô | `production-legacy-publication.test.mjs`: tối đa 8 record/128 KiB mỗi lô; retry đúng lô; hash, tiến độ và anchor/copy cùng batch. Lỗi batch không để lại tiến độ dở. Nguồn đổi phải chuẩn bị/đối chiếu lại, không chốt dữ liệu trộn. |
| Hoàn tất | Kiểm nguồn và mọi anchor, số lượng/phantom trước khi complete. Chỉ complete không bật policy. Không dùng một cờ complete thay việc xác minh ở thời điểm kích hoạt. |
| Kích hoạt TEST | Cùng build, đúng ngày đã chọn theo GMT+7, đầy đủ capability kể cả prefix tháng chuyển đổi. Kiểm nguồn/manifest/anchor trong batch; cạnh tranh một activation khác không ghi đè. Marker/policy cùng transaction; mất phản hồi đọc lại cùng marker, không sinh lượt mới để ghi lại. |
| Sau kích hoạt | Xóa/tắt/đổi policy không cho quay lại ghi legacy hoặc tính current-only. Không coi đổi cờ là rollback an toàn sau khi đã có phiếu mới/kho/Sheet; cần phương án đối chiếu được duyệt riêng. |
| Quy mô | Scope sản lượng có budget 8 MiB/32 phần cho tổng hai nguồn; publication có cap metadata/lô/anchor. Vượt phải dừng và báo rõ, không cắt bớt lịch sử. Số đo Miniflare không chứng nhận CPU/memory hoặc quy mô thật. |

Các fault-injection bổ sung kiểm ngay trước batch kích hoạt: nguồn có phantom, anchor đổi, manifest đổi trạng thái, một lượt kích hoạt khác đến trước; mọi record chỉ được khác bởi chính lượt cạnh tranh giả. Kiểm batch SQL lỗi rollback cả marker/policy, và mất phản hồi sau commit retry không có batch thứ hai. Không thay thuật toán runtime hoặc quyền để làm các test này đạt.

## Dữ liệu/quyết định phải có trước khi kích hoạt thật

1. Duyên nghiệm thu phạm vi thay đổi, sau đó cho phép merge/phát hành riêng. Ngày chuyển đổi là ngày triển khai sau nghiệm thu đã chốt, cần xác định ngày thực tế lúc phát hành; không lấy ngày fixture hoặc ngày chạy CI làm ngày production.
2. Chốt ba lựa chọn còn mở trong [bảng ví dụ/ảnh hưởng](DAILY-OUTPUT-DECISIONS-TO-REVIEW.md): HR cố ý sửa ngược phần đã bảo toàn; ngày chọn Leadtime cho LSX mới; kế hoạch kéo qua nhiều định mức nhưng thiếu lượng từng ngày. Không tự chốt mặc định. Quy tắc sản lượng thực tế theo ngày và giữ nguyên chia tiền/phụ kho đã chốt, không hỏi lại.
3. Đối chiếu được phép trên dữ liệu thật: manifest nguồn/counts/scope, các giá trị trước–sau, vùng thiếu căn cứ, phiếu đang chờ và trạng thái kho. Không đưa PII, payload thật hoặc bí mật vào log/GitHub/gói QA. Source snapshot không thay backup đầy đủ DB/FILES, cũng không khôi phục được lịch sử chưa từng lưu.
4. Có adapter kích hoạt production được review/test; adapter phải chứng minh các tiêu chí cùng hoặc chặt hơn driver TEST. Chưa có adapter thì không bật policy bằng sửa DB thủ công.
5. Kho/Sheet: chứng minh công thức thực sự loại dòng đã vô hiệu, ID duy nhất toàn cột, di chuyển/sao chép dòng, mất ACK, cạnh tranh xác nhận và thu hồi. Helper lập kế hoạch/Apps Script giả không chứng minh Google đã recalculation. Cần quyền riêng cho thay đổi thật; không yêu cầu gửi secrets qua chat.
6. Kết quả lịch sử và tải của dữ liệu thật phải được kiểm trong phạm vi được phép trước quyết định phát hành. Không stress production. Nếu thiếu căn cứ hoặc vượt cap, ghi chính xác phần bị chặn và giữ dữ liệu gốc; không tự nới budget hoặc bỏ kiểm tra để bật.

## Bàn giao sau một lần chạy được phép

Lưu riêng: SHA source/CI; SHA đang preview và phạm vi browser đã kiểm; thời điểm/ngày GMT+7; snapshotId/sourceId/counts/capabilities và phần thiếu căn cứ; kết quả so raw record/báo cáo trước–sau; trạng thái adapter/policy; dữ liệu/kho/Sheet còn chờ; người nghiệm thu và quyền merge/phát hành. Chỉ ghi định danh và tổng hợp không nhạy cảm trong repository, giữ chứng cứ dữ liệu thật ở nơi được phép.

Nếu kết quả ghi chưa xác nhận, đọc trạng thái đúng snapshot/lượt cũ trước khi thử lại. Không tạo snapshot, intent hoặc khóa mới chỉ vì timeout; không tự sửa/thu hồi phiếu kho thật để kiểm. Khi có source hoặc dữ liệu thay đổi đồng thời, dừng bước phụ thuộc, ghi rõ denied/pending/uncertain và tiếp tục việc độc lập được phép.

## Guard nguồn thiếu bản sao

Fault injection phát hiện guard trước đây chỉ so các bản sao còn tồn tại với live và đếm live; mất một source copy vẫn có thể báo khớp. Regression trước sửa fail (`true !== false`) ngay khi bỏ một copy. Guard chung nay đếm cả quan hệ frozen bằng sourceCount trong cùng SQL, rồi giữ kiểm live count và byte/metadata từng record. Áp dụng cho kiểm nguồn, hoàn tất publication và fence của TEST activation; không thêm lượt đọc full workflow, không sửa dữ liệu thật, không tự dựng lại copy thiếu.

Kiểm bổ sung: missing copy đơn lẻ; live edit vẫn giữ tổng số dòng; finalization giữ staging và không policy; mất copy ngay trước batch activation không để lại marker/policy. Mọi raw record chỉ khác ở chính fault giả đã tiêm. Đây là lỗi kỹ thuật đã tái hiện trên fixture, không có chứng cứ sự cố tương ứng trên production. Các giới hạn quyền/nghiệm thu/adapter ghi ở trên giữ nguyên.
