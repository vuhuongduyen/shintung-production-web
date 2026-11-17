## 17/11/2026 — Tối ưu lượt đọc tổng hợp sau PR35 (đang kiểm)

Chỉ truyền trường pending cần cho tổng hợp lịch sử; đọc các lô độc lập đồng thời; dùng lại đoạn tính giờ giống nhau trong một request. Không lưu cache tính giờ qua request, không ghi lại phiếu/V1/V2/căn cứ thiếu, không đổi quyền/DB/FILES. Local 54/54 hồi quy và 24/24 hợp đồng đạt bằng dữ liệu giả; TypeScript/build đạt. Full CI và kiểm ứng dụng còn chờ; chưa tuyên bố hoàn tất.

## Điều chỉnh giờ công kế hoạch ngày 05/11 — thay quyết định bắt tách trước đó

Theo yêu cầu mới, Plan dùng mức giờ công/SP có hiệu lực tại ngày chốt GMT+7, không theo khoảng ngày SX, mức scalar hoặc thứ tự cập nhật. Bản nháp xem mức ngày hiện tại; server kiểm lại khi chốt, kể cả đi qua nửa đêm. Lưu giá trị/phiên bản/ngày và người/thời điểm chốt; không thay căn cứ dòng đã chốt/chuyển, không gộp dòng tách cũ. Tách đơn vẫn tùy chọn. Thiếu căn cứ giữ null/cảnh báo theo ngoại lệ hiện có; CAS master/policy/Capacity giữ nguyên. Sản lượng thực tế độc lập theo ngày hoàn thành. Các đoạn lịch sử yêu cầu bắt tách/click từng kết quả ở trên là checkpoint cũ đã được quyết định này thay thế.

Kết quả giờ công không còn button; tiêu đề có ghi chú mũi tên đóng mặc định, mở khi cần. Chi tiết thường vẫn có căn cứ đọc. Kiểm targeted/helper/API/mounted và kết quả cuối ghi riêng sau kiểm; không coi đây là nghiệm thu browser hoặc quyền phát hành. Không thay DB/Sheet thật hoặc policy kích hoạt.


## Adapter Codespace Private — TEST riêng (05/11)

Có adapter explicit trong scripts/verification cho đúng một HTTPS origin/cổng5173 của Codespace cũ, chỉ bind loopback và dùng full compiled Worker/DB/R2 volatile giả. Không được app/Worker/Vite/package scripts nhập; không đổi mã triển khai, quyền, cookie/Origin, port visibility, Site/DB hoặc secrets thật. Không dùng session local-owner làm bằng chứng KHSX; USER giả đi qua auth/permission/audit thật của Worker. Xem docs/CODESPACE-PRIVATE-PREVIEW-TEST.md.

Kiểm local mới 5/5 đầu gồm guards Host/Origin/forwarded/duplicate, exact cookie, auth sai/đúng, KHSX/HR403/audit, reload, asset stream/HEAD, chốt Plan, payload lớn và restart isolation. Một đợt bổ sung phát hiện lỗi socket do body không đọc hết khi trả413; đã sửa đóng kết nối lỗi, không nới guard. Fixture thử UPDATE Plan thẳng bị PLAN_CONFLICT đúng CAS; thay bằng marker TEST độc lập để kiểm restart, không sửa trigger hoặc nghiệp vụ. Kiểm rộng/CI kết thúc ghi riêng sau. Đây là NodeHTTP với Host/Origin ngoài được mô phỏng, không browser hoặc real GitHub forwarding. Kết nối CLI hiện invalid-auth, API Codespaces từngForbidden không được tái thử; chưa launch trên Codespace, chưa gửi link hoạt động, chưa chứng minh quyền KHSX production hay Google Sheet.

Kiểm chốt local: **26/26** (5 adapter + 2 HTTP Worker kế thừa + 19 quick-contract có giao với full CI), TypeScript và build đạt. Header HTTPS được mô phỏng bằng HTTP loopback; có Line A ghi lượng25 và replay đúng một phiếu, mọi raw report cũ bất biến. Guard so toàn bộ business rows và auth accounts/sessions/login-limits trước–sau yêu cầu sai, không so timing metadata của D1 như dữ liệu. Source guard từng từ chối literal mật khẩu giả dài trong test; đổi thành giá trị sai sinh từ passphrase ngẫu nhiên lúc chạy, không nới rule. Có một lượt kiểm phụ thuộc build bị chạy song song khi dist đang được xóa/build; không tính lượt thiếu artifact đó là lỗi sản phẩm hoặc bằng chứng đạt. Lượt26/26 trên chạy sau khi build đã hoàn tất. CI head mới ghi riêng khi terminal; không gán CI8cdebaa cho commit QA mới. Chưa có URL/browser Codespace đã xác minh.


## Sửa transport Private theo probe Codespace thực tế (05/11)

