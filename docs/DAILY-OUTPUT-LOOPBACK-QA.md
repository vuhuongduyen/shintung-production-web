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

## Bổ sung Pro Plan theo quyết định 05/11 (quy tắc mới không bắt tách)

Gói mới có QA_KHSX (USER, profile KHSX chuẩn chỉ trong DB giả), không grant tài khoản thật. Mở Production Plan tuần 02/11/2026: SYNTHETIC-QA-PLAN 100 SP từ 02–06/11, rate .1 trước 03/11 và .2 từ 03/11. Giờ công là văn bản; mở mũi tên ở tiêu đề để xem ghi chú. Chốt nguyên kế hoạch 02–06/11 không cần tách: chọn mức có hiệu lực ngày chốt GMT+7. Có thể tách tùy chọn để kiểm ví dụ dòng chính 40 SP ngày 02/11, dòng con 60 SP ngày 03–06/11; cả hai nếu chốt cùng ngày dùng cùng mức ngày chốt. Tổng nhỏ/lớn hơn đề xuất được phép; không tự chia lượng. Chốt từng dòng, chuyển In Transit và xem Leadtime theo ngày chốt, không theo ngày SX hoặc ngày mở LSX. Legacy/hours/output fixtures cũ vẫn có để đối chiếu.

Capacity fixture giờ có availableHours/syncedAt/khsxAcceptedAt và input factor đầy đủ, availableHours tính bằng calculateCapacity từ cùng input/roster giả; không giả capacity chấp thuận vượt khả năng thật. Nếu thấy panel vượt tải phải dùng đúng luồng hỏi/ACK, không bỏ guard để demo. Tài khoản/passphrase vẫn được tạo mới mỗi tiến trình, outbound Worker fetch vẫn chặn. Không nhập hoặc seed thêm vào DB đang dùng; harness luôn DB volatile riêng.

Browser kiểm desktop/390 px, không clip/nhảy bảng; ghi chú mũi tên tại tiêu đề Giờ công đóng mặc định, mở bằng chuột/bàn phím, không tăng chiều cao hàng/bảng; kết quả không còn button công thức; sửa ngày SX không đổi mức tham khảo ngày chốt, thiếu căn cứ hiện thiếu; chốt qua nhiều mức được phép dùng một mức ngày chốt, dòng khóa giữ basis, mỗi dòng chuyển riêng không gộp Plan ID. Mọi thao tác chỉ dữ liệu giả. HTTP/mounted pass không thay nghiệm thu pixel; các gói b5/6a cũ không có UI/fixture này.

Leadtime có bậc MOQ vẫn chọn theo lượng LSX từ các bậc đã giữ ở ngày chốt, không lấy một giá trị của tổng lượng Plan áp cho mọi LSX. Fixture UI mặc định có version phẳng 2 ngày; regression handler riêng dùng các mức 100→2/1.000→5 và LSX50 để chứng minh bậc lượng cũ không đổi. Không coi fixture phẳng là đã nghiệm thu mọi MOQ trên browser.


## Kiểm LSX bổ sung độc lập

Trên Plan giả mới chuyển, chỉ mở một phần lượng để còn ngân sách LSX, lưu sản lượng chờ cho LSX nguồn rồi tạo LSX bổ sung. Dòng mới phải có mã/SL LSX trống, hoàn thành/chờ bằng 0, cùng Plan ID và căn cứ Plan; không mang mã CSV/trạng thái nhận kho cũ. Nhập lượng còn lại, chuyển đúng Line rồi báo/xác nhận: nguồn và dòng mới giữ lịch sử/số lượng riêng. Không dùng SYNTHETIC-DAILY-A thiếu planQty để suy ra ngân sách nguồn legacy. Handler regression đã kiểm nguồn200/dòng mới400, replay report và đề nghị kho chờ; browser cần kiểm riêng đúng gói/head mới. Không coi đề nghị kho chờ là nhận kho hoặc Sheet đã đối soát.


## Kiểm retry tạo LSX sau mất phản hồi

