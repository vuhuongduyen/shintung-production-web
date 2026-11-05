# QA full ONSPA trên loopback, dữ liệu giả

Harness `scripts/verification/daily-output-loopback.mjs` chỉ là công cụ QA được gọi thủ công; không được Worker/Vite runtime nhập và không thay cấu hình chạy web. Nó dùng **Worker đầy đủ trong dist/server và assets dist/client của chính source đã build**, không sao chép giao diện hoặc giả API UI.

## Chuẩn bị

1. Kiểm SHA của source và manifest gói, không dùng build còn sót từ commit khác. Dùng Node 24, dependencies theo package-lock.json. Không đem DB/FILES, .env, cookies hoặc mật khẩu thật sang môi trường QA.
2. `npm run typecheck` và `npm run build` tại checkout/gói đúng SHA. Không dùng cấu hình/binding cloud. Harness kiểm config/local-test.json và từ chối biến môi trường LIVE theo guard của repo.
3. Chạy `node --test tests/daily-output-loopback-qa.test.mjs` để kiểm Worker/assets/auth/fixture trước browser. Đây là test HTTP thật qua loopback trên Miniflare, chưa phải browser.
4. Chạy `node scripts/verification/daily-output-loopback.mjs --synthetic-loopback 5180`. Chỉ bind 127.0.0.1, không forwarding/public. Mỗi lần chạy có DB/R2 **mới, không persistence**, migrate và seed tường minh chỉ trên DB đó; không reset .local-data hoặc đọc DB có sẵn. Tắt tiến trình là bỏ fixture đó.

## Tài khoản và dữ liệu giả

- QA_ADMIN, QA_HR, QA_QLSX, QA_KHO; mật khẩu giả dùng chung cho lần chạy được tạo ngẫu nhiên và in trong console khi khởi động; chỉ có giá trị trong DB volatile đó, không lưu vào gói/source và không có giá trị trên web thật. Có LINE_A dùng nút Line qua API quick-line hiện hành.
- Đăng nhập bằng **luồng password/session bình thường** của Worker; không inject Admin, sửa cookie Secure hoặc bỏ kiểm Origin/quyền. Trước đăng nhập /api/auth/session phải authenticated=false. Nếu browser không nhận __Host cookie trên HTTP loopback thì ghi blocker; không gỡ Secure hoặc đổi code auth. Có thể dùng localhost trusted loopback của browser được hỗ trợ; không xuất session thật.
- Nhân viên dùng ID SYNTHETIC; một nhãn tên lấy từ danh sách phụ kho cố định có sẵn trong source để thử quy tắc đó, không phải bản sao hồ sơ thật. Lịch giả tháng 11/2026 có Line A/B.
- SYNTHETIC-DAILY-A: lệnh 1.000, phiếu ngày 02/11 đã duyệt 200, ngày 03/11 đang chờ 300; mức 0,1/0,2 theo hai ngày. SYNTHETIC-SIBLING cùng Plan ID nhưng độc lập; SYNTHETIC-B thuộc Line B.
- SYNTHETIC-LEGACY-LSX/report ngày 30/10 chỉ để kiểm lịch sử mô hình cũ. Policy/anchor bật **chỉ trong fixture**, không là adapter kích hoạt production hoặc chứng nhận quy trình chốt snapshot production.
- Source build giữ nguyên các JSON tương thích nghiệp vụ đã được duyệt trong repo. Harness không nhập/export dữ liệu runtime production và không tuyên bố mọi màn danh mục chỉ có dữ liệu SYNTHETIC.

## Cách kiểm browser và giới hạn

Browser phải chặn mọi request ngoài origin loopback trước điều hướng; không cho tải Google/Sheet/production/CDN trong QA. Worker outboundService cũng trả 503 cho mọi external fetch, cf=false, không có credential/binding remote. Không mở URL web thật trong cùng quy trình QA.

Kiểm đúng full shell/menu: SX mở Báo công không có công đoạn/giờ NV, ngày giờ mặc định GMT+7 được sửa; lưu phát sinh và lũy kế; nhiều LSX chung Plan ID không lẫn; QLSX chọn/xác nhận; Nhật ký/Điều chỉnh; đổi work sang Payroll khi full chậm/lỗi; HR nghỉ và QLSX phụ kho theo quyền; desktop/mobile và vị trí bảng/overlay. Theo dõi request, lỗi JS, response status và DB giả trước–sau, không chỉ chụp ảnh.