Duyên xác nhận peer loopback, Hostlocalhost:5173, forwarded-host đúng domain/forwarded-protohttps; POST Origin bị đổi thành http://localhost:5173, không có original-origin. Bảnb022 vì thế chặn Host rồi Origin; không phải quyền KHSX hoặc dữ liệu sản lượng lỗi. Test bộ header thực tế fail trước sửa; sau sửa9/9 local gồm hai transport, guard âm, no-write, auth/role/audit/reload, Plan và sản lượng/retry đạt. Nhánh proxy chỉ nhận đúng mapping + Origin nội bộ cố định và bắt Sec-Fetch-Site:same-origin cho thao tác ghi/có Origin; thiếu/cross-site/same-site đều403. Giữ nguyên cookie/Origin/body, auth/CAS/audit Worker; không dùng forwarded như danh tính. Direct HTTPS cũ giữ nguyên. Có error code/metadata nhãn cố định không lộ cookie/token và Vary/redirect an toàn.

Chưa đo propagation Sec-Fetch-Site trên đường GitHub từ probe cũ; chưa nghiệm thu browser bản sửa. Không cho bỏ guard khi thiếu header. Bản sửa là TEST-only, giữ cổng Private; cập nhật chỉ checkoutQA riêng, không checkout cũ/production. Kiểm rộng/CI đúng SHA ghi riêng sau khi kết thúc, không dùng kết quả b022 hoặc local thay thế.

- 05/11/2026, PR #7 đang sửa phản hồi QA: khôi phục bảng/nút SX và danh sách Điều chỉnh theo lệnh từ component gốc; thu gọn thanh số lượng và xác nhận; sửa xuất Nhật ký/chi tiết phiếu ngày; giảm SELECT direct-save từ10 xuống5 bằng snapshot/batch CAS. Chi tiết, giới hạn số đo và bước browser/QA còn chờ tại `docs/DAILY-OUTPUT-IMPLEMENTATION-STATUS.md` mục 05/11. Chưa merge/triển khai và chưa coi mounted/build là nghiệm thu giao diện.
- 05/11, bổ sung candidate sau7056664: badge/hạn/ghi chú KHSX và trạng thái mobile theo work-board gốc; export toàn bộ kết quả đã lọc qua metadata, kể cả khi dùng thẻ mobile, giữ quyền/active-scope. Local42/42 và13/13 bổ sung có giao nhau; TypeScript/build/Worker đạt. Chờ CI đúng head và browser QA, không tự cập nhật Site hay mô tả PR bị chặn.

- 05/11, đính chính Xuất SX: Home baseline vẫn tắt exporter cho report-work/production-report/report-review, toolbar không có nút; các test bật riêng chỉ là kiểm metadata/thành phần, không phải nghiệm thu xuất qua app. Lượt ACK đang sửa projection riêng lệnh đã ghi để200/1000 đi cùng Đang SX ngay cả khi refresh chậm/lỗi; giữ report mới hơn, metadata/order revision/lịch sử và các guard cũ. Không bật xuất hoặc triển khai.

## Synthetic Capacity roster (draft PR, 2026-11-11)

- Added an optional, disabled-by-default roster selector for an existing isolated test week/Line. Selection uses an explicit server-owned allowlist, checks employment dates, replaces dormant names as well as HC/OT names, and changes only the unsaved draft until Save.
- Backend keeps existing permissions, version checks, lifecycle, reservations and compare-and-swap writes. An enabled policy rejects creating a week, writes outside its Line, non-synthetic or out-of-date names, unnamed leave, transfers/cleaning, and replacing confirmed or dependency-bearing rosters.
- No Worker/local API route enables the policy. No QA identity, runtime allowlist, seed, integration setting or deployment change is included. Production behavior remains unchanged.
- **Not live acceptance:** QA overlay wiring and desktop/mobile end-to-end overtime/payroll QA are still pending. See `docs/CAPACITY-TEST-ROSTER.md` for activation contract and verification gates. Do not merge/deploy merely because component/unit checks pass.


## Kho: tách kiểm kết nối và bật trigger (16/11/2026, ứng viên PR riêng)