API add-lsx mới bắt buộc requestIdempotency; client giữ cùng key/input cho một lượt, có receipt actor/input trong transaction. Với proxy TEST chủ ý bỏ response sau commit: form và nút Lưu còn, dữ liệu nhập khóa, Lưu lại cùng lượt trả đúng LSX cũ, chỉ một business audit/LSX. Thử502/non-JSON, double click, đóng/mở workspace cùng trang, bàn phím/nút Hủy và cảnh báo rời trang; không tạo lỗi trên mạng hoặc dữ liệu thật. Sau ACK không còn cảnh báo và có thể tạo lượt mới có chủ ý. Bản journal mới khôi phục kết quả đã commit qua reload bằng cursor của tài khoản trên server, không lưu draft/key ở browser. Request chưa tới server không có nội dung để khôi phục và không được tự submit; nhập/kiểm lại trước khi Lưu. Không áp bằng chứng mới cho gói8b/511 cũ chưa có journal.

Test production-additional-lsx-worker đi qua actual compiled Worker/ordinary KHSX và kiểm HR/QLSX/Line bị từ chối, draft/sync/Line output/QLSX review; in-transit-additional-mounted dùng component thật/JSDOM với transport giả để fault injection. Hai dạng bằng chứng không thay pixel/keyboard/touch trên browser KHSX hoặc Google thật. Gói6b/75 không chứa bản bổ sung này; cần đúng source/build mới.


## Nghiệm thu khôi phục qua reload — đúng source có journal

1. Full ONSPA/Worker giả, QA_KHSX USER; chuyển Plan giả, tạo LSX nguồn một phần lượng. Tạo thêm LSX với ghi chú synthetic, proxy TEST lấy response200 từ Worker rồi chủ ý trả502 HTML hoặc làm mất response về browser. Ghi số LSX/audit/receipt trước–sau. Không gây lỗi trên web/Sheet thật.
2. Reload hoàn toàn, giữ phiên bình thường hoặc đăng nhập lại cùng QA_KHSX. Chưa chọn dòng cũng bấm Tạo thêm LSX: phải đọc `creationRecovery=1`, chọn đúng LSX đã lưu/thông báo kết quả cũ, không POST add-lsx mới, không modal tạo mới. Nội dung note ở đúng dòng cũ; summary recovery không trả note/session/PII. ACK chỉ metadata/proof, không qty/warehouse. Không tự cập nhật preview đang dùng.
3. Sau ACK mới cho ý định tạo khác bằng thao tác/Lưu rõ ràng; gửi packet cũ có revision trước phải409 dù cờ pending đã xóa. Thử hai tab cùng tài khoản mở từ cùng revision, chỉ một create được ghi. Kiểm old ACK không xóa pending mới, lỗiSQL rollback và mất response ACK không ghi business audit lặp.
4. QA_ADMIN khác tài khoản có scope riêng, không nhận pending KHSX qua recovery; HR/QLSX/Line bị403. Trong fixture cô lập, thu hồi quyền KHSX rồi khôi phục: GET/ACK bị chặn không mất state; sau re-login cùng account khôi phục đúng. Không thay quyền thật. API records chung không cho sửa cursor/proof.
5. Mất request trước commit: reload không dựng kết quả hoặc tự bấm Lưu; người dùng nhập/kiểm lại. Request cũ đến trễ không tạo thêm sau lượt mới. Mạng/503/non-JSON của recovery không được hiểu thành không có pending hoặc mở form mới. Component cũ đã unmount không ACK sau khi trang mới khôi phục.
6. Theo dõi localStorage/sessionStorage: không có ghi chú/request token/credentials của cơ chế này. Client chỉ giữ draft trong bộ nhớ; journal/receipt thuộc lần Save thành công ở DB giả. Chỉ point lookup, ACK không phát thêm refresh business; đo thời gian từng pha và không stress production.

Backend/direct tests và mounted JSDOM đã có các nhánh trên; Worker HTTP dùng auth thật trên Miniflare giả kiểm KHSX/role/re-login/permission/receipt. Đây chưa là browser pixel/touch/keyboard acceptance, Google thật hoặc quyền bật policy. Không có migration/journal backfill cho các lượt cũ thiếu proof; không suy đoán lịch sử. Các gói QA trước source journal không chứa thay đổi này.