Sửa phiếu đã liên kết kho, thu hồi sau nhận và ACK/công thức tồn cần môi trường Sheet giả/được phép riêng. Không có Sheet thật hoặc giả bridge luôn thành công trong harness này; outbound bị chặn. Không coi lỗi kết nối đó là bằng chứng thao tác kho thành công. CI/HTTP smoke không thay browser acceptance. Không gửi link cho Duyên chỉ vì server chạy, và loopback này không phải URL truy cập từ máy Duyên.

## Bổ sung quyền của tài khoản thử

Ở checkpoint 5783408, fixture có login/session và tên bộ phận nhưng chưa seed department_permissions, nên tài khoản USER HR/QLSX/Kho có thể xem nhờ quyền đọc hiện có mà bị chặn ghi đúng cơ chế backend. Không dùng 403 của fixture thiếu này để kết luận quyền production lỗi; bản Admin/Line và các kiểm backend trước vẫn có phạm vi riêng.

Source bổ sung chỉ trong harness: seed bản ghi quyền bộ phận **trong DB volatile mới** từ permissionProfiles.HR/QLSX/KHO hiện có, không sửa template hay backend, không cập nhật bảng quyền thật. Đăng nhập người dùng cho QA_HR/QA_QLSX/QA_KHO; nút đăng nhập Admin dành QA_ADMIN. HTTP smoke kiểm quyền thật qua site-session và thao tác: HR nghỉ được nhưng không xác nhận SX, QLSX phụ kho/xác nhận được, Kho không được điều chỉnh SX; phiếu báo công không bị viết lại bởi HR/phụ kho. Đây là tài khoản giả theo template, không chứng nhận toàn bộ quyền user production.

## Bổ sung Pro Plan theo quyết định 05/11

Gói mới có QA_KHSX (USER, profile KHSX chuẩn chỉ trong DB giả), không grant tài khoản thật. Mở Production Plan tuần 02/11/2026: SYNTHETIC-QA-PLAN 100 SP từ 02–06/11, rate .1 trước 03/11 và .2 từ 03/11. Bấm ô Giờ công để xem lý do cần tách và các khoảng nguồn; tách rồi nhập ví dụ dòng chính 40 SP ngày 02/11, dòng con 60 SP ngày 03–06/11. Tổng nhỏ/lớn hơn đề xuất được phép; không tự chia lượng. Chốt từng dòng, chuyển In Transit và xem Leadtime theo ngày chốt, không theo ngày SX hoặc ngày mở LSX. Legacy/hours/output fixtures cũ vẫn có để đối chiếu.

Capacity fixture giờ có availableHours/syncedAt/khsxAcceptedAt và input factor đầy đủ, availableHours tính bằng calculateCapacity từ cùng input/roster giả; không giả capacity chấp thuận vượt khả năng thật. Nếu thấy panel vượt tải phải dùng đúng luồng hỏi/ACK, không bỏ guard để demo. Tài khoản/passphrase vẫn được tạo mới mỗi tiến trình, outbound Worker fetch vẫn chặn. Không nhập hoặc seed thêm vào DB đang dùng; harness luôn DB volatile riêng.

Browser kiểm desktop/390 px, không clip/nhảy bảng; button công thức có Tab/Escape/trả focus; sửa ngày đổi basis preview, chưa có căn cứ phải hiện thiếu; chốt qua nhiều mức bị chặn, dòng khóa giữ basis, mỗi dòng chuyển riêng không gộp Plan ID. Mọi thao tác chỉ dữ liệu giả. HTTP/mounted pass không thay nghiệm thu pixel; các gói b5/6a cũ không có UI/fixture này.

Leadtime có bậc MOQ vẫn chọn theo lượng LSX từ các bậc đã giữ ở ngày chốt, không lấy một giá trị của tổng lượng Plan áp cho mọi LSX. Fixture UI mặc định có version phẳng 2 ngày; regression handler riêng dùng các mức 100→2/1.000→5 và LSX50 để chứng minh bậc lượng cũ không đổi. Không coi fixture phẳng là đã nghiệm thu mọi MOQ trên browser.