- Base GitHub staging `6e004e4657eee5072c908c36778ca49f4ca3d70a` sau PR #28. Sites MAIN v824 có source khác, không ghi đè source MAIN từ checkout này. Backend bridge/pending correction/withdrawal đã đối chiếu giống nhau; Apps Script đi kèm MAIN còn cũ.
- `ONSPA_kiemTraKetNoi` và tên tương thích `ONSPA_khoiPhucKetNoi` chỉ ping bằng cấu hình đã lưu. Setup không tự bật lịch. Bật trigger là hàm riêng `ONSPA_batTriggerDongBo`; chưa chạy trên Sheet thật. Giữ code xử lý commandId/commandRevision và các guard từ staging, không đưa thay đổi vào dữ liệu hay cấu hình runtime.
- Local: 34/34 ca Apps Script/formula/index/replay, 17/17 ca backend Kho/pending correction/selected confirm, 24/24 quick contracts và TypeScript đạt. Không cần build Worker cho thay đổi Apps Script/tài liệu này. Chưa có CI remote cho commit mới tại thời điểm ghi.
- Bốn điểm kiểm: (1) source/baseline đã đối chiếu, chưa đọc đủ queue/ACK live theo ID; (2) thử cô lập nhập/sửa/hủy, ACK thất lạc/retry và race nhận hàng đạt trong các suite trên, chưa đủ điều kiện merge vì thiếu đối soát live; (3) chưa đồng bộ QA; (4) chưa nghiệm thu hoặc triển khai Apps Script/MAIN.
- Browser MAIN chỉ kiểm mẫu Admin: thấy nút Báo công, tổng số cập nhật sau tải nền và chuyển được trang. Chưa đo mở mới, chưa kiểm Line A/B thật hoặc chứng nhận tốc độ. Apps Script hiện hiển thị 0 trigger cho tài khoản đang xem; không thay trigger.
- Còn mở: phân loại toàn bộ khác biệt source, kiểm riêng quyền/tốc độ Line A/B, đối soát queue/ACK live trước mọi điều kiện khôi phục, rà công thức theo tháng và nghiệm thu trên Sheet TEST đã được phép. Không kết luận sai lệch tồn thật từ việc chỉ đọc một mẫu công thức.


## Cảnh báo đồng bộ Kho (16/11/2026, ứng viên PR riêng)

- Bổ sung cảnh báo đọc thuần vào chuông và màn Nhập kho cho phiếu bridge ONSPA: lỗi/sai mã phiên bản ngay, chờ quyết định/ACK quá 5 phút, hủy thiếu bằng chứng loại tồn. Một phiếu một cảnh báo; không tự ghi/sửa/tính lại tồn.
- Giữ quyền đọc hiện tại; dùng tập phiếu của API chuông đã đọc và refresh màn Kho theo cơ chế chung khi active. Không tăng reader SX; không thêm job hoặc bật trigger. Xem phiếu từ cảnh báo chỉ lọc ID, không chọn hay xác nhận.
- Bốn điểm kiểm: baseline 101 phiếu bridge vừa đối soát → chạy bộ đọc mới có 0 cảnh báo và input bất biến; trước merge có 14/14 ca mục tiêu + 24/24 quick, TypeScript/build đạt; chưa đồng bộ QA; chưa nghiệm thu browser/Sheet TEST/MAIN.
- Giới hạn: cảnh báo trạng thái/ACK không phải kiểm lại công thức tồn trực tiếp trên Sheet. Không bảo đảm phát hiện thao tác sửa tay sau ACK; chưa có giám sát khi web đóng. Chi tiết tại docs/WAREHOUSE-SYNC-ALERTS.md.

## 16/11/2026 — ứng viên sửa tải nền/phân trang SX báo công

Đã tái hiện trên MAIN v826: Line A và Admin có lúc khóa phân trang trong khi tải; Admin hiện lại phân trang và chuyển trang được sau khi hoàn tất. Đã rà cấu hình 30 user (17 có quyền menu), chưa đăng nhập thử từng user. Ứng viên riêng từ staging sau PR #30: cache theo phiên/user/Line/bộ lọc, gộp request focus/poll, tải trước một trang, timeout/retry và không khóa phân trang vì cập nhật nền/lỗi đọc; giảm dữ liệu SKU và bỏ đọc Leadtime không dùng. Không đổi tổng/trạng thái/quyền hoặc dữ liệu thật. Chi tiết và giới hạn: `docs/SX-PAGED-LOADING-2026-11-16.md`. Chưa merge/deploy, chưa nghiệm thu tốc độ bản sửa trên web thật.

## 16/11/2026 — ứng viên giảm thời gian mở SX báo công

Chỉ SX báo công: giảm đọc lặp, giữ snapshot hết TTL khi mở lại để kiểm tra nền. Fixture 126 lệnh: 45 → 17 lượt DB, tổng/dữ liệu lưu giữ nguyên. 37 ca mục tiêu/hồi quy, TypeScript và build đạt. Chưa merge/deploy hoặc nghiệm thu tốc độ end-to-end MAIN. Các menu còn lại giữ nguyên. Chi tiết: docs/SX-FIRST-LOAD-2026-11-16.md.

## 16/11/2026 — ứng viên Tiến độ sản xuất sau PR #32

Tách profile progress, mặc định scoped workflow đang xử lý, loại hoàn thành và HỦY; chỉ đọc lịch sử khi người dùng chọn. Giữ phiếu chờ xác nhận kể cả sản lượng 0. Snapshot active/history riêng, cập nhật nền giữ bảng, timeout có thể thử lại, full detail theo yêu cầu. SQL bỏ bản sao audit nhưng giữ trường reviewSnapshot. Xem docs/PROGRESS-LOAD-2026-11-16.md. Chưa merge/triển khai hoặc nghiệm thu tốc độ trên web thật.

Kiểm chứng ứng viên: 55 test mục tiêu/hồi quy, TypeScript và build đạt; fixture 59→37 lượt DB, 19.064.014→23.209 byte. Chưa coi số liệu test là thời gian người dùng chờ.
