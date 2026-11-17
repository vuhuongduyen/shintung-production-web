## 17/11/2026 — Tiến độ sản xuất: một nơi xác nhận

- Tất cả LSX bỏ cột Mở và checkbox. Bấm LSX xem kế hoạch, lịch sử báo công và sự cố chỉ đọc; không dựng form chọn phiếu/xác nhận tại chi tiết.
- Xác nhận báo công giữ danh sách phiếu theo ngày và quyền/Line hiện có. Bộ lọc Hiển thị, Tra cứu và phân trang không đổi.
- Không thay API, D1/R2, giờ công, số lượng hoặc quyền. Kiểm thử DOM cho luồng chỉ đọc và luồng duyệt riêng; trạng thái triển khai theo PR #48, không suy diễn đã duyệt phiếu thật.

## 17/11/2026 — Chuẩn bị triển khai PR36 lên MAIN theo yêu cầu

Áp dụng phần thay đổi ứng dụng của PR36 e72e587 (kiểm thử cập nhật tại b5a80fa22f15af25085e6a449b5293fe654b0953) lên đúng nguồn MAIN v833 dfbd11873f01c2f9e9f8f7bc8a28acfed9570200. Giữ các khác biệt MAIN ngoài phạm vi PR; không thay nguyên cây staging. Bổ sung khôi phục tab báo công, bộ lọc/trang/hạng mục theo tài khoản/quyền/Line đã xác minh; giữ snapshot sau đăng xuất chủ động và tối ưu đọc tổng hợp theo request. Không thay schema/migration, .openai/hosting.json, DB/FILES hoặc dữ liệu nghiệp vụ.

Nguồn MAIN sau áp dụng đạt 89/89 kiểm thử mục tiêu và TypeScript; kiểm thử CI bổ sung harness và hai dòng flush/suspend đăng xuất, giữ nguyên fingerprint mọi callback/quyền còn lại. Build, CI revision cuối, merge, deploy và kiểm trình duyệt là các bước riêng chưa được tuyên bố hoàn tất tại thời điểm ghi source. Yêu cầu người dùng lần này là triển khai trực tiếp MAIN và kiểm sau triển khai; không cập nhật Site thử.

# 17/11/2026 — PR35 cold-read repair candidate

- Live MAIN rolled back to v829 after v830 Journal timed out repeatedly. This source builds on v830 plus only PR35 delta; preserves MAIN-specific access and storage. GitHub candidate ff9570cbb56ee0ca42d1b7b9d183f2d6b499a418, tree b60b51f37fc3374fd58a633144a6cc39dd729132. Reuses request-local production records for transit calculations; MAIN has its own transit implementation, adapted without importing unrelated GitHub behavior.
- Workspace defers time-journal cumulative calculations until the user selects the time category. Explicit journal read remains complete, has its own retained display snapshot and a bounded 60-second deadline. SELECTs are grouped within one authenticated GET, no cross-request server cache. Poll leaves pending reads/errors intact; explicit retry remains available.
- Local candidate passed 125 targeted/contract tests, typecheck/build. Combined-source checks and live performance acceptance pending. No business writes, migrations, seed, reset or data copies.

# 17/11/2026 — PR34 retained production display, deployment candidate

- PR34 merged into staging at `70366701ee6f74fa44456a42fa7fccdccef4a71e`; final head `1c8f78c3634c27ba766b4b6ae0ccb9d07f08d939` passed all four CI jobs, 2255 tests. Applies only PR34 delta onto MAIN v829 `d92ac43929bc1bc91ec8c2bd67ee3caf6f828a30`, preserving MAIN-specific Line Plan access and other behavior.
- Restores bounded IndexedDB display snapshots only after verifying account, Line and grants; old scopes invalidated on logout/account/rights changes, including across tabs. Restored write actions await current authorization/data. Silent background reads, bounded requests and permission-scoped sequential warmup; errors remain explicit.
- Lightweight workspace reads, shared progress transit context and journal calculations reduce work. Completed/canceled production orders remain hidden by default. No migrations, seed, business-data writes, site identity or storage changes.
- CI and synthetic tests do not establish production latency. Combined MAIN source checks and live-browser cached-display/fresh-data measurements are the deployment verification steps for this revision.

# 14/11/2026 — Quantity/labor integration on v818, local preflight

- Base MAIN v818 `79132455a8c77b4c24a36ad56f9814a91b4b7c46`; selectively applies quantity/labor candidate `0eacb824ec917519dfa2d20cddaf08d85d1de868`. Preserves v817 corrections and v818 maintenance, D1/R2, migrations, accounts and other modules.
- Maintenance defaults locked. Delegates only exact Admin activation API/page to existing source/origin/actor/CAS guards. An explicit maintenance-only runtime value `ONSPA_MAINTENANCE_MODE=open` permits reopening via redeployment of the SAME saved source; no source/T change is required. No production environment change made in this local step.
- Operator/readiness/maintenance37 tests, original built Worker6 cases, built lock1 and same-source locked-activation/reopen1 passed. TypeScript/build passed. Reopen fixture initially lacked a materialized pending field; seed pending200 and retain pending500 raw assertion to verify refreshing an existing projection. No assertion relaxed or business algorithm changed.
- Restore artifact for backup895f33ea SHA256 f65d7fd193a483c66f4e4be38c39510651cb43e91f57b51f31894ff5e63e494e verified separately; it attests isolated SQLite/FILES restore, not hosted acceptance or global writer freeze. QA hosted candidate acceptance, external KHSX writer tracing and activation readiness on real pending legacy remain gates. NOT published/activated MAIN.

# 14/11/2026 — Maintenance write lock, LOCAL ONLY

- Separate branch from MAIN v817 `303090ddd865f8615c55ccbe94505f767a0f7e55`. No quantity candidate changes or migration/config/credential edits.
- Entry guard returns 423 for mutations before business handlers, including Sheet bridge, presence, reviews and corrections; page returns 503 without mounting application scripts. Authenticated readback and the existing authenticated full-backup start/complete handlers remain available.
- Checks: 15 targeted lock/backup/v817 correction tests passed; actual built Worker synthetic test passed with unchanged raw business rows/schema, empty R2 and zero outbound requests. TypeScript and build passed. Initial built fixture exposed lazy D1 internal metadata initialization; initialize synthetic DB before baseline capture, keeping full equality assertions.
- NOT published, NOT active. Existing in-flight requests still need drain after deployment. Requires verified backup/migration release gates before publication; no platform-wide lock or rollback guarantee claimed.

# 04/11/2026 — Ghép chọn lọc runtime PR #6 vào MAIN v809

- Nền Site được đọc lại v809: 4a3644c45971bb23c69fedd8cf02e6058c7f6ed6. PR #6 merge d8dbb1e031e540fec892509b577cd49c3d2cc442, head đã kiểm aa47e953d20744f1e825d424144605fa20560f77; cây head và merge giống nhau. CI head có run 41774919678 thành công (typecheck và ba shard build/test).
- Chỉ ghép sáu tệp runtime: app/page.tsx, components/production-detail-read.tsx, components/production-management.tsx, lib/production-hours.mjs, scripts/local/production-workflow.mjs, worker/site-api.mjs. Năm tệp khớp nền GitHub, app/page.tsx chỉ nhận các hunk preload, giữ dữ liệu tài khoản MAIN. Giữ các thay đổi PR #5 đã phát hành.
- Home preload mã, reader menu hoạt động tải dữ liệu; work bỏ bản sao display lớn qua projection sẵn có, full giữ lịch sử. Chi tiết work chỉ hiện nội dung full khi tải thành công; có trạng thái tải, lỗi/thử lại, bỏ phản hồi cũ và xóa dữ liệu cũ khi mất quyền. Chỉ mục sự kiện và memo lịch/hiện diện trong một request giảm tính lặp, không chia sẻ qua user/request/lần ghi.
- Không đổi schema/migrations hoặc D1/R2, dữ liệu nền, uploads, tài khoản/quyền đã lưu, secrets, cấu hình kho, package/lockfile và hosting. Toàn bộ hàm mutateProductionWorkflow nguyên byte so với v809; không chỉnh logic FINAL trong đợt này. Không seed/import hoặc gọi API ghi production.
- Typecheck đạt; 150/150 test từ 16 tệp đạt, fail/cancel/skip/todo bằng 0. Bao phủ giờ công HC/TC/nghỉ/vệ sinh, full/work và GET không ghi DB, Line A/B/HR/Admin, sửa/hủy/lưu, CAS/idempotency, lịch sử, payroll, session/cache và chi tiết pending/error/retry/đóng/chuyển menu/mất quyền. DB mỗi fixture là Miniflare TEST mới; mounted React dùng API giả. Không coi đây là chạy lại toàn bộ CI 1.538 ca hoặc benchmark Workers.
- Đối chiếu deep equality v809/bản ghép đạt 10 tổ hợp full/work của QLSX, HR, Admin, Quick Line A/B trên cùng 8 LSX giả; đọc không đổi DB. Lượt đối chiếu bổ sung ban đầu qua stdin không hoàn tất do fixture local treo, đã chạy lại bằng tệp script tuần tự thành công; script và module đối chiếu đều được gỡ trước build.
- Chưa nghiệm thu trình duyệt desktop/mobile của bản tích hợp hoặc nghiệp vụ thật sau đăng nhập; không dùng chứng từ thật để test. Không khẳng định đã loại bỏ mọi exceededMemory hoặc phần trăm giảm thời gian production. Kết quả build, lưu version/deploy và đọc lại bản chạy được xác nhận riêng qua Sites sau đóng gói.

# 04/11/2026 — Ghép chọn lọc PR #5 vào MAIN v808

- Nền Site v808: 1c3a10ee62f9d5dfdea91ecaadca25a895b388e0. Nguồn PR #5 đã kiểm: 0d56e88c26f9320582a9abad4c671877d00e45f8; merge e83c854631bb77ecd48c0c2a59e7b67fc1547027 có cùng cây nội dung. Ghép 12 tệp runtime; app/page.tsx chỉ nhận ánh xạ Tách đơn sang quyền Sửa hiện có, giữ nguyên dữ liệu tài khoản tại MAIN.
- Pro Plan tách dòng có ID độc lập, giữ Plan ID nhóm; sửa lượng và tự lưu bảo toàn từng dòng. In Transit, giới hạn LSX và backlog/Capacity phân biệt dòng nguồn, tránh cộng trùng. Chặn phản hồi cũ ghi đè cache mới; cảnh báo gọn trong popover không đẩy bảng.
- Không có SQL/schema/migration mới; metadata tùy chọn nằm trong payload JSON hiện có, giữ tương thích dòng chưa tách. Không đổi D1/R2, dữ liệu nền, uploads, tài khoản/quyền đã lưu, secrets, cấu hình kho, package/lockfile hoặc cấu hình hosting. Không seed/import hay ghi dữ liệu nghiệp vụ production.
- Typecheck đạt. 194/194 kiểm thử thuộc 16 tệp đạt, không fail/cancel/skip/todo; backend chạy DB giả Miniflare mới. CI head PR được đối chiếu thành công, không coi bộ kiểm thử chọn lọc là chạy lại toàn bộ CI.
- QA desktop trên component Pro Plan và CSS thật, API giả trong bộ nhớ: tách 100 thành dòng gốc 100 và dòng mới trống; tự lưu dòng mới 30, mô phỏng lỗi lưu khi sửa 31 và Thử lưu lại thành công (revision 4). Chung Plan ID, lượng gốc giữ nguyên. Đổi cảnh báo Capacity giữ nguyên vị trí bảng và độ rộng 16 cột; mở/đóng bằng Escape đạt. Đã gỡ toàn bộ fixture QA trước đóng gói.
- Chưa kiểm responsive/mobile hoặc toàn bộ luồng Admin đăng nhập trên trình duyệt; không xác nhận chứng từ thật để test. Build, lưu phiên bản và deployment được xác nhận riêng qua Sites sau khi đóng gói.

# 03/11/2026 — Ghép chọn lọc runtime PR #4 vào MAIN v807

- Nền Site: 8b22aa8cc69ab9c7d2e9d2e098ccb8923d88c5fe (v807). Nguồn đã kiểm: 505be66b543931f82858786b152be1c9128d557e; merge GitHub 39d667ac87ce4c118518129b005f0d477c807b20 có cùng cây nội dung. Đối chiếu 21 tệp runtime với snapshot v807: không xung đột.
- Lấy các sửa lỗi FINAL khi xuất/nhập bù/hủy nguồn cung, giới hạn vệ sinh theo nhân sự đầu ca thực tế, Plan ID rỗng giữ kết quả, picker phân bổ lại khi hủy xuất, trạng thái điều phối và giải thích thao tác bị khóa. Không thay công thức giờ công, quyền hoặc cơ chế đồng bộ kho.
- Giữ nguyên app/page.tsx (không chép dữ liệu tài khoản đã làm trống trên GitHub), toàn bộ JSON dữ liệu nền, cấu hình TEST/production, hosting DB/FILES, package/lockfile, worker auth/quyền và mã kho. Không seed/import/migrate hay gọi API ghi dữ liệu production. Runtime env revision 4, giữ nguyên audience public.
- Kiểm thử bản ghép: 32 file, 369/369 test đạt, không fail/cancel/skip/todo; typecheck và build đạt. Bao phủ FINAL, nhập bù, sửa/tách báo công, hủy/khôi phục, vệ sinh/lịch thực tế, điều phối, quyền, tra cứu và bridge kho. Không coi đây là chạy lại toàn bộ CI 248 file của GitHub.
- Preview TEST khởi tạo được màn đăng nhập trong trình duyệt; luồng có dữ liệu được kiểm bằng API giả lập và mounted DOM, chưa nghiệm thu toàn bộ giao diện Admin hoặc responsive trên trình duyệt thật.
- Bản lưu/phát hành và commit cuối được xác nhận bằng Sites sau bước đóng gói; trạng thái phát hành không được suy từ test hoặc build.

# 02/11/2026 — Tách xuất trạm trên công đoạn tiếp nối ERP

- Điều chỉnh số lượng hỗ trợ nhật ký native tiếp nối mốc nhập ERP hoặc trạng thái đã lưu trước thao tác đầu; giữ nguyên bản nguồn và timeline lịch sử khi tách phiếu. Từ chối nếu không có căn cứ tiếp nối hợp lệ, không thay lô nhập bù.
- Giữ thao tác tiếp tục/tạm ngưng lặp đã có trạng thái tương ứng trong lịch sử; không tự thêm giờ hay nhập lại sản lượng. Giờ điều chỉnh nhập được đến giây. Không kiểm tra chồng chéo liên lệnh; giữ kiểm tra tổng lượng, FINAL và kho chưa xác nhận.
- Hiển thị Mốc tiếp nối đã chuyển từ web cũ, cho sửa giờ trên chính bản gốc và giữ nhân lực/lịch sử, không tạo thêm Nhập trạm hay sản lượng.
- Sửa thời gian/nhân lực cũng không tự chạy đối chiếu chồng chéo; báo cáo kiểm tra vẫn mở riêng theo yêu cầu.
- Kiểm thử backend 9 ca đạt, gồm tách lịch sử ERP, giữ tổng lượng/giờ, lưu trước/sau, kho chưa xác nhận và xung đột phiên bản. Đã lưu và đọc lại các lần xuất CUT/ASSY/CRIMP/PACKING/FINAL của 510-26102704 theo ERP; FINAL tách 600 Phú và 3.400 Việt + Phú, lệnh đủ 4.000 đã xác nhận, phiếu kho chờ xác nhận. Nhật ký điều chỉnh giữ dữ liệu trước/sau.

# 02/11/2026 — Kết thúc chuyển Line dài hạn có lượt mượn tiếp

- Cho bổ sung mốc kết thúc bản chuyển chưa có hạn khi giữ nguyên người, Line nguồn/nhận và thời điểm bắt đầu; mốc phải bao trọn các lượt mượn tiếp. Giữ nguyên lượt mượn tiếp và lịch sử trước/sau. Không bắt Line nhận lịch sử khớp Line hiện tại khi chỉ kết thúc bản cũ.
- Vẫn chặn hủy/sửa khác làm mất căn cứ lượt mượn tiếp, chặn kết thúc cắt ngang lượt sau hoặc lượt sau chưa có hạn. Nhận diện quan hệ qua phiên bản cũ để bảo vệ cả bản đã chỉnh và giữ đúng chủ Line khi hai lượt cùng giờ bắt đầu.
- Kiểm thử API kết thúc chuyển dài hạn, bảo vệ chuỗi và bộ kiểm thử phân bổ chuỗi đạt. Bộ workflow rộng có một lỗi đối chiếu approvedSchedules ở ca Capacity forecast; đã tái hiện trên source baseline v801, không phải lỗi mới. Không sửa dữ liệu production.

# 02/11/2026 — Lưu và tiếp tục điều chỉnh báo công

- MAIN: nút Lưu và tiếp tục xem xét rồi lưu trong một thao tác, giữ cửa sổ/công đoạn; cập nhật dòng, số lượng và phiên bản từ phản hồi đã lưu trước khi cho sửa tiếp. Danh sách ngoài làm mới nền. Vẫn có Xem thay đổi để xem trước.
- Sửa/thêm/tách kết hợp hủy Nhập trạm/Tiếp tục/tạm ngưng/bổ sung trong một batch; kiểm tra trình tự theo ngày giờ mới, không đối chiếu riêng bản cũ. Hủy Xuất trạm vẫn dùng luồng hủy riêng để bảo vệ liên kết phiếu kho. Giữ lịch sử, kiểm tra phiên bản và quy tắc kho chưa xác nhận của bản trước.
- Kiểm thử 11 ca backend sửa/hủy, kiểm thử cập nhật kết quả tại chỗ; giao diện dữ liệu giả lưu giờ hai lần liên tiếp trong cùng cửa sổ thành công. Route QA đã gỡ; không sửa dữ liệu sản xuất. File mã kho được xuất TXT từ mã Apps Script hiện hành, chưa thay mã trên Sheet thật.

# 31/10/2026 — Điều chỉnh phiếu kho chưa xác nhận sau đồng bộ

- Thay quy tắc v799: gửi/đồng bộ Sheet không đồng nghĩa kho đã xác nhận. Điều chỉnh số lượng native giữ trạng thái báo công đã xác nhận, cập nhật In Transit và phiếu kho chưa xác nhận cùng batch; không thu hồi thủ công, không xóa/tạo lại phiếu cũ. Tách lần từ phiếu đã xác nhận giữ căn cứ xác nhận nguồn và tổng gốc; lần mới không có nguồn tách vẫn chờ kiểm tra theo quy trình.
- Phiếu mới do tách dùng một ID báo công/phiếu kho cố định; không cộng trùng khi gửi lại. Lưu trước/sau báo công và phiếu kho trong nhật ký điều chỉnh. Kho đã xác nhận (kể cả nhận 0), có dấu xác nhận hoặc đã nhận hàng vẫn chặn; snapshot bảo vệ thao tác đồng thời.
- Phiếu kho cập nhật được đưa vào hàng đồng bộ pending theo kết nối cũ, không thay cấu hình/khóa. Bridge kiểm tra phiên bản và lượng khi nhận ACK điều chỉnh; chặn xác nhận Sheet với phiên bản chưa đồng bộ. Sửa thời gian/nhân lực giữ quy trình cũ, cập nhật ngày nguồn và hàng đợi của phiếu kho chưa xác nhận.
- File scripts/warehouse-sheet/ONSPA_KHO_WEB.gs hỗ trợ sửa lượng ở chính dòng chưa xác nhận, giữ dòng kho đã có nhận hàng. Cần thay file này trong Apps Script đang chạy nếu kho dùng Sheet: sửa source Site không tự cập nhật mã Apps Script bên ngoài. Chưa xác minh hay thay mã trên Google Sheet thật. Web cập nhật nội bộ ngay; Sheet hoàn tất sau khi mã tương thích chạy và gửi ACK.
- Kiểm thử DB TEST: phiếu sent chưa xác nhận được sửa/tách, tổng In Transit/phiếu kho, nhật ký trước/sau, xác nhận kho đồng thời, gửi lại; kiểm thử Bridge và mã Apps Script với dữ liệu giả. Không chỉnh dữ liệu sản xuất trong đợt triển khai.

# 31/10/2026 — Điều chỉnh báo công, tách lần và kiểm tra chồng chéo

- MAIN: bảng điều chỉnh theo nhóm thao tác; dòng cũ vẫn sửa ngày/giờ, nhân lực và số lượng. Nhập/xuất có nút thêm và tách lần; tách giữ tổng gốc, tự tính dòng còn lại và kiểm tra tổng ở backend.
- Điều chỉnh/hủy không kiểm tra hoặc chặn phân công chồng chéo lệnh/công đoạn khác, không tự thu hồi phân công đó. Giữ kiểm tra trình tự trong công đoạn, tổng lượng, người được chọn, quyền, phiên bản và batch nguyên tử; giữ nhật ký trước/sau. Nhân lực sửa ở lần xuất áp dụng cho khoảng công của phiếu đó, vẫn trừ nghỉ/tạm ngưng theo lịch.
- Báo cáo chồng chéo chạy riêng khi bấm Kiểm tra, lọc ngày/Line/nhân viên/LSX và xuất Excel qua xem trước chung. Dùng dữ liệu đã tải, các khoảng đã hết trùng rời danh sách; chưa có danh sách lịch sử Đã xử lý riêng. Phần chưa báo công thể hiện khoảng phân công cần đối chiếu lịch. Báo cáo này không cộng giờ và không tự khử trùng giờ trong bảng lương.
- Thêm/tách/sửa lượng chỉ áp dụng nhật ký native, không sửa lượng dữ liệu ERP/Sheet cũ. Phiếu bị đổi lượng chờ kiểm tra lại; chứng từ kho đã gửi/đã xử lý vẫn bảo vệ liên kết. Không sửa dữ liệu thực tế, DB/uploads hay cấu hình khi triển khai mã.
- Kiểm tra bằng DB TEST tách biệt và giao diện component thật với dữ liệu giả; route QA được gỡ trước đóng gói. Trạng thái lưu bản/triển khai được xác nhận riêng bằng Sites.

# 30/10/2026 — Chuyển báo công chọn lọc

- Trang Admin `/production-cutover`: xuất từng lệnh từ web thử cũ, preview/nhập trên web chính. Không chuyển accounts, quyền, files, cấu hình hoặc khóa; không xác nhận phiếu/kho.
- Giữ bản ERP trước 30/10; nối giờ sau mốc ERP theo nhân lực trong nhật ký, tính theo lịch thực tế web chính. Không ghi đè lịch hay bản báo công đã có. Phiếu mới Chờ kiểm tra. Dữ liệu trước/sau và dấu nguồn được lưu, kiểm đồng thời và đọc lại; không tự retry khi chưa rõ kết quả.
- Chặn thiếu lệnh/nhân viên/liên kết chuyển Line, vượt sản lượng, nguồn trước 30/10 lớn hơn ERP, phân công trùng hoặc dữ liệu đã chuyển bị sửa. Các xung đột phải xử lý riêng, không ép nhập.

21/10/2026 — Đã bù đủ 195 phiếu (tổng 250), 0 cần bù. Thêm xác nhận đủ số lượng theo chỉ thị người dùng, lưu user và thời điểm; không cộng lại tồn ERP lịch sử.

21/10/2026 — Đã bù 193 phiếu trên web thật (55 → 248), không sửa phiếu cũ. Bổ sung đối chiếu phiếu cũ gộp nhiều báo công cùng ngày để xử lý 2 lệnh còn lại.

21/10/2026 — Bỏ dòng đếm/đối chiếu khỏi giao diện Nhập kho. Bù phiếu qua công cụ quản trị có đối chiếu mã và phiếu cũ cùng lệnh; chỉ tạo phiếu chờ xác nhận, không tăng tồn, giữ nguyên phiếu cũ. Chưa chạy bù trên dữ liệu thật tại thời điểm ghi chú.

21/10/2026 — Ngày nhập kho dd/MM/yyyy HH:mm:ss; quản trị có đối chiếu chỉ đọc giữa báo công đã xác nhận và phiếu kho, liệt kê báo công thiếu phiếu. Chưa tự tạo bù phiếu.

21/10/2026 — Tiến độ SX: Tra theo bổ sung toàn bộ 16 cột dữ liệu và Tuần kế hoạch; các số liệu tổng hợp và thời gian tra đúng giá trị đang hiển thị. Giữ áp dụng khi Tìm kiếm/Enter và giới hạn Line.

21/10/2026 — Nhập kho: bỏ thanh tệp ở màn nhập kho, Tra cứu cùng hàng tab; Ngày nhập kho lấy completedAt từ báo công liên kết, không dùng ngày tạo phiếu. Không thay đổi dữ liệu gốc.

## 21/10/2026 — Bảng nhập kho và liên kết thử
- Bỏ nút vào Site thử khỏi trang đăng nhập và header web chính; Site thử giữ riêng.
- Thu gọn tiêu đề/quy trình, Tra cứu dùng toolbar chung; thêm Nhóm SP theo SKU master, Người xác nhận, Cách ghi nhận; Mã báo công thu gọn cuối bảng.
- Phiếu sinh từ báo công ghi Tự động; chưa có người xác nhận hiển thị Chưa xác nhận. Không cập nhật dữ liệu hoặc nghiệp vụ xác nhận kho.

## 21/10/2026 — Thông báo và danh sách phiếu nhập kho
- Thông báo chữ 18–22px, xanh đậm nền sáng.
- Nhập từ SX đọc warehouse_in thật thay dòng minh họa; thông báo mở đúng danh sách chờ xác nhận. Chỉ đọc dữ liệu; chưa triển khai nghiệp vụ xác nhận nhập/cập nhật tồn từ màn hình này. Không sửa chứng từ, tồn, quyền hoặc môi trường thử.

## 21/10/2026 — Lối vào môi trường thử

- Thêm nút Vào môi trường thử tại màn hình đăng nhập và khu vực tài khoản; mở Site thử ở tab mới, không truyền cookie hoặc tài khoản qua URL. Chỉ hiện trên hostname web thật và trước 17:00 ngày 31/10/2026.
- Site thử vẫn đang chờ xác nhận chuyển dữ liệu, chưa sẵn sàng thao tác. Lối vào không thay đổi quyền hoặc đăng nhập.

## 21/10/2026 — Sửa sao lưu đầy đủ vượt bộ nhớ

- Thay xuất toàn bộ DB vào bộ nhớ Worker bằng snapshot SQL trung gian trong một D1 batch; đọc tối đa 256 dòng / 2 MiB/trang, SHA-256 tăng dần và tải R2 multipart 5 MiB. Giữ SQL SQLite chính xác, số lượng bảng/bản ghi, quyền thiết bị, kiểm tra file gốc và định dạng Windows hiện hành.
- Bảng trung gian được xóa khi hoàn tất/lỗi; bảng sót do Worker bị ngắt được thu hồi sau 24h. Chỉ loại transport nội bộ, không loại bản ghi nghiệp vụ.
- Đã kiểm tra local: phục hồi SQL, BLOB/số nguyên lớn, phân quyền, file thiếu/thay đổi, snapshot hơn 12 MiB và thay đổi DB trong lúc xuất, dọn khi upload lỗi. Cần xác nhận lần chạy trên PC và HOAN-TAT.json sau triển khai; chưa coi lịch tự động Windows đã được nghiệm thu.

## 20/10/2026 — Bản 605: Chuẩn hóa thông báo kết quả

- ActionFeedbackHost dùng khung giữa màn hình chữ 24px, tiêu đề 30px (mobile 20/25), xanh thành công/đỏ thất bại; lỗi có Nguyên nhân và Hướng xử lý theo nhóm quyền, trùng thời gian, phiên đăng nhập, mạng, phiên bản, đầu vào.
- Cầu nối các banner kết quả quản trị, save/master, kho, In Transit, SX, BOM, phản hồi, nhân viên, PlanningFeedback về cùng host; không nâng lỗi ở ô bảng hay hint có input thành popup. Loading không coi là thành công. Giữ handler đóng của nguồn, ẩn thông báo khi nguồn bị tháo hoặc tab ẩn.
- Khung kết quả báo công thử giữ Dialog riêng, tăng chữ và thêm hướng xử lý. Thành công 6s/lỗi chung 12s, đóng bằng nút hoặc Escape. Không thay đổi nghiệp vụ/lưu dữ liệu/quyền.

## 20/10/2026 — Bản 604: Bỏ xác nhận phát sinh không có xung đột

- Bỏ bước xác nhận chung khi ghi nhận Làm việc phát sinh: không có phân công xung đột trong phiên thử thì ghi nhận ngay. Chỉ hỏi chuyển người khi thực sự có phân công khác. Giữ tính giờ HC, giới hạn 17h và bản thử không ghi chính thức.

## 20/10/2026 — Bản 603: Nội dung gửi khi thao tác lỗi

- Nhật ký máy chủ lưu ảnh chụp đầu vào nghiệp vụ trước khi xử lý, giữ cả khi lỗi/từ chối; nhân viên/ngày/giờ/danh sách dòng hiển thị trong Chi tiết → Thông tin đã ghi nhận → Nội dung đã nhập / gửi. Không coi dữ liệu gửi là dữ liệu đã lưu thành công.
- Lỗi giao diện có phần tử kích hoạt nằm trong form: chụp trường nhập tại lúc thao tác và thông báo lỗi; không ghi gõ phím, mật khẩu, token, trường ẩn hoặc tệp. Không có form/ngữ cảnh thì không suy đoán đầu vào. Máy chủ lọc lại và giới hạn dung lượng.
- Dòng lịch sử cũ chưa có đầu vào hiển thị rõ không khôi phục được. User vthduyen vẫn loại trừ hoàn toàn tại máy chủ. Kiểm thử lỗi 409, đầu vào, loại bí mật, giả mạo danh tính/nguồn và hàng đợi client; typecheck/build.

## 20/10/2026 — Bản 602: Một thao tác Làm việc phát sinh

- Thay quy tắc 601 theo yêu cầu mới: cho chọn cả công đoạn chưa nhập trạm. Làm việc phát sinh tự khởi tạo mốc startedAt và phân công người được chọn, không cần Nhập trạm riêng. Xuất một phần vẫn hiện; xuất đủ ẩn.
- Giờ thử giới hạn cuối HC, tối đa 17:00 ngày phát sinh; xuất sớm dùng giờ xuất. Không tự đổi trạng thái thành tạm ngưng/hoàn thành khi hết giờ. Không cộng qua đêm.
- Vẫn là bản thử trong phiên, không ghi báo công chính thức. Kiểm thử giờ/công đoạn và build đạt.

## 20/10/2026 — Bản 601: Điều chỉnh quy tắc làm việc phát sinh

- Thay quy tắc 600 theo xác nhận người dùng: công đoạn xuất một phần (partial) vẫn được Làm việc phát sinh; xuất đủ (done) ẩn. Chưa nhập trạm (waiting) không được Làm việc phát sinh, phải Nhập trạm công đoạn cần làm.
- Cùng bộ lọc bảo vệ thao tác gửi cũ; giữ sản lượng đã xuất khi làm phần còn lại. Kiểm thử mục tiêu và build đạt. Vẫn là dữ liệu thử trong phiên.

## 20/10/2026 — Bản 600: Lọc công đoạn đã xuất trạm

- Làm việc phát sinh trong bản thử ẩn cả công đoạn xuất một phần (partial) và hoàn thành (done); chặn cả thao tác gửi từ lựa chọn cũ. Nhập trạm lại phần còn lại vẫn dùng luồng Nhập trạm hiện có. Không ghi dữ liệu chính thức.
- Kiểm thử công đoạn/giờ phát sinh đạt; build thành công.

## 20/10/2026 — Bản 599: Làm việc phát sinh (bản thử)

- SX báo công thêm Làm việc phát sinh trong menu Báo công, dùng chung modal theo công đoạn, danh sách NV và đồng hồ 24h. Ngày/giờ mặc định GMT+7 tại lúc mở.
- Chỉ lưu state phiên thử, không API ghi báo công, không thay đổi D1/R2/lịch của Line; tải lại sẽ mất bản thử. Kiểm tra chuyển người chỉ trên phân công thử đã biết trong phiên.
- Chọn người cho từng công đoạn, xác nhận tiếp tục/chuyển người, xuất trạm/tạm ngưng/chuyển người đóng khoảng. Hiển thị giờ HC thử theo từng NV: ngày không lịch dùng HC ngày thường gần nhất (mặc định 08–17), trừ trưa/giải lao/nghỉ và phụ kho, hợp nhất khấu trừ trùng. Khoảng chưa đóng dự kiến tới cuối HC ngày phát sinh, không tự tính thêm các ngày nghỉ khác.
- Typecheck, build và kiểm thử logic công đoạn/giờ công. Chưa nghiệm thu bố cục bằng trình duyệt trong bản này.

## 20/10/2026 — Đổi tên Lịch làm việc dự kiến (596)
- Đổi nhãn menu con Capacity, tab, tiêu đề và chỉ dẫn điều phối thành Lịch làm việc dự kiến; cập nhật nhãn Anh/Trung tương ứng. Giữ ID menu, quyền và dữ liệu hiện tại.
- Video hướng dẫn được dựng trên bản giao diện chạy thử riêng, dữ liệu giả định, không ghi dữ liệu nhân sự lên production.

## 20/10/2026 — Loại vthduyen khỏi nhật ký thao tác (595)
- Theo yêu cầu xác nhận lại: bỏ qua biên nhận website_action_audit phía server và báo cáo lỗi trình duyệt của user vthduyen, dựa danh tính phiên đã xác thực, không dựa actor do client gửi. Không thay quyền kiểm tra nghiệp vụ.
- Khôi phục lọc ẩn vthduyen cho cả biên nhận mới đã lưu và lịch sử cũ. User khác tiếp tục ghi đầy đủ theo cơ chế 594. Giữ lịch sử nguồn nghiệp vụ/bản trước-sau phục vụ dữ liệu và đối chiếu, không xóa dữ liệu cũ.

## 20/10/2026 — Không gán lỗi tác vụ nền thành thao tác người dùng (594)
- Chỉ ghi báo cáo mất kết nối cho đường dẫn ghi nghiệp vụ đã tích hợp audit; loại request hiện diện/phiên và AbortError khỏi biên nhận mất mạng. Không xóa lịch sử đã ghi; báo cáo trình duyệt vẫn không là bằng chứng đã lưu.

## 20/10/2026 — Điểm mở Nhật ký thao tác (593)
- Kiểm tra live 592 phát hiện nhánh AdminAuditView chặn nhánh mở trình xem mới. AdminAuditView nay mặc định mở nhật ký nghiệp vụ mới; nút Đăng nhập / Lịch sử quản trị giữ màn hình và công cụ đối chiếu quyền cũ, có nút quay về nhật ký nghiệp vụ.

## 20/10/2026 — Nhật ký yêu cầu và kết quả thao tác (592)
- Kiểm chứng: nhóm audit server/client, API với DB TEST, chuẩn hóa/hiển thị nhật ký, phản hồi lỗi và phụ kho mounted đã đạt; typecheck và build đạt. Không tạo giao dịch báo công/phụ kho thử trên dữ liệu thật.
- Thêm website_action_audit trong app_records hiện có, không migration/seed. Các API ghi nghiệp vụ chính ghi biên nhận trước khi chạy; không ghi được biên nhận thì trả 503 và không chạy thay đổi. Kết quả phân biệt thành công, bị từ chối, lỗi, đã xử lý trước đó, chưa có kết quả. Actor lấy từ phiên server.
- Nếu ghi kết quả cuối bị lỗi, giữ trạng thái đã nhận/chưa có kết quả; không suy đoán thành công. Biên nhận không thay thế lịch sử nghiệp vụ trước/sau, không bảo đảm một thao tác lỗi chưa từng ghi một phần dữ liệu.
- Lỗi tại nút/toolbar qua phản hồi chung gửi báo cáo trình duyệt; phân biệt quyền/dữ liệu chưa hợp lệ/kết nối. Không thể giả biên nhận máy chủ thành công qua API này. Hàng đợi tối đa 100 ở bộ nhớ phiên, thử lại khi online; đóng/tải lại lúc offline có thể mất báo cáo chưa gửi. Không ghi mật khẩu, thao tác gõ phím hoặc mọi click thụ động; luồng thử công đoạn chỉ ở bộ nhớ chưa phải dữ liệu sản xuất.
- Nhật ký thao tác dùng cùng trình xem có Kết quả/Nguồn/Mã đối chiếu; lọc kết quả qua Tra cứu, chỉ áp dụng khi Tìm kiếm. Biên nhận mới hiển thị mọi user; quy tắc ẩn lịch sử test cũ vthduyen vẫn giữ. Đọc biên nhận tối đa 5000 theo khoảng ngày riêng, báo giới hạn; bản ghi DB không bị xóa khi vượt giới hạn.
- Đối chiếu UI live: cnphuong xác nhận 20/10 09:28:32 GMT+7, report SHEET-REPORT:6ac43917-160a-47bf-9a69-6caccc54bcad; trước Chờ kiểm tra/sau Đã xác nhận và reviewedById cnphuong. Đổi tên hiển thị theo chuyển trạng thái có bằng chứng thành Xác nhận báo công tại Tiến độ SX. Không tạo bù lịch sử cũ không có bằng chứng. Xác nhận báo công hiện hữu đã có production_event/admin_audit; biên nhận mới bổ sung cả yêu cầu lỗi, không tự xác nhận báo công.
- Đính chính 591: ngoài sửa mapping WarehouseDuty → ActualWorkSchedule, đã khôi phục 3 quyền Báo công sản xuất Thêm/Sửa/Xác nhận của cnphuong qua giao diện Admin, từ 40 lên 43 quyền; không cấp thêm quyền khác.

## 20/10/2026 — Mở khung công đoạn từ Báo công hiện hữu
- Bỏ nút và màn hình thử riêng. Trên bảng SX báo công hiện tại, Báo công → Nhập trạm mở trực tiếp khung chọn công đoạn/NV.
- Khung vẫn ghi rõ bản thử, chỉ giữ trạng thái ở bộ nhớ. Lệnh đã thao tác thử dùng các lựa chọn công đoạn hợp lệ trong cùng nút Báo công. Lệnh đang có dữ liệu thực tế chưa được tự chuyển sang công đoạn giả; luồng cũ còn giữ cho những lệnh đó.
- Chưa bật ghi nghiệp vụ mới hoặc tính giờ công theo công đoạn chính thức.

## 20/10/2026 — Bản dùng thử báo công theo công đoạn (chưa ghi nghiệp vụ)
- SX báo công có nút “Thử báo công theo công đoạn”. Dùng các lệnh đã mở/đồng bộ và công đoạn SKU Master thật; danh sách NV cùng Line. Mọi trạng thái và thao tác thử chỉ ở bộ nhớ component, mất khi rời bản thử, không gọi API ghi.
- Trong bản thử: Báo công → nhập trạm chọn nhiều công đoạn/NV, số NV tự đếm, giờ 24h; ẩn công đoạn đang chạy khỏi nhập trạm; tạm ngưng/tiếp tục/xuất trạm theo trạng thái thử.
- Chuyển NV đang làm cần xác nhận chung; rời hết người tự tạm ngưng; xuất trạm cho chọn Chờ phân công hoặc từng công đoạn nhận đang chạy. Kiểm tra số lượng còn lại, trùng người và giờ lùi.
- Chưa triển khai ghi công đoạn vào báo công chính thức, tính/trừ giờ thực tế, phân công theo Capacity/HR, nhật ký server hoặc đồng bộ kho. Không chuyển trạng thái lịch sử thành trạng thái công đoạn giả. Màn hình ghi rõ giới hạn trước khi thao tác.
- Kiểm tra reducer thử: 5 trường hợp đạt; typecheck/build được kiểm tra khi đóng gói.

## 20/10/2026 — Capacity: giữ giao diện và tải nền
- Lịch làm việc lấy tuần mới nhất, lịch và danh sách nhân viên trong cùng một lần đọc DB; tải điều phối song song trước khi mở dữ liệu lần đầu.
- Giữ snapshot trong bộ nhớ phiên khi mở lại; điều phối không trở về danh sách trống. Phản hồi không đổi giữ nguyên tham chiếu dữ liệu, bản đang nhập và phần đang mở.
- Bộ nhớ xóa khi đổi phiên/quyền; lỗi 401/403 không tiếp tục dùng dữ liệu điều phối. Lỗi mạng giữ bản đã tải và báo thử lại. Không sửa dữ liệu nghiệp vụ hoặc xác nhận báo công.

## 17/10/2026 — Tra cứu Lịch sản xuất thực tế tại chỗ, nguồn sau LIVE 538

- Bỏ luồng chuyển sang bảng tháng có thanh Tra cứu/Quay lại thứ hai. Dùng một StandardToolbar của Lịch SX thực tế; Tra cứu mở Tra theo rỗng, Nội dung tra chỉ xuất hiện sau khi chọn. Chọn hạng mục/nhập điều kiện không thay kết quả; Tìm kiếm hoặc Enter mới áp dụng.
- Tổng hợp tháng cho đặt cùng lúc tháng, Line, loại biến động, mã/tên nhân viên và bản ghi hiện hành/gồm đã hủy; áp dụng một lần. Kết quả ở trong cùng màn hình, có tiêu đề tháng rõ ràng. Bộ lọc tháng dùng state riêng, không đổi Line/tuần hoặc nội dung của lịch đang nhập.
- Chỉ một Quay lại: trở về lịch đang xem, giữ DOM của lịch, bản nhập HR, nội dung bộ lọc tháng và vùng cuộn. Mở/đóng sửa bản ghi giữ bảng/kết quả/bộ lọc; quay lại tra cứu tái dùng bảng đã mở, không dựng lại hoặc gọi ghi dữ liệu. Xóa lọc giữ tháng và chế độ kết quả, không nhảy về tháng hiện tại. Đóng popover nhân lực khi vào kết quả tháng.
- ActualLaborMonth nhận bộ lọc đã áp dụng khi được nhúng; giữ tương thích cách dùng độc lập. Ranh giới Line bị khóa được áp dụng lại cả ở parent và bảng con, kể cả filter Line giả. HR vẫn xem lịch sử Phụ kho/Chuyển Line như trước nhưng không có nút sửa/hủy loại không được cấp. Không đổi API, auth/grants/scope, công thức giờ, DB/FILES, migrations hoặc config.
- Gate: nhóm hồi quy 166/166 đạt; chạy lại 80/80 kiểm tra liên quan sau chỉnh DOM cuối cùng, zero skip. Bao phủ kết hợp nhiều điều kiện một lần, draft không áp dụng sớm, Enter/picker/IME/busy, một Quay lại, giữ lịch/nội dung HR/scroll/bảng và đóng sửa, Xóa lọc giữ tháng, scope A/B chống giả Line, quyền HR và thời lượng. Typecheck đạt; build/legacy qua gate đóng gói. Kiểm thử thao tác dùng dữ liệu giả cô lập, không gọi ghi thử lên sản xuất. Chưa nghiệm thu hình ảnh mọi kích thước màn hình.

## 17/10/2026 — Điều phối: nhóm nút đồng thời và trạng thái sau hủy, nguồn sau LIVE 537

- Năm nút Chuyển nhân sự / Chờ phân bổ / Hủy chuyển nhân sự / Lịch sử chuyển-hủy / Hướng dẫn luôn được dựng cùng lần, cùng thứ tự. Không đợi có lịch sử hoặc quyền trả về mới chèn nút. Giữ native button và wrapper qua cold → verified, refresh, lỗi/retry; Retry và Thiết lập QLSX đứng sau nhóm chính để không đổi key của nhóm này.
- Chưa xác minh thì khóa; chỉ xem/không có scope thì Chuyển và Hủy vẫn khóa và giải thích. Callback cũng kiểm tra lại trạng thái. Không mở form hoặc gửi lệnh khi chưa đủ quyền/ngữ cảnh. Lịch sử trống hiển thị trạng thái trống thực sự khi người dùng mở.
- Giữ đúng hai thao tác hiện hành: phía nhận hủy phân công vào lịch sẽ trả khoảng giờ về Chờ phân bổ; đề nghị chuyển phía gửi vẫn còn. Chỉ phía gửi được rút phần đang chờ. Hiển thị giải thích ngay tại dòng chờ có khoảng giao với phân công đã hủy và trong xác nhận hủy, không gán trạng thái này cho người/khoảng giờ khác.
- Đã đối chiếu lịch sử LIVE bằng giao diện chỉ đọc; không hủy/rút thêm dữ liệu thật. Không sửa backend/domain, quyền, scope C/AB, DB/FILES/auth/config hoặc dữ liệu sản xuất.
- Gate tập trung 124/124, zero skip: DOM nhóm nút qua tải/xác minh/lỗi/retry; bản nhập và xác nhận giữ nguyên; phân bổ/hủy/rút/idempotency/CAS/rollback, quyền A/B và admin chỉ xem. Typecheck đạt; build/legacy là gate đóng gói. Không tuyên bố nghiệm thu hình ảnh mọi kích thước màn hình.

## 17/10/2026 — Tối ưu tải và lưu dùng chung, nguồn sau LIVE 536

- Đo từ slow-read LIVE: nhiều yêu cầu mất 2–4 giây, principal thường 1–1,7 giây. Giảm xác thực/session từ ba SELECT xuống một, principal thường còn hai SELECT kể cả bộ phận; Quick Line còn một. Không cache quyền hoặc phiên qua request, giữ thu hồi/hết hạn/credential_version/active và scope A/B.
- Capacity đọc lịch + nhân viên trong một snapshot; lưu còn một đọc + một CAS ghi thay vì bốn đọc + một ghi. Giữ nguyên guard legacy/envelope/revision/queue, quyền xem/ghi, kiểm tra đầu vào và lịch sử; phân bổ vẫn lưu riêng.
- Tách tám màn hình tải khi mở, không tải trước hàng loạt dữ liệu kế hoạch ở trang chủ. Loader giữ component/bản nhập khi refresh, có thử lại lỗi chunk. Map ngày BOM giữ ưu tiên bản đầu. Gói page chính 2.684.532 → 2.043.680 byte; gzip 481.211 → 296.733 byte (giảm 38,3% gzip), không diễn giải thành tỷ lệ tăng tốc mọi thao tác.
- Gate: full suite 929/929 đạt, không skip; thêm kiểm tra preload đúng menu 7/7 đạt; rerun auth/snapshot, Capacity/queue và mounted loader/draft/retry đạt; typecheck/build và legacy 5/5 đạt. Mọi ghi thử dùng DB/FILES TEST cô lập, không ghi thử sản xuất. Preview tải được giao diện; đọc DB TEST qua preview bị giới hạn loopback, chưa QA dữ liệu trực quan đầy đủ.
- Preflight giữ nguyên project/URL/public/auth, DB/FILES bindings, migrations và env revision 4. Chỉ xác nhận lên web bằng deployment succeeded + commit readback. Không có đo p95 LIVE sau triển khai. Xem `docs/PERFORMANCE-2026-10-17.md` về bằng chứng và giới hạn.

## 16/10/2026 — Bộ lọc Line của Điều chỉnh báo công (source sau LIVE 509, chưa phát hành)

- Phiên LINE_A/LINE_B chỉ thấy lựa chọn Line của mình trong Điều chỉnh báo công; bộ lọc khóa theo phiên và Xóa lọc giữ Line đó. Người dùng không giới hạn Line vẫn có Tất cả/A/B.
- Chỉ sửa giao diện bộ lọc và truyền sessionLine; giữ nguyên ranh giới dữ liệu server, quyền ghi và công thức. Chờ gate/QA của bản phát hành tiếp theo.

## 16/10/2026 — Chốt kế hoạch bằng nút riêng và quyền Mở chốt (source sau LIVE 508, chưa phát hành)

- Production Plan không còn cho đổi trực tiếp sang Đã chốt trong ô Trạng thái. Các lựa chọn Dự kiến / Tạm hoãn / Hủy vẫn giữ nguyên; chỉ thao tác Chốt kế hoạch riêng mới gửi yêu cầu chốt, và giao diện chỉ xác nhận sau khi máy chủ thành công.
- Quyền Mở chốt dùng đúng Hủy xác nhận của Production_plan, giữ tương thích quyền Mở lại cũ. Backend kiểm riêng Sửa / Xác nhận / Hủy xác nhận, không coi Hủy xác nhận là Xác nhận. Chốt kèm chỉnh sửa còn cần quyền Sửa.
- Nút Mở chốt không bị giấu khi thiếu quyền: bấm sẽ báo quyền; khi thiếu lựa chọn hoặc sai trạng thái, tiêu đề nút giải thích lý do. Lệnh đã chuyển In Transit vẫn không được mở chốt tại đây.
- Không sửa trạng thái, quyền hay lịch sử đã lưu. Nhận mới từ Engine vẫn là Dự kiến; nhận lại dòng đã chốt giữ nguyên lần chốt thực sự trước đó. Kiểm thử nguồn bao phủ chốt thành công/thất bại, thao tác lặp, lựa chọn trạng thái và ánh xạ quyền; QA browser bản nguồn chưa thực hiện.

## 16/10/2026 — Khôi phục ranh giới dữ liệu riêng Line (source sau LIVE 508)

- Giữ quyền Xem các menu QLSX/Capacity cho LINE_A và LINE_B, nhưng dữ liệu server chỉ trả Line của phiên đăng nhập: lệnh, báo công, tiến độ/nhật ký, nhân viên, lịch, giờ Nhân sự, Capacity và định mức của lệnh được xem. Tham số Line giả trên URL không mở rộng phạm vi.
- Bộ lọc giao diện chỉ có Line của phiên; Admin và người dùng không giới hạn Line vẫn xem đủ. Giữ nguyên quyền ghi/báo công ban đầu, không cập nhật quyền hay dữ liệu lịch sử.
- Giữ sự kiện mượn/chuyển người liên quan Line để tính đúng hiện diện; loại danh tính lệnh, điều chỉnh báo cáo và nội dung nhúng thuộc Line khác khỏi phản hồi. Kiểm thử API hai chiều A/B, yêu cầu ghi bị từ chối và báo công Line của mình.
- Kiểm thử tập trung workflow/borrowing/Capacity 63/63 và HR/Line 8/8 đạt; kiểm tra cuối các payload nhúng và gate tổng hợp trước phát hành. Chưa nghiệm thu UI bản mới trên LIVE.

## 16/10/2026 — Thông báo Lệch (%) dạng nổi (source sau LIVE 507, chưa phát hành)

- Mũi tên Lệch (%) dùng Popover chung như Ghi chú giờ công; nội dung đưa ra portal ngoài bảng nên mở không làm giãn dòng. Giữ nguyên phần trăm, công thức và xuất báo cáo.
- Dùng xử lý bàn phím/focus mặc định của Radix: Enter/Space mở, Escape hoặc bấm ngoài đóng; nút đóng theo ngôn ngữ. Canh biên màn hình 12px, giới hạn chiều cao, cập nhật theo cuộn và ẩn khi điểm neo rời vùng nhìn.
- 4/4 kiểm thử source/render và typecheck đạt. Chưa có QA trực quan bản mới: trình duyệt cloud không truy cập preview local, khởi chạy Chromium local bị chặn socket. Chờ preview/phát hành được phép rồi kiểm tra chiều cao dòng, mép màn hình, cuộn và bàn phím; chưa xác nhận LIVE thay đổi.

## 16/10/2026 — Cột số giờ biến động trong Lịch sản xuất thực tế (source, chưa xác nhận phát hành)

- Bảng tra cứu tháng thêm “Số giờ theo lịch (mỗi người)” ngay sau Đến thời điểm. Giữ nguyên bắt đầu/kết thúc; số chính loại nghỉ trưa/giải lao/ngoài ca: 08:00–10:30 = 2 giờ 20 phút; 08:00–17:00 = 7 giờ 40 phút theo lịch 20 phút giải lao. Mở mũi tên đối chiếu “Giờ theo ca gồm giải lao”, tương ứng 2 giờ 30 phút / 8 giờ.
- Bảng Giờ và tiền từng NV thêm chú thích và tooltip về cơ sở giờ lịch/vắng/hiện diện đã loại giải lao; giữ nguyên các giá trị và công thức hiện có.
- Đây là thời lượng riêng từng bản ghi, chưa nhân số người; không cộng trực tiếp các bản trùng nhau. Bản hủy/chờ duyệt chỉ đối chiếu; thiếu lịch/chưa có giờ vào hoặc kết thúc hiển thị lý do. Không thay công thức hiện diện/payroll/báo công, không ghi lại dữ liệu.
- Kiểm thử source bao phủ cả hai chỉ số, ca/giải lao/trưa/ngoài ca, nhiều ngày, nhiều người, trạng thái hủy/chờ, lịch thiếu; chờ gate tổng hợp và QA trình duyệt trước nghiệm thu giao diện/phát hành.

## 16/10/2026 — Thông báo thao tác thiếu quyền và kiểm tra quyền xuất dữ liệu


- Các toolbar QLSX/Capacity có thông báo rõ khi bấm thao tác thiếu quyền; callback, submit và xuất file bị chặn trước khi thực hiện. Các điều kiện nghiệp vụ như đang xử lý/chưa chọn dòng vẫn khóa như cũ. Handler báo công, duyệt, điều chỉnh và xuất riêng cũng kiểm tra để không mở editor hoặc gửi request khi quyền không phù hợp. Backend vẫn là nơi xác thực cuối cùng; không sửa quyền lưu trên DB.
- Xuất Excel/PDF dùng đúng quyền Xuất dữ liệu của menu đang mở, không suy ra từ Xem/Sửa hay quyền xuất menu khác. Áp dụng cả xuất bảng chung, preview tải file, Capacity và báo cáo sản lượng; không chặn Xuất trạm hoặc đọc tệp Forecast gốc.
- Editor phân quyền hiển thị các quyền cũ đang có nhưng nằm ngoài danh mục; mặc định giữ nguyên, chỉ bỏ quyền được người quản trị chủ động bỏ chọn và Lưu lại. Không tự gỡ quyền, không tạo menu audit mới, không sửa dữ liệu quyền trong tác vụ nguồn.
- 35/35 kiểm thử trực tiếp về thông báo, callback/submit, quyền đổi giữa render/click, ba ngôn ngữ, export, quyền cũ và Capacity cached đạt. Review cuối giữ grant Lưu-only của báo công, loại import tồn kho khỏi phân loại export, chỉ báo thiếu quyền Capacity sau khi đã xác minh quyền. Đưa hai file kiểm thử vào npm test để chống tái phát. Chưa có nghiệm thu trực quan luồng mới trên LIVE tại thời điểm kiểm nguồn.

## 16/10/2026 — Pro Plan giữ lệnh hủy và đối chiếu giờ danh sách với tải tuần (bản sửa sau LIVE505)

- LIVE505 đã phát hành bản chỉ chuyển lệnh đã chốt, nhưng mặc định chỉ giữ Dự kiến/Đã chốt nên ẩn cả Hủy/Tạm hoãn; thẻ Giờ cần lại tiếp tục cộng lệnh đã chuyển. Bản này sửa mặc định/Xóa lọc/Quay lại thành Chưa chuyển In Transit: giữ mọi dòng chưa chuyển, gồm Hủy và Tạm hoãn với trạng thái hiện hữu. Đã chuyển vẫn xem được qua bộ lọc lịch sử; không thay dữ liệu hay mở lại lệnh đã chuyển.
- Thẻ theo Line tách bốn số: Giờ trong danh sách, Ngoài danh sách, Khả dụng tuần, Dư/thiếu tuần; tỷ lệ ghi rõ Tải tuần. Hai nhóm giờ chia tải của cùng tuần/Line theo toàn bộ danh sách đã lọc, không theo trang. Bộ lọc SKU/loại/trạng thái không làm tăng giả capacity còn trống. Lệnh Hủy/Tạm hoãn không tính tải; dòng thiếu số lượng giữ chưa xác định, thiếu định mức tiếp tục quy tắc cảnh báo hiện hữu. Lệnh đã chuyển giữ tải và căn cứ lịch sử, không cộng thêm bản In Transit lần nữa.
- Chỉ sau khi đọc được kết quả chuyển thành công, giờ của dòng chuyển từ trong danh sách sang ngoài danh sách. Đang chờ, bị từ chối, lỗi mạng hoặc đọc lại lỗi giữ số đã xác nhận trước đó. Không sửa backend, capacity, lịch sử, quyền hoặc bộ chọn tuần. Hủy LSX ở In Transit không đồng nghĩa hủy toàn Plan vì một Plan có thể có nhiều LSX; bản này không tự đổi Plan Đã chuyển thành Hủy.
- 20/20 kiểm thử UI/render/effect/callback và tích hợp API với DB TEST cô lập đạt; thêm 2/2 kiểm thử source-sync đạt. Bao phủ 22 dòng đã chuyển, ba SKU Hủy theo phản hồi, trạng thái/lọc/Line/tuần/phân trang, giờ không xác định, chuyển một phần/thất bại/đọc lại lỗi/lặp, giữ nguyên Capacity và bản ghi không liên quan. Ảnh LIVE trước sửa đã đối chiếu; preview mới là HTML render component với dữ liệu giả, chưa nghiệm thu trình duyệt. Bản gộp đạt 386/386 npm test và typecheck. Build/phát hành và nghiệm thu trực tiếp được xác nhận riêng từ kết quả chạy, không suy ra từ kiểm thử nguồn.

## 16/10/2026 — Kiểm soát chuyển Pro Plan chỉ từ lệnh đã chốt (đã phát hành trong LIVE505)

- Kiểm tra lại luồng frontend/API/backend: API dùng `mutatePlan`; backend chỉ đổi sang In Transit từ `ĐÃ CHỐT`, từ chối lệnh Dự kiến/Tạm hoãn/Hủy. Bản đã chuyển là no-op khi gửi lại với revision hiện hành; revision cũ bị chặn xung đột. Plan, In Transit và audit vẫn ghi cùng giao dịch, không cần sửa backend/schema/quyền.
- Handler giao diện kiểm tra trạng thái đã lưu trước thao tác và sau khi chờ tự lưu; dùng khóa ref tức thời để chặn callback lặp trước khi React cập nhật trạng thái busy. Nút vẫn yêu cầu toàn bộ lựa chọn đã chốt. Giữ dòng khi đang chờ, bị từ chối hoặc lỗi mạng; chỉ ẩn trong danh sách làm việc sau khi đọc được trạng thái đã chuyển từ máy chủ. Nếu máy chủ đã nhận nhưng đọc lại lỗi, giữ cảnh báo đối chiếu hiện hữu và không tự suy đoán/xóa dòng.
- Giữ bản sửa lọc ngày 15/10, lịch sử, lựa chọn xem Đã chuyển/Tất cả và giờ Capacity đã cam kết. Không sửa bộ chọn tuần, không thêm thông báo thường trực, không publish/push, không ghi dữ liệu LIVE.

## 15/10/2026 — Production Plan ẩn dòng đã chuyển trong danh sách làm việc (bản sửa cục bộ)

- Nguyên nhân: chuyển In Transit đã ghi trạng thái `ĐÃ CHUYỂN` và giữ bản kế hoạch/lịch sử đúng nghiệp vụ, nhưng mặc định `all` và nhóm `active` đều hiển thị dòng đã chuyển. Tải lại sau chuyển vẫn giữ dòng trên bảng do bộ lọc, không phải bằng chứng chuyển thất bại.
- Mặc định, Xóa lọc và Quay lại dùng nhóm Dự kiến + đã chốt; loại dòng đã chuyển khỏi bảng làm việc, phân trang, báo cáo/xuất theo bảng và thao tác hàng loạt. Tra cứu rõ Tất cả trạng thái/Đã chuyển vẫn xem được lịch sử; dòng đã chuyển không được chọn để thao tác. Giữ công thức/căn cứ Capacity gồm giờ đã chuyển, không thêm nhãn/ghi chú/banner.
- Không sửa API, database, trạng thái nghiệp vụ, lịch sử, dữ liệu In Transit hay cách xử lý chuyển thất bại. Kiểm thử dùng dữ liệu giả; chưa đối chiếu dòng thực tế tuần 42 do phiên trình duyệt LIVE đã hết. Chưa publish; tác vụ chính kiểm tra build trước khi phát hành nếu được yêu cầu.
- 68/68 kiểm thử tập trung đạt, gồm 8 kiểm thử render/effect/callback thật với HTTP giả cho lọc, xuất, chọn hàng, chuyển thành công/thất bại, đọc lại lỗi, refresh, mở lại menu và ba ngôn ngữ. Typecheck và diff check đạt. Lint file sửa giữ nguyên 6 lỗi/7 cảnh báo có sẵn khi so với HEAD; kiểm thử mới không có lỗi/cảnh báo lint.

## 15/10/2026 — Bỏ hai checkbox khi tạo Chuyển Line (bản sửa cục bộ)

- Theo yêu cầu tiếp theo, bỏ “Chuyển hẳn theo Danh sách NV từ ngày đã chọn” và “Chọn từ toàn bộ danh sách NV” khỏi khung tạo Chuyển Line. Bỏ state/nhánh tạo tương ứng; chọn nhân viên đang hoạt động thuộc đúng Line nguồn, luôn nhập thời điểm kết thúc. Payload tạo không còn directoryAssignment và không tạo chuyển không hạn.
- Chuyển hẳn xử lý tại Danh sách nhân viên. Không đổi API, nghiệp vụ bản cũ, lịch sử chuyển dài hạn hoặc hộp sửa/hủy bản cũ. Giữ giới hạn riêng haquyen, quyền cnphuong và việc bỏ ô Lý do tạo biến động.
- 27/27 kiểm thử tập trung và typecheck đạt; diff check đạt. Kiểm thử gồm lọc Line nguồn, đổi Line xóa chọn cũ, payload có kết thúc, hai checkbox biến mất và lịch sử chuyển dài hạn vẫn sửa/hủy được. Chưa publish trong tác vụ này.

## 15/10/2026 — Bỏ nhập Lý do khi tạo biến động nhân lực (bản sửa cục bộ)

- Bỏ ô Lý do trong khung tạo Nghỉ/Đi trễ/Về sớm/Phụ kho/Chuyển Line; payload tự ghi đúng loại đã chọn làm lý do mặc định cho nhật ký. Giữ loại, thời gian, nhân viên và dữ liệu lịch sử. Không bỏ lý do bắt buộc khi sửa lịch hoặc sửa/hủy bản ghi.
- Trước yêu cầu bỏ hai checkbox tiếp theo, hai checkbox chuyển Line được giữ nguyên: chuyển hẳn tạo khoảng không có ngày kết thúc theo Line nhận đã có trong Danh sách NV, không sửa danh sách NV; chọn toàn bộ mở rộng danh sách đang hoạt động cho chuyển tạm, còn chế độ chuyển hẳn vẫn lọc theo Line nhận.
- 26/26 kiểm thử giao diện/quyền tập trung đạt, gồm haquyen chỉ 3 loại, cnphuong giữ các thao tác, payload lý do theo loại và hành vi hai checkbox. Chưa publish trong tác vụ này.

## 15/10/2026 — Hồ sơ giao diện nhập HR chỉ cho haquyen (bản sửa cục bộ sau LIVE503)

- Ảnh phản hồi của haquyen cho thấy LIVE503 vẫn có đủ 5 tab vì tài khoản đồng thời có quyền quản lý. Bản này dùng đúng login phiên đăng nhập đã có (`session.login` → `preferenceUser`), áp dụng yêu cầu riêng chỉ cho `haquyen`: nhóm nhập biến động chỉ còn Nghỉ, Đi trễ, Về sớm, kể cả khi có quyền quản lý. Không dùng tên hiển thị/department suy đoán và không yêu cầu đổi grant.
- Tách quyền hiển thị thao tác nhân lực khỏi quyền sửa lịch. Các tab, bộ chọn loại, sửa/hủy/điều chỉnh nhân lực và biểu mẫu LSX dùng hồ sơ nhập đã giới hạn; quyền sửa lịch và quyền khác vẫn như trước. Lịch sử/công thức giữ nguyên; cnphuong giữ Phụ kho/Chuyển Line theo quyền hiện có; tài khoản QLSX/Admin khác không thay đổi. Đây là giới hạn giao diện theo yêu cầu, không thu hồi quyền backend hay thay đổi xác thực.
- Bổ sung kiểm thử haquyen với quyền kết hợp và cnphuong giữ nguyên 5 tab, tài khoản khác/Admin, login khác tên hiển thị, đường truyền danh tính phiên và lựa chọn chuyển Line cũ khi đổi tài khoản. Chưa publish trong tác vụ này; tác vụ chính kiểm tra bản build/phát hành.

## 15/10/2026 — Giữ đúng nhóm nhập vắng mặt HR (bản nguồn cục bộ chưa publish)

- Tại Lịch SX thực tế, HR theo quyền hiện có `Ghi vắng mặt` chỉ có Nghỉ, Đi trễ, Về sớm; khóa lựa chọn cũ ở tab/Tra cứu khi đổi quyền, không cho biểu mẫu cũ ghi Phụ kho/Chuyển Line. Hộp sửa/hủy/điều chỉnh giờ kiểm tra lại nhóm thao tác theo quyền hiện tại; màn tổng hợp tháng giữ dữ liệu lịch sử, không cho HR sửa/hủy phụ kho hoặc chuyển Line. Sửa bộ chọn vắng mặt LSX cũ từng hiện Phụ kho vô điều kiện.
- Dùng quyền HR/QLSX từ workflow hiện hữu, không nhận diện theo tên đăng nhập, không đổi phân quyền, xác thực, API hay công thức/dữ liệu. Admin và người được cấp đồng thời quyền HR + quản lý vẫn giữ nhóm thao tác cũ. Để có giao diện HR-only, tài khoản cần Xem + Ghi vắng mặt của Lịch SX thực tế, không đồng thời có quyền quản lý SX.
- 9/9 kiểm thử mới đạt: render/callback/effect thật với props và dữ liệu giả, gồm mặc định, tra cứu cũ, đổi quyền, hộp chỉnh sửa/điều chỉnh, lịch sử tháng và quyền QLSX/Admin. 74/74 kiểm thử hồi quy đạt (gồm 7 kiểm thử mới ở lần chạy đầu); typecheck đạt trước bổ sung effect đóng hộp tháng. Chưa kiểm tra trực quan trình duyệt, chưa build/publish trong tác vụ này; tác vụ chính kiểm tra bản gộp.

## 15/10/2026 — Thu gọn nhãn đăng nhập Line (bản sửa cục bộ chưa publish)

- Hai nút chỉ còn nhãn “Đăng nhập line A” và “Đăng nhập line B”, giữ huy hiệu A/B và tiêu đề khu vực; bỏ dòng “Chỉ báo công Line …”. Nhãn căn giữa theo chiều dọc và cho phép xuống dòng khi hẹp. Luồng đăng nhập, quyền và điều kiện khóa nút giữ nguyên; Line chưa hoạt động có tooltip giải thích.
- 3/3 kiểm thử render/nhãn/khóa nút/CSS và 1/1 kiểm thử tích hợp quyền Line đạt; typecheck đạt. Chưa nghiệm thu trực quan trình duyệt: Chromium cục bộ bị sandbox chặn socket khởi động. Chưa publish.

## 15/10/2026 — Danh sách nhân viên tải nền không làm nhảy bảng (bản sửa cục bộ chưa publish)

- Nguyên nhân: chu kỳ cập nhật chung 45 giây gọi lại danh sách; mỗi lần đều bật trạng thái tải ban đầu và chèn dải xanh phía trên bảng dù đã có dữ liệu. Bộ đo chiều cao bảng phản ứng theo vị trí mới, tạo thay đổi bố cục.
- Chỉ lần đọc đầu tiên hiện thông báo tải. Đọc nền giữ dòng, khóa dòng theo mã NV, lựa chọn và bản nháp/revision; không bật/tắt trạng thái đang lưu và không xóa lỗi lưu. Lỗi đọc có cảnh báo/Thử lại; 401/403 vẫn xóa dữ liệu và bản nháp không còn quyền. Không đổi nhịp cập nhật, API, nghiệp vụ hoặc bộ phân trang chung.
- 13/13 kiểm thử tập trung đạt; typecheck đạt. Kiểm thử chạy render/effect/callback thật với HTTP/DOM giả: tải nền không thay markup, giữ bản nháp và lỗi xung đột, phân trang giữ trang 3/vị trí cuộn khi dữ liệu không đổi hoặc cập nhật; chỉ bấm chuyển trang mới gọi scrollTo. Kiểm thử DOM giả không thay thế nghiệm thu trực quan trình duyệt LIVE. Chưa deploy.

## 15/10/2026 — Thu gọn thông báo tải nền SKU/Capacity (bản sửa giao diện chưa publish)

- Không hiện dải thông báo đầu trang cho tải lại nền, dữ liệu đã tải hoặc đang kiểm tra quyền SKU; Capacity đã có dữ liệu cũng không thêm dòng cập nhật/thời gian thường trực. Vẫn giữ cảnh báo lỗi kèm Thử lại, thông tin dữ liệu cũ khi lỗi, thông báo đổi quyền và trạng thái tải lần đầu tại vùng dữ liệu; chưa tải thành công không hiện số SKU bằng 0, gồm ô đếm trong bảng Leadtime. Không đổi cache, tải dữ liệu, nghiệp vụ hay xác thực.
- 21/21 kiểm thử tập trung SKU/Capacity/Home đạt; typecheck đạt. Đây là thay đổi nguồn cục bộ, chưa deploy.

## 15/10/2026 — Giữ dữ liệu SKU/Capacity khi mở lại menu (bản nguồn chưa publish)

- SKU dùng ảnh chụp dữ liệu chung trong RAM; mở menu đã có dữ liệu hiển thị ngay, không chờ kiểm tra quyền xác nhận. Capacity giữ tối đa 8 tuần, chỉ hiển thị đúng tuần; quyền thao tác được kiểm tra lại trước khi bật. Có thời điểm tải thành công, trạng thái đang cập nhật, lỗi và Thử lại; phản hồi rỗng thành công thay dữ liệu cũ.
- Đổi tài khoản/quyền hiệu lực xóa dữ liệu giữ lại và chặn phản hồi phiên cũ; đổi tên/ngôn ngữ/thứ tự quyền không đóng màn hình hay mất bản nháp. Khi quyền đổi có thông báo rõ về việc làm mới và không giữ thay đổi chưa lưu của phiên quyền cũ. Bản nháp Capacity cùng phạm vi giữ dòng sửa và revision kiểm tra xung đột qua refresh.
- Kiểm thử tập trung đã đạt; typecheck/build cuối do bước tích hợp xác nhận. Chưa publish sau LIVE499, chưa nghiệm thu trực quan LIVE; không sửa backend quyền, dữ liệu sản xuất hoặc công thức. Chi tiết: `docs/RETAINED-MENU-DISPLAY-2026-10-15.md`. Warehouse/basic-master chưa chuyển sang cơ chế hiển thị này.

## 08/10/2026 — User Line A, Line B và đăng nhập bằng nút Line

- Màn hình đăng nhập có Vào Line A/B; API tạo phiên HttpOnly 8 giờ bằng tài khoản thực LINE_A/B, F5 giữ đúng Line. Quyền cố định USER: chỉ xem và thao tác báo công Line tương ứng. Không vào nhân sự, quỹ sản lượng, quản trị, sao lưu hoặc điều chỉnh QLSX; không dùng trường role/grants từ trình duyệt. Nhật ký đăng nhập và nghiệp vụ giữ ID user Line.
- Quản lý người dùng có nút Tạo user Line A, Line B, tạo rõ ràng qua phiên Admin, không tự seed khi mở trang. Không ghi đè ID đã tồn tại, thao tác lặp lại không tạo trùng. User Line có cột phương thức đăng nhập, không đặt mật khẩu hay nâng vai trò; ngưng hoạt động thu hồi phiên.
- Kiểm thử DB TEST: tạo chỉ Admin, không seed khi đọc, cookie/F5, Line A/B, chặn khác Line và quyền QLSX/quản trị, sửa vai trò, ngưng hoạt động, audit. Chưa tạo hai tài khoản trên DB LIVE; đã có phiên Admin nhưng cần xác nhận tại bước mở đăng nhập không mật khẩu cho hai Line theo quy định thao tác trình duyệt.

## 05/10/2026 — Chọn nhanh nhân viên và thông tin trong ngày khi nhập trạm

- Danh sách nhập trạm dùng CapacityEmployeePicker chung, bổ sung tùy chọn Chọn tất cả; chỉ tích người đủ điều kiện, sau đó bỏ tích từng NV. Checkbox có trạng thái một phần, số người cập nhật ngay. Những nơi dùng picker hiện hữu giữ cách chọn cũ nếu không bật tùy chọn này.
- Tại các thao tác chọn nhân viên của LSX, mỗi NV hiển thị nghỉ HC/TC đã đăng ký và biến động thực tế cùng ngày đang chọn: đi trễ (giờ vắng hoặc Chưa đến), phụ kho, về sớm, nghỉ, có mặt thực tế; bản sửa mới thay bản cũ, có nhãn chờ duyệt. Dùng giờ Việt Nam 24h và dữ liệu hiện có, không tạo bản ghi hoặc trừ giờ thêm lần nữa.
- Khi nhập trạm, NV đang đi trễ vẫn được chọn theo quy tắc hiện hành. NV nghỉ/phụ kho hoặc ngoài ca tại thời điểm đó hiển thị làm mờ kèm lý do, không được Chọn tất cả. Người đang thuộc LSX cũ vẫn chọn được và chuyển theo luồng hiện hành.
- Đã kiểm thử 15 tình huống về thông tin trong ngày, sửa giờ, lịch Capacity và luồng nhân lực/giờ công. Đã kiểm tra giao diện TEST: 9 người đủ điều kiện và 1 người phụ kho không đủ điều kiện; Chọn tất cả chọn 9, bỏ 1 còn 8 và checkbox một phần; thông tin đi trễ/phụ kho cùng khoảng giờ hiển thị rõ, nút Xong/Xác nhận còn nhìn thấy. Typecheck/build theo lần cập nhật này; chưa nghiệm thu bằng phiên đăng nhập LIVE của người dùng.

## 05/10/2026 — Bộ LSX mẫu Line A/B và hướng dẫn nghiệm thu

- Nút LSX mẫu dùng chung StandardToolbar tại SX báo công, Lịch SX thực tế, Tiến độ và Nhật ký. Admin không giới hạn Line mở bộ ví dụ; lần bấm đầu tạo rõ ràng 8 LSX, 20 NV giả và lịch Capacity đã duyệt trong vùng lưu riêng. Không tạo dữ liệu khi đọc hoặc mở menu; mở lại không tạo trùng và không xóa/ghi đè dữ liệu mẫu hiện có.
- Dữ liệu thử dùng chính các API nghiệp vụ đang chạy. Bảng riêng `production_example_records` cách ly LSX, báo công, nhân viên, Capacity, lịch, sự kiện, kiểm soát đồng thời, audit và đề nghị nhập kho. Xác thực và quyền vẫn lấy dữ liệu thật; không có tài khoản hay quyền admin mới. Trong tab đang thử, các menu báo công/lịch/tiến độ/nhật ký tiếp tục cùng chế độ; Dữ liệu thật quay lại dữ liệu hiện hành. Các menu KHSX/Kho thật không chuyển sang chế độ mẫu.
- Bộ ví dụ có hai lệnh đang chạy 10 NV từ 08:00; nhập trạm lệnh mới lấy bốn NV làm lệnh cũ còn sáu, lệnh mới bốn. Hai ngày thử đều ở quá khứ để admin kiểm tra ngay: đi trễ chưa đến/giờ vào, phụ kho, về sớm, chặn trùng, tạm ngưng/tiếp tục, sản lượng 80+120 theo hai ngày, HT sớm/đúng/trễ, lý do trễ và điều chỉnh giờ đã duyệt. Hướng dẫn và kết quả cụ thể nằm trong khung thu gọn ở từng màn hình mẫu.
- Kiểm thử API với D1 TEST và phiên đăng nhập thật của bộ kiểm thử: tạo/mở lại/đồng thời, chặn tài khoản không có quyền, 10→6+4 trên cả A/B, giờ A=20/6,83 và B=20,5/6,83, thiếu giờ vào, duyệt giờ trước/sau, bản báo công gốc không bị ghi đè, lý do trễ, ngày hoàn thành độc lập thứ tự duyệt, đề nghị nhập kho cách ly và đối chiếu mọi bản ghi thật trước/sau không thay đổi. 106 kiểm thử toàn bộ đã đạt. Kiểm tra giao diện dùng dữ liệu giả: mở bộ mẫu, chọn bốn người đang ở LSX cũ, nút Xong và Xác nhận không bị che, chuyển lịch thực tế giữ chế độ và đúng tuần. Chưa nghiệm thu bằng phiên đăng nhập LIVE của người dùng.

# Tình trạng chức năng ONSPA TEST

## 30/09/2026 — Xem cấu trúc BOM cha–con trong menu BOM

- Nút Xem cha–con nằm trong StandardToolbar của BOM, dùng mã được chọn trên danh sách hoặc BOM đang mở. Không tạo menu riêng. Bảng có Mã hàng và Lớp L0/L1/L2…, dòng L0 là BOM gốc; giữ STT, tên, quy cách, hao hụt, lượng dùng, mẫu số, ngày hiệu lực/hết hiệu lực, đơn vị, nguồn theo từng dòng BOM riêng. Có mở/thu nhánh, giới hạn lớp, xuất Excel XML và mở lại BOM riêng bằng mã hàng.
- Chỉ bóc BOM đã xác nhận và các dòng đang hiệu lực tại ngày tra hiện tại. Không sửa nguồn hoặc tự quy đổi lượng dùng. Nhánh thiếu BOM tự chế/ủy thác, BOM chưa xác nhận, mã trùng nguồn, liên kết vòng hoặc ngày không hợp lệ được báo rõ; không đoán BOM hay mở tiếp nhánh không xác định. Có giới hạn lớp/số dòng. Chưa có tính nhu cầu theo kế hoạch và chưa tra cấu trúc lịch sử tại ngày tùy chọn.
- Kiểm thử giữ nguyên toàn bộ định mức trong chuỗi 102XS02001 → 3060301 → 3060301B → 2016G001; kiểm thử nhánh dùng chung, vòng, đóng/mở, giới hạn lớp và ngày hiệu lực. Chưa nghiệm thu trực quan sau đăng nhập LIVE. Không migration, seed, reset hay thay dữ liệu BOM hiện hành.

## 30/09/2026 — Thu gọn đầu trang BOM

- Bỏ dải Tệp BOM và tài liệu khỏi danh sách, tra cứu và chi tiết BOM. Nút Trở lại danh sách BOM nằm trong StandardToolbar của chi tiết/thêm mới và phiếu thay đổi mở từ BOM, không còn nút riêng phía trên. Giữ nguyên dữ liệu và tệp đã lưu. Kiểm tra mã kiểu và build; chưa nghiệm thu trực quan sau đăng nhập LIVE.

## 29/09/2026 — Đăng ký nghỉ nhiều ngày và thu gọn Chi tiết vệ sinh

- Tab Nghỉ ở Lịch sản xuất thực tế có Từ ngày–Đến ngày, cùng giờ bắt đầu/kết thúc áp dụng cho mỗi ngày làm việc. API kiểm tra Capacity đã duyệt, danh sách người, lịch làm và trùng giờ của toàn khoảng (tối đa 32 ngày) rồi lưu các sự kiện trong một giao dịch; bỏ qua ngày không làm. Nếu một ngày sai, không lưu ngày nào. Những ngày có báo công cũ chờ QLSX duyệt giờ theo nhóm trong một lượt; giờ/sản lượng gốc vẫn được đối chiếu.
- Chi tiết vệ sinh chỉ hiện những ngày có nhóm vệ sinh; nếu tuần không có vệ sinh thì không hiện cả khung. Số Người thực tế được tăng cỡ chữ bằng quy tắc ưu tiên trên màn Báo công. Lịch làm việc thực tế dùng một thanh Chức năng chung cho cập nhật, lịch sử, lưu, tuần, Line và lý do; tiêu đề tuần hiện số thứ tự ISO cùng khoảng thứ Hai–Chủ nhật, bỏ dòng Capacity V2. Với biến động nhân lực, bỏ ô Lý do; lưu tên tab Nghỉ/Đi trễ/Về sớm/Phụ kho/Có mặt làm lý do mặc định kể cả khi API không gửi lý do. Lý do cập nhật lịch vẫn nhập riêng. Thông báo của Quản lý sản xuất phân biệt rõ thao tác thành công màu xanh và lỗi màu đỏ; nếu lưu được nhưng tải lại thất bại, giữ lỗi tải lại màu đỏ. Đã kiểm thử nghiệp vụ và build; chưa kiểm tra trực quan sau đăng nhập LIVE.

## 29/09/2026 — Lịch sản xuất thực tế đồng nhất thời gian và bố cục

- Khung ghi biến động nhân lực hiển thị ngày, giờ bắt đầu/kết thúc 24h, danh sách NV, lý do và nút ghi nhận trên một hàng khi đủ chiều rộng; màn hình hẹp tự xuống dòng. Dùng lại `ClockInput` của Capacity để tránh SA/CH theo ngôn ngữ trình duyệt. Lịch sử ghi nhận theo HH:mm dd/MM/yyyy.
- Số Người thực tế lớn hơn và bấm được để mở người nghỉ/biến động HC/TC theo ngày, gồm đăng ký Capacity và ghi nhận QLSX. Bỏ lời nhắc thừa và phần sửa giờ giải lao ở lịch thực tế; Chi tiết từng ngày chỉ hiển thị vệ sinh. Bộ chọn nhân viên cuộn riêng danh sách tên, nút Xong luôn nằm ngoài vùng cuộn. Đã typecheck/build/test; còn cần kiểm tra trực quan sau đăng nhập LIVE trên desktop và di động.

## 29/09/2026 — Ghi chú biến động nhân lực vào giờ công LSX

- Các lượt báo công có nhân viên liên quan đến nghỉ, đi trễ, về sớm, phụ kho hoặc thực tế có mặt hiển thị ghi chú tự động “QLSX cập nhật NV …”, gồm tên/mã nhân viên, khoảng giờ, người ghi, thời điểm ghi và lý do. Bảng Sản lượng và giờ công hiển thị tóm tắt ghi chú theo LSX; chi tiết LSX giữ ghi chú báo sản lượng ban đầu và hiển thị các ghi chú giờ công riêng.
- Biến động theo Line chỉ gắn vào lượt báo công của LSX mà nhân viên thực sự được phân công trong khoảng giao nhau. Ghi chú lấy từ sự kiện đã lưu; sự kiện chờ duyệt chưa được tính vào giờ hoặc ghi chú báo công cho tới khi QLSX duyệt. Giờ đã lưu được đối chiếu qua lịch sử điều chỉnh; không ghi đè báo công gốc. Đã kiểm thử hai LSX cùng Line để tránh ghi chú nhầm; chưa nghiệm thu trực quan bằng tài khoản đăng nhập LIVE.

## 29/09/2026 — Biến động nhân lực theo Line và sửa đăng ký nghỉ

- Lịch sản xuất thực tế dùng cùng bộ chọn nhân viên thu gọn với Capacity cho nghỉ, đi trễ, về sớm, phụ kho, có mặt thực tế và chuyển người; không cần chọn LSX nguồn cho biến động theo Line. Có mặt thực tế ghi ngoại lệ đối với người đã đăng ký nghỉ trong Capacity. Các mốc biến động theo người được dùng để chia giờ của báo công đúng khoảng thực tế; nếu giao báo công đã lưu thì chờ QLSX duyệt điều chỉnh giờ, giữ sản lượng và bản gốc. Luồng chuyển người vẫn cần xác định LSX nguồn và đích.

## 29/09/2026 — In Transit: ẩn dòng và số tuần kế hoạch

- StandardToolbar dùng một nút Hiển thị dòng mở bảng chọn bật/tắt dòng Hoàn thành và Hủy; Hiện tất cả đưa bảng về đầy đủ. Đây là lọc hiển thị, không yêu cầu tích dòng và không ghi hay thay đổi trạng thái bản ghi. Các lọc tra cứu và phân trang tiếp tục chạy trên danh sách còn hiển thị.
- Dòng ngăn cách tuần hiển thị số tuần ISO theo lịch thứ Hai–Chủ nhật cùng khoảng ngày và chữ lớn hơn. Tuần 14/09–20/09/2026 là tuần 38; tuần 28/09–04/10/2026 là tuần 40. Chưa nghiệm thu trực quan sau đăng nhập LIVE.

## 29/09/2026 — Giờ công trong Production Plan

- Cột Giờ công theo từng dòng = SL kế hoạch × Giờ công/SP; thay đổi SL cập nhật số giờ ngay trong bảng. Chi tiết hiển thị cả Giờ công/SP và tổng Giờ công, bản xuất Excel có hai giá trị tương ứng.
- Định mức của dòng chưa chốt đọc lại từ Dữ liệu cơ bản / Giờ công qua API Production Plan khi dữ liệu thay đổi; dòng đã chốt hoặc chuyển In Transit giữ định mức tại lúc chốt. Các màn hình đang mở nhận tín hiệu cập nhật trong tab, giữa tab, lúc focus hoặc khi tải lại định kỳ theo cơ chế hiện có. Chưa nghiệm thu thao tác LIVE sau đăng nhập.

## 26/09/2026 — Nhập trạm và giờ công theo nhân viên có mặt từng ngày

- Danh sách Nhập trạm của Line lấy danh sách nhân viên đã xếp ca trong Capacity được KHSX đồng ý, lọc đăng ký nghỉ HC/TC theo tên, ca và thời điểm thực tế, người đã thuộc LSX khác và các biến động nghỉ QLSX đã ghi. Chỉ tự tích sẵn khi danh sách theo ca đủ xác định; số người tự theo tên được tích. API kiểm tra lại cùng điều kiện, không nhận người nghỉ dù giao diện cũ gửi lên.
- Lệnh đã nhập trạm giữ danh sách phân công lịch sử, nhưng khi báo công qua ngày kế tiếp, giờ của từng nhân viên chỉ tính trong ngày/ca họ có mặt; người nghỉ không cần nhập trạm lại hay giả lập giảm người vĩnh viễn. Cột người hiện tại trong ca trừ người vắng. Mở ngày HC mới từ ngày nghỉ trong Capacity cho phép kế thừa danh sách HC ngày làm gần nhất, sau đó trừ người nghỉ ngày mới.
- QLSX có thể ghi nghỉ theo tên ở Lịch làm việc thực tế khi chưa có LSX nguồn, một ngày mỗi lần, có lý do và thời gian hiệu lực; kiểm tra quyền, lịch đã duyệt và giao nhau. Trường hợp kỳ đã có báo công lưu bị chặn để chuyển sang quy trình duyệt giờ; không ghi đè giờ đã xác nhận. Chưa nghiệm thu bằng tài khoản thực trên thiết bị di động.

## 26/09/2026 — Lịch làm việc thực tế theo ảnh giao diện

- Lịch làm việc thực tế trình bày bảng 7 ngày (HC, nghỉ trưa, nghỉ trước TC, TC, người thực tế, ghi chú) và khung Biến động nhân lực với các tab Nghỉ, Đi trễ, Về sớm, Phụ kho, Chuyển Line. Chi tiết giải lao/vệ sinh thu gọn để giữ bảng chính gọn; giờ trong bảng chọn theo định dạng 24 giờ. Chuyển Line từ tab dùng LSX nguồn và LSX đích của quy trình điều chuyển đã có, chọn nhân viên trong khung thao tác; chưa có thao tác điều chuyển chỉ bằng tổng số người Line khi chưa xác định LSX nguồn.
- Chỉ khi KHSX đồng ý phiên bản Capacity thì lịch thực tế của tuần/Line mới tự có bản tham chiếu. Trong lúc xin điều chỉnh hoặc chờ duyệt lại, vẫn lấy phiên bản KHSX đồng ý gần nhất từ lịch sử Capacity; sau khi KHSX đồng ý bản mới, phần lịch chưa bị QLSX đổi dùng tham chiếu mới, các ngoại lệ thực tế đã đổi được giữ. Lưu QLSX kiểm tra phiên bản Capacity và phiên bản lịch; không ghi khi chưa duyệt. Bản Capacity đã chốt không bị sửa ngược.
- Biến động theo LSX và giờ công từ lịch thực tế dùng cơ chế hiện có. Số người ở bảng ngày lấy nhân lực dự kiến Capacity cộng/trừ biến động đã ghi trong tuần; khi LSX đã có báo công xác nhận, sửa lịch trùng kỳ vẫn cần luồng duyệt giờ riêng, không tự ghi đè. Chưa nghiệm thu trực tiếp với tài khoản đăng nhập trên thiết bị thật.

## 26/09/2026 — Báo công sản xuất theo bản thiết kế 23/09, đang tích hợp

- Source HEAD lấy từ Site 305 trước khi sửa. Menu Báo công sản xuất nối năm màn hình: Lịch sản xuất thực tế, SX báo công, Tiến độ sản xuất, Nhật ký báo công và Sản lượng/giờ công; giữ StandardToolbar. Dữ liệu LSX chỉ đọc những lệnh đã đồng bộ từ In Transit; backend giới hạn Line theo tài khoản, quyền quản lý và trạng thái. Danh sách nhân viên lấy từ Dữ liệu cơ bản.
- API nghiệp vụ ghi sự kiện nhập trạm, chuyển người nguồn/đích trong một giao dịch, bổ sung/giảm, nghỉ/phụ kho có thời điểm hiệu lực riêng lúc ghi, tạm ngưng/tiếp tục, sự cố tùy chọn dừng, và báo sản lượng chờ QLSX. Lịch thực tế tuần/Line tách khỏi bản Capacity đã xác nhận, lưu phiên bản/lý do; từ chối thay lịch ngày giao báo công đã duyệt. Không có migration hoặc seed dữ liệu hoạt động.
- Tính HC/TC theo mốc đổi người và lịch Việt Nam, nghỉ trưa/giải lao/vệ sinh; khi LSX có danh tính đầy đủ lưu giờ từng nhân viên và đối chiếu tổng. Nghỉ nhập muộn giao báo công được giữ chờ QLSX; sau duyệt ghi sự kiện tính lại giờ và bản trước/sau bất biến, số lượng báo công giữ nguyên. Lịch sử Capacity và lịch thực tế tham gia Nhật ký theo quyền. Bảng sản lượng chỉ chia giờ theo số SP đã duyệt nếu đủ dữ liệu.
- API chung không còn nhận ghi trực tiếp `production_report` và không cho đọc báo công toàn Line qua `/api/records`; chỉ đọc qua API giới hạn Line. Duyệt báo công giới hạn QLSX/Line; chặn duyệt trong lúc có yêu cầu điều chỉnh giờ đang chờ.
- **Chưa hoàn tất:** đối chiếu trần người vệ sinh với nhân sự thực tế từng LSX/ngày và giờ theo người cho nhóm vệ sinh chỉ có số lượng; đối chiếu tất cả phân công cũ không có danh tính; luồng duyệt hồi tố cho chuyển/bổ sung/giảm người và chỉnh lịch ngày đã duyệt (hiện chặn); sự cố KHSX tiếp nhận/phản hồi và lệnh thay thế đang chờ mã Google Sheet; hủy/khôi phục; tổng hợp nhật ký mọi nguồn SX; khóa kỳ và đồng bộ giờ downstream; nghiệm thu thao tác thực trên desktop/điện thoại sau đăng nhập. Không xem chức năng tổng thể đã nghiệm thu hoặc đã đưa lên Site chỉ từ typecheck/build/TEST.

## 25/09/2026 — Danh sách nhân viên theo file DSNV.xls

- Mục Dữ liệu cơ bản / Danh sách nhân viên đã có từ phiên bản trước. Bổ sung Line C và mã nhân viên ngắn, cho nhập, sửa, lọc, lưu phiên bản và xem lịch sử; quyền xem/sửa tiếp tục kiểm tra tại backend.
- File mẫu có 31 người (A 12, B 11, C 8). Ban đầu chưa nhập tự động vào D1; lần đọc LIVE 25/09/2026 sau đó đã thấy đủ 31 bản ghi nhân viên được nhập thông qua giao diện. Capacity chỉ có Line A/B; người Line C không tự được đưa vào lịch A/B.
- Đối chiếu D1 LIVE sau phiên bản 283: bảng app_records chưa có dòng entity employees; menu nhân viên cũng chưa nằm trong danh mục cấp quyền nên tài khoản Capacity không thấy mục này. Đã thêm danh mục quyền cho Admin cấp riêng; người được xem Capacity có thể xem nhân viên mà không tự có quyền sửa. Thêm nhập từ bản sao ô Excel hoặc CSV, xem trước số người A/B/C, và nhập nguyên lô có kiểm tra trùng mã, không ghi đè hoặc nhập một phần. Việc nhập cần tài khoản có quyền Thêm/Sửa Danh sách nhân viên; không tự thực hiện trên menu hoặc lúc deploy.


## Lịch làm việc — căn theo mẫu giao diện 25/09/2026

- Bản chỉnh sau phiên bản 285: bảng 7 ngày có NV HC/NV TC. Trên màn hình rộng, danh sách của ngày được chọn hiển thị bên cạnh bảng để dùng phần trống; trên màn hình hẹp, danh sách mở ngay dưới ngày. Tích người theo ca HC hoặc TC rồi chọn chuyển sang Line đối diện; hành động chuyển nhiều người cập nhật hai Line trong một lần trên bản nháp và cần Lưu nháp. Nếu nhân viên có đăng ký nghỉ, vệ sinh hoặc thời gian khác trong ca, người dùng phải sửa các đăng ký trước khi điều động. Quyền, ngày/ca phía nhận và trạng thái Nháp của hai Line được kiểm tra trước khi cập nhật. Tuần 21/09 trên D1 là bản lưu dạng tổng hợp không có lịch/người theo ngày; không tự gán dữ liệu nhân viên nhập sau này vào lịch sử.

- Màn hình Lịch làm việc thu gọn theo ảnh mẫu: đầu trang là tuần/Line/trạng thái và StandardToolbar; dưới đó là người HC, người TC, hệ số; bảng bảy ngày có các cột riêng cho HC, nghỉ trưa, giải lao sáng/chiều, nghỉ trước TC, vệ sinh và tăng ca.
- Danh sách nhân viên thu gọn mặc định, bấm để xem/điều chỉnh; chi tiết vệ sinh và tăng ca đặt cạnh nhau. Ba bảng nghỉ HC, nghỉ TC và thời gian khác đặt liên tiếp, giữ chọn nhân viên theo tên, loại và nội dung. Trên điện thoại lịch và dòng đăng ký vẫn chuyển thành thẻ.
- Chỉ đổi trình bày và ô nhập giờ dạng 24 giờ để tránh trình duyệt hiển thị 05:00 thay vì 17:00 trong bảng hẹp. API lưu, tính giờ, quyền, lịch sử, xác nhận và liên kết Plan không thay đổi. Kiểm thử 18 ca Capacity, typecheck, build; kiểm tra hình ảnh qua trang mẫu local. Chưa xác thực giao diện thực tế sau đăng nhập bằng tài khoản LIVE.

## Capacity tuần — cập nhật 25/09/2026

- Tuần mới có thể nhập và **Lưu nháp ngay** trên Lịch làm việc, không cần tạo tuần trước. Hệ số khởi tạo **95%** theo từng tuần/Line; bản Capacity đã lưu giữ hệ số/phiên bản cũ. Khi có quyền sửa hệ số, thay đổi được lưu trong lịch sử trường và phiên bản Capacity.
- Dữ liệu cơ bản có **Danh sách nhân viên** riêng với tài khoản đăng nhập, lưu bền vững, không xóa cứng. Tuần mới lấy nhân viên đang hoạt động theo Line; mỗi ngày có danh sách HC/TC thu gọn để thêm, bỏ hoặc điều động giữa A/B. Lưu cả hai Line cùng một bản cập nhật và chặn trùng nhân viên cùng ca/ngày ở backend.
- Đăng ký nghỉ HC/TC và thời gian khác chọn tên trong lịch đã phân công; thời gian khác có **loại** và **nội dung cụ thể**. Dòng cuối có thể nhấn phím mũi tên xuống tại ô nhập để thêm dòng; điện thoại dùng nút Thêm dòng. Các bản ghi cũ dạng chỉ số người vẫn đọc theo dữ liệu cũ, không tự quy tên.
- Nghỉ HC cả ngày nhiều ngày có thể tích nghỉ TC khi khoảng đó có lịch tăng ca. Dòng TC liên kết hiển thị trong mục Nghỉ TC với khoảng ngày TC riêng nằm trong khoảng HC, chọn toàn bộ hoặc sửa giờ TC; chỉ tính các ngày có lịch tăng ca và chặn trừ lặp nhân viên ở backend. Dòng nghỉ TC độc lập cũng có Từ ngày – Đến ngày. Cần nghiệm thu thao tác thực tế trên điện thoại bằng tài khoản đăng nhập.
- Tổng hợp Capacity dùng bảng theo tuần/Line với khung gửi yêu cầu điều chỉnh bên phải, lưu lý do và nội dung dự kiến sửa riêng trong lịch sử. Yêu cầu chờ hiển thị tại Confirm trong Production Plan cho KHSX có quyền duyệt; KHSX duyệt cho sửa mới tự mở Lịch làm việc của Line đó. Backend khóa gửi yêu cầu, duyệt mở khóa, hủy xác nhận và tiếp tục sửa bản đang điều chỉnh sau 23:59 thứ Bảy **trước** tuần kế hoạch theo giờ Việt Nam. Yêu cầu KHSX duyệt Capacity mới không bị quy tắc khóa điều chỉnh áp dụng. Chưa nghiệm thu trực tiếp thao tác desktop/điện thoại có đăng nhập trên dữ liệu thật.
- Luồng xác nhận Capacity mới: QLSX xác nhận tại Lịch làm việc → Tổng hợp Capacity hiển thị **Chờ đồng bộ KHSX** → QLSX chọn Line và bấm **Đồng bộ KHSX** → yêu cầu mới xuất hiện ở Confirm của Production Plan. KHSX mở Confirm xem luôn yêu cầu đầu tiên cùng bảng giờ HC/TC và khấu trừ; hộp thoại đặt tại trang chính để không bị khung Plan che hoặc co phía trái. Bản Capacity đã gửi theo luồng cũ vẫn có yêu cầu chờ như trước, không tự thay đổi dữ liệu cũ.
- KHSX đồng ý yêu cầu **điều chỉnh** sẽ tự mở đúng Line thành trạng thái đang điều chỉnh để QLSX vào Lịch làm việc sửa trực tiếp. Không cần thao tác Hủy xác nhận hoặc nhập lại lý do; quyết định, người mở và thời điểm mở được ghi lịch sử. Các bản lưu từ luồng cũ đang ở trạng thái `adjust-approved` cũng cho phép sửa và tự chuyển trạng thái khi lưu lần đầu. Sau khi QLSX xác nhận lại phải đồng bộ phiên bản mới từ Tổng hợp Capacity để KHSX duyệt. Chưa nghiệm thu trực tiếp trên trình duyệt bằng tài khoản QLSX/KHSX.
- Tổng hợp Capacity dùng cùng một bảng cho tuần theo lịch ngày và tuần cũ chỉ lưu số liệu tổng, kể cả tuần 21/09. Tuần kế hoạch hiển thị một dòng, tổng giờ khả dụng được làm nổi, cột cuối là Trạng thái kết hợp SX/KHSX theo sự kiện (nháp, xác nhận, chờ đồng bộ, chờ duyệt, đã đồng ý, xin điều chỉnh, bị từ chối, đang sửa). Phần nhập liệu tuần cũ giữ dưới nút mở riêng; không chuyển đổi hoặc ghi lại dữ liệu cũ. Nếu khoản nghỉ của bản cũ chỉ lưu tổng tuần, chi tiết ngày có thông báo không phân bổ được khoản đó.
- API Capacity và danh mục nhân viên kiểm tra quyền và phiên bản khi ghi; tính lại Capacity ở máy chủ. Cần nghiệm thu thêm trên dữ liệu thật về lịch sử nhân sự, ca giao nhau và kết quả KHSX với những tuần đã xác nhận trước khi dùng nghiệp vụ LIVE.

## Đã hoàn thành trong thiết lập local

- D1 local qua Miniflare, lưu bền vững tại `.local-data/d1`.
- Migration có ledger/checksum; không tạo lại dữ liệu mỗi lần chạy.
- Seed TEST nhập thủ công vào database rỗng; export/import giữ nguyên năm cột và dấu đã xóa.
- API đọc và ghi chỉ trong loopback, không có DB binding LIVE. Ghi cần phiên tài khoản TEST và origin hợp lệ.
- Tài khoản TEST trên từng máy, mật khẩu hash scrypt trong file bị loại khỏi Git/bàn giao. Cookie phiên HttpOnly/SameSite; đăng xuất vô hiệu hóa phiên.
- Nhãn MÔI TRƯỜNG TEST; endpoint kiểm tra database đang dùng.
- Quy trình kiểm tra, build, restore đối chứng và đóng gói folder theo allowlist.

## Có giao diện hoặc logic, cần nghiệm thu nghiệp vụ

- Khung bảng Kế hoạch sản xuất (Base forecast, Demand event, Production engine, Production plan, In transit) tự tính chiều cao còn lại theo màn hình và thanh công cụ; cuộn dọc/ngang trong bảng, giữ chỗ cho phân trang. Không thay đổi dữ liệu nghiệp vụ.
- Base forecast: thanh công cụ dùng khung/màu dùng chung với SKU Master, chọn tháng và tra cứu cùng một hàng; bỏ thông tin mở rộng và dòng đếm SKU. Bảng lọc theo ký tự ngay khi nhập hoặc đổi trường tra cứu, không dùng danh sách gợi ý.
- Production Plan đã thay luồng cũ: nhận Engine đã lưu, batch có chống trùng/revision, sửa/chốt/mở chốt và chuyển In Transit. In Transit có API nghiệp vụ riêng, lưu D1, tạo thêm LSX, tạo lệnh phát sinh, sửa trường KHSX, kiểm soát tổng số lượng, chống trùng mã LSX, đồng bộ idempotent, nhận tiến độ Báo công khi đọc và lịch sử chi tiết. Giao diện có bộ lọc, phân trang, panel chi tiết, drawer lịch sử và xuất Excel. Có kiểm thử backend. Xem `production-plan/IMPLEMENTATION.md` để đối chiếu dữ liệu nguồn.
- Production Plan tự lưu chỉnh sửa dòng chưa chốt sau khi ngừng nhập ngắn (650 ms), dùng revision và API save hiện có. Hiển thị đang lưu/đã lưu/lỗi kèm thử lại; giữ bản nhập nếu lỗi, cảnh báo khi đóng tab, và chờ lưu trước khi đổi tuần, tải lại hoặc chốt. Dòng đã chốt/đã chuyển vẫn khóa; backend tiếp tục kiểm tra quyền, giá trị, revision và lưu lịch sử. Chưa kiểm tra trực tiếp thao tác tài khoản đăng nhập trên desktop/điện thoại.
- Khi tự lưu gặp revision cũ do dữ liệu tuần trên màn hình đã lỗi thời, tải lại bản mới và tự thử lưu đúng các ô còn nguyên trạng; không ghi đè ô có người khác vừa sửa hoặc dòng đã chốt. Bản nhập xung đột được giữ trên màn hình và thông báo SKU cụ thể. Kiểm thử có các trường hợp SL kế hoạch 6.000 → 10.000, cùng ô đã đổi, và dòng mới chốt.
- Quản lý sản xuất đã có màn hình Thực hiện sản xuất, Kiểm tra báo công, Theo dõi tiến độ và Báo cáo sản xuất. Lệnh lấy từ In Transit đã đồng bộ; báo công lưu riêng theo từng ID/ngày trong `production_report`; quản lý xác nhận nguyên tử để cập nhật tiến độ đọc bởi In Transit và tạo phiếu `warehouse_in` chờ Kho TP xác nhận. Báo công chờ duyệt không cộng vào số hoàn thành; nhiều lần đã xác nhận được cộng lũy kế theo LSX. Tạm ngưng, tiếp tục và báo sự cố ghi sự kiện trạng thái riêng. Cần nghiệm thu LIVE bằng tài khoản SX, quản lý và Kho TP.

- SKU Master, Lead Time, Safety Days, BOM, phiếu thay đổi BOM, forecast, Demand Event, Production Engine/Plan/In Transit, tồn ERP và snapshot.
- Người dùng/phân quyền nghiệp vụ vẫn ghép dữ liệu khởi tạo trong mã nguồn với bản cập nhật local. Danh sách này không phải danh sách tài khoản đăng nhập TEST: tài khoản TEST được quản lý riêng trên từng máy.
- Các quyền nghiệp vụ chưa được thực thi đầy đủ ở backend TEST. Tài khoản TEST đã đăng nhập có quyền chỉnh dữ liệu TEST; đây không phải hệ thống phân quyền production.
- Dữ liệu JSON gốc, nhật ký chung, một số bảng giao dịch kho và chỉ số vẫn là dữ liệu viết sẵn/import từ trước. Các thay đổi trong React state mà không gọi API vẫn không được xem là lưu bền vững.

## Chưa hoàn thiện

- Điều chỉnh nhân lực/thời gian, Capacity, khôi phục sản xuất và Report kế hoạch vẫn cần hoàn thiện nghiệp vụ; màn hình Kho TP xác nhận/từ chối phiếu `warehouse_in` chưa được ghép vào menu kho.
- Đồng bộ ERP/Google Sheets, backup/restore LIVE, nghiệm thu tính toán, giao dịch kho hoàn chỉnh và đồng thời nhiều người dùng.
- Một số bố cục sidebar che nội dung; chưa làm lại giao diện trong bước này.
- Không có bản sao D1 LIVE nguyên vẹn; seed mới là dữ liệu giả lập TEST.

## Sửa lỗi kỹ thuật phục vụ kiểm tra bàn giao

- Khai báo kiểu Cloudflare và kiểu dữ liệu thiếu; bỏ khóa object trùng bằng cách giữ giá trị cuối như hành vi JavaScript cũ.
- Khai báo trạng thái ngày của form Safety Days còn thiếu, bổ sung trạng thái cho dòng mới.
- Test Worker chạy bằng runtime Miniflare phù hợp với `cloudflare:workers`; bỏ kỳ vọng CSS scrollbar đã lỗi thời, giữ các kiểm tra còn lại.


## 15/09/2026: Forecast/Demand

Đã nhập302/304 SKU và104 Demand đã lập; bỏ ghép Demand viết sẵn; dùng Forecast30D/30. Engine chặn thiếu đầu vào, không giả lập WIP/0. In Transit hiển thị dữ liệu đã chuyển từ Plan và lệnh phát sinh đã lưu; Capacity và các đầu vào thiếu được liệt kê trong FORECAST-RESTORE-RESULT.md.


## Giao diện KHSX gọn / Master bổ sung

Bốn menu KHSX dùng thanh công cụ gọn, bảng cuộn riêng, Capacity/input/history thu gọn. Đã bổ sung35 SKU và36 mục Lead Time chờ nhập; các giá trị sẵn có và dữ liệu Forecast/Demand giữ nguyên. Xem PLANNING-COMPACT-RESULT.md. Nhập PDF web vẫn chưa hỗ trợ ghi; dùng quy trình README.

## Cập nhật 15/09: SKU / Demand / Engine

Xem `SKU-DEMAND-ENGINE-RESULT.md` cho đối chiếu chi tiết. Local đã có xác nhận SKU đơn/hàng loạt bằng quyền server, lịch sử giao dịch và migration revision; Demand mới có createdAt bền vững/thứ tự mới nhất; Engine tiếp tục tính khi thiếu Safety/Lead Time/tồn/In Transit/MOQ và chặn SKU chờ xác nhận sang Plan. Quy tắc thiếu dữ liệu mới thay thế mô tả cũ “chặn toàn bộ Engine”. Đã lưu Engine 304 dòng tuần 14/09/2026; 35 SKU vẫn chờ, 106 Demand được giữ. Chưa kiểm thử thao tác ghi trên browser bằng tài khoản người dùng (chờ đăng nhập); đã kiểm thử service/API ở database riêng và UI chỉ xem. Tài khoản quản trị TEST local-owner dùng quyền xác nhận mặc định khi chưa có bản ghi permissions riêng; bản ghi quyền/vô hiệu hóa được ưu tiên. Master JSON cũ giữ trạng thái Đang sử dụng, không tự tạo xác nhận giả.


## Đính chính sau đối chiếu Site 162

Xem [SITE-162-SELECTIVE-AUDIT.md](SITE-162-SELECTIVE-AUDIT.md). Công thức F30/30 đơn thuần và việc gộp High/Medium/Low trong mô tả trước là sai; đã khôi phục theo mã và dữ liệu Site. Safety không hoàn toàn thiếu: đã phục hồi8 record vào local. Số SKU chờ hiện tại31, giữ các xác nhận của người dùng. Báo cáo mới thay thế các kết luận tương ứng trước đây.

## Demand Event — form cửa sổ

Đã hoàn tất giai đoạn Demand Event: dialog720px, tự điền SKU đã xác nhận, validation client/API, lưu TEST bền vững, chống gửi lặp. Build/typecheck và13 test đạt; dữ liệu212 record trước/sau nguyên trạng sau khi dọn dòng thử. Xem DEMAND-EVENT-MODAL.md. Các menu khác chờ người dùng duyệt Demand Event theo yêu cầu, chưa áp dụng hàng loạt.

## SKU: hai trạng thái và đơn vị tính PDF

Xem SKU-STATE-AND-UNITS.md. SKU Master lấy dữ liệu chính từ D1 local;1273 SKU,1242 đã xác nhận/đang sử dụng,31 chờ sau legacy migration;320 đơn vị tính sửa theo PDF. Engine/đầu vào nghiệp vụ chặn SKU chưa xác nhận hoặc chưa sử dụng. Điều này thay thế mô tả trước cho phép Engine tính SKU chờ. Kiểm thử xác nhận thủ công trên browser đang chờ chọn SKU chờ hợp lệ;103S101101 vốn thuộc danh mục đang sử dụng, không hạ trạng thái để thử.


## Sao lưu & Bàn giao — bản TEST 16/09/2026

Xem STORAGE-HANDOVER.md. Đã có FILES local bền vững, metadata D1, quyền Super Admin cho vthduyen theo chấp thuận, xuất ZIP và restore kiểm chứng. Gói thử gồm3048 app_records/14 entity,5 bảng,0 tệp nghiệp vụ. Chưa hoàn tất chuyển nguồn JSON/localStorage sang D1, bóc tách/tích hợp upload từng menu, chia gói lớn, R2 LIVE hoặc ghép gói vào npm run handoff. hosting.r2 vẫn null. Không xem đây là nghiệm thu toàn bộ yêu cầu.

## Đồng bộ R2 theo thông tin Site163

Xem R2-SYNC-REVIEW.md. hosting.r2 nay là FILES, giữ Project ID; thay thông tin null ở báo cáo trước. Đã nối lưu/tải tệp gốc vào Forecast/Demand/kho/BOM/báo cáo và dùng service binding chung trên TEST. Worker adapter có sẵn nhưng chưa bật HTTP production khi thiếu xác thực backend; backup Worker, OCR/nhập và đối chiếu source163 chưa hoàn tất. Không xuất bản/push/ghi LIVE.

## Runtime Site — 16/09/2026
Xem SITE-RUNTIME-MIGRATION.md. Đã thêm API Worker và nhận diện email Sites; TEST giữ riêng. Có lớp đọc tương thích danh mục1237 SKU/86 Demand với override D1, không import3048 TEST. Backup ZIP Worker/OCR và chuyển toàn bộ danh mục nguồn sang D1 chưa hoàn tất. Chưa xem kiểm thử trên bản sao local là nghiệm thu ghi LIVE. Trạng thái triển khai thực tế theo báo cáo cuối.


Phiên bản165 đã triển khai thành công lên đúng Site.15 test, typecheck và build đạt. Nút SIWC đã chuyển đến trang đăng nhập OpenAI; đang chờ người dùng hoàn tất phiên để nghiệm thu giao diện LIVE sau đăng nhập. Xem SITE-165-DEPLOYMENT-RESULT.json. Không nhập TEST3048, không chạy thử ghi LIVE.

## Đăng nhập production ONSPA — 16/09/2026

Thay luồng SIWC của phiên bản165 bằng LoginGate ONSPA đầy đủ và API /api/auth/login, /api/auth/session, /api/auth/logout. D1 lưu hash PBKDF2, phiên token băm và giới hạn thử đăng nhập. Cookie Secure/HttpOnly/SameSite=Strict; người dùng phải còn active và không _deleted. Actor lấy từ tài khoản D1, không tin header/email hoặc người dùng do client gửi.

Sửa giới hạn đăng nhập Admin ngày 28/09/2026: trước đây bộ đếm cộng cả lần đăng nhập thành công, khiến tài khoản bị chặn sau 5 lần vào bình thường trong 15 phút. Bộ đếm nay chỉ tăng khi mật khẩu sai; đăng nhập hợp lệ xóa bộ đếm thất bại của tài khoản và IP, nhưng sai quá giới hạn vẫn báo 429. Không thay đổi mật khẩu, tài khoản, quyền hoặc phiên đang hoạt động. Chưa xác minh thao tác đăng nhập trên trình duyệt cá nhân của người dùng.

Migration0005 chỉ thêm auth_accounts, auth_sessions, auth_login_limits và index; không sửa migration cũ, không nhập TEST, không tự khôi phục15 user đã xóa. Khởi tạo quản trị đầu tiên chỉ qua liên kết bí mật một lần, có hạn dùng, cho login được cấu hình riêng trên Sites. Người dùng tự đặt mật khẩu4 chữ số. Không có mật khẩu mặc định, không sao chép TEST. Việc kích hoạt sẽ thêm users và admin_audit mới, giữ nguyên74 bản ghi cũ.

16 test đạt; typecheck, build và kiểm thử HTML Worker đạt. API test bao gồm31 GET, quyền, actor, D1/R2 bền vững. Giao diện đã kiểm tra1280px và iframe390px; nút mắt và sai mật khẩu hoạt động. LIVE sau đăng nhập cần người dùng hoàn tất đặt mật khẩu và đăng nhập. Không coi kiểm thử database riêng là nghiệm thu phiên LIVE. Giới hạn cũ về backup ZIP Worker/OCR/danh mục nguồn tĩnh vẫn còn.

## StandardToolbar — 2026-09-19

Đã tích hợp component chung tại 23 vị trí source (có nhánh legacy), chuẩn hóa cấu hình và giao diện, gộp BOM/Production Plan, thêm tra cứu cùng thanh cho người dùng/phân quyền/sản xuất. Quy chuẩn: `ONSPA-TOOLBAR-STANDARD.md`; danh mục và giới hạn: `TOOLBAR-INTEGRATION-STATUS.md`. Typecheck/build, 30 test nghiệp vụ và 8 test DOM đạt. Chưa nghiệm thu trình duyệt desktop/mobile do automatic approval review chặn trình duyệt đám mây; chưa publish. Không tuyên bố các nhánh nguồn thiếu handler hoặc legacy đã có nghiệp vụ hoàn chỉnh.

## StandardToolbar spacing and Forecast PDF — 2026-09-21

Removed automatic spacer before search fields. Search-by and search-value are adjacent, with contextual fields following. Shared scoped styles keep button/input height and baseline aligned despite legacy planning styles. Base Forecast now has a toolbar button connected to the existing RecordFiles PDF picker, storing the original PDF against the selected production month. This does not parse/import forecast rows. Existing storage endpoints and authorization are unchanged. Typecheck/build passed; 9 local DOM tests and mocked PDF upload wiring passed. Browser layout QA remains unverified because the earlier cloud-browser approval was denied.

## StandardToolbar baseline correction — 2026-09-21

The global `label > span { margin: 0 0 7px }` also matched the span wrapping toolbar inputs, raising their bottom edge above adjacent buttons. Reset the caption and controls wrapper margins/padding within StandardToolbar only. Keep the existing same-height controls, compact spacing and scroll behavior. Verification includes the actual global rule in a local CSS regression fixture; this is not a browser geometry measurement.

## Production Engine toolbar — 2026-09-21

BulkEngineView now uses one StandardToolbar for lookup, plan-week selection, update and bulk transfer. Week selection normalizes to Monday and shows both dates (including month/year boundaries). Removed the separate update bar and select-all strip; the first table header now contains an accessible checkbox with mixed state. Select-all covers eligible filtered rows; transfer intersects selection with current eligibility and remains disabled for stale/unloaded weeks. Existing calculation and transfer APIs are unchanged. Local DOM verification used the actual component: one toolbar, eligible select-all, excluded no-supply rows, sent IDs, week range, update callback and stale-week guard passed. No live data was changed during tests.

## Planning transfer feedback — 2026-09-21

Removed selected-count/quantity notes from Engine and selected/unsaved counts from Plan toolbars. Added shared centered, dismissible success/error feedback for Engine→Plan and Plan actions (including Plan→In Transit), avoiding the inherited CSS that hid Engine notices. Rejected transfers display individual reason codes as business messages with SKU/name when available and recovery guidance. Failed Engine transfers retain selection; Plan failures preserve edits and selection. A successful POST followed by a failed reload is reported as received but unverified, with instructions to reload before retrying, not as a definite failed write. Typecheck/build and mocked component success/failure tests passed. No production transfer was executed for testing.

## Production Plan toolbar - 2026-09-21

Removed the visible data-revision label from the toolbar. Internal revision checks remain unchanged.

### 2026-09-21 — Shared table scroll / Demand Event toolbar
- All table-wrap/pp-table/it-table grids use the shared viewport height observer and scrollbar styling.
- Demand Event removes attachment panel UI, summary counts and standalone selection strip; existing stored attachments are untouched.
- Select-all header targets eligible filtered unplanned rows, with indeterminate/disabled state. Mark-as-planned now lives in StandardToolbar (vi/zh/en label); only successful HTTP writes update local state, failed selections remain for review.
- Existing Demand Event plannedWeek assignment is preserved; this UI change does not redesign planning-week business rules.
- Validation: local TypeScript/build and isolated mocked UI checks. No live data writes or migrations. Actual desktop/mobile browser visual acceptance remains unverified because the browser approval review denied access earlier in this session.

### 2026-09-21 — Demand Event exact SKU entry
- Enter in the SKU field selects a unique exact non-deleted master code (trimmed, case-insensitive), populates product details and prevents implicit form submission. Lookup uses the full master list, not the eight displayed suggestions.
- Partial input retains clickable suggestions. Confirmation status text is removed from suggestion rows; existing SKU eligibility validation is preserved.
- Typecheck and isolated DOM interaction checks pass; no live database writes used for verification.

### 2026-09-21 — Planning Report: 7 existing + 4 priority reports
- Report now provides 11 read-only reports with shared toolbar, filters, week range, pagination, shared table scrolling, localized headings/statuses, complete filtered Excel XML export and browser Print / Save PDF.
- In Transit report modal/button removed; list Excel export remains. No backend grants/data/schema changes.
- Four priority reports: current saved weekly plan, plan versus linked LSX actuals, unplanned Demand Events, latest Engine snapshot versus linked plans.
- Details/limitations: `docs/PLANNING-REPORTS.md`. Plan comparison uses current saved plans, not a historical frozen baseline; PDF saving uses the browser print dialog.
- Six pure data tests plus isolated UI mocks pass. Typecheck passes. Live browser geometry/print verification remains unavailable; no live data writes used for tests.

### 2026-09-21 — Report navigation and criteria-first layout
- Eleven reports appear as nested navigation under Report in the existing left sidebar. The right workspace remains empty until a report is selected, with no report fetch on that empty screen.
- Selection opens a two-column responsive criteria form (period/product/line/status/output format), retaining ONSPA colors. Data loading at selection supplies filter choices; results remain hidden until Preview.
- Shared toolbar handles preview/export/clear/close. Changed filters invalidate prior preview/export. Switching report resets criteria; closing returns blank. Report calculations and source permissions unchanged.
- Isolated UI tests pass for navigation, empty state, preview gating, Excel output, filter invalidation and switch/close. Actual browser geometry and print preview remain unverified.

### 2026-09-21 — Report sidebar and output-format CSS correction
- Root cause: the nested Report `<nav>` matched legacy `.topbar nav` fixed-position rules, covering the existing planning menus. Replaced with an in-flow `div role="navigation"`, constrained inside the sidebar, with its own short scroll area. Planning menu siblings remain available above Report.
- Child report text uses 14px regular weight (parent menu 16px), with wrapped labels and contained width.
- PDF/Excel radio controls have explicit 18px dimensions and adjacent text spans; label layout overrides inherited full-width input styling. Mobile labels retain 44px tap height.
- Typecheck/build and isolated navigation/label interaction checks; direct browser geometry remains unverified.

## In transit — nhóm tuần kế hoạch (22/09/2026)
- Danh sách gom theo tuần kế hoạch đã lưu (`week`), thứ tự tuần tăng dần; giữ thứ tự lệnh trong cùng tuần.
- Mỗi nhóm có dòng phân cách toàn bảng: TUẦN KẾ HOẠCH: dd/MM/yyyy – dd/MM/yyyy (thứ Hai–Chủ nhật), hỗ trợ VI/繁中/EN.
- Trang tiếp theo lặp lại tiêu đề tuần cho dòng đầu; tiêu đề không tính vào 20 dòng dữ liệu/trang và không thể chọn như lệnh.
- Thiếu tuần hiển thị Chưa xác định; không suy đoán từ ngày mở LSX. Không thay đổi dữ liệu, API hoặc nghiệp vụ.

## Production Plan — chốt trực tiếp (22/09/2026)
- Chọn Đã chốt trong cột trạng thái hoặc Chốt kế hoạch trên toolbar sẽ lưu chỉnh sửa của các dòng được chọn và chốt trong cùng batch; không yêu cầu Lưu kế hoạch trước.
- Backend kiểm tra dữ liệu và trạng thái trước khi ghi; dữ liệu lỗi không được lưu/chốt một phần. Giữ quyền và kiểm tra phiên bản hiện có.
- Khi chốt thành công, cập nhật các dòng đã chốt, phiên bản và lịch sử từ phản hồi API; bỏ lượt tải lại toàn bộ kế hoạch. Chỉnh sửa chưa lưu ở dòng khác được giữ nguyên.

## Production Plan — mở chốt trực tiếp (22/09/2026)
- Bỏ nút Lưu kế hoạch; dữ liệu được lưu cùng thao tác Chốt kế hoạch.
- Mở chốt trực tiếp, không yêu cầu lý do hoặc bước xác nhận, chỉ cho dòng Đã chốt chưa chuyển In transit và tài khoản có quyền.
- Backend từ chối mở chốt khi đã chuyển, có dấu thời gian chuyển hoặc bản ghi In transit liên kết, kể cả bản ghi đã hủy. Người dùng xử lý hủy tại In transit.
- Phản hồi mở chốt cập nhật dòng và lịch sử ngay, giữ chỉnh sửa ở dòng khác; không tải lại bảng.

## Production Plan — bỏ chọn sau thao tác (22/09/2026)
- Sau phản hồi thành công của thao tác kế hoạch, tự bỏ toàn bộ tích chọn và ô chọn tất cả; áp dụng cả chốt/mở chốt cập nhật trực tiếp.
- Phản hồi lỗi hoặc lỗi kết nối trước khi xác nhận thành công giữ nguyên lựa chọn để xử lý tiếp.

## Production Plan — trạng thái và phản hồi (22/09/2026)
- Bỏ khung chọn dữ liệu Engine và nút Nhận từ Engine đi kèm; chuyển đề xuất bằng luồng Production Engine → Production Plan hiện có.
- Mặc định hiển thị mọi trạng thái; Tạm hoãn/Hủy/Dự kiến được lưu ngay khi đổi bằng API, giữ bản nháp nếu thất bại. Backend trả dòng đã lưu để không tải lại toàn bảng.
- Chọn tất cả bỏ qua Tạm hoãn/Hủy. Chốt hàng loạt chỉ gửi các dòng Dự kiến; lỗi thiếu trường được hiển thị từ backend thay vì chỉ khóa nút.
- Có thông báo đang xử lý, thành công/lỗi cho thao tác ghi và tải lại; xuất Excel thông báo đã gửi tải xuống hoặc lỗi. Các thao tác mở/đóng giao diện vẫn thể hiện trực tiếp qua giao diện.

## In transit — làm mới sau chuyển kế hoạch (22/09/2026)
- Sửa bộ nhớ tạm giữ danh sách cũ: mỗi lần mở In transit đều đọc lại API, đồng thời hiển thị dữ liệu cũ trong khi chờ.
- Chuyển Production Plan thành công sẽ vô hiệu hóa cache In transit. Phản hồi prefetch cũ không được ghi đè cache mới.
- Không chuyển lại đơn, không chỉnh sửa dữ liệu đang hoạt động để khắc phục lỗi hiển thị.

## In transit — thu gọn cột LSX (22/09/2026)
- Thu gọn cột Mã LSX và SL LSX; ô nhập tương ứng rộng 112px và 72px, giữ chiều cao và nghiệp vụ hiện có.

## Engine → Plan tự cập nhật (22/09/2026)
- Sau khi chuyển từ Engine thành công, vô hiệu hóa cache Plan cũ và đưa kết quả đã xác minh vào cache tuần tương ứng; mở Pro Plan sẽ có dữ liệu mới, không cần Tải lại dữ liệu.
- Chặn phản hồi prefetch cũ ghi đè cache sau khi chuyển. Nút Tải lại dữ liệu chỉ dành cho chủ động đối chiếu dữ liệu đã lưu.

## Demand Event — tuần kế hoạch người dùng chọn (22/09/2026)
- Bỏ mốc cố định 31/08–06/09 khi đánh dấu đã lập kế hoạch.
- Form thêm mới bắt buộc chọn ngày đầu tuần (chuẩn hóa thứ Hai), tự tính Chủ nhật; lưu planningWeekStart/planningWeekEnd, backend kiểm tra và tính lại ngày cuối.
- Cột Tuần kế hoạch hiển thị tuần đã chọn cả khi chưa lập kế hoạch. Đánh dấu đã lập kế hoạch giữ tuần này; bản ghi cũ chưa chọn tuần bị chặn thay vì tự gán tuần sai.
- Engine lọc cả Phát sinh và Bù tải theo planningWeekStart; dữ liệu cũ chưa có trường này dùng tuần ngày giao, không cho Bù tải tràn mọi tuần.
- Không sửa tự động các bản ghi đã bị gán tuần sai trước đây; cần đối chiếu tuần nghiệp vụ của từng đơn.


## 22/09/2026 — Capacity tuần và Production Plan
- Thay placeholder Capacity tuần bằng bảng A/B, lịch HC/TC, ngày lễ, đăng ký nghỉ theo nhân viên và bộ tính giờ-người dùng chung frontend/backend.
- Lưu DB theo tuần với revision chống ghi đè, xác nhận/hủy có lý do, phiên bản, số lần sửa và snapshot/diff lịch sử. Quyền backend riêng, không cho ghi tắt bằng records.
- Production Plan tự cập nhật Capacity đúng tuần/Line; Nháp/hủy không chốt mới; chốt giữ snapshot Capacity và kiểm tra race trong transaction. Không sửa kế hoạch/LSX đã chốt.
- Dữ liệu Capacity cũ giữ nguyên, nếu trùng tuần cần đối chiếu trước thay thế; chưa tự chuyển cấu trúc cũ. Không tự tạo phiên bản căn cứ cho kế hoạch đã chốt trước tính năng này.
- Chi tiết cấu trúc, công thức, quyền và kiểm thử: docs/WEEKLY-CAPACITY.md.
- Không migration/seed hoặc ghi dữ liệu kiểm thử vào DB vận hành. Chưa kiểm tra hình ảnh trực tiếp trên trình duyệt desktop/mobile.


## 22/09/2026 — Đơn giản hóa nghỉ Capacity
- Thay đăng ký nghỉ theo nhân viên bằng hai ô tổng giờ nghỉ HC/TC theo Line và tuần; không còn nhập/chọn nhân viên.
- Tổng HC là giờ ảnh hưởng sản xuất, không chứa giải lao/vệ sinh đã khấu trừ. Chặn tổng âm/vượt giờ; backend tính lại và lưu tổng vào DB.
- Bản cũ và lịch sử giữ nguyên. Khi chuyển sang nhập tổng không khấu trừ lại các dòng nhân viên cũ; xác nhận/phiên bản/liên kết Plan tiếp tục dùng cơ chế hiện hữu.
- Typecheck và 15 kiểm thử Capacity/Plan đạt trước phát hành.


## 22/09/2026 — Nghỉ Capacity theo số người và ngày/giờ
- Chi tiết nghỉ HC/TC nhiều dòng, không nhập tên nhân viên. Nhấn ↓ trong ô nhập cuối để thêm dòng và chuyển con trỏ; có nút ↓ cho chuột/cảm ứng.
- Chọn khoảng ngày, nghỉ cả ngày hoặc theo giờ; loại phần nghỉ giao giải lao/vệ sinh. Người nghỉ thứ Bảy không bị trừ thêm vệ sinh.
- Backend kiểm tra số người, ngày, khung giờ; lưu từng dòng và lịch sử, giữ liên kết Plan. Bỏ qua dòng nhập trống.
- Giữ dữ liệu tổng cũ, người dùng phải nhập chi tiết thay thế có chủ đích; không tự suy đoán phân bổ giờ/ngày. Các dòng cùng ngày đại diện nhóm người khác nhau, không nhập trùng cùng người.

## 23/09/2026 — Chốt thiết kế tiếp theo cho Capacity (CHƯA TRIỂN KHAI)
- Yêu cầu đã thống nhất được lưu tại docs/CAPACITY-DESIGN-DECISIONS-2026-09-23.md: Lịch làm việc 7 ngày; khung HC/TC/nghỉ trưa/giải lao; vệ sinh nhiều nhóm; nghỉ theo số người/ngày/giờ; thời gian khác; Tổng hợp Capacity.
- Luồng SX xác nhận → KHSX đồng ý qua nút Confirm có huy hiệu số yêu cầu trong Production Plan; khi đã đồng ý, SX xin điều chỉnh ở Tổng hợp Capacity và chỉ hủy xác nhận/sửa Lịch làm việc sau khi KHSX cho phép. Bản mới phải được KHSX đồng ý lại; Plan đã chốt giữ căn cứ cũ.
- Các nội dung trên mới là bản thiết kế cho phiên triển khai sau; chưa thay đổi giao diện, API, DB hoặc dữ liệu vận hành.
## 25/09/2026 — Capacity tuần (triển khai trên Site hiện tại)
- Menu Capacity tuần gồm Lịch làm việc (bảy ngày, HC 08:00–17:00, nghỉ trưa 12:00–13:00, giải lao hai khung 10 phút, vệ sinh theo nhóm, TC 17:30–21:00, nghỉ HC/TC và thời gian khác theo số người/ngày/giờ) và Tổng hợp Capacity hai Line A/B. Tính giờ-người theo ngày trên giao diện và kiểm tra lại khi ghi; các bản cũ giữ nguyên định dạng.
- SX xác nhận gửi yêu cầu KHSX qua huy hiệu Confirm ở Production Plan. KHSX đồng ý/từ chối có lịch sử, phiên bản và kiểm tra quyền backend; sau khi đồng ý, SX chỉ mở sửa khi yêu cầu điều chỉnh được duyệt. Bản nháp/chờ duyệt/đang điều chỉnh không làm căn cứ chốt kế hoạch mới; kế hoạch đã chốt giữ snapshot.
- Bảng tổng hợp tách các khoản giờ và trạng thái; thao tác sửa có CAS ngăn ghi đè giữa hai người. Kiểm thử ở DB TEST và build ở bản source sạch; không chạy migration/seed hoặc ghi vào D1 đang hoạt động trong quá trình phát hành. Nhóm vệ sinh/nghỉ cùng thời điểm chưa định danh người được chặn khi không phân biệt được nhóm; chưa có Nhật ký báo công tập trung cho sự kiện Capacity.

## 25/09/2026 — Rà lại giao diện Capacity theo mẫu đã chốt
- Lịch làm việc: bảng bảy ngày gọn với checkbox HC/vệ sinh/TC; chi tiết vệ sinh và tăng ca đặt thành hai khu, ghi người/từ–đến/giờ-người; nghỉ HC/TC và thời gian khác theo các dòng có cột rõ ràng. Trên điện thoại mỗi ngày và mỗi dòng nhập là thẻ có nhãn.
- Nghỉ HC hỗ trợ khoảng từ ngày–đến ngày và tùy chọn nghỉ cả tăng ca trong một ngày có lịch TC; backend tính theo ngày làm việc và chặn trùng với dòng nghỉ TC. Tổng hợp Capacity mở bảng giờ từng ngày cùng đăng ký nghỉ/thời gian khác; lịch sử vẫn tra theo phiên bản.
- Các thay đổi giao diện không chuyển đổi hoặc xóa bản Capacity cũ. Chưa xác thực hình ảnh trong phiên đăng nhập thực tế; build và kiểm thử DB TEST không thay thế nghiệm thu trực quan.

## 25/09/2026 — Lịch làm việc: giờ và nhân sự theo mẫu
- Tuần mới mở danh sách nhân viên theo Line từ Dữ liệu cơ bản ngay cả khi danh sách hiện rỗng; các bản cũ thiếu danh sách giữ nguyên cho đến khi người dùng chủ động chọn nhập danh sách. Nhân viên có thể tích HC/TC, điều động A/B theo ngày, và chọn theo tên ở nghỉ HC, TC, thời gian khác và nhóm vệ sinh.
- Tích Vệ sinh tạo hai nhóm 16:00–17:00 và 16:30–17:00 với người chưa chọn; cho sửa giờ. Nhóm trùng giờ được tính khi chọn các nhân viên khác nhau, backend chặn trùng nhân viên. Hai khung Vệ sinh/TC đồng chiều cao, bảng vệ sinh không cuộn ngang.
- Các giờ chỉnh sửa ở Lịch làm việc dùng bộ chọn giờ gốc của trình duyệt, hiển thị 24 giờ; nghỉ cả ngày hiển thị 08:00–17:00, nghỉ toàn bộ TC 17:30–21:00 hoặc giờ TC thực tế của ngày. Nghỉ HC tích Nghỉ cả TC hiện thêm dòng tham chiếu trong đăng ký nghỉ TC, chỉ tính và lưu một lần.
- Typecheck, build và 19 kiểm thử Capacity đạt. Bản xem trước cục bộ không mở được trong trình duyệt ở phiên này; chưa nghiệm thu trực quan trong tài khoản đăng nhập hoặc trên điện thoại thật.
## 25/09/2026 — Lịch làm việc thu gọn theo thao tác
- Trên lịch tuần, chỉ mở danh sách người HC/TC khi chọn ngày; danh sách chỉ có ô tích điều động khi bật Điều phối NV. Bỏ khung nhân viên tự hiện bên cạnh trên màn hình rộng.
- Hàng thao tác gồm Điều phối NV, Nghỉ HC, Nghỉ TC, Thời gian khác; bảng đăng ký chỉ hiển thị khi tích mục tương ứng. Bỏ tích để thu gọn mà không xóa dòng đã nhập/lưu; lưu thành công tự thu gọn. Số người nghỉ trong ngày và số dòng đăng ký được tóm tắt khi bảng đóng.
- Chi tiết vệ sinh và lịch tăng ca chỉ xuất hiện khi có ngày được tích tương ứng; hai khung cùng hàng khi đều có dữ liệu. Cột Nghỉ trước TC giữ 17:00–17:30 cho ngày tăng ca, không khấu trừ trùng giờ.
- Danh sách chọn tên nhân viên mở trong ô của dòng thay vì nổi ngoài vùng cuộn, giúp chọn được khi bảng đăng ký mở. Giữ nguyên các tính toán, lưu, quyền backend, lịch sử và liên kết Production Plan hiện có. Chưa nghiệm thu trực tiếp bằng trình duyệt đăng nhập trên desktop hoặc điện thoại.
## 25/09/2026 — Sửa Lịch làm việc theo hình đã duyệt và phím xuống
- Bỏ bố cục hai cột cũ trên màn hình rộng: lịch bảy ngày dùng hết bề ngang giống các bảng phía dưới. Chọn mũi tên hoặc số NV HC/TC mở danh sách người thực sự tham gia ngay dưới đúng ngày, kể cả màn hình rộng; người nghỉ cả ngày không nằm trong danh sách.
- Điều phối NV hiển thị hai khung chọn tên HC/TC gọn theo ngày, dùng cùng thành phần chọn nhiều nhân viên như Nghỉ HC, Nghỉ TC, Thời gian khác và Vệ sinh. Nút Xong đóng khung chọn; phần chỉnh phân công chi tiết/mượn Line được thu gọn riêng. Bảng nghỉ chính gom về Nhân viên, Ngày, Hình thức, Từ giờ, Đến giờ, Ghi chú; nghỉ nhiều ngày, nghỉ cả TC và giờ TC tham gia nằm trong ô liên quan. Không xóa cách chuyển người hay bản ghi đã lưu.
- Nhấn ↓ từ ô số/text hoặc ô Chọn nhân viên đã đóng ở dòng cuối tạo dòng mới rồi chuyển con trỏ sang ô đầu; ô chọn ngày, hình thức và đồng hồ vẫn giữ hành vi phím mặc định. Áp dụng cho đăng ký và nhóm vệ sinh; nút + Thêm dòng luôn có cả trên desktop để dự phòng.
- Chỉ sửa giao diện và thao tác dòng. Không thay đổi schema, dữ liệu D1, quyền backend, lịch sử, cách tính hay liên kết Production Plan. Chưa nghiệm thu trình duyệt đăng nhập/điện thoại thật trong môi trường này.

## 25/09/2026 — Điều phối, vệ sinh và giờ 24h
- Điều phối NV chỉ còn một bảng phân công theo ngày: ô HC/TC thêm bớt người, một cột chọn điều động, một ca chọn HC/TC và một nút chuyển; bổ sung người từ Line khác dùng cùng ca chọn. Không còn hai bộ chọn tên chuyển Line và các nút chuyển trên từng người.
- Chi tiết vệ sinh giữ cột Xóa trong bảng, cho cuộn ngang khi màn hình hẹp và mở danh sách tên trong khung; tiêu đề chỉ ghi một ngày khi thực sự chỉ có một ngày vệ sinh. Ô Nghỉ cả TC nằm ở cột Ghi chú của dòng nghỉ HC, tách khỏi ô Hình thức hẹp.
- Mọi ô ClockInput của Lịch làm việc dùng nhập HH:mm và bộ chọn giờ 00–23, phút 00–59; không phụ thuộc cách trình duyệt hiển thị AM/PM. Không đổi giá trị thời gian đã lưu, API tính toán, quyền hoặc lịch sử. Typecheck, build và 22 kiểm thử Capacity đạt; chưa nghiệm thu trực quan trên trình duyệt tài khoản LIVE hoặc điện thoại.

## 26/09/2026 — Vệ sinh nhập số người theo nhóm
- Chi tiết vệ sinh nhập số người từng nhóm, không yêu cầu chọn nhân viên. Hai nhóm mặc định 16:00–17:00 và 16:30–17:00 có thể đồng thời nếu tổng người của các nhóm không vượt nhân viên HC tham gia ngày đó sau nghỉ cả ngày.
- Giao diện giới hạn và báo khi tổng vượt; API lưu/xác nhận dùng cùng phép tính và còn kiểm tra người nghỉ theo giờ ở những phút giao nhau. Nhóm vệ sinh cũ đã lưu tên giữ dữ liệu và quy tắc kiểm tra tên khi đọc/lưu, chỉ bỏ tên của nhóm được người dùng sửa số lượng. Không chuyển đổi ngầm bản cũ, không migration. 24 kiểm thử Capacity, typecheck và build đã đạt; chưa nghiệm thu trình duyệt LIVE/điện thoại.

## 26/09/2026 — Cỡ chữ giờ, số người và khoảng ngày nghỉ HC
- Tăng kích thước, độ đậm và độ tương phản của ô giờ, số người trong lịch Capacity và bảng chi tiết. Giờ mặc định không chỉnh được vẫn hiển thị rõ, nút chọn giờ vẫn khóa đúng quyền.
- Dòng đăng ký nghỉ HC hiển thị hai ngày cạnh nhau: Từ ngày – Đến ngày; một ngày mặc định lặp cùng ngày ở cả hai ô. Chỉ cho chọn ngày kết thúc không sớm hơn ngày bắt đầu. Không thêm trường mới hay chuyển đổi bản đã lưu.

## 26/09/2026 — Tuần Capacity mới nhất và giờ khả dụng trong Production Plan
- Lịch làm việc và Tổng hợp Capacity cùng mở tuần mới nhất có dữ liệu Capacity đã lưu, kể cả nháp; không còn cố định ở tuần của ngày hiện tại. Không có dữ liệu thì mở tuần hiện tại theo giờ Việt Nam; vẫn cho chọn tuần khác. API đọc tuần mới nhất kiểm tra quyền xem Capacity ở backend và bỏ qua bản đã xóa.
- Production Plan tải lại giờ khả dụng từ Capacity ngay sau KHSX duyệt qua Confirm, khi chuyển tab/focus và định kỳ; bản được duyệt mới là căn cứ chốt. Khi yêu cầu điều chỉnh chưa hoàn tất, hiển thị Chờ điều chỉnh, không cho chốt mới; bản chốt cũ giữ căn cứ đã lưu.
- Số ở cột Tổng giờ khả dụng trong bảng Capacity tăng cỡ 23px, cột đủ rộng để tránh ngắt số. Kiểm tra tự động trên TEST; chưa nghiệm thu trực tiếp tài khoản đăng nhập trên desktop/điện thoại.

## 26/09/2026 — Tồn kho ERP: tải file chờ chốt và hủy bản tải sai
- Excel mới được lưu dưới trạng thái Chờ chốt, không tự gắn với tuần đang xem. Ở bước Chốt tồn người dùng phải chọn rõ file và ngày thuộc tuần kế hoạch, API chuẩn hóa thứ Hai rồi kiểm tra và ghi bản chốt cùng tuần/file trong một giao dịch.
- Nút Hủy bản tải sai và thao tác trong Lịch sử tải Excel hủy mềm bản tải, giữ tên file, người tải và thời điểm. Chỉ chặn hủy file thực sự liên kết với bản chốt đang hiệu lực; file tải nhầm vào cùng tuần với bản chốt cũ vẫn có thể hủy. Trạng thái Engine của tuần chỉ hiển thị trên file có liên kết chốt, không lan sang file khác cùng tuần. Bản chốt/Engine cũ không bị xóa hoặc tính lại.
- API riêng kiểm tra đăng nhập, quyền ghi Quản lý kho, tuần chốt, file và chống thao tác trùng; API ghi chung không thể tự tạo bản tải ERP hoặc bản chốt mới. Không migration/seed dữ liệu vận hành. Chưa nghiệm thu trực tiếp với tài khoản thực và điện thoại.

## 26/09/2026 — Base Forecast: PDF tháng báo cáo và tháng áp dụng
- Bản cũ chỉ lưu PDF gốc vào FILES theo tháng đang chọn, không đọc dữ liệu. File báo cáo 09/2026 đang có trên Site gắn metadata 09/2026 và chưa tạo dữ liệu 10/2026.
- Trình tải mới đọc tháng báo cáo, tổng SKU và từng dòng PDF; áp dụng tháng kế tiếp (09→10, 12→01 năm sau). Chỉ lưu khi đọc đủ số SKU không trùng; không tự ghi dữ liệu khi mở menu. Mục PDF Base Forecast hiển thị mọi tệp đã lưu, kể cả tệp cũ gắn nhầm tháng, và cho nhập lại tệp cũ mà không tải lên lần hai. Tệp mới được lưu theo tháng tính từ nội dung PDF, rồi nhập vào bảng và chuyển bộ lọc sang tháng đó.
- API nhập Forecast kiểm tra quyền Super Admin và quyền ghi Base Forecast, xác thực metadata file FILES, tháng áp dụng, số liệu; ghi bản hiện hành và lịch sử/bản cũ trong giao dịch D1. Không migration/seed hay ghi tự động vào dữ liệu hoạt động. Chưa nghiệm thu PDF thực tế trên tài khoản đăng nhập/điện thoại.

## 26/09/2026 — Engine cập nhật trạng thái bản chốt tồn
- Bản trước ghi Engine thành công rồi cố dùng API bản ghi chung để đánh dấu bản chốt tồn đã sử dụng; backend chỉ cho phép đường đó mở chốt nên trả 409 và giao diện hiện sai “Không thể lưu bản chốt tồn”. Nhật ký LIVE xác nhận 3 lần Engine trả 200 rồi API bản chốt trả 409 vào chiều 26/09.
- Cập nhật Engine và đánh dấu bản chốt tồn “Đã được Production_engine sử dụng” trong cùng giao dịch D1, kèm lịch sử trạng thái. Kiểm tra snapshot đúng tuần, mã và trạng thái; nếu đã mở/thay đổi hoặc tuần có bản chốt mới mà giao diện đang dùng tồn mặc định 0 thì dừng trước khi ghi Engine. Giao diện cập nhật từ kết quả API, không ghi bản chốt lần hai bằng API chung. Các bản Engine đã lưu trước khi sửa được giữ nguyên; không chạy tự động trên LIVE.

## 26/09/2026 — Engine lấy đúng SL đang đi từ In Transit
- Engine đọc `/api/in-transit` để lấy dòng đã gộp báo công được duyệt, dùng `inTransitQty` đúng như cột SL đang đi. Khi LSX 2.000 hoàn thành 1.000, Engine nhận 1.000; nhiều LSX cùng SKU được cộng phần còn lại. Lệnh chưa mở, đã hủy hoặc hoàn thành hết đóng góp 0.
- Cả khi mở Engine và khi chọn lại tuần đều dùng cùng phép cộng. Không sửa dữ liệu In Transit, báo công hoặc bản Engine đã lưu; muốn cập nhật bản Engine đã lưu cần chủ động chạy lại.

## 26/09/2026 — Độ rõ bảng Production Engine
- Chữ dữ liệu trong bảng Production Engine tăng lên 15px, các cột số 17px đậm; tiêu đề 14px và dòng cao 42px. Dòng không cần bổ sung vẫn có nền nhận biết nhưng không còn giảm độ mờ toàn dòng. Chỉ chỉnh CSS của bảng Engine, không đổi tính toán, quyền, dữ liệu hoặc StandardToolbar.
- Bỏ cột “Phiên bản quy tắc” trong bảng Engine theo yêu cầu; căn lại cột ROP và hàng thông báo rỗng. Phiên bản và quy tắc Safety Days vẫn được lưu và áp dụng khi tính Engine.

## 26/09/2026 — Cỡ chữ số liệu Forecast, Demand Event và Tồn kho ERP
- Các cột số của Base Forecast, cột SL phát sinh của Demand Event và cột Tồn kho (số lượng) trong bảng Tồn kho ERP hiển thị 17px đậm, màu xanh đậm, chữ số có bề rộng ổn định. Bảng Forecast/Demand tăng chiều cao dòng đủ chứa số lớn. Không thay đổi giá trị lưu, phép tính, API, quyền hoặc StandardToolbar.
## 28/09/2026 — Đồng bộ Giờ công vào kế hoạch

- Giờ công/SP hiện hành theo SKU được đọc từ Dữ liệu cơ bản (bản PDF nền cộng các thay đổi đã lưu). Dòng Production Plan chưa chốt và tổng giờ cần dùng cập nhật theo định mức hiện hành khi tải tuần; kế hoạch đã chốt/chuyển giữ Giờ công tại thời điểm chốt để bảo toàn căn cứ lịch sử. Mở chốt hợp lệ sẽ nhận định mức hiện hành.
- Sau khi lưu Giờ công, xóa cache Production Plan trong phiên hiện tại; khi mở tuần hoặc đưa cửa sổ trở lại trước mặt, tải dữ liệu mới. Dữ liệu D1 cũ không được ghi lại hàng loạt. Chưa nghiệm thu thao tác sau đăng nhập trên Site hoặc từng menu khác ngoài SKU Master và Production Plan.
## 29/09/2026 — Đồng bộ màn hình liên quan và khóa phiên sửa

- Lưu Giờ công phát tín hiệu làm mới SKU Master, Leadtime, Safety Days, Danh sách nhân viên, Production Plan và Engine. Các menu này đọc lại nguồn của mình; không sao chép Giờ công vào bản ghi nhân viên/Leadtime/Safety. Các thay đổi SKU, nhân viên, Capacity, kế hoạch, kho, Forecast cũng báo cho các màn hình phụ thuộc qua sự kiện trong tab và BroadcastChannel giữa các tab. Màn hình đang mở đọc lại khi nhận tín hiệu, khi được focus và tối đa khoảng 45 giây khi còn hiển thị để thấy thay đổi từ máy khác. Bản đã chốt không tự tính lại; Engine dùng đầu vào mới khi tính tuần mới.
- API bản ghi chung, Giờ công, SKU Master (gửi yêu cầu và xác nhận hàng loạt), nhân viên, Capacity, Production Plan, In Transit, báo công và các quy trình chuyên biệt dùng phiên bản/điều kiện lưu; nhập PDF Forecast cùng tháng nay kiểm tra hash của bản Forecast đang xem và ghi tháng, lịch sử nhập, nhật ký theo kết quả ghi có điều kiện. Phiên cũ nhận 409, không ghi đè. Tại biểu mẫu xung đột, người dùng phải đối chiếu bản mới trước khi lưu lại.
- Giới hạn: thông báo giữa máy khác dựa vào tải lại định kỳ/focus, không phải kênh đẩy tức thời. Một số thao tác nghiệp vụ nhiều bản ghi hiện còn là nhiều yêu cầu riêng (ví dụ phiếu thay đổi BOM → BOM và lịch sử Leadtime/Safety); cần gom thành một API giao dịch để bảo đảm mọi bước cùng thành công. Chưa nghiệm thu đồng thời bằng hai tài khoản LIVE trên desktop/điện thoại. Không migration/seed/reset dữ liệu.

## 29/09/2026 — Giao dịch cho các bản ghi liên kết

- Xác nhận phiếu thay đổi BOM cập nhật phiếu và BOM nguồn trong một giao dịch; Leadtime cập nhật phiên bản đang áp dụng, phiên bản hết hiệu lực và lịch sử trong cùng giao dịch; Safety Days cập nhật bộ quy tắc, quy tắc liên kết, phiên bản cũ và lịch sử cùng lúc. API kiểm tra phiên bản của từng bản ghi trước khi ghi; khi có xung đột trả 409, giữ biểu mẫu và không ghi dở dang trong các nhóm này. Nhật ký quản trị chỉ tạo khi bản ghi đã lưu.
- Nhập Đơn vị tính SKU từ PDF kiểm tra nội dung SKU trước khi ghi và chỉ ghi lịch sử khi đúng SKU được cập nhật. Với lô lớn xử lý theo đợt 40 SKU, nếu phát sinh xung đột sau các đợt đã lưu thì API báo rõ số SKU đã lưu để quản trị viên đối chiếu rồi nhập lại phần còn lại; toàn bộ tệp lớn chưa phải một giao dịch duy nhất.
- Màn hình giữa hai thiết bị vẫn cập nhật khi focus/định kỳ khoảng 45 giây, chưa có thông báo đẩy thời gian thực. Cần nghiệm thu thực tế bằng hai tài khoản LIVE và thiết bị riêng. Không đổi dữ liệu đã chốt, không migration/seed/reset.

## 29/09/2026 — Một phiếu thay đổi BOM cho nhiều SKU

- Trong Phiếu thay đổi BOM, tiêu đề nằm trên thanh Chức năng và có nút Sửa hàng loạt. Biểu mẫu dùng bảng nhập 10 cột, ba loại Thêm mới/Thay đổi/Ngừng sử dụng và gợi ý Mã LK/NVL như phiếu một SKU; chọn nhiều SKU rồi nhập một nội dung sửa dùng chung. API kiểm tra tất cả SKU có BOM nguồn, không có phiếu chờ xác nhận khác, cùng mã vật tư đang dùng và cùng lượng dùng/mẫu số/hao hụt trước khi cho lưu.
- Lưu tạo đúng một bản ghi `bom_change` ở trạng thái Chờ xác nhận. Giao diện chuyển sang phần xác nhận của phiếu; badge thông báo hiện một phiếu chờ. Xác nhận một lần cập nhật tất cả BOM đã chọn và nhật ký trong một D1 batch có kiểm tra phiên bản từng BOM; bất kỳ xung đột nào làm cả lượt bị từ chối. Hủy phiếu chờ hoặc hủy xác nhận cũng có kiểm tra phiên bản; hủy xác nhận khôi phục đồng thời các BOM khi chưa ai sửa sau lúc xác nhận.
- API phiếu một SKU cũng chặn tạo thêm phiếu Chờ xác nhận nếu SKU thuộc phiếu hàng loạt đang chờ. Bản đã lưu cũ và BOM nguồn chỉ được đọc, không migration/seed/reset.


## BOM — đối chiếu PDF 30/09/2026

Đã thiết lập bản đối chiếu có nguồn/trang, bổ sung nội dung bị cắt và tách hao hụt theo BOM cha trực tiếp. Admin xem và áp dụng rõ ràng trong menu BOM; backend kiểm tra phiên bản, lưu trước/sau và tránh phiếu chờ xác nhận. Những quan hệ chưa thống nhất hoặc chưa có BOM riêng giữ nguyên và hiển thị để đối chiếu riêng. Xem `BOM-PDF-RECONCILIATION-2026-09-30.md`.


## 30/09/2026 — Nguồn BOM theo SKU Master

- Nguồn các dòng BOM hiện hành lấy theo SKU Master: Mua hàng → Mua; Tự sản xuất → Tự chế; Gia công → Ủy thác. Áp dụng khi xem BOM, tra cây/xuất cây, chọn vật tư, lưu BOM và xác nhận phiếu một mã/hàng loạt.
- Dữ liệu đọc được suy ra từ danh mục hiện tại, không chạy ghi hàng loạt khi mở menu. Dòng đã hết hiệu lực giữ nguồn lịch sử; lượng dùng, mẫu số, hao hụt và dữ liệu trước/sau phiếu không bị đổi chỉ vì tra nguồn.
- Nội dung SKU chờ xác nhận dùng nguồn của bản đã duyệt nếu có, chưa dùng nguồn đề nghị mới.


## 30/09/2026 — Hoàn thiện vòng đời BOM (thay thế ghi chú cũ về nút chưa kết nối)

- Lưu/xác nhận/khôi phục BOM mới đi qua API nghiệp vụ; kiểm tra SKU Master, mã trùng và số hợp lệ, lưu bản trước xác nhận và nhật ký. Dữ liệu gốc không có bản trước xác nhận không được đoán để khôi phục; thay đổi có phiếu được khôi phục qua phiếu tương ứng.
- Phiếu một mã và hàng loạt dùng chung xử lý trên máy chủ. Lưu bản nguồn, kiểm tra phiên bản khi duyệt, ghi BOM/phiếu/nhật ký trong giao dịch và khôi phục toàn bộ bản trước phiếu khi hủy xác nhận. Từ chối khôi phục nếu BOM đã bị sửa tiếp.
- Phiếu cũ đã xác nhận chỉ được khôi phục nếu nhật ký có bản trước/sau khớp chính xác. Phiếu cũ chờ chưa có snapshot phải mở Sửa/lưu lại trước khi duyệt.
- Lượng dùng và mẫu số phải là số dương; chấp nhận dấu phẩy thập phân. Dòng lịch sử được giữ nguyên. Cho sửa riêng mẫu số; khi chọn mã con lấy mẫu số nguồn thay vì luôn đặt 1.
- Chi tiết, cây, phiếu và hàng loạt dùng chung quy tắc ngày hiệu lực/hết hiệu lực theo ngày Việt Nam.
- Kiểm tra quyền Thêm/Sửa/Xác nhận/Hủy xác nhận riêng theo menu tại máy chủ; chặn đường ghi BOM qua API bản ghi chung và API liên kết cũ để tránh bỏ qua kiểm soát.

- 30/09/2026: Phiếu thay đổi BOM hàng loạt chỉ hiển thị SKU đầu tiên kèm nút +N để mở danh sách đầy đủ tại bảng lịch sử, khung xác nhận và chi tiết. BOM không còn nút Đối chiếu PDF trên thanh chức năng; dữ liệu và quy trình xác nhận giữ nguyên.

## Dữ liệu cơ bản — tra cứu và Hủy (30/09/2026)
- SKU Master, Leadtime, Giờ công, Safety Days và Danh sách nhân viên có lựa chọn Create - date: sắp xếp theo lần thêm/sửa gần nhất, mới nhất lên đầu; không tự tạo ngày cho dữ liệu gốc chưa có thời gian.
- Nút Hủy giữ nguyên giá trị nguồn, ghi Đã hủy cùng người/thời gian và lịch sử; dữ liệu vẫn xem được. Hủy khác Hủy xác nhận và không tự khôi phục phiên bản trước.
- SKU Hủy không được chọn cho dữ liệu mới. Leadtime Hủy ngừng cả bản đang áp dụng/đang chờ của SKU và không lấy lại Leadtime gốc. Giờ công Hủy không còn được dùng cho tính giờ mới; Safety Days Hủy ngừng quy tắc tính liên kết; nhân viên Hủy không còn được chọn bố trí mới.
- Số liệu nghiệp vụ đã chốt và lịch sử được giữ nguyên. Sửa thông thường không tự kích hoạt lại bản đã Hủy.
- Backend kiểm tra quyền Hủy hoặc Sửa tại đúng menu, kiểm tra phiên bản và lưu liên kết cùng lịch sử trong một giao dịch.

- 30/09/2026: Danh sách SKU ghi nhận revision của chính dữ liệu được hiển thị cho Hủy; tải lại sau xác nhận SKU để tránh revision cũ. Cảnh báo Hủy phân biệt phiên bản không khớp với việc khẳng định có người khác sửa.

- 30/09/2026: Hủy SKU tăng revision số đúng quy tắc sku_revision_guard; kiểm tra SKU đã có revision từ thêm/sửa/xác nhận, giữ nguyên version nội dung và toàn bộ dữ liệu khi Hủy.

- BOM: Nhóm SP lấy trực tiếp từ nhóm của SKU Master đã xác nhận; tách riêng Phân loại BOM. Danh sách, kết quả tra cứu, chi tiết, thêm mới và cây cha–con hiển thị hai trường riêng. Phân loại hợp lệ giữ nguyên; dữ liệu từng bị ghi nhầm nhóm vào phân loại dùng phân loại gốc của mã BOM. Thêm mới chọn Phân loại riêng, backend kiểm tra và không ghi nhóm SKU đè lên Phân loại. Không thay đổi định mức, mẫu số, hao hụt, phiên bản hay lịch sử để sửa cách hiển thị này.
- Tra BOM riêng và cha–con dùng chung nguồn hiện hành từ SKU Master, cùng nhãn Tự chế/Mua ngoài/Gia công. Thông tin mã cha hiển thị Nguồn thay Loại BOM lưu sẵn; các dòng ngừng sử dụng khi tra cứu cũng hiển thị nguồn hiện hành. Chỉ chiếu dữ liệu khi tra, không ghi đè nguồn trong bản lịch sử hoặc sửa định mức.
- Lịch SX thực tế: bảng Biến động đã ghi/Lịch sử chuyển Line có cột Nhân viên (tên và mã) cạnh Số người. Đọc mã đã lưu để hiển thị dữ liệu cũ, kể cả nhân viên ngừng hoạt động còn trong danh mục; lần ghi mới lưu tên kèm mã. Dữ liệu cũ chỉ có số lượng hiển thị Chưa ghi nhận nhân viên, không suy đoán tên.
- SX báo công: bố cục theo mẫu đã chọn: bảng LSX 11 cột, lọc Line/tra LSX-SKU-tên/Đang làm/Tất cả, sắp xếp hạn gần nhất; thẻ điện thoại; nút Chuyển người/Báo công và Thao tác khác. Bấm Báo công mở khung nhập sản lượng dưới danh sách, thông tin kế hoạch và thực tế tự lấy từ lệnh. Giờ công đã ghi nhận dùng báo công có sẵn; lần mới tính tại backend theo lịch và biến động. Các thao tác Nhập trạm, Tiếp tục, Tạm ngưng, bổ sung/giảm nhân lực và sự cố giữ API/quyền hiện hữu.
- SX báo công: hiển thị trực tiếp đủ Tạm ngưng/Tiếp tục/Báo công/Chuyển người, nút không hợp lệ theo trạng thái bị vô hiệu hóa; Nhập trạm cho lệnh mới. Chi tiết nhóm theo thông tin lệnh, kế hoạch/sản lượng, nội dung và người thực hiện; nhãn tiếng Việt, không hiển thị tên trường kỹ thuật hoặc JSON thô. Nhân viên trong nhật ký có tên và mã.

- 03/10/2026: SX báo công bám màu mẫu: nền kem, chữ xanh navy, đầu bảng xanh lá đậm/chữ trắng, nút báo công cam; sửa ghi đè CSS và khoảng trống menu trái. Thanh chức năng một khung gồm Line, tra cứu, Đang làm/Tất cả, Quay lại và chọn thứ tự ngày bắt đầu/hạn hoàn thành. Khung báo công có thông tin thực tế nền xám, ngày kế hoạch nền vàng nhạt, giờ đã ghi nhận nền xanh nhạt; nhập giờ 24h bằng ClockInput chung. Đã kiểm tra trực tiếp bảng/khung nhập ở desktop và chiều rộng 390px trên fixture TEST từ component thật, có kiểm tra vô hiệu hóa nút theo trạng thái. API trên supervised preview bị chặn bởi quy tắc loopback của TEST nên không coi đây là kiểm tra lưu dữ liệu end-to-end; 9 kiểm tra production-workflow riêng đã qua. Không dùng fixture hoặc dữ liệu minh họa trên bản phát hành.

- 03/10/2026: Nhập trạm/Tạm ngưng/Tiếp tục/Chuyển người và thao tác phụ trong SX báo công mở khung ngay dưới bảng, không có overlay làm tối màn hình. Dùng cùng nền kem, tiêu đề navy, thông tin lệnh nền vàng và nút Xác nhận cam; tự cuộn tới khung khi mở. ProductionDateTimeInput dùng chung ô ngày và ClockInput 24h, giữ nguyên giá trị effectiveAt/endsAt gửi backend. Danh sách nhân viên mở lên trên ở desktop, trong luồng ở mobile để nút Xong/Xác nhận không bị che. Đã kiểm tra component ProductionManagement thật với nguồn trả về fixture TEST (không ghi dữ liệu) ở desktop và 390px: Nhập trạm, chọn NV, Hủy, Chuyển người, thời gian và nút cuối khung. Fixture không đưa lên bản phát hành.

- 03/10/2026: SX báo công gom thao tác từng lệnh vào một nút Thao tác ▾ trên bảng và thẻ điện thoại. Danh sách giữ thao tác chưa hợp lệ ở trạng thái mờ/vô hiệu hóa theo điều kiện hiện hữu; Chi tiết luôn truy cập được. Menu nổi có giới hạn chiều cao/cuộn, không bị cắt bởi bảng. Tiêu đề cột căn giữa; chữ bảng 16px, nhãn chi tiết 16px và giá trị 18px đậm trên nền trắng. Đã kiểm tra desktop/390px bằng component thật với fixture TEST chỉ đọc, trạng thái lệnh đang chạy/chưa nhập trạm và xác minh CSS tính toán. Typecheck đạt; fixture không đưa lên phát hành. Không thay đổi API hoặc dữ liệu sản xuất.

- 05/10/2026: SX báo công tăng Trạng thái và mục Thao tác lên 18px/đậm; từng thao tác có màu chữ/nền nhạt riêng, mục chưa hợp lệ giữ màu xám/vô hiệu hóa. Đã kiểm tra desktop và 390px qua component thật với fixture TEST chỉ đọc; xác minh font trạng thái 18px/700. Typecheck đạt. Không đổi điều kiện thao tác hoặc API, không phát hành fixture.
- 05/10/2026: SX báo công tăng cột LSX tối thiểu 155px, mã lệnh 20px/đậm/không xuống dòng. Đã kiểm tra trực tiếp component thật trên dữ liệu TEST chỉ đọc, xác minh CSS 155px và 20px/700; fixture không phát hành.
- 05/10/2026: SX báo công chuyển Thao tác sang cột đầu tiên bên trái. Điều chỉnh selector cột LSX theo vị trí mới để giữ 155px/20px/đậm. Typecheck đạt; kiểm tra component thật qua fixture TEST chỉ đọc cho thứ tự đủ 11 cột và mở menu bên trái. Không thay đổi nghiệp vụ hoặc dữ liệu; fixture không phát hành.

## 05/10/2026 — Báo công, phân công và biến động nhân viên

- Nhập trạm chọn nhân viên cụ thể; người đang thuộc LSX khác được chuyển cùng mốc hiệu lực trong một giao dịch. Sự kiện chuyển giữ LSX nguồn/đích, nhân viên, số người trước/sau và người ghi. Bổ sung chỉ nhận nhân viên chưa thuộc LSX khác. Ghi lùi ảnh hưởng báo công hoặc phân công đã có bị chặn, không tự tạo hai phân công chồng nhau.
- SX báo công giữ Nhập trạm, Tạm ngưng, Tiếp tục, Báo công, Chuyển người, Bổ sung và Sự cố trong Thao tác ▾; bỏ Giảm/Rút người và Nghỉ/phụ kho khỏi bảng thao tác. Nghỉ/Đi trễ/Về sớm/Phụ kho ghi theo nhân viên ở Lịch SX thực tế. Không yêu cầu chọn LSX bị ảnh hưởng; hệ thống xác định từ phân công từng khoảng giờ.
- Đi trễ có Chưa đến để đăng ký trước ca; nhân viên này vẫn chọn được khi nhập trạm. Giờ ghi vào hệ thống khác mốc vắng hiệu lực. Ghi giờ vào thực tế đóng bản ghi đi trễ bằng một phiên bản mới; thực tế nghỉ hoặc thực tế có mặt cũng là điều chỉnh có lịch sử trước/sau. Bản gốc được giữ. Mốc cuối ca của bản ghi Chưa đến chỉ giới hạn khoảng vắng trong ngày, không phải giờ đến được tự suy đoán.
- Bản ghi vắng/có mặt chồng nhau bị chặn theo nhân viên và khoảng giờ; lỗi nêu nhân viên, loại và bản ghi có sẵn. Chỉ phiên bản hiệu lực được đưa vào phép tính. Điều chỉnh hồi tố ảnh hưởng giờ đã xác nhận phải được QLSX duyệt; giữ giờ cũ và sự kiện điều chỉnh giờ trước/sau. Các báo công ngoài phân công nhân viên đó không bị điều chỉnh.
- Giờ HC/TC lấy giao của lệnh đang chạy, phân công nhân viên, lịch thực tế và có mặt; nghỉ trưa, giải lao, vệ sinh và thời gian không làm được loại theo lịch. Vắng theo người đi theo phân công kể cả chuyển LSX/Line, mỗi khoảng chỉ loại một lần. Khung Báo công có giờ lần này, tên người vắng/đi trễ/về sớm/phụ kho liên quan và chi tiết giờ theo người; thiếu giờ vào hoặc còn điều chỉnh chờ duyệt thì vẫn lưu sản lượng nhưng chặn xác nhận/đồng bộ.
- Báo công lưu Ngày sản lượng do người dùng chọn trong khoảng thực hiện, không phân bổ sản lượng theo tỷ lệ giờ. Giờ theo ngày là thời gian làm thực tế của từng ngày, tách khỏi ngày ghi nhận sản lượng. Khi đã báo đủ SL (kể cả phần chờ duyệt), dừng lệnh và trả nhân viên về nhóm chưa phân công ở mốc kết thúc; trạng thái Chờ xác nhận HT cho đến khi QLSX xử lý.
- Ngày hoàn thành chính thức là ngày Việt Nam của mốc cuối trong các báo công hợp lệ đã xác nhận đủ SL lệnh, không dùng ngày duyệt. Phân biệt HT sớm / HT đúng hạn / HT trễ theo ngày kết thúc kế hoạch. Khi xác nhận đủ lệnh bị trễ, bắt buộc một ô Lý do trễ; lỗi nêu LSX và số ngày trễ. Xác nhận cập nhật dữ liệu KHSX hiện hữu và đề nghị nhập Kho, vẫn giữ luồng Kho xác nhận riêng.
- Menu Nhật ký hiện hữu có Nhật ký báo công và Thời gian & nhân lực. Có từng lần, sản lượng/ngày, lũy kế đã duyệt, giờ HC/TC, thời điểm thực hiện/ghi nhận, nhân viên, người ghi, duyệt/trả và thay đổi trước/sau. Chi tiết LSX có sản lượng theo ngày và mở từng lần báo công. Báo công lưu căn cứ lịch, phân công, biến động và phiên bản Capacity để giữ nguồn tính ban đầu.
- Báo công và sự kiện ghi nguyên tử với khóa phiên bản chung; mã thao tác tránh ghi lại khi gửi lại cùng yêu cầu. Không sửa/seed/reset dữ liệu production trong quá trình triển khai. Kiểm tra API/nghiệp vụ trên DB TEST cách ly; toàn bộ 103 kiểm tra nền đã đạt, thêm kiểm tra giải phóng người khi báo đủ SL và chạy lại nhóm 23 kiểm tra liên quan. Typecheck đạt. Kiểm tra component thật trên fixture TEST chỉ đọc cho Báo công, nhập trạm có người đi trễ/chuyển từ lệnh cũ, Lịch thực tế, Nhật ký và thẻ điện thoại 390px; đây không phải kiểm tra ghi dữ liệu production qua trình duyệt.

- 05/10/2026: SX báo công đổi tiêu đề cột đầu và nút dropdown từng LSX từ Thao tác thành Báo công (desktop/thẻ điện thoại); mục complete trong dropdown và khung nhập đổi thành Xuất trạm. Giữ nguyên sự kiện, API, điều kiện quyền/trạng thái và phép tính. Kiểm tra TypeScript và build trước khi phát hành.

## 05/10/2026 — tiếp tục Site 358: số người báo công, ghi nhận, tên mẫu

- Base source xác minh trùng Site 358: `8de184020b8f6a20bbe0ac25b56e6cc7d9aa9008`. Giữ nguyên Project/DB/FILES và audience public.
- SX báo công phân biệt có mặt hiện tại / người phân công; form xuất trạm lấy số có mặt theo giờ xuất được chọn. Preview, lịch sử từng báo công và chi tiết hiện số người thực tế tính giờ theo từng khoảng HC/TC, danh sách người, người phân công. Nghỉ/giải lao/vệ sinh được loại đúng theo khoảng; người đến tại cuối lần báo công không được tính ngược.
- Ghi nhận tại Lịch SX thực tế có nút cam, trạng thái disabled rõ, hover/focus bàn phím, hướng dẫn lưu và bổ sung giờ vào. Giữ quy trình duyệt điều chỉnh sau báo công đã xác nhận.
- LSX mẫu lấy tên/mã/quy cách sản phẩm từ SKU Master đang dùng và tên nhân viên từ directory hiện hữu. Trial vẫn dùng bảng riêng, không ghi các nghiệp vụ lên dữ liệu thật. Người dùng mở LSX mẫu để tạo; bộ cũ có nút Cập nhật tên mẫu, CAS cập nhật nhãn giữ nguyên sự kiện thử. Yêu cầu đủ 10 nhân viên và 4 SKU cho mỗi Line A/B; thiếu thì báo rõ, không bịa tên.
- Kiểm thử: bộ npm test trước thay đổi hiển thị mã NV cuối cùng qua 108/108; sau chỉnh cuối, 16/16 kiểm thử báo công/mẫu/nhận diện NV/số người qua; test nâng cấp tên mẫu giữ sự kiện qua; typecheck qua. Test mới về 08:00–10:00 có 9/10 người, sau 10:00 có 10/10, không tính ngược giờ đến, có trong npm test.
- Browser QA chưa chạy: skill control-browser không có trong môi trường này. Không tuyên bố nghiệm thu ảnh desktop/mobile. Báo công cũ đã xác nhận chưa có staffing trong snapshot giữ nguyên, hiển thị chưa có chi tiết thay vì tính lại dữ liệu lịch sử.

## 05/10/2026 — Theo dõi lệnh sản xuất, Hủy báo công và Nhật ký riêng

- Đổi menu cha Thực hiện sản xuất thành Theo dõi lệnh sản xuất; bổ sung Hủy báo công. Giữ nguyên Project, DB, FILES và quyền Line hiện hữu.
- Hủy báo công tra theo LSX/SKU/tên sản phẩm, Line và trạng thái. QLSX được chọn thao tác, hủy hoặc điều chỉnh thời điểm/nhân lực/chuyển người/sản lượng theo loại, nhập lý do, xem tác động rồi ghi nhận. Bản gốc giữ nguyên trong lịch sử với cờ Đã hủy; điều chỉnh tạo bản thay thế và nhật ký trước/sau.
- Backend tính lại phân công, giờ, sản lượng, trạng thái LSX và đề nghị nhập kho liên quan, kiểm tra phiên bản và ghi nguyên tử. Chặn thao tác phá vỡ sự kiện sau; hủy nhập trạm kèm chuyển người xử lý toàn nhóm. Chặn hủy/đổi sản lượng đã nhập kho. Báo công bị trả cần điều chỉnh được đưa về chờ kiểm tra sau sửa.
- Nhật ký có 5 giao diện: Báo công, Thời gian, Nhân lực, Điều chỉnh, Thay đổi. Mỗi mục có cột riêng và bộ tra cứu riêng theo LSX/SKU/tên/NV/người ghi/thao tác, Line, trạng thái, ngày từ–đến. Hủy vào Thay đổi, sửa vào Điều chỉnh; chi tiết có trước/sau và lý do. Không gộp thời gian với nhân lực.
- Dùng StandardToolbar hiện hữu cho hai giao diện mới, dịch nhãn Việt/Anh/Trung. Kiểm thử API/nghiệp vụ trên DB TEST cách ly; không ghi/reset dữ liệu production. Toàn bộ 117/117 kiểm thử qua sau sửa cuối, gồm 8 kiểm thử hủy/điều chỉnh/tra cứu/quyền/ghi đồng thời. Typecheck qua; build kiểm tra khi phát hành. Browser QA chưa chạy vì skill control-browser không có trong môi trường.

## 05/10/2026 — sửa dữ liệu Chi tiết trong Theo dõi lệnh sản xuất

- Base source mở từ Git trùng Site 360 (`f2ae09af14540641a2b13096c75ae94c63098130`); giữ nguyên Project/DB/FILES/audience.
- Chi tiết dùng bộ nối chỉ đọc giữa bản ghi gốc, LSX, báo công và sự kiện. Bổ sung KH bắt đầu/hoàn thành, quy cách, số lượng/tiến độ/trạng thái LSX và thực tế từ LSX khi bản ghi cũ thiếu trường; giữ các giá trị lịch sử có sẵn và giá trị 0. Không ghi bù vào DB hoặc suy đoán khi nguồn cũng thiếu.
- Báo công lấy số người, tên NV từ sự kiện xuất trạm liên quan; sự kiện xuất trạm/xác nhận/hủy/điều chỉnh lấy khoảng báo công, giờ HC/TC, sản lượng và thông tin duyệt từ báo công liên quan. Đọc bản gốc theo ID tránh nhầm dữ liệu ghép trên dòng nhật ký.
- Mẫu dùng chung áp dụng cho Nhật ký 5 mục, Hủy báo công, SX báo công, Tiến độ và các nút mở từng lần báo công trong chi tiết LSX. Chuyển người hiển thị đúng lệnh/Line đích; sự cố có dừng SX/SL ảnh hưởng.
- Điều chỉnh giờ theo Line hiển thị từng LSX và giờ trước/sau; lịch làm việc có bảng ngày HC/TC/nghỉ trưa/giải lao/nghỉ trước TC/vệ sinh/ghi chú trước–sau; Capacity hiển thị giờ khả dụng, thao tác/quyết định/nội dung yêu cầu. Các trường không áp dụng không còn tạo khung thay đổi rỗng.
- Kiểm tra component thật bằng render HTML trên fixture TEST: ngày KH, số lượng, NV, giờ, người duyệt; báo công cũ/sự kiện/dòng nhật ký/LSX/chuyển người; điều chỉnh giờ theo Line, Capacity bằng 0, lịch và hủy nhân lực. 121/121 npm test qua; typecheck qua. Không ghi dữ liệu production; chưa kiểm tra trực quan desktop/mobile do skill browser bắt buộc không có trong môi trường.

## 05/10/2026 — sửa đúng tình huống ảnh Nhật ký Xuất trạm

- Site 361 vẫn ghi nhãn Sản lượng đã hoàn thành cho số đã xác nhận, dẫn tới báo 100 SP chờ duyệt hiển thị 0; bắt đầu thực tế phụ thuộc projection LSX có thể trống. Kiểm tra trước đó dùng fixture có sẵn sản lượng đã duyệt/ngày bắt đầu nên chưa bắt được tình huống này.
- Chi tiết nay phân biệt SL hoàn thành đã báo công (đã xác nhận + chờ xác nhận), SL đã xác nhận, SL chờ xác nhận, SL chưa báo công và SL còn lại chưa xác nhận. Không thay đổi công thức In_transit, đồng bộ nhập kho hoặc trạng thái duyệt. Các báo công hủy/trả cần điều chỉnh không được cộng vào sản lượng hiệu lực. Giữ phần sản lượng cũ đã xác nhận khi có dữ liệu legacy.
- Bắt đầu thực tế khi thiếu trong LSX lấy Nhập trạm/chuyển vào đầu tiên hiệu lực; nếu lịch sử vận hành không còn có thể dùng khoảng bắt đầu của báo công hợp lệ. Không lấy mốc bắt đầu của lần báo công tiếp theo làm mốc bắt đầu toàn lệnh. Đến thời điểm của Xuất trạm lấy completedAt của báo công liên quan.
- Kiểm tra 5/5 test component/render qua, trong đó test mới dùng DB TEST và workflow thật: TEST-LSX-A02 nhập 09:00, xuất 100 SP 11:00 → 100 hoàn thành/0 xác nhận/100 chờ/900 chưa báo, bắt đầu 09:00; xuất tiếp 50 SP 11:30 → 150/850, bắt đầu vẫn 09:00; trả lại lần 100 thì hiệu lực chỉ còn 50. Test cố ý xóa actualStartedAt khỏi projection để tái hiện ảnh, không xóa dữ liệu nghiệp vụ. Typecheck qua; build kiểm tra khi phát hành. Không ghi production, không xác nhận browser QA.

## 05/10/2026 — Nhật ký gọn và ngày trước giờ sau

- Source mở từ Git Site 362. Nhật ký Nhân lực bỏ cột tên nhân viên trải rộng: Số người có mũi tên native details/summary, mặc định đóng, nhấn hoặc dùng bàn phím để mở danh sách tên/mã. Hủy báo công và bảng từng lần báo công dùng cùng component. Tra theo tên nhân viên vẫn giữ nguyên.
- Nhật ký Báo công đưa Ngày sản lượng lên đầu; Thời gian/Nhân lực/Điều chỉnh/Thay đổi đưa Thời điểm hiệu lực lên đầu. Hủy báo công đặt thời điểm hiệu lực trước cột chọn. Các cột dữ liệu được đổi cùng tiêu đề.
- Bộ định dạng dùng chung hiển thị dd/MM/yyyy HH:mm:ss, giờ Việt Nam 24h; ngày đơn chỉ dd/MM/yyyy. Áp dụng Nhật ký, Hủy báo công, Chi tiết/so sánh trước-sau, từng lần báo công, SX báo công, Tiến độ, preview giờ và khoảng số người; không thay đổi timestamp nguồn hay phép tính.
- Typecheck qua; 6/6 kiểm tra Chi tiết/render qua gồm timezone qua nửa đêm, ngày không giờ, danh sách nhân viên mặc định đóng, ngày sản lượng ở cột đầu và định dạng thời điểm. Build kiểm tra khi phát hành. Chưa browser QA; không ghi dữ liệu production.

## 05/10/2026 — số người và giờ từng NV trong Nhật ký Báo công

- Mở Git Site 363. Nhật ký Báo công thêm cột Số người dùng component chung; mũi tên mở tên/mã NV và giờ HC/TC/tổng giờ từ hours.perEmployee của đúng lần báo công. Các giá trị 0 hiển thị đúng; bản cũ thiếu giờ cá nhân báo chưa có, không chia đều giờ tổng hoặc suy đoán.
- ProductionEmployeeCount dùng nhóm details name=onspa-employee-lists: khi mở dòng khác, dòng trước tự đóng. Nhóm được dùng cho Nhật ký Nhân lực, Hủy báo công, lịch sử từng lần báo công và người thực tế trong Lịch SX thực tế. Các picker NV dùng nhóm riêng; các khung giờ NV/số người theo khoảng cũng có nhóm riêng để tránh đóng khung cha khi mở khung con.
- Giữ nguyên bộ tra cứu, giờ, sản lượng và timestamp lưu trữ. Typecheck qua, 6/6 test render/Chi tiết qua, kiểm tra cột Số người, nhóm disclosure mặc định đóng và giờ từng NV (HC 1,5 / TC 0,5 / tổng 2). Cơ chế đóng cùng nhóm dùng HTML details native; chưa browser QA, không tuyên bố đã thử tương tác trực quan. Không ghi production.

## 05/10/2026 — bảng nhân viên trong mũi tên Số người

- Source Git Site 364. ProductionEmployeeCount đổi danh sách văn bản sang bảng có ô/viền: Nhân viên (tên, mã), Giờ HC, Giờ TC, Tổng giờ công. Mỗi NV một dòng, số căn phải. Giao diện chỉ xem nhân lực không có giờ dùng bảng Nhân viên một cột.
- Giữ nhóm tự đóng bảng trước khi mở dòng khác; không thay đổi số người, giờ hay dữ liệu. Bảng con giới hạn chiều rộng/cuộn ngang trên màn hình nhỏ, không tự phân trang và không dùng minimum width của bảng LSX.
- Kiểm tra TypeScript/build và bộ render Chi tiết khi phát hành; không ghi production, chưa browser QA.

## 05/10/2026 — Người thao tác (ID) trong các Nhật ký

- Source mở từ Git Site 365. Nhật ký Báo công/Thời gian/Nhân lực/Điều chỉnh/Thay đổi có cột Người thao tác (ID) ngay sau ngày hiệu lực/ngày sản lượng; tra cứu theo ID. Hủy báo công, từng lần báo công và Chi tiết dùng cùng dữ liệu người thao tác.
- Máy chủ lưu actorId/report.reportedById theo userId/permissionLogin của phiên đăng nhập (fallback login local), không lấy ID từ body. Email/log actor cũ giữ nguyên. Xác nhận/trả báo công có actorId của người duyệt trong sự kiện riêng và reviewedById; hủy/điều chỉnh có ID người xử lý trong sự kiện mới; không thay người tạo trong bản gốc. Lịch thực tế lưu byId; lịch sử Capacity lưu actorId.
- Dữ liệu cũ chỉ hiển thị ID đã lưu hoặc đối chiếu chính xác login/email với tài khoản hiện hữu. Sự kiện thiếu actor chỉ dùng updated_by khi updated_at trùng recordedAt, tránh gán người sửa sau làm người thao tác gốc. Bộ ví dụ mới lưu ID admin tạo; bộ cũ dùng metadata ghi ban đầu khi đủ căn cứ. Không migration/ghi bù production và không suy đoán người thiếu.
- 123/123 npm test qua; thêm kiểm tra ID QLSX-001 khác email manager@test, body FAKE-ID bị bỏ qua, đối chiếu email cũ sang ID và giữ người báo công khi có người duyệt sau. Nhóm 6 test render/Chi tiết chạy lại qua sau bổ sung kiểm tra đối chiếu. Typecheck qua; build kiểm tra khi phát hành. Chưa browser QA.


## 06/10/2026 — Tên sản phẩm trong Nhật ký giờ công

- Mở source Git Site 366; giữ cột Tên sản phẩm ngay sau SKU trong Nhật ký Thời gian. Bổ sung đối chiếu sự kiện qua reportId → báo công → LSX; khi không còn LSX, lấy tên/SKU từ bản lưu orderSnapshot hoặc báo công. Bản cũ chỉ có SKU lấy tên từ SKU trùng chính xác trong danh sách LSX; thiếu nguồn vẫn hiển thị dấu —, không suy đoán. Tra cứu theo Tên sản phẩm dùng cùng dữ liệu đã đối chiếu.
- Chỉ thay dữ liệu hiển thị, không ghi bù hay thay nhật ký, giờ công, DB/FILES hoặc quyền. Kiểm tra hồi quy tên từ báo công, snapshot, SKU; thiếu nguồn và dữ liệu gốc không đổi. Typecheck, test Nhật ký/Chi tiết và build kiểm tra trước phát hành; chưa browser QA.


## 06/10/2026 — giao diện Nhật ký giờ công theo hình mẫu

- Source Git Site 367. Thay bảng Thời gian bằng Nhật ký giờ công: Thời gian sự kiện (hiệu lực đầu tiên theo yêu cầu trước), Thời gian hệ thống ghi nhận, Plan ID, LSX, SKU, Tên sản phẩm, Line, Sự kiện, Tổng giờ hoạt động lũy kế, Nguồn, Người thao tác (ID), Lý do điều chỉnh thời gian và nút Chi tiết. Nhãn Bắt đầu/Hoàn thành/Tạm ngưng/Tiếp tục có màu phân biệt; tên sản phẩm/lý do xuống dòng. Số giờ hiển thị hai chữ số thập phân. Tra cứu thêm Plan ID/lý do. Có bản dịch Việt/Phồn thể/Anh.
- API tính giờ hoạt động lũy kế chỉ khi đọc: dựa sự kiện từng LSX và lịch thực tế đã nhận từ Capacity phê duyệt; trừ nghỉ trưa, giải lao, nghỉ trước tăng ca và khoảng tạm ngưng/sự cố dừng việc. Không nhân số người, không lấy tổng giờ nhân công làm giờ hoạt động. Báo hoàn thành từng phần vẫn nối tiếp lũy kế; hoàn thành cuối dừng đồng hồ. Sự kiện đã hủy không tham gia tính; thiếu lịch trong khoảng chạy hiển thị —. Không ghi bù hoặc thay dữ liệu gốc.
- Typecheck và 29 kiểm tra Nhật ký, render Chi tiết, workflow, hủy/điều chỉnh qua trước build. Có kiểm tra loại trừ nghỉ/tạm ngưng, nhiều lần hoàn thành, không nhân 10 người, thiếu lịch và dữ liệu hủy. Chưa browser QA, không tuyên bố nghiệm thu tương tác/hình ảnh.


## 06/10/2026 — sửa ý nghĩa giờ lũy kế và tên thao tác

- Source Git Site 368. Hủy cách hiển thị giờ hoạt động đơn thuần của lần trước; cột Tổng giờ công lũy kế dùng hoursForOrder chung với Báo công và attendancePolicy cùng lịch thực tế. Cộng giờ được tính từng người, theo các khoảng phân công/điều chuyển/nghỉ/đi trễ/vệ sinh/HC/TC và tạm ngưng; giữ độ chính xác khi cộng, hiển thị hai chữ số thập phân. Không nhân số người ban đầu cho toàn bộ thời gian. Thiếu lịch vẫn hiển thị —.
- Tên sự kiện lấy productionActionNames chung: Nhập trạm, Xuất trạm, Tạm ngưng, Tiếp tục, Báo sự cố. Bổ sung chú thích: từ Nhập trạm đến sự kiện và các lần Xuất trạm trong cùng LSX vẫn cộng dồn; không mô tả giờ lũy kế như giờ của riêng sản lượng lần đó. Giữ dữ liệu đã lưu.
- Kiểm tra mẫu 10 người qua nghỉ/tạm ngưng, 2 người có 1 người đi trễ và 1 người vệ sinh (2,5 giờ công), API 4 người từ 09–11 trừ giải lao = 7,3333 giờ công, render tên thao tác chung. Kiểm tra typecheck/test/build trước phát hành.


## 06/10/2026 — nhóm màu theo LSX trong Nhật ký giờ công

- Source Git Site 369. Thời gian sự kiện chuyển sang ngay sau Sự kiện. Cùng LSX hiển thị liền nhau, trong nhóm sắp theo thời gian sự kiện tăng dần (Nhập trạm → Tạm ngưng → Tiếp tục → Xuất trạm); nhóm có sự kiện mới nhất xếp trước.
- Mỗi nhóm có cùng nền màu nhạt và đường viền trên/dưới, màu khác các nhóm LSX khác; nhãn sự kiện bỏ màu riêng theo loại để màu biểu thị LSX. Tra cứu giữ màu cùng LSX, nhóm sau lọc vẫn sắp đúng thời gian. Chỉ đổi hiển thị, không đổi giờ lũy kế, dữ liệu hay lịch sử.
- Kiểm tra nhóm/sắp xếp/màu ổn định sau lọc/vị trí cột và render Nhật ký; typecheck/build trước phát hành.


## 06/10/2026 — cột ghi nhận gọn và màu sự kiện đồng nhất Báo công

- Source Git Site 370. Cột Thời gian hệ thống ghi nhận giới hạn 112px, tiêu đề xuống dòng, dữ liệu ngày trên/giờ dưới; giữ đủ ngày giờ và tooltip đầy đủ.
- Nhãn sự kiện dùng cùng biến màu --work-action-color/bg của menu Báo công qua data-work-action: Nhập trạm xanh lá, Tạm ngưng vàng, Tiếp tục xanh ngọc, Xuất trạm cam, Báo sự cố đỏ. Màu nền nhóm LSX giữ nguyên; màu nhãn phân biệt thao tác. Chỉ thay hiển thị. Typecheck/render/build trước phát hành.


## 06/10/2026 — Nhật ký Báo công theo hình mẫu

- Source Git Site 371. Hạng mục Báo công sắp cột: Thời gian ghi nhận, Plan ID, LSX, SKU, Tên sản phẩm, Quy cách, Line, Ngày bắt đầu, Ngày hoàn thành, Số lượng hoàn thành, Người ghi nhận (ID), Số người, Giờ HC / TC, Trạng thái và Chi tiết. Thời gian ghi nhận ngày trên/giờ dưới; ngày bắt đầu lấy thời điểm Nhập trạm đầu tiên của LSX, ngày hoàn thành lấy ngày Xuất trạm của lần báo công. Thời gian đầy đủ vẫn có trong Chi tiết.
- Giữ mũi tên Số người/bảng giờ từng NV và cách tính giờ/sản lượng của từng báo công. Người ghi nhận theo ID tài khoản ban đầu. Tra theo Plan ID; Quy cách lấy nguồn LSX/báo công/snapshot. Chỉ thay hiển thị, không ghi hay thay dữ liệu. Kiểm tra render/typecheck/build trước phát hành.

## 06/10/2026 — bảng tự co giãn và khung nhân viên

- Source Git Site 372. Bảng dữ liệu trực tiếp trong table-wrap/pp-table/it-table dùng width/min-width 100%, table-layout auto theo vùng màn hình; tiêu đề được xuống dòng thay vì ép bảng bằng độ rộng tối thiểu cố định. Giữ cuộn khi nội dung thực tế không thể vừa; không giảm cỡ chữ/cắt dữ liệu. Bảng con không nhận quy tắc độ rộng bảng chính.
- Nhật ký ghi nhận ngày giờ trên một hàng, cột 160px; số lượng hoàn thành 78px, tiêu đề xuống dòng. Bảng NV dùng khung ngoài đầy đủ và viền ô bên trong, không bị quy tắc bỏ viền tiêu đề cuối phá khung. Không thay dữ liệu.
- Typecheck/build trước phát hành. Kiểm tra nhật ký trực tiếp phát hiện mã dài còn ép bảng; bổ sung xuống dòng dữ liệu khi cần để co theo vùng màn hình. Ngày giờ ghi nhận vẫn giữ một hàng. Thay đổi CSS dùng chung chưa nghiệm thu trực quan từng menu.

## 06/10/2026 — tra vị trí nhân viên và nhật ký di chuyển

- Source mới nhất Site 374; Nhân lực có hai màn hình trong StandardToolbar: Vị trí hiện tại, Nhật ký di chuyển. Tra tên/ID, LSX hai phía, SKU/sản phẩm, Line nguồn/đích, trạng thái, người thao tác; lịch sử lọc ngày hiệu lực. Chọn một nhân viên xem lịch sử; mở người khác thay phần cũ. Số người mở bảng tên/ID dùng component chung.
- Replay dữ liệu hiện có theo hiệu lực với assignedAt/employeesAt, bỏ bản hủy và không áp dụng sự kiện tương lai vào vị trí hiện tại. Hoàn thành cuối cùng hoặc giảm người về chờ phân bổ; báo công một phần, nghỉ/đi trễ không làm đổi vị trí. Dữ liệu thiếu định danh hoặc phân trùng hiển thị Chưa xác định/Cần kiểm tra, không đoán sẵn sàng. Không tạo dữ liệu, schema, DB, Site; không thay API điều động hay giờ công. Nhật ký đọc chi tiết hiện có và dùng màu thao tác chung.
- Số dư chờ phân bổ chưa có dữ liệu quản lý pool riêng nên hiển thị dấu —; số trước/sau LSX lấy snapshot hoặc replay, không chế số. Chưa có nút điều động ngay từ nhật ký: thao tác vẫn ở màn hình SX báo công. Bộ dịch ba ngôn ngữ bổ sung các nhãn mới.
- Kiểm tra chuyển nguồn/đích, hoàn thành từng phần/cuối, hủy, tương lai, phân trùng/thiếu tên và tra LSX cả hai phía; typecheck/build trước phát hành.

## 06/10/2026 — Quy cách trong Nhật ký giờ công

- Source Site 375. Bổ sung Quy cách ngay sau Tên sản phẩm ở Nhật ký giờ công, lấy spec từ journalContext hiện có (LSX/snapshot); thiếu dữ liệu hiển thị —. Điều chỉnh vị trí CSS cột Line, tổng giờ công và lý do theo thứ tự mới. Không thay dữ liệu hoặc cách tính giờ.

## 06/10/2026 — sản lượng từng lần/lũy kế và viền dọc

- Nhật ký giờ công thêm SL hoàn thành lần này và SL hoàn thành lũy kế trước Tổng giờ công lũy kế. Lấy reportedQuantity theo reportId hoặc quantity lưu trong sự kiện; không lấy tổng LSX làm từng lần. Cộng theo thứ tự hiệu lực toàn LSX trước lọc, bỏ sản lượng hủy. Thiếu lượng hiển thị — và không đoán tổng. Các thao tác khác không có SL lần này. Giữ tính giờ hiện có.
- Bổ sung viền dọc trái/phải ô và khung ngoài cho bảng dữ liệu toàn app; giữ màu nhóm LSX và màu sự kiện. Không thay DB hoặc dữ liệu.

## 06/10/2026 — tăng độ rõ bảng nhân lực

- Theo ảnh Nhật ký di chuyển, tăng chữ bảng Nhân lực lên 17px; dữ liệu sản phẩm/SKU/Line/ID phụ 16px và màu xanh đậm, số người trước/sau 18px đậm. Tiêu đề nền xanh nhạt, hàng xen kẽ và viền đậm hơn; tăng khoảng đệm/chiều cao nút, giữ Times New Roman. Áp dụng Vị trí hiện tại, Nhật ký di chuyển, lịch sử nhân viên; không thay font các bảng khác hay dữ liệu.

## 06/10/2026 — Hủy/điều chỉnh báo công theo toàn bộ LSX
- Menu `Theo dõi lệnh sản xuất → Hủy/điều chỉnh báo công`: tra LSX/SKU/tên sản phẩm/nhân viên; chọn bất kỳ sự kiện nào để mở các sự kiện liên quan LSX, gồm lịch sử đã hủy (chỉ đọc). Sửa nhiều mốc ngày + giờ 24h, sản lượng lần xuất, ngày sản lượng; điều chỉnh danh sách tại Nhập trạm/Bổ sung/Giảm/Chuyển người.
- Preview và lưu qua API hiện hữu; một giao dịch cho toàn bộ thay đổi và các LSX đích liên quan, kiểm tra quyền, revision, thứ tự sự kiện, phân công trùng, lịch ca và kho đã xử lý. Tính lại giờ HC/TC theo từng NV và từng lần báo công, cập nhật biên báo công/snapshot nhân lực/sản lượng trạng thái liên quan.
- Nhật ký có hạng mục `Hủy/điều chỉnh báo công`, bao gồm cả hủy và điều chỉnh; một lần lưu ghi một nhóm có ID người thao tác, lý do, từng sự kiện trước/sau, các lần xuất trạm và giờ từng NV trước/sau. Không ghi nhật ký cho tra cứu hoặc xem tác động.
- Nhập trạm kèm tự chuyển người: sửa giờ và danh sách sẽ tính lại cả nhóm chuyển từ các LSX nguồn đã liên kết, không sửa rời từng chuyển kèm. Bản đã hủy chỉ đọc. Dữ liệu theo Line không gán LSX giả; mở riêng theo sự kiện gốc.
- Không đổi schema, không seed/reset hoặc tạo DB/Site mới. Kết quả kiểm tra và triển khai được ghi tại bàn giao của phiên cập nhật.
- Kiểm tra phiên này: typecheck đạt; 134 kiểm thử trong npm test đạt, gồm nhiều mốc đồng thời, hủy cặp pause/resume, liên kết chuyển khi Nhập trạm, cập nhật số người và giờ cá nhân, xung đột revision/quyền/kho. Chưa nghiệm thu bố cục bằng trình duyệt trong phiên này.

## 06/10/2026 — Đơn giản hóa menu Điều chỉnh báo công
- Theo yêu cầu mới: bỏ nút Hủy và checkbox Hủy khỏi giao diện báo công; menu đổi thành `Điều chỉnh báo công`. Màn hình mới chỉ gửi operation `adjust`; API hủy cũ được bảo toàn để không phá lịch sử/tích hợp đã có, không còn điều khiển Hủy trên menu này.
- Luồng chọn LSX → chọn sự kiện cần sửa → chỉnh → xem tác động → lưu. Bảng sự kiện mặc định chỉ đọc, tích `Chọn sửa` mới mở ô nhập. Bỏ chọn trả lại dữ liệu gốc của riêng dòng đó và hủy preview. Đếm số sự kiện đã thay đổi.
- Phần nhân lực chọn sự kiện phân công, tích điều chỉnh rồi mở danh sách nhân viên. Bảng danh sách gốc ẩn khi đang điều chỉnh, Quay lại danh sách hiển thị lại. Ô chọn ở danh sách, sự kiện, nhân viên đều vuông 15px theo chuẩn ONSPA; mở rộng vùng bấm trên điện thoại.
- Nhật ký hạng mục `Điều chỉnh báo công` vẫn giữ tra cứu bản hủy cũ và các bảng trước/sau, ID người thao tác và lý do. Ngày trước, giờ 24h sau được giữ nguyên.
- Điều chỉnh nhân lực của Nhập trạm kèm chuyển người cập nhật nhóm chuyển gốc cùng giao dịch; nhân viên bỏ khỏi nhóm giữ phân công nguồn theo dòng thời gian, không phải Hủy rồi thao tác lại.

## 06/10/2026 — Tiến độ SX dành cho QLSX kiểm tra trước đồng bộ
- Dùng cùng dữ liệu sản xuất hiện hữu; mặc định xem LSX có báo công chờ kiểm tra, có nút Tất cả LSX và điều chỉnh giờ chờ duyệt. Tra cứu Plan ID/LSX/SKU/tên, Line và trạng thái qua StandardToolbar.
- Mở một LSX mỗi lần, với Chi tiết LSX/Báo công/Sự cố. Hiển thị kế hoạch, Nhập trạm thực tế, hoàn thành đã xác nhận, SL lệnh/đã xác nhận/chờ xác nhận, nhân lực và giờ HC/TC. Sản lượng chưa xác nhận không cộng vào số đã chuyển KHSX.
- QLSX xem báo công, Xác nhận & đồng bộ hoặc Trả điều chỉnh với lý do; xử lý giờ chờ duyệt và thiếu giờ trước khi xác nhận. Lý do trễ bắt buộc khi đủ sản lượng sau hạn. API giữ quyền theo Line, giao dịch và nhật ký ID người duyệt; thêm kiểm tra phiên bản chống duyệt dữ liệu vừa bị sửa.
- Xác nhận cập nhật dữ liệu KHSX và tạo phiếu nhập kho chờ Kho xác nhận; chưa tự ghi nhận tồn kho. Hai trạng thái KHSX và Kho được trình bày riêng. Không tạo DB/Site, không seed hoặc reset dữ liệu.
- Bảng LSX phân trang theo nhóm 20 lệnh, giữ chi tiết cùng dòng; bảng con cuộn với khung chung. Giữ ô chọn vuông, thời gian ngày trước/24h sau và ba ngôn ngữ. Chưa nghiệm thu bố cục qua trình duyệt trong phiên này.
- Kiểm tra: TypeScript đạt; toàn bộ 138 kiểm thử đạt, gồm tổng hợp SL đã duyệt/chờ duyệt, ngày Việt Nam, giờ thiếu/chờ duyệt, giao diện SSR và luồng duyệt tạo phiếu Kho. Bản triển khai được build từ đúng source Git đã đẩy.

## 06/10/2026 — Tiến độ SX mặc định đủ lệnh đồng bộ KHSX
- Sửa mặc định từ nhóm báo công chờ kiểm tra sang Tất cả LSX: hiển thị mọi lệnh đủ điều kiện đã đồng bộ từ KHSX trong quyền Line, kể cả chưa Nhập trạm, không có sự kiện/báo công, đang SX và đã hoàn thành. Lệnh chưa sản xuất vẫn hiển thị Plan ID, LSX, SKU, tên, quy cách, Line, kế hoạch bắt đầu/kết thúc, SL lệnh; mốc thực tế ghi Chưa bắt đầu/Chưa hoàn thành, số đã duyệt/chờ duyệt là 0.
- Báo công chờ kiểm tra chỉ là lựa chọn lọc chủ động. Thêm trạng thái tra cứu Chưa nhập trạm; không thay điều kiện đồng bộ KHSX, quyền theo Line hay dữ liệu nguồn.
- Kiểm thử hồi quy render đồng thời lệnh đã báo công và chưa SX, cùng trường hợp toàn bộ lệnh chưa có báo công. Không tạo Site hoặc DB mới.

## 06/10/2026 — Tiến độ SX: chữ số rõ và màu trạng thái
- CSS cũ `.production-table` ép 13px bằng `!important`, ghi đè thay đổi 16px ở globals. Đặt sửa cuối stylesheet sản xuất với độ ưu tiên đúng: ô 16px, số 18px đậm, ID/số người 17px đậm, thông tin phụ 15px tối màu; opacity 1, khung bảng rõ và dòng đang mở xanh nhạt.
- Trạng thái có nhãn/chấm/nền/viền riêng: đang SX xanh lá, hoàn thành xanh dương, tạm ngưng cam, chưa Nhập trạm xám đậm, chờ xác nhận tím, sự cố dừng SX đỏ. Giữ tên chữ và có chú giải. Sự cố đã Tiếp tục không tiếp tục hiện đỏ; dùng sự kiện còn hiệu lực, không lấy sự kiện đã hủy.
- Khung báo công chờ kiểm tra vàng cam, tiêu đề đỏ đậm; chữ/số chi tiết và bảng nhân viên bên trong dùng cùng ưu tiên chữ rõ. Sửa giao diện, không thay dữ liệu/quyền/DB. Kiểm tra render và trạng thái; chưa nghiệm thu ảnh màn hình thực tế bằng trình duyệt.

## 06/10/2026 — Phân biệt nhân lực hiện tại và lần báo công; chữ thường rõ trong chi tiết
- Hai cột có nguồn/mốc khác nhau: runtime hiện tại và danh sách của báo công trong khoảng bắt đầu–Xuất trạm. Đổi thành Số người hiện tại / NV trong lần báo công, kèm Theo khoảng báo công và giải thích ngay trên bảng. Giữ số liệu gốc và danh sách NV để đối chiếu, không ép hai số bằng nhau.
- Bỏ in đậm dữ liệu/số/nút trạng thái trong tiến độ; giữ chữ tối, cỡ số rõ. Sửa dt/dd trong chi tiết bằng độ ưu tiên !important và 16px; sửa cả modal Xem báo công. Giữ tiêu đề bảng và tiêu đề mục, màu trạng thái/khung kẻ. Không thay DB hay tính giờ.

## 06/10/2026 — Gọn trạng thái Tiến độ SX theo ảnh chốt
- Bỏ chú giải màu, dòng giải thích nhân lực và giới thiệu luồng phía trên bảng. Giữ tên cột hiện tại/lần báo công để phân biệt dữ liệu.
- Trạng thái dùng chấm màu và chữ thường tối màu; bỏ viền, nền và khung quanh nhãn. Giữ khung kẻ bảng dữ liệu và các mục chi tiết theo yêu cầu trước. Không thay số liệu hay quyền.

## 06/10/2026 — Tiến độ theo tuần và xác nhận
- Nhóm và sắp xếp LSX theo `week` của KHSX, cùng monday/weekNumber/weekEnd như In transit: tiêu đề tuần + khoảng ngày, xuất hiện lại khi sang trang. Tra theo Tuần kế hoạch bằng danh sách tuần; bản thiếu tuần vào Tuần chưa xác định, không tự gán theo ngày sản xuất.
- Đang sản xuất xanh dương; hoàn thành được xác định theo ngày hoàn thành đã xác nhận so với KH hoàn thành: HT sớm xanh lá / HT trễ đỏ / Hoàn thành tím. Giữ chấm màu và chữ, không thêm chú giải/khung.
- Bắt đầu/hoàn thành thực tế để trống khi chưa có dữ liệu, cả bảng và chi tiết mở rộng. Không sinh mốc giả.
- Tiến độ chỉ xem xét và Xác nhận & đồng bộ: bỏ Trả điều chỉnh và hàng đợi Duyệt giờ khỏi màn hình này. Sửa sự kiện/thời gian/nhân lực qua menu Điều chỉnh báo công hiện hữu. Giữ chặn thiếu giờ/điều chỉnh chờ duyệt và lý do trễ cần cho xác nhận; không đổi API hay quyền.
- Để duyệt giờ không mất chức năng khi rời Tiến độ: chuyển hàng đợi giờ chờ duyệt sang Điều chỉnh báo công; giữ nút Chi tiết/Duyệt giờ theo quyền QLSX và API approve-hours hiện hữu. Không tự duyệt hoặc bỏ chặn báo công.

## 06/10/2026 — Sản lượng theo ngày/tháng, giờ công theo toàn LSX
- Sản lượng và giờ công dùng hai tab: Sản lượng theo ngày (mặc định) và Giờ công theo LSX. Tab ngày có Ngày sản lượng, SL theo ngày, đã xác nhận/chờ xác nhận, số lần Xuất trạm; nhóm cùng LSX/ngày và ngăn tháng theo ảnh bằng dòng xanh dương MM/yyyy, lặp lại tiêu đề khi đổi trang.
- Ngày lấy `productionDate` đã ghi nhận, fallback ngày Xuất trạm tại Việt Nam cho bản cũ; không dùng ngày hệ thống ghi nhận. Không tính bản hủy/void hoặc đã trả điều chỉnh vào sản lượng đang hợp lệ.
- Tab LSX cộng giờ HC/TC đã xác nhận của toàn bộ báo công thuộc LSX, kể cả gối tháng và nhiều lần xuất. Giờ công/SP = tổng giờ-người LSX / tổng sản lượng LSX, chỉ hiển thị chính thức khi LSX hoàn thành, đủ lượng đã duyệt và không còn lượng chờ duyệt; giờ thiếu thì không hiện tỷ lệ. LSX chưa chốt để trống tỷ lệ (dấu —), số giờ hiện có vẫn xem được.
- Không lấy tỷ lệ từng lần xuất hoặc từng ngày; không hiển thị tỷ lệ tổng trộn nhiều sản phẩm ở footer. Giữ tra cứu chung, chi tiết hiện hữu, khung bảng, phân trang 20 dòng, chữ thường rõ và ba ngôn ngữ. Không thay schema/DB, không seed.

## 06/10/2026 — Bỏ menu Điều chỉnh nhân lực và Khôi phục dữ liệu
- Bỏ hai nhóm khỏi sidebar Quản lý sản xuất và danh mục điều hướng, cùng menu con Bổ sung/Giảm nhân lực của nhóm cũ. Bỏ mục Điều chỉnh nhân lực của danh mục báo công cũ để không còn lối menu trùng.
- Các thao tác nhân lực trong SX báo công và Điều chỉnh báo công hiện hữu được giữ; không xóa nhân viên, sự kiện, nhật ký, quyền đã lưu hoặc dữ liệu khôi phục. API/dữ liệu cũ giữ tương thích; yêu cầu này chỉ bỏ menu.

## 06/10/2026 — Tab màn hình dùng chung toàn web
- Mỗi menu xem/thao tác mở một tab có tên và dấu × trên vùng nội dung; chọn lại cùng menu dùng lại tab. Hai lối Theo dõi lệnh sản xuất/SX báo công dùng chung màn hình báo công; mỗi loại báo cáo KHSX có tab riêng.
- Các màn hình đã mở vẫn được mount và ẩn khi chuyển tab: giữ input chưa lưu, bộ lọc, chọn dòng, chi tiết, trang bảng và cuộn trong bảng. Không ghi nháp vào localStorage/DB; tải lại trang hoặc đăng xuất kết thúc trạng thái này. × chỉ đóng giao diện, không xóa dữ liệu nghiệp vụ; mở lại tab đã đóng khởi tạo màn hình mới. Đóng tab hiện tại chuyển sang tab kế bên; đóng hết quay về trang chọn menu.
- Tra từ SKU sang Kho hoặc từ Kho sang SKU đưa mã sản phẩm vào đúng tab đích kể cả tab đã mở. Quay lại từ báo cáo mở menu Report, giữ tab báo cáo cũ. Phân trang DOM/observer được giới hạn trong từng màn hình để không làm mất trang của tab khác; chỉ màn hình đang xem chạy kiểm tra phiên/đổi ngôn ngữ toàn trang. Phiên hết hạn xóa toàn bộ tab để không giữ dữ liệu người dùng cũ.
- Thanh tab cuộn ngang trên màn hình hẹp, hỗ trợ phím trái/phải/Home/End và tên tab theo VI/EN/ZH; dùng màu/chữ ONSPA. Giữ API, quyền, Site, DB/FILES; không thay schema/seed. Kiểm tra logic mở lại/đóng tab, báo cáo riêng và liên kết SKU; kiểm tra TypeScript/build. Chưa nghiệm thu hình ảnh bằng trình duyệt.

## 06/10/2026 — Chỉ giữ tab menu con
- Menu tổng (Dữ liệu cơ bản, Kho, Cấu trúc thành phẩm, KHSX, QLSX, Quản trị) chỉ đổi phân hệ/trang chọn nghiệp vụ, không tạo tab hoặc lưu riêng màn hình tổng. Chỉ menu con xem/thao tác mới mở thành tab có ×.
- Chuyển qua menu tổng vẫn giữ nguyên các tab menu con đang mở, bộ lọc, dòng chọn và nháp. Chọn lại menu con quay về đúng tab cũ. Trang tổng dùng một vùng điều hướng chung, đổi theo phân hệ vừa chọn; không đóng/xóa dữ liệu nghiệp vụ.
- Kiểm tra chuyển nhiều phân hệ không sinh tab và giữ nguyên instance menu con khi quay lại; TypeScript/build.

## 06/10/2026 — Nhóm Theo dõi lệnh sản xuất không tự chọn SX báo công
- Nút Theo dõi lệnh sản xuất ở sidebar chỉ mở/thu nhóm menu con (có trạng thái mở và liên kết accessibility theo từng workspace), không điều hướng sang production-report/SX báo công, không sinh tab và không đổi nội dung màn hình đang xem.
- SX báo công chỉ mở khi chọn mục SX báo công. Mở nhóm tương ứng từ trang chọn nghiệp vụ cũng chỉ mở danh sách bên trái; các tab và nháp đang có vẫn giữ nguyên. Các lối production-report cũ và quyền/API giữ tương thích.
- Kiểm tra TypeScript/build; không thay DB, dữ liệu hoặc nghiệp vụ báo công.

## 06/10/2026 — Màu bảng Sản lượng và giờ công
- Dòng ngăn tháng đổi từ xanh dương sang xanh lá nhạt, chữ xanh đậm phù hợp giao diện chung. Dòng Tổng theo bộ lọc tô xanh lá nhạt toàn bộ ô (nhãn, số liệu và ô trống) cho cả Sản lượng theo ngày và Giờ công theo LSX; các ô tổng cùng ghim ở đáy khi cuộn.
- Giữ dữ liệu, cách tính tổng, bộ lọc, phân trang và khung bảng. Chỉ sửa CSS; kiểm tra build.

## 06/10/2026 — Xem thử hiệu suất và tiền sản lượng theo bảng hệ số
- Thêm menu con Hiệu suất và tiền sản lượng dưới Theo dõi lệnh sản xuất, có tab workspace riêng. Màn hình gồm Tổng hợp tháng, Giờ hoàn thành theo LSX, Giờ và tiền từng NV; chọn tháng/Line, quỹ gốc mặc định 3 triệu (sửa theo kỳ), checkbox NV tham gia, bảng hệ số và xuất Excel kết quả xem thử.
- Bảng hệ số đúng ảnh: từ 100%→1,00; [95,100)→0,95; [90,95)→0,90; [85,90)→0,85; dưới 85→0. Dùng hiệu suất trực tiếp làm điểm, không thêm trọng số kế hoạch hoặc hệ số Capacity 95%.
- Giờ hoàn thành lấy SL đã xác nhận × giờ chuẩn, theo ngày sản lượng trong tháng; LSX gối tháng chỉ cộng phần tháng đó. Không tính chờ kiểm tra/hủy/void. Ưu tiên laborHour lưu ở LSX, fallback nguồn Giờ công hiện hành; thiếu định mức hiển thị thiếu và không tính quỹ. Chưa bổ sung snapshot/khóa định mức lịch sử vào DB.
- Giờ Nhân sự HC/TC là ô nhập thử sau khấu trừ nghỉ/đi trễ/về sớm/các khoảng nghỉ; chưa đọc PDF, chưa lưu dữ liệu tháng hoặc chốt/chi trả. Không lấy giờ báo công LSX thay giờ Nhân sự. Nháp chỉ giữ trong tab đang mở, theo tháng/Line/NV.
- Phụ kho từ sự kiện QLSX đã duyệt và lịch thực tế đã duyệt, theo tên NV, hợp nhất các khoảng trùng; cắt tháng/giờ ca/nghỉ trưa/giải lao. Thiếu lịch, thiếu tên hoặc phụ kho chờ duyệt thì dừng tính. Hiệu suất = giờ chuẩn hoàn thành / (giờ Nhân sự − phụ kho); tỷ trọng chia tiền vẫn dùng giờ Nhân sự bao gồm phụ kho. Quỹ hưởng = quỹ gốc × hệ số. Chia tiền làm tròn đồng, phân bổ phần dư để tổng bằng đúng quỹ.
- Sản lượng và giờ công / Giờ công theo LSX thêm Giờ công chuẩn/SP và Giờ công hoàn thành; đổi cột Giờ công/SP thực tế thành Giờ báo công/SP để phân biệt. Giữ số giờ báo công để phân tích định mức.
- StandardToolbar, khung bảng/cuộn/phân trang 20 dòng, xanh lá nhạt và VI/EN/ZH. Không tạo DB/site, schema/seed hoặc ghi tiền vào dữ liệu thật. Kiểm tra biên hệ số, sản lượng gối tháng, phụ kho, giờ thiếu/sai và tổng tiền làm tròn; TypeScript/build. Chưa nghiệm thu hình ảnh bằng trình duyệt.

## 06/10/2026 — Thanh tab không che chi tiết
- Bỏ sticky/top cố định và z-index 1600 của thanh tab workspace; thanh nằm trong luồng bố cục, dưới lớp overlay/chi tiết hiện hữu. Bỏ top 144px áp riêng cho detail-panel, trả về vị trí đã thiết kế của từng màn hình.
- Sửa trường hợp tab che phần SKU/tên SP/dữ liệu đầu bảng chi tiết Leadtime; áp dụng thứ tự lớp chung cho tất cả menu. Giữ tab, dấu × và trạng thái nháp. Chỉ CSS, kiểm tra build.

## 06/10/2026 — Quỹ chung 6 triệu và giờ Nhân sự xem thử
- Quỹ nháp mặc định 6.000.000 đồng/tháng dùng chung A+B (không còn 3 triệu cố định mỗi Line). Phân bổ trước hệ số theo tỷ trọng giờ chuẩn hoàn thành trong tháng; làm tròn đến đồng, tổng A+B bằng quỹ chung. Sau đó áp hệ số riêng từng Line và chia cho NV theo giờ Nhân sự, giữ giờ phụ kho trong phần chia tiền. Không chuyển phần quỹ chưa hưởng sang Line khác.
- Riêng bảng Hiệu suất và tiền sản lượng lấy chuẩn/SP trực tiếp từ menu Giờ công; thiếu chuẩn ở một trong hai Line sẽ chặn phân bổ. Không thay cách đối chiếu LSX của menu Sản lượng và giờ công. Tài khoản chỉ xem một Line không được suy ra quỹ chung từ dữ liệu thiếu Line kia.
- Thêm bảng phân bổ A/B và quy tắc nguồn dữ liệu, công thức, hệ số, làm tròn, ý nghĩa checkbox tham gia (loại khỏi cả mẫu số hiệu suất và tiền; giữ giờ nháp). Chuẩn hóa thuật ngữ Việt/Anh/Phồn thể.
- Có tải PDF Nhân sự tại Giờ và tiền từng NV: đọc văn bản, ghép mã NV và đối chiếu tên với danh sách hiện hành; xem dòng gốc, chọn vị trí số HC/TC hoặc sửa giờ trước khi xác nhận áp dụng nháp. Chặn mã/tên mâu thuẫn, thiếu mã, trùng dòng NV, Line không hợp lệ, giờ sai, HC/TC cùng cột và đổi tháng trước khi áp dụng. Xem các dòng chưa ghép để kiểm tra đủ người.
- Giới hạn: đây vẫn là bản xem thử; giờ/quỹ chưa lưu DB, PDF chưa lưu FILES, chưa chốt/chi trả. Chỉ nhận tổng giờ tháng đã khấu trừ; chưa tự chuyển PDF chỉ liệt kê ngày nghỉ/đi trễ/về sớm thành giờ và chưa OCR PDF ảnh. Chưa có PDF Nhân sự thật để xác minh bố cục; cần mẫu trước khi triển khai nhập chính thức. Nhập theo Line trong danh sách NV; chưa tự phân chia giờ tháng của NV làm nhiều Line.
- Kiểm tra: 10 kiểm thử payroll (ranh hệ số, phụ kho, tháng sản lượng, bảo toàn tiền A/B, chuẩn menu, đối chiếu PDF) và typecheck đạt; build khi đóng gói bản cập nhật.

## 07/10/2026 — Đồng bộ source trực tiếp về máy, không GitHub
- Thêm panel tại Quản trị hệ thống → Sao lưu & Bàn giao: tải bộ cài Windows, cấp mã thiết bị một lần, tải source hiện hành, xem/thu hồi mã. Dùng StandardToolbar và Việt/Anh/Phồn thể.
- Mỗi build Vite tự đóng gói source allowlist (bao gồm chuẩn giao diện, script, migration và cấu hình TEST; không gồm .env, .git, live D1/R2, cache hoặc secret). Gói immutable được giữ riêng trong Worker, không vào tài nguyên công khai; manifest + ZIP cùng bản triển khai, định danh theo checksum danh sách file. Không tạo Site/DB/R2 mới.
- API source-sync kiểm tra Admin/cookie hoặc mã 256-bit chỉ đọc source. DB app_records giữ hash mã, không lưu mã gốc; hạn 1 năm với Admin nội bộ, hoặc đến ngày hết quyền setup với Truy cập nhanh Admin. Kiểm tra quyền hiện hành/credential version mỗi lần tải. Cấp/thu hồi có admin_audit. Mã không truy cập được API dữ liệu khác.
- Bộ cài Windows PowerShell 5.1: mặc định C:\website onspa, source dưới source, lưu config mã hóa DPAPI dưới _sync, giữ bản cũ dưới versions; chạy ngầm mỗi 15 phút và khởi động lại khi đăng nhập Windows bằng shortcut Startup của cùng user (không yêu cầu tạo kho Git hay quyền Administrator). Không tải khi máy tắt/đăng xuất. Log xoay vòng, mutex tránh trùng, lỗi mạng thử lại.
- Kiểm tra ZIP checksum, từng file, project ID, đường dẫn/ZIP traversal/symlink/tên trùng. Folder đang có sửa local/file riêng được giữ nguyên và dừng cập nhật. Download mới vào staging, chỉ thay khi hợp lệ; đổi folder thất bại trả về bản trước.
- Kiểm thử API và snapshot đạt: chặn không đăng nhập/viewer, mã không thể sửa dữ liệu/cấp mã mới; thu hồi/đổi mật khẩu/hết hạn dừng tải; hash ZIP/file và allowlist đạt. Typecheck đạt trước build. Chưa thể chạy PowerShell/Startup trên máy Windows của người dùng trong môi trường Linux; cần họ cài và gửi log kết quả để xác nhận đầu cuối máy thật. Đây là đồng bộ source, không phải sao lưu dữ liệu hoạt động D1/R2 hay đồng bộ hai chiều.

### 07/10/2026 — Sao lưu đầy đủ về Windows
- Site `/api/full-backup/start/item/complete`: export mọi bảng D1 trong một batch snapshot; SQL quote native bảo toàn BLOB/số lớn; metadata/file link kiểm tra. Toàn bộ R2 gồm orphan, source ZIP của phiên đang backup. Mã full-backup riêng, Admin, hạn/thu hồi và đổi quyền/mật khẩu được kiểm tra; mã source cũ không được đọc data.
- Bộ cài Windows bổ sung backup hàng ngày, bù khi mở lại máy, thử lại lỗi, Sao-luu-ngay.cmd; lưu từng bản, checksums/manifest/HOAN-TAT.json; không ghi đè data web. Bộ cài source trước đã được người dùng chạy thành công; bộ cài mới chưa chạy trên máy Windows của người dùng.
- Test local khôi phục SQL vào SQLite độc lập, so toàn bộ table counts và giá trị BLOB/64bit; test API private/auth/file thay đổi/thiếu/scope. Chưa nghiệm thu bộ cài Windows mới hoặc phục hồi vào LIVE. Export DB giới hạn 50 MiB, lỗi vượt giới hạn không tạo bản thiếu. Tải ZIP trên trình duyệt giới hạn 100 MiB; Windows tải từng file.
- Secrets hosting không nằm trong gói; cần cấu hình riêng khi chuyển hosting. DB/file là snapshot theo thời điểm: toàn bộ D1 cùng transaction, file identity được kiểm tra trước/sau; không có transaction chung D1 và R2. Không khẳng định dữ liệu đang ghi luôn có ảnh chụp tuyệt đối giữa hai dịch vụ.

### 07/10/2026 — Tổng hợp hiệu suất tháng theo Line
- Thay thẻ tổng hợp bằng hai bảng có kẻ khung: kết quả A/B/Tổng và dữ liệu đầu vào A/B/Tổng, theo bố cục hình người dùng. Hiển thị đồng thời hai Line (tài khoản giới hạn chỉ thấy Line được cấp), số rõ, tổng tô xanh toàn dòng.
- Bảng hệ số và quy tắc chỉ mở qua nút StandardToolbar, dùng native dialog có nút ×/Escape, focus và backdrop; mặc định không hiện trực tiếp.
- Giữ công thức chỉ theo hiệu suất đã chốt, không thêm trọng số kế hoạch 70/30 từ ảnh cũ. Quỹ 6 triệu phân bổ theo giờ hoàn thành; giờ phụ kho vẫn giữ khi chia tiền NV. Còn bản xem thử/giờ nháp, chưa lưu/chốt/chi trả.

### 07/10/2026 — Ví dụ hiệu suất và tiền sản lượng tháng
- Trong LSX mẫu, nút Nạp ví dụ tháng đọc SKU Master/Giờ công hiện hành và tên NV bộ mẫu; dựng dữ liệu xem riêng hai Line, SL xác nhận giả định, HC/TC/Phụ kho, hiệu suất A~98% B~88%. Áp dụng đúng quỹ chung/định mức/hệ số/chia tiền đang dùng.
- Xem cùng dữ liệu minh họa ở cả tổng hợp, LSX và từng NV. Không POST dữ liệu minh họa vào sản xuất, không thay báo công mẫu đang thao tác. Trở về hoặc đổi tháng khôi phục giờ nháp trước khi nạp mẫu; tải lại mất ví dụ.

- 07/10/2026: nút Nạp ví dụ tháng hiện trực tiếp cho Admin hai Line, không cần bật LSX mẫu trước. LSX mẫu tự nạp khi vào Hiệu suất; có trạng thái đang nạp/lỗi và chặn response cũ khi đổi tháng hoặc rời màn hình. Không lưu dữ liệu mẫu lên DB.
- 07/10/2026: ô chọn/chọn tất cả trong Hiệu suất và tiền sản lượng dùng ô vuông 15px theo các menu dữ liệu; giữ checked/indeterminate và thao tác chọn NV.

## Payroll column formulas and stable refresh (07/10/2026)
- Monthly results, input summaries, LSX earned hours and employee money tables display their calculation formulas below column titles, translated in VI/EN/繁體.
- Background labor-standard refresh retains displayed results while fetching; equal maps keep the previous state. Failed fetch still blocks results rather than silently using stale standards. Initial load stays visibly loading.
- Monthly summary wrappers override the shared viewport max-height so all A/B/total rows remain visible; the menu/page scroll remains available. Business math, draft values and saved data are unchanged.

## Monthly HR PDF hours persistence (07/10/2026)
- Real-data PDF review offers Lưu và áp dụng giờ Nhân sự. After choosing HC/TC and confirming review, saves monthly employee hours to existing D1, original PDF to existing FILES, and an ID-attributed before/after admin audit. Reloading the month restores saved hours; manual edits/fund/payment results remain drafts.
- Unique-name matching is allowed after explicit review; duplicate/ambiguous names, mismatched IDs/names, invalid hours or wrong lines still block. Filename YYYY-MM identifies the PDF month and blocks saving to another month.
- Sample mode has Áp dụng vào ví dụ only, never saves into real HR records. Errors show the reason the apply/save button is disabled. Revision conflicts preserve preview; no blind overwrites.
- New production_hr_month records and PDF metadata automatically enter existing full backups. No schema, seed or production-data reset.

## Cross-month HR example trial (07/10/2026)
- Example mode accepts HR PDF from another month (e.g. August PDF applied to October trial). Preview displays source month and selected trial month separately; apply targets the selected month and updates the local example only. Real-data month validation and persistence are unchanged.

## Full employee directory for payroll examples (07/10/2026)
- Payroll example generation reads the real, permission-checked /api/employees directory, independently of the 10-per-line SX scenario. Generates local illustrative hours for all active A/B employees and exposes their real IDs/names to PDF matching and the employee table. Other SX example scenarios remain unchanged.
- Fixes missing PDF matches for active employees outside the original 20-person scenario. No employee directory or real HR records are modified.

## Full payroll Excel/PDF report (07/10/2026)
- Toolbar exports a genuine XLSX workbook and a directly downloaded PDF snapshot of all monthly rows, independent of current table page or selected Line. Includes monthly input/efficiency/fund allocation/unearned balance; one employee sheet/section per visible Line with HC/TC/HR/helper/production/distribution hours, selection status, share and money; confirmed LSX earned standard hours; rules, coefficients and HR PDF source filenames when available.
- Both Lines must have valid calculations before either export; scoped users receive only permitted overviews and remain subject to existing allocation prerequisite. No new backend permissions or data writes. Employee totals reconcile exactly with each Line fund and Excel numbers retain numeric types.
- PDFs embed high-resolution browser-rendered pages with Unicode fonts, repeated table headers and page numbers; their contents are images, not selectable text. Excel uses Times New Roman, pale green headers/totals and full cell borders. Both formats label examples or unfinalized previews.

### 07/10/2026 — Giữ giờ PDF Nhân sự sau F5 trong tháng tính thử
- Sửa nguyên nhân giờ PDF trong ví dụ chỉ ở React state: giờ đã đối chiếu nay được lưu trong `production_hr_month_example` theo tháng áp dụng, tệp gốc ở FILES, kèm tháng nguồn PDF, người thao tác và nhật ký. Không ghi đè `production_hr_month` của SX thật. Không cần migration/reset/seed.
- Ví dụ cho phép PDF T8 tính thử T10; SX thật vẫn bắt buộc đúng tháng. Lưu/tải thử chỉ Admin không giới hạn Line; giữ đối chiếu mã/tên NV, kiểm tra giờ và CAS chống ghi đè.
- F5/mở lại cùng trình duyệt giữ tháng và chế độ tính thử; nạp ví dụ trước rồi áp dụng giờ PDF đã lưu, kể cả khi bấm Nạp ví dụ tháng lần nữa. Hiển thị tên PDF đã lưu. Dữ liệu số giờ/PDF nằm trên Site, không trong sessionStorage; sessionStorage chỉ giữ tháng/chế độ xem.
- Giờ sửa tay chưa lưu và quỹ vẫn là nháp. PDF đã áp dụng trước bản sửa này trong ví dụ chưa từng được gửi tới server, cần tải/lưu lại một lần.

### 07/10/2026 — Thu gọn Excel/PDF tiền sản lượng
- Cả hai định dạng chỉ còn Tổng hợp tháng, NV Line A và NV Line B; bỏ phần LSX, hướng dẫn/hệ số và cột quỹ chưa được hưởng khỏi tệp xuất theo yêu cầu.
- Tiêu đề cột gồm công thức dùng chung với web (`production-payroll-columns.mjs`), tiêu đề Excel tự tăng chiều cao và PDF lặp tiêu đề khi sang trang. Giữ tất cả NV, trạng thái tham gia, giờ và tiền, tổng tiền đúng quỹ được hưởng mỗi Line.

### 07/10/2026 — Màu bảng nhạt và menu tổng không tạo tab
- Thống nhất nền tiêu đề bảng/khung QLSX, Capacity và các bảng nghiệp vụ khác theo In Transit: nền xanh nhạt, chữ xanh đậm, khung rõ. Không đổi màu trạng thái/sự kiện hay logic dữ liệu.
- Capacity là nhóm thu/mở hai menu con; nhấn nhóm không tự chọn Tổng hợp. Chỉ menu con mở tab. Bộ quản lý workspace cũng chặn nhóm Theo dõi LSX, Capacity tuần và Report chưa chọn báo cáo; tab con cũ vẫn giữ trạng thái tới khi đóng dấu ×.
- Sơ đồ QLSX dùng các menu con hiện hành, bỏ các nhánh thao tác báo công cũ; mở nhóm trong sơ đồ chỉ mở danh sách con ở sidebar.

### 07/10/2026 — Cỡ dữ liệu bảng dùng chung
- Dữ liệu/tiêu đề/ô nhập trong bảng dùng `--onspa-table-data-size:16px`, font-weight 400; bỏ các cỡ 12–13px riêng của Lịch làm việc và các menu khác. Hàng/ô nhập tăng chiều cao theo chữ, giữ cơ chế cuộn responsive hiện hành.
- Đồng hồ 24h trong Capacity rộng 82px để chữ 16px không bị cắt, ô số tối thiểu 64px. Cột Tổng giờ khả dụng dùng 20px, chữ thường (400), là ngoại lệ nhấn bằng kích thước theo yêu cầu.

### 07/10/2026 — Bỏ tô nền riêng dòng dữ liệu
- Gỡ `.actual-days tbody tr:nth-child(3)` đang tô xanh cố định dòng thứ ba của Lịch SX thực tế, không phải trạng thái dữ liệu.
- Bảng toàn web dùng nền trắng cho dòng dữ liệu thông thường, bỏ tô nền/đổ bóng riêng theo thứ tự dòng, Line hoặc hover. Giữ nền tiêu đề/tổng/tháng/tuần và nhóm sự kiện LSX có ý nghĩa nghiệp vụ; giữ màu nhãn trạng thái.

### 07/10/2026 — Tra cứu ngày, xem trước file và cảnh báo giờ chuẩn
- Giờ công theo LSX: Giờ báo công/SP = tổng giờ HC + TC của các lần báo công đã xác nhận ÷ SL xác nhận. Chỉ tính khi lệnh hoàn thành, SL đủ và không còn SL chờ kiểm tra. Thêm tỷ lệ lệch với định mức; đỏ khi trị tuyệt đối lệch >10%, giữ trống khi thiếu/định mức không dương. Lọc theo ngày hoàn thành; Sản lượng theo ngày lọc ngày sản lượng. Tổng theo bộ lọc tính trên tất cả dòng đã lọc.
- Bộ tra cứu/xuất bảng dùng chung trong workspace: chọn bảng, cột ngày, khoảng ngày bao gồm hai đầu, từ khóa; xem kết quả và bản xem trước rồi tải XLSX thật/PDF. Đọc dữ liệu đã được nạp và lọc trong menu, kể cả các hàng phân trang DOM. Có nguồn xuất toàn bộ kết quả độc lập trang ở Sản lượng/Giờ công LSX, Tiến độ SX, Production Plan, In transit, báo cáo KHSX và lịch SX thực tế. Các bảng khác xuất các dòng đang được nạp; không tự gọi API lấy dữ liệu ngoài phạm vi menu/tuần/bộ lọc hiện hành.
- Các nút xuất Excel/PDF dùng StandardToolbar mở bộ xem trước chung; Hiệu suất/tiền sản lượng giữ mô hình ba bảng tổng hợp tháng và NV A/B, thêm xem trước snapshot trước tải. Báo cáo KHSX dùng cùng trình tạo XLSX/PDF, không phụ thuộc cửa sổ in.
- Snapshot không tự đổi theo cập nhật nền; người dùng bấm Tra cứu lại để đọc dữ liệu mới. Không ghi/sửa dữ liệu SX/DB, định mức hay giờ Nhân sự trong thao tác tra cứu/xuất.
- Kiểm thử biên ±10%, LSX chưa hoàn thành/chờ xác nhận, khoảng ngày múi giờ VN và cả hai ngày đầu/cuối, XLSX/PDF 47 dòng qua nhiều trang. Typecheck/build phải đạt; chưa xác nhận nghiệm thu trực quan toàn bộ màn hình desktop/mobile.

### 07/10/2026 — Đặt xem trước/xuất tại menu con dữ liệu
- Bỏ thanh Tra cứu/Xem trước/Xuất file chung ở đầu workspace và bộ chọn bảng/cột ngày trùng với tra cứu của menu. Menu tổng không được gắn exporter; menu con chỉ gắn cạnh bảng khi có dữ liệu.
- Tra cứu dùng bộ lọc hiện có trong menu (khoảng ngày riêng ở Nhật ký, Sản lượng/Giờ công LSX, báo cáo KHSX; tháng ở tiền sản lượng). Xem trước file đọc kết quả bảng hiện hành sau tra cứu, không tự xóa hoặc đổi bộ lọc. Excel/PDF chỉ tải từ cửa sổ xem trước. Không cung cấp bộ lọc ngày bổ sung ngoài menu như bản 412.
- Các nút xuất có sẵn chuyển đúng workspace chứa nút được nhấn; workspace khác hoặc tab ẩn không bắt sự kiện. Hiệu suất/tiền sản lượng và báo cáo KHSX giữ nút xem trước riêng, không chèn thêm nút chung. Không xuất ngoài phạm vi dữ liệu đã được menu nạp.

### 07/10/2026 — Một khung chức năng trong Hiệu suất và tiền sản lượng
- Đọc lại giờ đã lưu (GET dữ liệu tháng) và Nhập PDF Nhân sự (chọn file mới) có chức năng khác nhau, nay đặt chung trong ProductionPayroll toolbar.
- Importer truyền cấu hình nút/chọn cột cho toolbar cha; không tạo khung chức năng riêng phía trên bảng NV. Khi mở PDF, các nút Lưu/Đóng và chọn cột HC/TC cũng nằm trong khung chung; bỏ nút Lưu lặp phía dưới. Giữ nguyên đối chiếu, xác nhận, quyền lưu và API lưu PDF/giờ.

### 07/10/2026 — KHSX đồng nhất chữ/số; phụ kho trong dữ liệu sản lượng mẫu
- Dữ liệu KHSX 16px, font-weight 400: Forecast, Demand, Engine, Plan, In transit, báo cáo; cùng bảng, trường nhập, số tổng hợp và phần chi tiết. Quy tắc cuối áp dụng cả các selector Engine cũ có độ ưu tiên cao. Giữ màu trạng thái.
- Ví dụ tiền sản lượng ghép Quách Chanh Thảo, Trần Quốc Việt, Huỳnh Vạn Tiền theo tên danh sách hiện hành, sau đó dùng mã NV, không dùng hai người đầu mỗi Line. Chỉ các NV này có giờ phụ kho mẫu. Tổng 20h mẫu mỗi Line có phụ kho được chia đều cho những người phụ kho trong Line, vẫn là giả định (không ghi API). Thiếu/trùng tên báo lỗi dữ liệu để kiểm tra. Sản lượng/giờ hoàn thành ví dụ tính lại sau khi trừ giờ phụ kho.
- Dữ liệu thật vẫn lấy giờ phụ kho từng người từ Lịch SX thực tế đã xác nhận; không tự thêm số giờ hoặc sửa nhật ký thật khi chỉ biết tên. Giờ chia tiền giữ cả giờ phụ kho theo quy tắc hiện hành.

### 07/10/2026 — Giờ KHSX 2 số thập phân, màu ưu tiên Engine và cột chính
- Production Plan: Giờ cần, Khả dụng, Dư/thiếu dùng cùng formatter hai chữ số thập phân. Giờ công bảng/chi tiết dùng formatter này. Chỉ định dạng hiển thị, không làm tròn nguồn/tính toán.
- Engine: ưu tiên Khẩn đỏ, Cao cam, Đủ tồn/Event xanh lá, Bù tải tím, Không bổ sung xám. Ghép mức không phụ thuộc chữ hoa/thường, dấu gạch hoặc hậu tố Bù tải. Giữ font thường 16px. SKU 220px, Tên SP 320px, Lý do 180px và xuống dòng đầy đủ, không cắt nội dung.
- Xem trước file chung dùng thanh chức năng sẵn có, không dựng khung thứ hai; menu đã có nút xuất giữ nút đó mở xem trước. Dialog xem trước độc lập vị trí nút để vẫn hoạt động khi không gắn nút phụ.

- 07/10/2026: Nhóm KHSX / Report giữ đúng trạng thái nhóm để hiện toàn bộ menu con, không tạo tab nhóm. Bỏ khung xem trước tự thêm ở Engine / In transit; nút xuất Excel hiện có của In transit vẫn mở xem trước. Base Forecast bỏ khung FILES phía trên, giữ nút tải PDF và thông báo nhập. Lý do Engine dùng Xem thêm mở hộp riêng (đóng bằng × hoặc Escape), không kéo cao dòng; hỗ trợ VI/EN/ZH. Không đổi dữ liệu và quyền.

- 07/10/2026: Engine Lý do mở popover ngay bên cạnh dòng (một khung mỗi lần, bấm ngoài / Escape / × đóng; cuộn bảng đóng để không lệch dòng). Ưu tiên 13px, KO BỔ SUNG chỉ là nhãn hiển thị; số liệu nowrap, tối thiểu 90px và cuộn ngang. Engine bỏ polling 45 giây riêng; vẫn nhận thông báo thay đổi, focus và nút cập nhật. Giữ kết quả đã lưu trong lúc tải lại cùng tuần để tránh nhảy về số tính tạm / thông báo kiểm tra; khóa chuyển trong lúc đang kiểm tra được giữ. Các module khác giữ polling hiện hữu.
- 07/10/2026: Engine bảng cuộn liền mạch, bỏ ghim ngang theo offset cũ ở checkbox/Nhóm/SKU vì chồng lên các cột đã mở rộng. Giữ header ghim dọc hiện hữu; tất cả ô một đường viền 1px chung, không đổ bóng cột. Ưu tiên hiển thị chữ thường 16px theo bảng, không badge/khung/nền, giữ màu chữ phân biệt mức ưu tiên và nhãn KO BỔ SUNG. Chỉ sửa giao diện.

- 07/10/2026: Sửa selector Ưu tiên chỉ tác động span nội dung (trước đó selector chứa engine-priority- cũng trúng ô/tiêu đề, làm mất đường viền và đổi padding). Ô/tiêu đề Ưu tiên dùng nguyên kiểu bảng chung; chữ kế thừa font/cỡ/line-height. Tiêu đề Engine dài được xuống dòng trong cột gọn, dữ liệu số giữ nowrap.
- 07/10/2026: Theo hình người dùng, Engine cột checkbox thu còn 36px thay vì bị quy tắc tiêu đề gán 100px; header/body căn giữa cùng trục, checkbox 15px. Cột Ưu tiên tăng 130 → 170px để đủ chữ. Không đổi logic chọn hoặc dữ liệu.

- 07/10/2026: Sửa ô tuần Demand Event nhận cả input/change như các ô ngày khác. Cho chọn một dòng Chưa lập kế hoạch → Chỉnh sửa để sửa bản nhập sai, giữ ID/createdAt, dùng recordFetch revision CAS và backend quyền hiện hữu. Không thay hàng đã lập kế hoạch.

- 07/10/2026: Bỏ nút Xem trước file tự thêm trong menu Tồn kho ERP bằng cấu hình riêng của menu; giữ nguyên tải Excel, hủy bản tải sai, chốt tồn, tra cứu và dữ liệu.

## 07/10/2026 — Gỡ dữ liệu mẫu khỏi Quản lý sản xuất
- Đã bỏ bộ LSX mẫu, hướng dẫn mẫu, nút tạo/cập nhật mẫu và ví dụ tháng trong Hiệu suất và tiền sản lượng. Xóa lựa chọn mẫu cũ khi mở màn hình; F5 chỉ tải nguồn thực tế.
- Chặn API mở/tạo/thao tác LSX mẫu (410), kể cả tab phiên bản cũ. Không seed/reset hoặc xóa bản ghi thực tế.
- Dữ liệu thử cũ nằm riêng được giữ trong lưu trữ, không hiển thị hoặc áp dụng; PDF và giờ Nhân sự thực tế vẫn dùng nguồn production_hr_month. Không tự chuyển PDF thử sang dữ liệu thực tế.

## 07/10/2026 — Ổn định mũi tên phân trang Pro Engine
- Bộ phân trang chung chỉ theo dõi thay đổi cấu trúc/dữ liệu bảng; bỏ qua thay đổi nút và thông tin của chính bộ phân trang. Gom lịch cập nhật vào một frame và hủy callback khi đóng màn hình.
- Không hiện toàn bộ dòng tạm thời trước khi phân trang lại; giữ trang đang xem khi dữ liệu cùng bảng cập nhật. Nhấn trang hiện tại không dựng lại nút; chuyển trang cuộn tức thời.
- Bộ đo chiều cao không tự kích hoạt lại theo chiều cao main do chính nó thay đổi; vẫn đo khi chiều rộng, nội dung hoặc màn hình thay đổi.

## 07/10/2026 — Nhập lịch sử In transit
- Có bảng dán 12 cột, kiểm tra trước khi lưu: giữ Plan ID, LSX, tuần, SL và ngày thực tế. Admin nhập qua API nghiệp vụ, không tạo báo công/giờ nhân viên hoặc phiếu kho giả.
- Chặn trùng mã, SKU chưa dùng, sai số lượng/ngày; kiểm tra revision dòng gỡ. Một D1 batch nhập mới và gỡ mềm tuần 38/39; nhật ký lưu người thao tác, IDs bản nhập và bản gỡ. Không xóa vật lý bản ghi cũ.
- Nút Khôi phục dữ liệu đã gỡ phục hồi các dòng cũ của bản nhập, có quyền Admin và nhật ký, không xóa bản nhập mới.


## User permissions — 2026-10-08
Removed Line-account creation button after the two existing accounts were created. Disabled auto report preview for Users, Permissions and Departments. Permission view now resolves effective department grants and fixed Line scope. Admin roles retain full access. Added explicit Admin preview/apply setup with revision check, atomic D1 batch, audit and session revocation; no setup runs on read or deployment. Known department profiles cover KHSX, QLSX, KHO, QC and SX; unknown departments are unchanged. Storage files are scoped by module for non-admins; payroll/HR is limited to production managers or explicit payroll readers. Live permission setup remains pending final browser confirmation.


## Phản hồi người dùng — 08/10/2026
- Nút Phản hồi / Góp ý có trong thanh đầu trang cho các phiên tài khoản và Line. Chụp màn hình qua hộp chọn chia sẻ của trình duyệt, dán Ctrl+V hoặc chọn ảnh. Có bản xem trước và gỡ ảnh; chỉ gửi lên máy chủ khi nhấn Gửi phản hồi. Tối đa 3 ảnh PNG/JPG/WebP, 5 MB mỗi ảnh, tổng 10 MB. Trình duyệt không hỗ trợ chụp trực tiếp dùng dán/chọn ảnh.
- Dữ liệu và người gửi/Line/thời điểm ghi từ phiên máy chủ; lưu D1 hiện có, ảnh lưu FILES hiện có cùng metadata. GET không khởi tạo dữ liệu. Mã gửi chống trùng khi thử lại; lỗi giữ nội dung form.
- Người gửi chỉ xem phản hồi/ảnh của mình. Admin có menu Phản hồi người dùng, lọc loại/trạng thái/ngày/người gửi, xem ảnh, trả lời và cập nhật trạng thái. Ghi lịch sử và admin_audit; chống ghi đè khi hai Admin cùng sửa. Không xóa phản hồi. Bản sao lưu toàn bộ tự bao gồm entity và object mới.
- Kiểm chứng TEST: ghi ảnh/thông tin, đọc lại sau restart, retry không trùng, giới hạn ảnh, sai origin, phân quyền người gửi/Admin/Line, nhật ký trả lời và stale edit, lỗi R2 không tạo phản hồi thành công. Không gửi phản hồi mẫu vào LIVE.

- Cập nhật vị trí phản hồi: biểu tượng chat tròn màu cam, viền kem và bóng nhẹ, cố định góc phải dưới trên desktop/mobile; tên chức năng hiện khi rê chuột hoặc dùng bàn phím. Đã bỏ nút phản hồi khỏi thanh đầu trang.

- Nút phản hồi đổi sang icon hình người (CircleUserRound), kích thước 38px trên nút cam 68px; mobile 60px, giữ nguyên vị trí và chức năng.

- Icon hình người có động tác chào nhẹ và vòng sáng theo chu kỳ 6 giây, nghỉ giữa các lượt. Vùng bấm đứng yên; ngừng hiệu ứng khi rê chuột, focus hoặc mở phản hồi; tôn trọng cài đặt giảm chuyển động.

- Phản hồi người dùng: biểu tượng nổi ở góc trái dưới trên máy tính/điện thoại; nhãn gợi ý mở sang phải. Giữ hiệu ứng động nhẹ và khoảng nghỉ.

- Nhãn “Phản hồi / Góp ý” luôn hiển thị cạnh biểu tượng góc trái dưới, bấm nhãn cũng mở bảng phản hồi.

- Nhãn Phản hồi / Góp ý chuyển lên trên biểu tượng, căn trái; cụm nút chừa mép dưới 40px trên máy tính và 36px trên điện thoại cộng vùng an toàn, tránh sát thanh cuộn dưới.

- In transit: bốn cột Nguồn lệnh/Trạng thái LSX/Trạng thái tiến độ/Đồng bộ dùng chữ 14px thường, không ngắt dòng nội dung; màu trạng thái theo khóa không dấu, không đóng khung.

- In transit: hoàn thành đúng tiến độ hiển thị “Hoàn thành” ở bảng, bộ lọc và xuất file; giữ khóa nghiệp vụ cũ. Ba cột trạng thái/đồng bộ giảm còn 13px, nguồn lệnh giữ 14px.

- Ba cột trạng thái In transit dùng chữ thường đầu câu (Đã mở LSX, Hoàn thành, Đã đồng bộ), giữ 13px thường; Hoàn thành màu xanh lá.

- Cột Trạng thái tiến độ In transit có nền màu riêng trên nhãn: chưa SX vàng, đang SX xanh dương, HT sớm xanh ngọc, Hoàn thành xanh lá, HT trễ đỏ, tạm ngưng cam, sự cố tím. Giữ 13px không đậm.

## 09/10/2026 — SX tự cập nhật KHSX
- In transit đọc trạng thái từ chuỗi sự kiện SX đang có hiệu lực; Nhập trạm, chuyển người vào lệnh, Tạm ngưng, Sự cố dừng lệnh và Tiếp tục tự phản ánh, không chờ duyệt sản lượng. Không để lần duyệt báo công cũ ghi đè trạng thái vận hành.
- Chỉ cộng sản lượng đã QLSX xác nhận; đủ số lượng mới ghi hoàn thành. Xác nhận hoàn thành trễ bắt buộc lý do ở giao diện và API; nút Xác nhận tự cập nhật KHSX và tạo đề nghị nhập kho như luồng hiện hữu.
- Điều chỉnh tiếp tục cập nhật KHSX từ sự kiện/báo công đã sửa, lưu nhật ký trước/sau. Liên kết ưu tiên ID lệnh, không cộng nhầm hai LSX cùng Plan ID. Các màn hình KHSX nhận thông báo thay đổi SX trong cùng trình duyệt; thiết bị khác lấy mới theo chu kỳ 45 giây hoặc khi quay lại cửa sổ.
- Cập nhật bài kiểm tra API mẫu cũ: xác nhận trả 410 và giữ nguyên dữ liệu vì chế độ mẫu đã ngừng, không còn kỳ vọng API này sửa dữ liệu mẫu.

## 09/10/2026 — Dòng đang xem và thông báo xác nhận
- Dòng được bấm/focus có nền xanh lá và viền, chuyển sang dòng mới trong cùng bảng. Độc lập với checkbox chọn dữ liệu; không tự tích chọn hay xác nhận.
- Thông báo truyền yêu cầu chờ xác nhận vào đúng tab đích, kể cả tab đã mở. SKU, BOM, Phiếu thay đổi, Lead Time và Safety Days mở danh sách chờ xử lý, xóa bộ lọc cũ cản trở; điều hướng vẫn kiểm tra quyền menu. Các thông báo kho tiếp tục đến đúng menu chứng từ tương ứng.
- Nút Xác nhận/Duyệt/Đồng ý có nền xanh đậm, chữ trắng; trạng thái vô hiệu vẫn nhạt và không thao tác được. Nhận diện nhãn Việt/Phồn thể/Anh; không tô nổi nút Hủy xác nhận.

- Sửa 09/10: quy tắc nền trắng trong table-theme từng ghi đè màu dòng đang xem. Loại dòng đang xem khỏi quy tắc nền trắng và đưa màu chọn vào cuối theme chung, giữ viền xanh trên các ô và cột cố định.


## 09/10/2026 — Thu gọn SKU Master
- Bỏ khối Chi tiết yêu cầu SKU tự xuất hiện giữa thanh chức năng và bảng khi chọn dòng, theo vùng gạch chéo người dùng gửi. Giữ nguyên chọn dòng, thao tác và màn hình chi tiết SKU hiện có; không thay đổi dữ liệu.

## 09/10/2026 — Thống nhất tiến độ QLSX/KHSX
- Hai bảng In transit và Tiến độ sản xuất dùng chung tên trạng thái, nền màu và chữ không in đậm. QLSX ưu tiên trạng thái tiến độ của cùng bản ghi In transit, giữ riêng số báo công chờ kiểm tra. Hoàn thành đúng hạn hiển thị Hoàn thành nền xanh lá; đang sản xuất xanh dương. Không thay đổi dữ liệu hay quy trình xác nhận.

## 09/10/2026 — Báo công và tồn SKU
- SX báo công dùng chung nhãn/nền màu tiến độ với KHSX trên bảng và thẻ điện thoại, không thay trạng thái bằng nhãn đến hạn.
- SKU Master bỏ tồn/lô/vị trí mẫu. Đọc tồn TP, KD và tổng từ bản inventory_snapshot còn hiệu lực mới nhất theo tuần, rồi thời điểm chốt; hiển thị tuần, mã bản chốt và thời điểm. Chưa chốt không áp dụng, mở chốt quay về bản còn hiệu lực; SKU không có trong bản mới nhất hiển thị thiếu dữ liệu, không lấy nhầm số cũ. Đọc trực tiếp bản chốt đã lưu nên tồn vẫn đúng sau F5; không sao chép tồn vào hồ sơ SKU hay sửa nghiệp vụ SKU.

## 09/10/2026 — Capacity liên tiếp và nhập BOM
- Duyệt Capacity cập nhật lại yêu cầu còn chờ, tự chọn line kế tiếp và lấy revision tuần từ chi tiết mới tải để xác nhận A/B liên tiếp; giữ kiểm tra xung đột backend.
- Thêm BOM: Lượng dùng dòng đầu/dòng mới để trống; ArrowDown từ mọi ô chuyển/thêm dòng và đưa con trỏ về mã vật tư dòng kế.
- Hao hụt nhận tỷ lệ không âm hữu hạn, kể cả lớn hơn 100%, thống nhất kiểm tra frontend/backend và phiếu thay đổi.


## 09/10/2026 — Giờ hiện diện từ lịch tháng và HR
- Hiệu suất và tính sản lượng lấy lịch Capacity được duyệt + lịch SX thực tế đã lưu, danh sách ca, nghỉ/đi trễ/về sớm HR và phụ kho QLSX; không dùng PDF hoặc giờ nhập tay làm đầu vào mới. Tệp PDF và dữ liệu nhập cũ được giữ nguyên.
- Cột Giờ lịch HC/TC, Vắng HC/TC, Giờ hiện diện, Giờ phụ kho, Giờ SX, Giờ tính SL. Hiện diện = lịch − vắng; SX = hiện diện − phụ kho; tính SL = hiện diện. Khoảng nghỉ và biến động chồng lấn không trừ hai lần. Điều chuyển Line phân bổ giờ theo thời điểm.
- Thiếu lịch cả tháng, danh sách ca, nhân viên, giờ đến thực tế hoặc biến động chờ duyệt: hiển thị lý do và chưa cho xuất tiền. Kết quả tiền vẫn là bản xem thử, chưa chốt/chi trả.
- HR haquyen (tài khoản đã có) được xem lịch và ghi/điều chỉnh vắng mặt; backend chặn đổi lịch, phụ kho, duyệt giờ và báo công khi chỉ có quyền HR. Không tạo tài khoản hoặc đổi mật khẩu. QLSX giữ quyền lịch/phụ kho và duyệt tác động lên báo công đã lưu.
- Excel/PDF gồm tổng hợp tháng và nhân viên từng Line, cùng các cột/công thức mới. Nút Cập nhật dữ liệu tải lại lịch/biến động đã lưu. Không xóa, seed hay thay DB.


## 09/10/2026 — Pro Plan: cảnh báo gọn và giờ Việt Nam
- Cảnh báo từng dòng đóng mặc định, mở bằng mũi tên; mở dòng khác tự thu dòng trước. Nội dung vẫn đầy đủ trong file xuất.
- Chi tiết thời gian tạo/cập nhật hiển thị dd/MM/yyyy HH:mm:ss, múi giờ Asia/Ho_Chi_Minh (GMT+7); không đổi thời điểm lưu gốc.

## 09/10/2026 — Vắng mặt HR và tiền sản lượng theo Line
- Lịch SX thực tế bỏ tab Có mặt và nút Thực tế có mặt. HR nhập/sửa vắng; QLSX nhập phụ kho/chuyển Line. API chặn QLSX ghi vắng, kể cả đường điều chỉnh báo công; Admin giữ quyền.
- HR nhập/sửa sau báo công: lưu vắng và hours-adjustment trong cùng giao dịch; tính lại giờ các báo công chịu ảnh hưởng, lưu trước/sau và ID HR. Không chờ QLSX duyệt dữ liệu vắng mới của HR.
- Nghỉ dự kiến trong Capacity không thay thế vắng thực tế HR. Danh sách đã chuyển Line được nhận diện theo thời điểm chuyển.
- Bảng giờ/tiền NV và Excel/PDF thêm Giờ SX line khác, chỉ đối chiếu. Giờ tính SL và tiền vẫn riêng mỗi Line, giữ giờ phụ kho khi chia tiền.
- Kiểm chứng TEST: HR nhập sau XT giảm giờ, sửa tiếp tính lại, tải lại vẫn giữ; QLSX bị từ chối ghi/sửa vắng; phân giờ chuyển Line không trùng.

- Pro Plan: tách SKU/Tên SP; thu gọn cột nhập ngày, loại kế hoạch, ưu tiên, thứ tự, trạng thái và cảnh báo; giữ bảng cuộn ngang, dữ liệu và thao tác hiện hữu.

- Sửa tỷ lệ cột Pro Plan: tất cả cột chia theo tỷ lệ, không để Tên SP nhận toàn bộ phần dư; đủ rộng cho Line, ngày và Thường - Gối đầu, cảnh báo gọn một dòng.

- Pro Plan: giảm tỷ lệ chiều rộng nhóm cột ngày/loại/ưu tiên/thứ tự/trạng thái/cảnh báo; tăng đệm ô 6px dọc, 8px ngang để viền nhập tách khỏi khung bảng.

- 09/10/2026: Nhập lịch sử In Transit hỗ trợ bảng 17 cột và cập nhật theo Plan ID khi Admin chọn rõ; giữ ngày KH ẩn, kiểm tra revision/SKU/Line/tuần/LSX, chặn dữ liệu đã báo công, lưu trước/sau vào nhật ký. Không tự tạo giờ công hoặc nhập kho.

- 09/10/2026: Admin không giới hạn Line được ghi nhận đồng bộ cho dòng nhập lịch sử, giữ SL kế hoạch và SL LSX gốc dù khác nhau; không thay đổi kiểm tra số lượng khi nhập/sửa lệnh thông thường. Ghi nhật ký đồng bộ như hiện hành.

- 09/10/2026: Capacity chưa từng được KHSX duyệt cho phép Hủy xác nhận tuần cũ (chưa gửi hoặc bị từ chối), bắt buộc lý do, lưu lịch sử và chuyển về Nháp để sửa/xóa dòng nghỉ rồi Lưu nháp. Bản đang chờ duyệt hoặc đã được KHSX áp dụng vẫn giữ luồng và hạn điều chỉnh; không tự xóa dữ liệu.

- Bổ sung cùng ngày: Admin không giới hạn Line được mở lại bản Capacity tuần cũ kể cả đã gửi/duyệt, bắt buộc lý do. Lưu bản duyệt cũ làm nền đang áp dụng; bản sửa phải xác nhận/gửi/duyệt lại. Quyền tuần cũ không mở rộng cho tài khoản thường hoặc Admin giới hạn Line.

## 09/10/2026 — Lịch thực tế: hủy sai, mượn người, tra cứu tháng
- Tra cứu nhân lực tháng độc lập tuần/Capacity, tất cả Line, loại biến động, mã/tên NV; xem lại bản hủy.
- HR hủy vắng mặt, QLSX hủy phụ kho và chuyển Line theo giờ; lý do bắt buộc, append nhật ký có dữ liệu trước, ID người thao tác; tính lại báo công liên quan. Không xóa cứng dữ liệu.
- Mượn nhân viên từ Line nguồn trong danh sách NV (gồm C) sang A/B theo khoảng giờ cùng ngày, không yêu cầu LSX nguồn. Hết giờ quay về phân công trước; giờ tháng phân bổ một lần, không trùng. Chuyển giữa LSX cũ tiếp tục điều chỉnh tại Điều chỉnh báo công.
- Kiểm tra: 2 ca API lưu/hủy/quyền/trùng và 6 ca giờ tháng; typecheck. Không tạo dữ liệu mẫu hoặc sửa nghiệp vụ production để thử.

## 09/10/2026 — Sửa nhân lực trực tiếp và chuyển dài hạn
- Bảng tuần và tháng có Sửa/Hủy bản ghi ngay trên dòng; hộp sửa đổi ngày, giờ, người, Line và loại theo quyền HR/QLSX, có lý do, lịch sử trước/sau và tính lại giờ.
- Chuyển Line hỗ trợ không có ngày kết thúc, sửa hồi tố ngày hiệu lực; chọn được toàn bộ DSNV dù Line hiện tại trên danh mục đã thay đổi.
- Giờ phụ kho hiển thị số đã tính dù còn thiếu lịch tháng. Giờ SX line khác chỉ cộng thời gian có sự kiện điều chuyển, loại phụ kho và vắng; không suy ra từ việc NV xuất hiện ở hai roster.
- Đối chiếu UI production: Huỳnh Vạn Tiền có Nghỉ 01/10 08:00–10:30 và 06/10 08:00–17:00; 10 giờ là tổng hai bản ghi sau trừ giải lao. Không tự hủy một trong hai khi chưa rõ dòng nào nhập nhầm.
- Test: 4 ca actual labor (lưu/sửa/hủy/quyền/dài hạn) và 7 ca tổng hợp tháng.

## 09/10/2026 — Ghim chức năng và liên kết Line danh mục
- WorkspacePinnedHeader dùng chung các màn hình, giữ DOM/React hiện hữu, đo chiều cao vùng logo/menu/tab/tiêu đề/thanh Chức năng và thông báo; tính lại khi đổi menu, resize hoặc xuất hiện thông báo.
- Chuyển theo khoảng có Đến ngày, không còn chỉ cùng ngày; chuyển hẳn lấy DSNV tại Line nhận, dùng cùng mã và kiểm tra backend với danh mục. Ngày hiệu lực vẫn được ghi riêng để giữ dữ liệu lịch sử.
- UI nguồn: S2024011 Trần Quốc Việt, Line B, version 2; lịch sử A → B ngày cập nhật 07/10. Người dùng xác nhận hiệu lực 01/10; không suy ngày hiệu lực từ ngày sửa danh mục. Huỳnh Vạn Tiền 01/10 hiện đã được sửa thành Phụ kho trên dữ liệu thật.

- 09/10: Compact attendance edit dialog with a single desktop date/time row and spaced footer actions. Actual schedule headcount includes warehouse helpers; production eligibility continues to exclude helper intervals. No stored records changed.

- 09/10: Restore fixed full-width logo/header; retain sticky commands with opaque gap masking. Header observer ignores table row visibility and avoids resetting styles. Language translation is scoped to the active workspace, dictionary sorting cached, observer disconnected during its own writes; hidden tabs no longer poll approvals/viewers. Tab selection only scrolls the tab strip horizontally.

- 09/10: Remove setup banner presentation (auth unchanged). QLSX shares a browser-session workflow snapshot and deduplicates reads; writes force refresh, identity changes clear cached records. Preserve selected week within the browser session. Data scroll containers clip rows below opaque sticky table headers.

- 09/10: Payroll formula explanations collapsed behind column arrows; only one full-width explanation opens at a time, without expanding columns. Employee IDs/names and numeric values avoid wrapping. Export formula labels unchanged.

- 09/10: Actual schedule uses one StandardToolbar in entry or lookup mode. Tra cứu opens monthly filters in that same command area; removed duplicate monthly heading/toolbar and the requested file-preview action for this menu.

- 09/10: Payroll formula arrows now open an anchored, portaled popover with collision handling and no layout shift/animation. Removed requested refresh action and redundant explanatory paragraphs; rules remain accessible through Quy tắc tính.

- 09/10: Actual labor lookup follows Tra theo / Nội dung tra / Xóa lọc / Tìm kiếm / Quay lại using shared toolbar deferred search. Daily headcount details use anchored popovers outside table flow, one at a time; no row or column resize.

- 09/10: SX báo công hides completed/early/late orders by default using shared progress status; lookup includes historical completions, with LSX/SKU/name/Plan ID/Line/status criteria and shared search controls. Back returns to unfinished work. Removed file preview for work entry; records are retained.

- 09/10/2026: Lịch thực tế: Tra cứu mở bộ lọc ngay trên lịch tuần; Tổng hợp tháng là nút riêng. Lọc nhân viên trong biến động của tuần; bỏ hướng dẫn thừa, ghi chú loại bỏ nội dung trùng loại biến động và tách nút sang cột Thao tác.

- 09/10/2026: SX báo công mở Tra cứu không làm hiện lệnh hoàn thành trước khi chọn hạng mục. Lịch thực tế bắt đầu Tra theo trống; Tổng hợp tháng chuyển vào danh sách hạng mục, bỏ nút Cập nhật dư.

- 09/10: SX báo công tách workApplied khỏi các trường nhập; chỉ Tìm kiếm áp dụng bộ lọc gồm trường/nội dung/trạng thái/Line. Tra cứu, đổi hạng mục và nhập chưa tìm giữ nguyên kết quả. Lịch thực tế chỉ mở Tổng hợp tháng khi nhấn Tìm kiếm.

## Rà soát Tra cứu QLSX — 09/10/2026
- SX báo công: giữ workApplied độc lập với điều kiện nhập; mở/đổi hạng mục không đổi kết quả.
- Lịch thực tế: Tra theo và Nội dung tra liền nhau, ẩn trường nhập lịch khi tra; chọn tháng rồi Tìm kiếm truyền đúng tháng sang tổng hợp. Tuần/Line/loại/NV chỉ áp dụng lúc tìm.
- Tổng hợp biến động tháng: nhận tháng đã chọn; trường nội dung dùng cơ chế nháp của StandardToolbar.
- Tiến độ, Điều chỉnh, các Nhật ký báo công/giờ công/điều chỉnh/thay đổi/nhân lực: giữ bộ lọc applied hiện có; Tra cứu chỉ mở, không bật/tắt bảng.
- Sản lượng và giờ công: một toolbar trong component dữ liệu, có tra khoảng ngày/LSX/SKU/tên/Line. Bỏ toolbar cha trùng.
- Hiệu suất và tiền sản lượng: thêm Tra theo tháng/Line; quỹ nhập riêng ngoài chế độ tra cứu.
- Capacity lịch và tổng hợp: dùng cùng Tra theo tuần/Line (tổng hợp có trạng thái), chỉ áp dụng nội dung qua Tìm kiếm; giữ kiểm tra thay đổi chưa lưu.
- Xác minh: TypeScript và build; chưa xác minh hình ảnh đầy đủ trên dữ liệu thực qua trình duyệt do môi trường TEST chặn nguồn preview không phải loopback. Không thay dữ liệu hay quyền.

- 09/10: Bỏ CSS order/display:contents riêng ở SX báo công khiến Tra theo đứng trước nút Tra cứu; dùng bố cục StandardToolbar như SKU Master, Nội dung tra luôn cạnh Tra theo, Sắp xếp chỉ ở chế độ danh sách.

- 10/10/2026: Tiến độ sản xuất dùng bố cục pp-pagination như In transit: nút ←, trang/tổng trang · số dòng, nút →; giữ 20 lệnh/trang và đóng chi tiết khi chuyển trang.

## 10/10/2026 — Nhập lịch sử báo công từ Google Sheet
- Admin có nút Nhập lịch sử trong Nhật ký báo công: đối chiếu Plan ID + SKU + Line, xem trước phân bổ, lưu append-only có kiểm tra snapshot đồng thời và chống nhập lại.
- Giữ sản lượng, số người, giờ lũy kế và ghi chú nguồn. Phân bổ nhân viên theo lịch đã duyệt/biến động thực tế và tỷ trọng SL × giờ chuẩn; không trùng phút giữa người/lệnh, loại nghỉ/phụ kho/giải lao/vệ sinh. Thiếu lịch/định mức cảnh báo rõ.
- Dữ liệu lịch sử hiển thị Nhật ký và Sản lượng theo ngày ở trạng thái Lịch sử chờ đối chiếu; không tự xác nhận, không tạo nhập kho hay tính tiền thưởng. Đây là tái lập ước tính, không phải chấm công gốc. Xác nhận lịch sử được bổ sung ở mục cập nhật bên dưới; sửa bản nhập vẫn chưa triển khai; dữ liệu gốc được bảo toàn trong production_history_import, full backup giữ bảng này.
- Kiểm tra: typecheck; ba kiểm tra tính toán độc lập về không trùng giờ, loại phụ kho và thiếu lịch. Không tuyên bố hoàn tất xác nhận lịch sử.


## 10/10/2026 — Sửa đọc dữ liệu báo công lịch sử
- Giữ giờ lũy kế và số người trong ảnh gốc. Giờ từng lần = lũy kế lần này trừ lần trước; không dùng tổng phân bổ làm giờ gốc. Áp dụng khi đọc cả bản nhập cũ; giữ nguyên payload nguồn để đối chiếu.
- Danh sách bổ sung giới hạn số người gốc; chỉ giảm/chia phần giờ đã có theo lịch, không tạo thêm giờ hoặc trùng phân công. Thiếu khả năng phân bổ hiển thị riêng. HC/TC vẫn là phần phân bổ ước tính.
- SX báo công thêm SL lệnh và SL chờ xác nhận. Tiến độ lấy ngày xuất cuối khi tổng SL đã báo đủ lệnh, hiển thị Chờ xác nhận hoàn thành; chưa đủ SL vẫn Đang sản xuất. Chưa xác nhận không đồng bộ hoàn thành KHSX/kho.

## 10/10/2026 — Đính chính đơn vị ảnh Google Sheet
- Người dùng xác nhận giờ nguồn là giờ một người lũy kế. Tổng giờ công lần xuất = chênh lệch giờ nguồn so với lần trước × số người nguồn của lần xuất đó. Không nhân lũy kế lần sau rồi cộng lại lần trước.
- Rà 31 dòng nguồn (29 đã nhập): sản lượng và số người khớp ảnh 044536/044602. LSX 510-26092906 có 05/10: 1000 SP/11 người và 06/10: 3000 SP/12 người; không gộp hai lần.
- Nhật ký bổ sung giờ/người lần này, tổng giờ, giờ chuẩn và lệch chuẩn. Màu đỏ khi lệch trên ±10%. Giờ tên nhân viên vẫn là phần có căn cứ lịch; chênh lệch chưa thể phân bổ phải hiển thị, không kéo giãn thời gian để khớp tổng nguồn. Hai lệnh tuần21/9 chưa nhập vẫn còn mở.

- 10/10/2026: Nhật ký giờ công/điều chỉnh/thay đổi thu gọn lý do bằng mũi tên từng dòng. Popover neo cạnh dòng, mở một lý do mỗi lần, không thay chiều cao hàng; cột lý do 88px.

- 10/10/2026: Ghi chú giờ công theo LSX dùng mũi tên/popover cạnh dòng, mở một dòng mỗi lần; xuất file vẫn lấy nguyên ghi chú. Kiểm tra lịch sử 07102026-101CTP010-B: 13,92 giờ/người × 12 người (đã gồm người mượn) = 167,04 giờ; không cộng thêm 2 người.

## 10/10/2026 — Xác nhận báo công lịch sử trong Tiến độ
- Thanh chức năng có Xác nhận báo công (số chờ), gồm cả lịch sử chờ đối chiếu. Mở LSX để QLSX xác nhận từng lần xuất; hoàn thành trễ bắt buộc lý do. Quyền xác nhận và giới hạn Line kiểm tra ở server.
- Lần duyệt đầu tạo production_report từ bản nguồn, giữ số người/giờ nguồn đã đính chính, không thay batch gốc. Cursor + snapshot nguồn/lệnh chống duyệt trùng; ghi audit và sự kiện người duyệt, tạo đúng một phiếu kho chờ xác nhận. KHSX lấy SL đã duyệt, không cộng thêm tổng Sheet cũ.
- Đọc báo công khử trùng theo report ID; giữ giờ đã duyệt khi tải lại, không tính về 0 do thiếu sự kiện nhân viên gốc. Tên NV/HC/TC lịch sử vẫn là phân bổ bổ sung, có ghi chú cần đối chiếu. Lệnh lưu trữ chưa khôi phục In Transit không được duyệt.
- Bổ sung trực tiếp bằng giao diện 5 Plan ID phát sinh 07–09/10: ngày KH, ưu tiên, thứ tự từ ảnh. Giữ tuần 05–11/10, SL và trạng thái đã đồng bộ. Hai dòng chưa mở LSX giữ chưa đồng bộ. Không tự duyệt báo công thực tế.
- Kiểm tra: TypeScript đạt; 17 kiểm tra API/In Transit/giờ nguồn đạt, gồm xác nhận lịch sử, duyệt đồng thời, lý do trễ, chống trùng phiếu và giữ tổng giờ. Bộ production-detail còn 4 lỗi có sẵn: 3 lỗi alias @/lib/utils trong harness và 1 kỳ vọng ngày hoàn thành cũ; không tuyên bố bộ này đạt.

## 10/10/2026 — Thu gọn cột giờ công và sửa khung SKU
- Giờ công theo LSX: tiêu đề Giờ báo công/SP và Lệch (%) gọn, mũi tên mở công thức cạnh tiêu đề; chỉ một công thức mở, không giãn hàng. Bản xuất giữ công thức đầy đủ.
- LSX, SKU, tên SP, quy cách và Plan ID giữ nguyên trên một dòng; bảng cuộn ngang khi thiếu chỗ, không giảm cỡ chữ.
- Khung chi tiết SKU và nền che nằm trên thanh ghim; tiêu đề/nút đóng không bị thanh chức năng che. Dải tab đo theo cùng lề nội dung của menu đang mở.

## 10/10/2026 — Sửa lớp hiển thị chung của mọi menu
- Hạ lớp thanh ghim/tab/header về 10/11/17, thấp hơn toàn bộ các nhóm overlay/chi tiết cũ (từ 20). Sửa nguyên nhân chung của In Transit, Plan, BOM, dữ liệu cơ bản, kho, SX, Capacity, quản trị; không nâng riêng từng dialog.
- Loại các khung chi tiết, drawer, page-overlay và Capacity khỏi cơ chế tự ghim thông báo/thanh công cụ. Giữ cuộn bảng dưới tiêu đề và khung chi tiết ở trên nền che.

## 10/10/2026 — In Transit chọn nhiều, ẩn theo tuần và tải dữ liệu
- Checkbox cộng/bỏ từng dòng; checkbox tiêu đề chọn toàn bộ dòng đủ thông tin LSX trong kết quả lọc, kể cả nhiều trang. Đồng bộ theo lô tối đa 100 dòng/request, đọc nguồn một lần/lô, giữ kiểm tra revision từng dòng và nhật ký. Dòng lỗi không ngăn các dòng hợp lệ; thông báo tổng hợp và giữ lựa chọn lỗi để xử lý lại. Chỉ tải lại danh sách một lần sau cùng.
- Ẩn/Hiện theo từng tuần, tách hoàn thành và hủy. Lưu trên trình duyệt theo tài khoản, giữ khi đổi menu/đóng tab/F5; chỉ Hiện tất cả hoặc Áp dụng lựa chọn mới thay đổi thiết lập. Không xóa dữ liệu. Bỏ nút Quay lại danh sách ngoài khung Tra cứu.
- Bộ nhớ đọc API trong phiên trình duyệt: gộp request trùng, tái sử dụng tối đa 10 giây, xóa khi dữ liệu đổi/focus/đổi tài khoản; không cache phía server và không lưu response lỗi. Force reload bỏ cache đã hoàn tất. Giữ revision của form cũ để không ghi đè dữ liệu người khác.
- useDataRefresh trì hoãn refresh của tab ẩn, làm mới khi trở lại nếu nguồn đã thay đổi. Dừng polling riêng của Plan/Capacity khi tab ẩn. Prefetch KHSX chỉ chạy từ workspace gốc, không lặp khi mở mỗi menu. In Transit dùng dữ liệu đã tải để hiển thị ngay rồi cập nhật nền khi có thay đổi.
- Kiểm tra: 16/16 test cache và In Transit đạt, gồm đồng bộ lô lỗi một phần, revision cũ, retry không nhân đôi nhật ký và không đăng nhập. Chưa định lượng tốc độ mạng trên máy người dùng.

## 10/10/2026 — Demand Event lịch sử
- Thêm nhập bảng lịch sử qua giao diện, đối chiếu SKU và trùng dữ liệu trước khi lưu; createOnly giữ an toàn khi thử lại, lỗi từng dòng được giữ lại. Tuần theo ngày yêu cầu.
- Giữ thời gian/người cập nhật nguồn (GMT+7) riêng, hiển thị trong danh sách; thời gian và tài khoản thao tác web do backend ghi như cũ. Không tự tạo dữ liệu khi triển khai.

## 10/10/2026 — Điều phối Capacity theo Line và khoảng thời gian
- Lịch làm việc / Điều phối NV chỉ mở khung nhận nhân viên từ Line khác; Line nguồn gồm A/B/C và các Line có trong danh sách. Không hiển thị bảng nhân viên line đang nhận. Chọn nhiều tên, từ ngày–đến ngày trong tuần, HC/TC và giờ 24h từ–đến; ghi nhận vào bản nháp, Lưu nháp giữ revision và nhật ký cũ/mới.
- Khoảng điều phối lưu trong roster theo người/ngày/ca; Capacity chỉ tính thời gian được phân công, trừ nghỉ trưa/giải lao đúng khoảng. Chuyển A/B cập nhật hai Line nguyên tử khi lưu, Line C bổ sung cho Line nhận mà không tạo Capacity C. Backend chặn phân công trùng giờ, sai khoảng, nhân viên không hợp lệ; giữ khóa và quy trình phê duyệt hiện có.
- Danh sách điều phối đã ghi có nút xóa khi các Line còn Nháp; trả lại thời gian nguồn, giữ các phân công khác. Bản đã duyệt được đọc theo khoảng giờ trong báo công và bảng hiện diện tháng; giờ chuyển Line ghi theo nguồn.
- Kiểm tra: typecheck đạt; 45 test Capacity/điều phối/hiện diện/báo công đạt, gồm lưu/tải lại DB TEST, nhật ký, trùng giờ, Line khóa, nhận C, nhiều ngày, xóa và bảo toàn tổng giờ A+B.

## 13/10/2026 — Nút menu và tổng Giờ cần khi thiếu giờ chuẩn
- Bỏ nút Xem trước file dùng chung ở các menu; không thêm nút thay thế. Giữ các nút Xuất/Tải riêng và các bước xem trước/đối chiếu bắt buộc của nghiệp vụ nhập dữ liệu. Danh sách nhân viên bỏ riêng Nhập danh sách và Tải lại; tự làm mới theo thay đổi dữ liệu, API và dữ liệu đã lưu giữ nguyên.
- Tổng Giờ cần của từng Line cộng các dòng đã có giờ chuẩn; dòng thiếu giờ chuẩn đóng góp 0 vào tổng, đồng thời vẫn giữ cảnh báo và dữ liệu thiếu giờ ở cấp dòng. Giờ cần không còn để trống chỉ vì một SKU thiếu giờ. Nếu thiếu số lượng kế hoạch, tổng vẫn chưa xác định. Giữ kiểm tra chốt kế hoạch và cơ sở giờ của kế hoạch đã chốt.
- Đây là thay đổi mã nguồn, không seed/reset/import hoặc ghi lại dữ liệu sản xuất khi triển khai. Nghiệm thu giao diện thực tế được ghi riêng; không suy ra browser pass từ kiểm tra nguồn.
- Lịch Capacity bỏ hai dãy tóm tắt HC theo ngày / TC theo ngày lặp trên lịch; giữ số nhân viên từng ngày trong bảng, điều phối, phép tính và hệ số đã đặt.

- Theo yêu cầu 13/10/2026, bỏ riêng nút Tra cứu ở Tổng hợp Capacity; giữ trường tuần/Line và callback lọc/load hiện có. Không đổi Tra cứu hoặc Quay lại của Lịch làm việc.

- Theo xác nhận tiếp theo 13/10/2026, bỏ nút Quay lại cấp cha của Lịch làm việc dẫn sang Tổng hợp Capacity. Giữ Quay lại nội bộ để đóng Tra cứu; không thêm đích điều hướng thay thế.

## 13/10/2026 — Màu cảnh báo thiếu giờ khả dụng
- Khi tổng Giờ cần đã biết vượt Capacity, cảnh báo vượt khả dụng được ưu tiên và hiển thị đỏ kể cả khi một SKU còn thiếu giờ chuẩn. Giữ dòng thiếu giờ đóng góp 0 và thông báo thiếu SKU; không thay dữ liệu kế hoạch.
- Kiểm tra tập trung 6/6, typecheck và build đạt; gồm trường hợp 564,72/430,83 giờ, thiếu 133,89 giờ và còn một SKU thiếu giờ chuẩn. Kiểm trình duyệt được ghi riêng.


## LIVE496 TEST corrections — 14/10/2026

- TEST only; not published. SX reporting now refreshes from shared data-change events, tab activation after changes, focus and polling.
- In Transit reads pending historical reports and prefers reviewed records with the same ID. Pending quantity changes the display status only; approved quantity, warehouse data and hour calculations are unchanged.
- Removed SX introductory sentence. Daily recorded leave/late/early departure can be expanded by Line, with names and Vietnam 24-hour intervals. Pending HR corrections remain labeled.
- Validation: 32 targeted tests pass, typecheck passes, build passes. Browser TEST verified pending/full and partial labels, removal of intro, disclosure open/close, Line filtering and a newly synced dummy order appearing in an already-open SX tab.
- Browser dimensions measured: 390, 800, 801, 1188 and 1920 CSS px. This is limited verification of these changes, not acceptance of all 49 business screens.


## Source 497 local TEST corrections - 14/10/2026

- TEST only, not published. Quick Line buttons keep two text rows through enabled/loading/disabled states; narrow screens stack the two buttons. Shared toolbar date pairs stay side by side.
- Production sidebar and overview child links use existing per-menu grants. Denied navigation reports an explicit message. No account, role, capability or backend permission changes.
- Employee directory distinguishes loading, successful empty and error; refresh retains existing rows, while 401/403 clears them. Retry is explicit; superseded/unmounted requests are aborted. No shared employee cache added.
- Employee navigation no longer starts unrelated SKU/capability reads or labor-hour preload. This removes known redundant work; LIVE latency and individual LIVE-user grant coverage remain unverified.
- Targeted regression suite: 37/37; typecheck passed. Browser fixture covers employee loading/error/empty and date pairs at 320/375/800/801/1188/1920px. Quick Line measured at 64px across 28 state/size cases.
- Auth investigation only: password remember=true is 7 days, normal session is 8 hours; logout revokes the session. Setup Admin entitlement is host-only and uses a shared configured expiry; no per-browser 14-day extension was made.
# TEST497 follow-up verification — 2026-10-14

- Capacity permission follow-up: reproduced LIVE497 global ToolbarPermissions hiding granted QLSX actions because WeeklyCapacity lacks an alias; sync also inferred Edit instead of Confirm. TEST defers WeeklyCapacity/ProgressReview/ActualWorkSchedule toolbar filtering to existing capability/state guards, adds explicit allowed flags, refreshes session grants and same-revision Capacity permissions. Catalog adds scoped Ghi vắng mặt and Sửa hệ số choices without assigning grants. 23 focused tests passed. Capacity API authorization unchanged; existing module-wide production permission policy remains a separate unresolved scope.

- Final browser follow-up: completed work quantity uses max(aggregate completedQty, approved report sum) plus pending, avoiding double count and retaining legacy aggregate. Desktop/mobile fixture verified250 with aggregate200 + detailed approved200 + pending50.
- Progress toolbar hide-confirmed preference persists per login/menu in localStorage; render waits for preference, no report data cached. Only fully completed/confirmed, non-running orders without outstanding reports hide. Browser22→1→22, page reset, reload, reentry and separate-user behavior verified. No auth/DB/hour-calculation mutations.

- Workflow read: share capacity read only within one request; overlap schedule/capacity/history reads. No global cache or authorization changes.
- Existing workflow/detail/history suite: 39/39 passed. Additional read/permission/state fixtures: 4/4 passed (2 overlap the 39-test run). Earlier login/HR/menu regression: 37/37 passed.
- Synthetic empty fixture with 50ms SQL delay: baseline 15 reads versus TEST 14; identical 203-byte payload. First/repeat 180/200ms versus 65/51ms. These are synthetic server timings, not LIVE/browser cold/warm acceptance.
- Existing authorization discrepancy remains for review: edit-only actor receives rights.manager=true, while production-report confirmation requires Xác nhận at API. No permissions granted or backend policy widened.
- Browser LIVE request waterfall, transferred payloads and real-user role matrix remain unverified. TEST fixtures do not establish full 49-screen coverage.

Final follow-up: rights.confirm now reflects existing confirmation grant/Admin; progress review uses it instead of manager. Edit-only has no confirmation capability; confirm-only needs no Edit. API authorization unchanged. SX work table/mobile completed quantity is approved plus pending, excluding cancelled/voided reports. Final focused suite 20/20. Benchmark after additive confirm capability: 203→218 bytes; business payload equivalent, baseline173/185ms versus TEST65/66ms (synthetic only).


## Chốt phạm vi UI quyền TEST497

Bản cuối KHÔNG bypass provider cho ActualWorkSchedule/ProductionProgressReview. Hai component dùng alias menu, đồng thời manager là capability backend AND quyền đúng menu. Capacity dùng capability backend chính xác theo menu/hành động; đồng bộ dùng confirm. Session đang active cập nhật grants từ verify/focus; Capacity cập nhật permissions khi revision không đổi và không dirty/busy.

Catalog chỉ thêm Ghi vắng mặt cho Lịch SX thực tế, Sửa hệ số cho Capacity tuần; ẩn Xóa/Hủy/Xuất dữ liệu Capacity không có kiểm quyền tương ứng. Chỉnh checkbox khác giữ nguyên stored grants cũ/không biết. Không ghi DB/template/grant thực.

Backend SX vẫn kiểm quyền chung phân hệ ở workflow/report/correction; ProductionCorrections vẫn dùng rights.manager. Đây là giới hạn cần quyết định policy riêng, chưa sửa và chưa xác nhận cách ly quyền toàn hệ thống. Test cuối 27/27, gồm từ chối quyền khác menu, capability AND menu, catalog bảo toàn legacy, phiên refresh, Capacity component/provider và API 403 trước DB. Không publish, không tác động bản nháp LIVE.

## 2026-10-15: Shared read performance (TEST, not deployed)
- Centralized focus/visibility/poll refresh and root-owned background readers; pending shared reads are preserved across refresh signals.
- Production hidden panels defer reads; concurrent forced reads coalesce; failed initial reads no longer render empty-order or missing-schedule conclusions. Refresh failures retain prior data only within the valid session.
- Request-local workflow entity reads reduced 14 to 11; ordinary SKU GET removes one redundant read. Authentication and write authorization unchanged.
- Server-Timing and sanitized slow-read diagnostics added. The observed 51-second production stall is not yet attributed or proven fixed.
- Focused cache/lifecycle/render tests, API/auth regressions and typecheck passed. Synthetic request-count measurements are not LIVE latency claims.

## 2026-10-16: Nhật ký test website (local iteration after saved version 506)
- Added separate admin-only Users submenu and `/api/website-test-log`, reusing the existing backend administrative gate. The existing authentication/activity log remains separate.
- User-selected start boundary is 16/10/2026 00:00 Vietnam time (2026-10-15T17:00:00Z). The new endpoint excludes earlier, missing or invalid timestamps even when filters request an earlier day; default From is 16/10/2026. Original histories are preserved unchanged.
- Read-only projection combines committed administrative, SKU/labor/leadtime/safety/planning/transit histories, capacity/employee/schedule histories and production events. Filters support actor, menu, add/update/delete, record text and Vietnam calendar dates. Before/after is shown only when historically recorded; missing identity remains explicitly unknown.
- Excludes login/logout, views/searches, presence, explicit replay/unchanged results and snapshot-only no-ops; deduplicates supported mirrored domain records. Server sanitizes credential fields, bounds snapshot display and pages responses. Results disclose the latest-5000-source-record / 8 MiB payload window when truncated; SQL replaces payloads outside the byte budget with null before transport. No retention/deletion policy was added.
- Local generic record saves now add a sanitized audit in the same guarded D1 transaction. Failed compare-and-swap writes cannot create successful audit entries; audit failure rolls back the write. No history is fabricated for earlier gaps.
- Added capture for Site/local inventory upload/cancel/commit/replacement and engine creation; inventory-status audit is now CAS-guarded. Paired engine/current snapshots produce one creation entry. File metadata and audit commit together in D1 (R2 upload remains separate and a failed D1 commit preserves the orphan for reconciliation). Legacy Capacity employee-add now stores embedded history. Draft LSX changes store domain audit; normalized unchanged saves and stale replays add none.
- Existing upload/engine APIs intentionally create a fresh record on each accepted request; no new request-idempotency contract or silent rerun deduplication was introduced. Persisted new snapshots preserve non-secret business values; UI/API responses alone are truncated.
- Remaining limits: historical actions with no saved evidence cannot be reconstructed, some old sources provide summaries rather than full snapshots, and filters/counts cover the bounded recent-source window. Related changes may be represented by their existing business-operation history. Authentication, presence, reads/searches and backup transport are intentionally excluded; this is not a new database-wide change-data-capture system.
- Verification uses isolated TEST D1 mutation/conflict/audit-failure cases, executable UI callback tests, serial aggregate regression, typecheck and local build. No production mutation tests, schema migration or publication performed. Browser visual acceptance remains pending.

## 2026-10-16: Chained temporary line borrowing (local, not deployed)
- Actual production schedule transfer selector resolves the source workforce for the whole selected interval, including approved Capacity roster windows and active incoming/outgoing temporary loans. Home employee line remains unchanged.
- Nested C → B → A loans are allowed only while the worker is available at B for the entire requested interval. Backend rechecks eligibility under the existing optimistic transaction guard. Expired/cancelled loans are excluded; stale UI selections cannot submit.
- New onward loans retain parent movement references. Equal-start chains resolve deterministically to one owner for attendance/monthly labor. The worker returns to the still-active previous loan when the onward interval ends, then to the baseline roster/home assignment. Parent loans with dependent onward records require cancellation of the onward record before editing/cancelling the parent.
- Regression coverage includes 10 + 2 source selection, partial windows, returns, cancellation, same-start ordering, conserved monthly hours, and isolated API dependency validation. Live data, employee directory, permissions and deployment are unchanged; browser visual acceptance remains pending.

### Test-log review hints (local implementation, not published)
- Neutral deterministic hints only, without notifications, profiling or account restrictions. Thresholds are exported in lib/website-test-log-warnings.mjs: 20 separate updates or 5 deletes/cancellations by one known actor in one menu within 5 minutes; 2 known actors changing one entity/record within 5 minutes. Maximum one flag per group/window.
- Only normalized, deduplicated, cutoff-filtered loaded histories are analyzed before pagination. Import/batch operations are marked and excluded from frequency/editor rules. Evidence event IDs and exact counts/windows appear in details.
- Large change applies only to known numeric nonnegative labor_hours.laborHour before/after values: absolute delta at least 1 hour and relative delta at least 50% (or increase from zero). Unknown old values and arbitrary quantity fields are not guessed; quantity alerts remain unimplemented until per-domain units and row mappings are established.
- Hints are review suggestions, not findings of wrongdoing. Existing history/byte limits also limit analysis; absence of a flag does not establish absence of unusual changes. No login/logout, views or searches enter these rules.

- Legacy row mutations with identical actor/menu/action/timestamp count conservatively as one operation; this can undercount genuinely simultaneous actions. Known source-file/import markers are retained. A dedicated review-hints filter exposes flags outside the newest page. Analysis uses timestamp-indexed queues rather than quadratic rescans.

- Multiple row events sharing known actor/menu/action/exact instant are conservatively marked as an inferred batch and excluded from both frequency and multiple-editor hints. UI labels that inference; genuinely simultaneous independent edits may therefore be undercounted.


## 2026-10-16 — Quick Line production read scope (source only)
- Prepared LINE_A/B with Xem for all eight Quản lý sản xuất menus, including payroll; retained only the previous Báo công Thêm/Lưu mutation grants. Not deployed; sensitive-access confirmation and live grant changes are separate.
- Workflow read disclosure spans both Lines while mutation authorization retains the authenticated Line. Capacity and monthly HR are read-only; administration, basic-data navigation, planning, warehouse, and raw records remain blocked for Quick Line. Payroll standards use a production-only read endpoint returning SKU/hour values without notes/history.
- Client navigation opens production read menus and allows cross-Line inspection; attempts to report against another Line are blocked both in the UI action handlers and backend. Existing local TEST server remains its loopback owner-only model; no Quick Line authentication was added there.
- Targeted tests exercise read scope, immutable denied writes, own-Line preview/completion, payroll/Capacity write denial, menu isolation, and persistence. Visual browser QA and final aggregate validation remain pending.

## 2026-10-16 — Confirmed output / In Transit refresh (local, not deployed)
- Existing quantity rules verified, not replaced: only confirmed completion reports contribute to completed quantity, grouped by stable In Transit ID; outstanding is LSX quantity minus confirmed quantity. Pending/rejected reports do not count. Confirm/edit/cancel operations retain their existing audit, concurrency and warehouse guards. Partial 3,000 on a 4,000 order remains 3,000 completed / 1,000 outstanding.
- Fixed a separate retained-display defect: successful mutations now mark the In Transit snapshot stale without blanking the visible table. Reopening fetches current quantities; a pre-write response or error joins the newer read instead of overwriting it. A refresh revision received while loading is consumed after busy ends. Session changes still clear retained data.
- Added isolated API/DB regression coverage for cumulative partial/full approval, request replay, concurrent approval, correction/cancellation, rejected/stale review, unchanged capacity and unrelated LSX sharing Plan/SKU. Added actual-module and component-effect tests for closed/reopened tabs, in-flight mutations, reverse response order, failed refresh and session boundaries. No production records, backend quantity calculations or hour-allocation confirmation guard changed. Final merged checks/browser QA remain separate.

## 2026-10-16 — Capacity partial absence and break overlap (local)
- Corrected an overcount when hourly absence overlaps a scheduled break. Displayed hourly absence remains net of breaks, while all break deductions for non-full-day-absent staff are retained, so each non-working minute is deducted once. The named assignment-window adjustment uses the same rule.
- Regression includes late arrival, early departure, break-only overlap, full-day leave, and named/windowed staffing. Example: one 08:00–17:00 worker with one-hour lunch and two ten-minute breaks, absent 08:00–10:30, has 5h20 available rather than 5h30. No historical records are rewritten. Final merged validation and deployment are separate.


## Bounded Vietnam-time consistency fix (2026-10-16, local verification only)

SKU approval/cache times, setup-admin expiry and storage handover history now render in GMT+7. Planning reports derive actual completion dates from Vietnam time while calendar-only dates retain their original day. Production default week and schedule lookup use Vietnam calendar dates; demand defaults and current safety-rule lookup use the Vietnam date. New inventory Excel rows capture ISO UTC instants and display GMT+7; existing offset-free source timestamps remain unchanged. No migration, production write or publication is part of this change. Cross-timezone regression coverage is in `tests/vietnam-time-display.test.mjs`. This is a bounded fix, not a claim that every legacy date path has been audited.

## 2026-10-16: Readable Website Test Log details (local, not published)
- Replaces JSON blocks with localized field-level before/after comparison, changed fields first, expandable unchanged values, and structured recorded context. Nested arrays explicitly use positions; unknown field names are preserved rather than guessed.
- Unknown history, absent fields, null, blank text, false, and zero remain distinct. Timestamp values use Asia/Ho_Chi_Minh (GMT+7), without changing stored instants. Detail dialog is responsive and long identifiers wrap; evidence IDs are collapsed by default.
- Hides vthduyen's rows only in Website Test Log read projection, before options/counts/pagination. Immutable audit capture, authentication log, other business journals, schema and permissions are unchanged. Existing warning thresholds run on complete loaded history; hints on hidden events appear separately and are not attributed to visible editors.
- Automated formatter, rendered-component and existing UI/API tests cover this change. Desktop/mobile browser visual acceptance is still pending.

## 16/10/2026 — tiếp tục phần còn lại sau báo công lịch sử
- Báo công lịch sử đã xác nhận một phần không khóa Nhập trạm cho sản lượng còn lại. Menu giải thích cần nhập trạm và phân công thực tế trước khi xuất trạm. Lịch sử chưa xác nhận vẫn khóa; đủ sản lượng vẫn khóa; tạm ngưng vẫn phải Tiếp tục.
- Khi ngày bắt đầu của lịch sử được chiếu vào LSX, backend chỉ cho nhập trạm phần còn lại nếu toàn bộ báo công hiệu lực là lịch sử đã xác nhận, không có lần nhập/chuyển vào trực tiếp trước đó, và thời điểm mới không trước báo công lịch sử cuối. Giữ quyền và Line; không tự tạo phiên, đổi nhân lực hay tính giờ quá khứ.
- Kiểm tra fixture riêng: 4.000/3.000, nhập trạm rồi tạm ngưng/tiếp tục/xuất 1.000; giờ mới chỉ tính phiên thực tế, bản lịch sử giữ nguyên; chặn xuất trước nhập, nhập lùi, nhập trùng, sai Line và thiếu quyền. Không ghi dữ liệu production.

### Provisional schedule headcount (source-only, 2026-10-16)
- Lịch SX thực tế shows named headcount by work-time interval, including effective transfers. Capacity leave temporarily subtracts identified employees, without changing saved hours or monthly actual attendance. Unknown/unnamed leave is flagged instead of guessed.
- An accepted HR absence replaces that employee’s Capacity forecast for the affected day; warehouse assistance, pending records and cancelled absences do not. An explicit presence override suppresses forecast only within its interval.
- Capacity-only deductions expire at 00:00 GMT+7 on the 11th of the next month (HR has all of the 10th). Accepted HR absence remains effective. This changes display only, does not lock HR editing or write retrospective reports.
- Popup provides counted IDs, provisional Capacity absentees, HR absentees, intervals and warnings. Counts varying within the day display a range.
- Not deployed; no production data changed.
- SX báo công uses the same display projection in its Line calendar. Existing LSX staffing/actions and hour calculations remain unchanged.
- Display reuses the already-authorized restricted payroll identity directory for past/future borrowers; API permissions are unchanged. Restricted Line accounts show unresolved borrowed-window counts when foreign HR completeness cannot be verified; authorized full-view users can see exact projected counts. Legacy unnamed assignments and partial OT attended-hours without intervals are explicitly unresolved.

### Compact headcount copy/layout (source-only, 2026-10-16)
- Both attendance displays use a concise summary: count, temporary status, named absences/transfers and count-change times. The HR deadline, warnings, exact work intervals and one named roster sit in closed disclosures.
- Repeated identical membership across breaks shares one display group; the exact disjoint intervals remain listed without implying work through breaks. Popover width is bounded and long names wrap.
- No changes to projection formulas, HR deadline, permissions, selections, saved hours or production data. Not deployed.

## Personnel allocation queue (source, not activated)
- Bidirectional C ↔ A/B queue implemented within Lịch làm việc with scoped names, per-person bounded subwindows, pending remainder/expiry and pending-only withdrawal.
- Separate audited manager-scope setup in existing permission dialog; no account/grant configuration applied. Missing scope fails closed. Intended accounts dhtin/C and cnphuong/A+B require verified active accounts and authorized configuration before activation. Queue-only scope does not require a broad legacy edit grant.
- Atomic queue/movement/audit/cursor writes, actor-bound idempotency and legacy/correction reservation guards. No automatic station entry/payroll and no broad C permission expansion.
- Coordinated revision of accepted allocations and external notifications are not implemented. Browser/configured-account end-to-end verification remains before release.

## In Transit blocked Edit explanations (2026-10-16)
- Edit retains its single-row, synchronized-row, busy and permission protections. A separate keyboard-accessible explanation target surrounds only an explicitly opted-in disabled Edit action; the real button remains disabled.
- Attempting a blocked edit shows the existing floating red notification with a localized reason and next step. No warning is shown just for opening the table with no selection. Enter/Space explain; Escape or Close dismisses, and notification focus returns to its explanation target when still present.
- Selection changes, refreshed eligibility, processing completion and ordinary success/error messages clear stale explanations independently of server errors. Permission-hidden actions remain hidden; no permission grants/backend mutation rules changed.
- Focused state, permission, toolbar pending and mounted refresh/sync-failure regressions cover this change. Visual browser acceptance and final release gates are recorded separately by the release owner.

## Enter tra cứu — 16/10/2026

Source-only: StandardToolbar uses the same guarded search button for plain Enter in search inputs, including Feedback Inbox and Demand Event date filters. IME, held keys, native selection and edit fields remain separate. Mounted-handler tests and the 45-declaration source inventory are documented in `SEARCH-ENTER-COVERAGE.md`; this is not a claim of browser acceptance for every menu or of deployment.

## Planning personnel allocation correction (source-only, 2026-10-16)
- Moves Điều phối nhân sự to Capacity tuần → Lịch làm việc; removes actual schedule entry. Labels: Chuyển nhân sự, Chờ phân bổ, Phân công vào Line.
- Admin read-only overview and explicit missing-scope state; configured managers retain scoped controls. No grant changes.
- Acceptance atomically updates saved draft roster windows and recalculates Capacity; no actual events. Multi-day selection follows daily HC/OT schedules and normal break deductions. Locked/confirmed weeks and adjustment deadlines remain protected. Existing confirmation/KHSX propagation remains required.
- Existing movement-backed allocations/history/config are retained unchanged. Legacy Capacity CAS checks queue reservations and protects accepted transfers.
- Includes schedule column reorder: Vệ sinh, Tăng ca, NV TC before time columns. Source tests/review documented in release handoff; browser/configured-manager verification remains separate.

## Compact personnel entry and dedicated setup (source-only, 2026-10-17)
- Native toolbar actions open Chuyển nhân sự, Chờ phân bổ and optional Hướng dẫn panels; component-scoped CSS is loaded with the planning queue.
- Admin-only Thiết lập QLSX opens one reusable dedicated editor, with selected names/IDs, explicit confirmation and GET readback verification. General permission setup now points here rather than embedding another save action.
- Queue errors retain the backend403 reason. No default manager authority, automatic configuration, account mutation or grant changes.
- Local fixture tests cover dedicated setup and scoped offer/accept; browser fixture and live configured-manager acceptance are tracked separately in the release handoff.

## Global action failure explanations (source review, 2026-10-17)
- Shared floating red feedback is mounted for every session, including Admin. Visible blocked actions expose a keyboard-accessible explanation target while the actual mutation button remains disabled; hidden resources and explicit permission-hidden actions stay hidden.
- Native buttons, shared toolbars, imperative pagination, production dropdown actions and form validation use explicit reasons. Busy requests, selection/status constraints and backend permission checks remain enforced. Errors use fixed safe messages; API response bodies are preserved for existing callers.
- The overlay supports Close/Escape and live-trigger focus restoration, including dialog scope and pending-button replacement. Input/select Enter uses the same guarded search target; no global click interception is installed.
- Routed production search, missing schedule reason, explicit Capacity review refresh and attachment read failures have dedicated mounted regressions. Baseline inventory and current route/dialog matrix distinguish source coverage from tested scenarios.
- No production database, grants, authentication policy or source-sync behavior was changed by this feature. Native-browser desktop/mobile visual acceptance and exhaustive account-by-route acceptance are not verified; consult GLOBAL-ACTION-FEEDBACK-ROUTE-MATRIX.md. Final release gate and publication are recorded separately by the release owner.

## 24-hour time controls and allocation defaults (2026-10-17; local verification)

All reachable JSX time-entry controls now use the shared locale-independent HH:mm clock; the four allocation date/time fields use separate calendar date + 24-hour clock with full interval validation. Remaining localized time displays explicitly use h23, retaining GMT+7 and stored instants. Planning/report/payroll export timestamps already use the same 24-hour semantics. Allocation offers default to 08:00–17:00 on the selected planning date; editing is retained across polls and successful sends. Changing the planning date moves date portions while preserving edited hours. Receivers retain the available offered interval. Past-start validation remains enforced with an explanation; no automatic clock-based replacement of the 08:00 default. No backend time-rule change, migration or publication is included. Regression tests: `tests/site-24hour.test.mjs`.

## Personnel transfer picker and cancellation correction (source candidate)
- Compact searchable employee dropdown replaces horizontal roster cards; scoped IDs, multiselect and line reset remain guarded.
- Required transfer/withdraw/cancel reasons; receiver-only future planning cancellation reverses exact draft segments and retains durable scoped history. Locked/started/actual-backed actions reject.
- Source tests cover domain, atomic storage, reverse planning rollback and mounted confirmation UI; live role acceptance and actual rendered browser QA remain separate.

## LIVE521 integration checkpoint (not released; pending dependency-backed verification)
- Queue/picker/24-hour controls and receiver-only future planning cancellation are integrated with lifecycle warning cleanup. No browser or live-role acceptance is claimed.
- Selected-user permission additions reject inconsistent user record keys, case-fold duplicates and mismatched personal permission identities before any permission write.
- Preview confirmation uses a server-issued random receipt stored in `app_records` under `permission_preview`, bound to authenticated actor, exact selection/revision fingerprint and five-minute expiry. Applying consumes the receipt atomically with the permission audit and grant changes; it is not a public digest. Preview now creates a temporary receipt record, not a permission change. This checkpoint has not passed integration tests.
- Existing `package-lock.json`, dependency versions, hosting configuration and source baseline are unchanged. Test commands remain incomplete until `npm ci` can install dependencies; do not publish.

## LIVE521 integration gate (2026-10-17; not released)
- `npm test` now explicitly includes `tests/action-feedback-lifecycle.test.mjs`, `tests/action-feedback-navigation.test.mjs`, and `tests/user-permission-setup-mounted.test.mjs`, alongside previously integrated tests. This corrects test discovery only; it is not evidence of passing tests.
- Full aggregate, legacy, typecheck and build require a completed `npm ci` from the unchanged lockfile. Offline install failed `ENOTCACHED` for `zod-validation-error@4.0.2`; online installation has not been confirmed successful.
- Permission identity consistency and server-issued actor-bound preview receipts remain subject to integrated security regression and review; no live permission restoration or modification performed.
- Browser role/geometry QA, production DB/FILES preflight, deployment and deployment commit readback are not verified. Do not publish until all gates pass.

## LIVE522 release and transfer layout correction (2026-10-17)
- The candidate4 ZIP (SHA256 `8fecc315f18043f4be026727b9da39465a27d8af72b32f04702910a5d314e742`) was verified against all 588 checksum entries and PCB's 901/901 aggregate report. Fresh `npm ci`, typecheck, build and 5/5 legacy checks passed. Version 522 deployed successfully with source commit `0d265fd0a9ea80cca09fa5997b8359332f030480`; version/commit readback matched. Site identity, DB/FILES declarations, migrations, auth client, access policy and environment revision 4 were preserved. Homepage HTTP 200 and the deployed stylesheet matched the build. This supersedes the pending source gates above; it does not establish exhaustive live-role acceptance.
- The user's follow-up screenshot and live DOM inspection confirmed that the employee picker was trapped in the allocation section's sticky stacking context (10), below the later Capacity toolbar (10). Only while that picker is expanded, its pinned section now uses layer 12, below the header (17) and dialogs (20+).
- Scoped allocation CSS gives the source line, employee picker, dates, clocks, reason and action a shared 36px control height (44px on narrow screens), removes the inherited date/time span's 7px bottom margin and preserves wrapping between whole fields. No production workflow, data, permissions, auth or storage configuration changed.
- Existing focused picker/date-time/compact queue/UI tests: 27/27 passed. This layout correction's browser acceptance and deployment are recorded by the release owner after packaging; they are not implied by the source tests.

## Permission recovery evidence review (2026-10-17; read-only)
- Admin audit now offers an explicit read-only permission review. It uses the existing authenticated GET endpoints for audit, users, personal/department permissions, departments and allocation scope. Backend authorization, data-line filtering and write APIs are unchanged.
- Historical stored before/after snapshots and current records show full permission strings without the bounded log display projection, using an allowlist of identity/permission/scope fields. Missing snapshots and null records remain distinct; credentials are excluded. No recovery or permission apply is automatic.
- Mounted regression verifies complete strings over 6000 characters, preserved C/AB scope, missing/null distinction, credential exclusion and GET-only requests. Typecheck passed. Actual restoration still requires a complete evidence comparison and per-user readback.

## Evidence-bound personal permission recovery (2026-10-17; awaiting apply)
- Complete LIVE evidence identifies `2026-10-16T09:27:42.507Z` as the loss of 11 existing CUSTOM permission records. The repeat setup on 17 October changes metadata only; subsequent manager scope remains dhtin/C and cnphuong/AB.
- Explicit preview/confirmation restores only recorded CUSTOM → DEPARTMENT conversions with complete identity-matching snapshots. Later meaningful permission edits, changed identities/state or unverified scope block the plan; no department template is applied. User roles, quick-Line users, new department-mode records and allocation scope are never written.
- Apply refreshes all identity/permission/template/scope records and audit first, rejects any changed snapshot, and uses the existing SUPER_ADMIN-protected `/api/records` save with per-record revision guards and existing before/after audit. Each write is read back; a failure stops the batch and reports completed users without automatic retries. This is a sequential recovery, not an all-or-nothing transaction.
- Mounted/domain tests cover exact historical grants (including legacy values), unchanged Line/scope, missing/null snapshots, later legitimate changes, readback and zero writes after a concurrent change. Production application and full readback remain to be performed explicitly.

## Additive business-menu view policy (2026-10-17)
- Authorized recovery completed on LIVE525: all 11 historical CUSTOM permission records were restored and immediately read back with matching before/after audit. Department templates, other users, roles, credentials and dhtin/C + cnphuong/AB scope were preserved.
- Active internal password accounts now receive the 30 business-menu Xem grants in addition to their effective CUSTOM or DEPARTMENT grants. Stored permissions/templates and manager scopes are not rewritten. Explicitly inactive personal permission records stay disabled. The admin permission list displays these effective grants.
- Administrative, backup/recovery, credential and scope-management access is unchanged. No new mutation or export grants are added. Server generic checks compare the final action segment exactly, preventing the menu name Nhập kho from being treated as a write action.
- Quick-Line principals retain their separate production-view/report grants and existing server-side Line filtering. Both A and B regressions cover forged foreign-order IDs/query filters, nested event/report projections, capacity/HR reads, denied manager actions and own-Line reporting. No production writes are needed to apply this policy.

## Line startup permission warning (2026-10-17)
- The automatic active-viewer heartbeat POST was sent for Quick-Line sessions and correctly denied by the existing production-only API guard. Global mutation feedback then displayed a misleading permission warning at startup and after periodic refresh.
- Presence and pending-approval background polling now run only for account sessions. Account changes abort pending presence requests and remove their timer/listener/manual refresh callback. Stale account callbacks cannot launch further presence requests. The unsupported viewer-list icon is hidden for Line sessions.
- Identity verification, production reads, reporting rights, Line scoping, backend guards and global denial feedback are unchanged. No production business/permission/auth/config/storage writes are needed.

## Stable coordination frame in Capacity calendar (2026-10-17)
- The calendar now mounts its existing coordination workspace beside the schedule heading before latest-week lookup completes. A persistent queue frame, toolbar and reserved status row remain mounted during loading, refresh and transient failures. No cached business data is treated as freshly authorized.
- Queue actions require a successful current queue read and a verified calendar context. Pending refresh/error locks operations without removing the existing form. A confirmed 403 clears restricted queue data while retaining the outer frame; identity changes reset private drafts. Late responses from older week/identity contexts are ignored.
- User-edited transfer dates/reason/selections remain in the mounted form on week/Line changes; untouched default dates can still follow the planning week. Department permissions, manager scope, backend checks and DB/FILES/auth/config are unchanged.

## Quiet coordination refresh (2026-10-17)
- Removed the repeating calendar-week/permission verification text during routine background reads and after an existing queue has loaded. Initial loading uses a short inline note beside the coordination title; real errors remain visible. No empty status row is reserved above the schedule controls.
- Removed the duplicate coordination refresh action from the normal toolbar; retry remains available when a real queue error occurs. Verification gates, read-only roles, retained drafts and server authorization are unchanged.

## Discoverable personnel-transfer cancellation (2026-10-17)
- Configured QLSX managers now have a persistent “Hủy chuyển nhân sự” toolbar entry. It groups the existing sender pending-window withdrawal and receiver eligible planning-allocation cancellation, with clear empty-state explanations. Receiver cancellation moved out of history; history remains readable.
- Existing server flags, reason confirmation, revision/request guards and verified-context gates are preserved. No API, permission, scope, storage, auth or configuration changes; no production cancellation is performed by this update.

## Select personnel before saving the work schedule (2026-10-17; superseded)
- Calendar queue acceptance is now a local selection (“Chọn phân bổ”). The projected calendar updates immediately; the pending selection is explicitly unsaved. First-time weeks no longer need a preliminary save. A single Save draft sends original edited schedule inputs plus selected allocation commands.
- Save prepares the existing Capacity validation against one scoped operational snapshot, rechecks receiver scope, queue revision, roster, HR, station conflicts and calendar locks, then atomically commits Capacity, queue, cursor and audit. A guarded batch rolls back all writes on failure. Matching retries have a durable actor-bound, payload-hash receipt; different payloads cannot reuse it.
- Selected allocations must belong to the displayed calendar Line/week. Selecting never writes. Schedule controls are temporarily locked while selections are pending; “Bỏ chọn phân bổ” restores the prior draft for further edits. Failed saves retain the draft and selections. Week discard, server comparison replacement and session resets clear selections.
- Local arithmetic/assignment checks run before a save request. Independent Capacity reads run concurrently with a matching-snapshot check; post-command refreshes no longer wait serially. No production data is modified to test this change. DB/FILES bindings, auth, environment, grants and C/AB manager scopes remain unchanged.
- Validation: 144 focused domain/storage/mounted UI/permission/retained-state tests passed with zero skips. Typecheck passed. Browser TEST preview reached sign-in only; the new workflow was exercised in mounted UI and isolated D1 tests, not by writing production records.

## Independent allocation save and stable action (2026-10-17)
- Supersedes the coupled calendar flow above. “Lưu phân bổ” writes only the selected person, Line and bounded time through the existing allocation API. “Lưu nháp” is separate and rejects allocation payloads. Selecting/saving personnel no longer locks the calendar. The staged-draft adapter, coupled save transaction and its UI state were removed.
- Missing Capacity weeks can initialize only the standard named default schedule (95%, active employee directory, existing normal working hours) as part of the same atomic allocation transaction. Existing/legacy/locked calendars retain their prior validation. Unsaved browser calendar inputs are never sent to or saved by allocation. No real-work events are created.
- Successful allocation refreshes the calendar immediately. A clean calendar becomes editable with its fresh roster; local unsaved edits are retained for explicit comparison rather than overwritten or silently rebased onto someone else’s revision.
- Reproduced the reported action instability: the shared feedback button switched its root element whenever background verification toggled disabled state. Opt-in stable containers keep allocation submit buttons mounted and keep native disabled/feedback behavior. Other buttons retain their existing default behavior. Disabled allocation labels have readable contrast.
- Regression tests cover six refresh/context/error cycles with the exact same action node and retained Line selection, blocked commands during verification, real-denial clearing, first allocation without calendar Save, exact retry, ignored injected calendar inputs, atomic rollback, and separate allocation POST followed by an editable refreshed calendar. No production business records were changed for validation. DB/FILES/auth/config, manager scope and reporting permissions are unchanged.

## Clear cancellation actions and transient coordination feedback (2026-10-17)
- The shared toolbar danger classification now includes personnel-transfer cancellation. Receiver Hủy phân công and its final confirmation reuse the shared toolbar button/danger styling, without changing confirmation, reason, revision, scope or server authorization.
- Coordination errors use the existing four-second PlanningFeedback lifecycle rather than a permanent full error paragraph. Dismissal affects presentation only: the retry action retains the full diagnostic in its title and mutation verification remains blocked. Background retries no longer clear/recreate the same error on each read; successful verification clears it. Existing schedule success/error notices already use the same four-second lifecycle.
- The pending-allocation instruction is shortened. Regression verifies that expiry removes the notice while retaining retry details, blocked commands and native disabled controls; cancellation actions carry shared danger styling.

## Stable shared buttons and background verification (2026-10-17)
- Corrects the remaining cancellation-confirmation instability and the same behavior elsewhere. FeedbackActionButton defaults to a persistent shell; StandardToolbar action shells also persist through disabled/pending transitions. Native buttons, focus return, keyboard explanations, denied-action checks and duplicate-submit guards remain intact. Enabled shells retain the shared layout marker so existing responsive direct/wrapped-button rules apply consistently.
- Removed cursor:help from both shared disabled-action explanations. Blocked actions show the normal unavailable cursor and still explain the actual reason when activated.
- Allocation background reads retain a previously verified snapshot for the same account/week instead of invalidating it at every polling tick. New identity/week contexts still require verification; failed reads lock operations, authorization failures clear restricted data, and failed mutation authorization/conflict locks until fresh verification. Every mutation retains server-side scope/revision checks.
- Calendar context readiness is based on verified permissions and current week/session, rather than the transient readLoading flag. Six-cycle mounted tests verify that cancellation input and the exact native confirmation button survive, remain usable during ordinary background reads, and lock/clear on failure/revocation. No backend, permission, auth, environment, DB or FILES changes.
- Broad validation ran 924 tests: 923 passed, one pre-existing date-following assertion failed. The same failure was reproduced in the untouched LIVE533 source. That assertion predates the accepted requirement to retain edited allocation drafts across week changes; it now verifies retention, with an added separate test that untouched defaults still follow the planning date. Only tests/documentation changed after the broad run; affected tests are rerun separately. No claim of a fresh zero-failure aggregate run is made here.
- Release follow-up: all 42 affected button/feedback/calendar/date-time tests passed, including both edited-draft retention and untouched-default following. Typecheck, build and legacy checks passed for the runtime changes.

## Compact cancellation panel (2026-10-17)
- Removed the crossed-out explanatory text, redundant group headings and empty sender subsection from the cancellation panel. Actual pending withdrawal forms and eligible received allocations remain available under the same rules. A single empty-state message appears only when neither is available.
- Confirmation and Close now use a dedicated wrapping action row with a 16px gap; Close uses the standard outlined button. No commands, data or permission rules change.

## Employee lookup suggestions and explicit action notices (2026-10-17)
- Lịch sản xuất thực tế now offers loaded-data employee suggestions in weekly lookup and combined monthly lookup, including standalone monthly history. Code, display code and accent-insensitive name input find suggestions showing business code and full name. Locked Line accounts only receive suggestions for their Line from the existing authorized directory; no additional API/data access is introduced.
- Selecting a suggestion fills the deferred search draft only. Click Search or Enter with no highlighted option applies it; arrows plus Enter accept an option without submitting the attendance form. Escape/blur close suggestions, IME and repeated keys do not submit, no-match guidance remains visible while typing. Popovers are outside scrolling toolbar flow, retain shared input sizes, and use accessible combobox/listbox semantics.
- Employee filtering resolves display codes through the directory even when historical event snapshots only contain internal employee IDs. An exact known code matches its employee rather than longer prefix codes. The matcher compiles once per render instead of scanning the directory for every event employee.
- Shared action notices use the supplied screenshot's prominent failure heading, warning icon, pale red panel, explicit existing reason/instruction and separated close control. Missing-permission notices add guidance to ask the administrator to verify the account and Line scope. Existing four-second expiry, one-notice replacement, modal focus scope, keyboard dismissal and safe status-only error handling remain intact. No raw server error data is exposed and no warnings/permission checks are suppressed.
- Validation: 166 targeted mounted/behavior regressions passed, zero skipped; covers all three languages, search routes, HR editing controls, monthly records, allocation controls, notification lifecycle and permission gates. Typecheck passed. This is not a fresh full-suite aggregate or a completed desktop/mobile visual acceptance claim. Production data, migrations, DB/FILES bindings, auth, stored grants, hosting and runtime configuration are unchanged.

## Direct monthly-summary entry and adjacent schedule save (2026-10-17)
- At the user's explicit request, ActualWorkSchedule replaces its Tra cứu entry button with Tổng hợp tháng. One click selects the monthly category and immediately shows the existing month/Line/type/employee/status criteria. This is the requested exception to initially empty generic lookup selection; no results change until Search/Enter. Other lookup categories remain available and preserve existing validation.
- Lưu thay đổi is now the adjacent shared-toolbar action inside Lý do cập nhật lịch, rather than a disconnected top-level action. Reason and Save appear together in calendar editing mode and return with the preserved reason draft after Back; monthly lookup has no orphan Save button. Existing approval, busy, manager and required-reason guards, save payload and server authorization remain unchanged.
- Validation: 55 targeted mounted/behavior tests passed, zero skipped, including immediate monthly criteria, deferred search, reason/Save adjacency and draft return, HR controls, Line constraints, keyboard behavior and guarded saves; typecheck passed. This does not claim a fresh full-suite aggregate or desktop/mobile visual acceptance. No DB/FILES/auth/config, grants, migrations or production data changes.

## Keep reason and Save on one control row (2026-10-17)
- Corrects LIVE541's wrapped reason/Save layout. Read-only browser inspection confirmed the reason input filled the controls wrapper while flex-wrap was wrap, moving Save below it and raising the whole field above the toolbar baseline.
- Shared StandardToolbar fields containing an input followed by an action now keep that pair together with nowrap/max-content sizing and the existing 260px input size. The outer field may move as a unit when necessary; the toolbar retains horizontal scrolling on narrow screens. Input and Save keep the shared control height and bottom alignment. No business callback, state, permission or data changes.
- Validation: 55 relevant behavior/mounted regressions and typecheck passed. The browser diagnosis refers to the pre-fix live layout; this does not claim full desktop/mobile visual acceptance of the fix. DB/FILES/auth/config remain unchanged.

## Dedicated weekly HR attendance entry (2026-10-17)
- Replaces the three inline Nghỉ/Đi trễ/Về sớm tabs with Ghi nhận chấm công for accounts with the existing HR capability. It opens a separate workspace inside the current screen. QLSX keeps its existing Phụ kho/Chuyển Line controls; HR-only profiles receive neither production control. Lookup categories and historical editing permissions are unchanged.
- A shared-toolbar weekly entry table supports multiple rows, code/name suggestions from scoped loaded employee data, the three HR types, date ranges for leave, 24-hour times, full-day scheduled hours, optional notes, copy/remove draft rows and one explicit Save action with a row count. Enter advances between inputs and can add a draft at the last row. All-day ranges with different shift hours must be split, rather than applying the wrong hours to later days.
- Client validation checks employee/Line candidates, dates within the selected week, same-day late/early intervals, working days and overlap with other draft/known entries. Existing backend eligibility, approval, duplicate, Line, journal, idempotency and hour-recalculation guards remain the authority. No new server action, privilege, migration or data formula is added.
- Save submits rows sequentially through the existing line-absence action, each with a stable retry token. This is not a whole-week transaction: confirmed rows are marked saved and excluded from retries; the first failure stops the remaining queue and retains unsaved input with explicit partial-result guidance. Context or permission changes stop subsequent requests. No actual production record was written during validation.
- Row drafts remain separate by week/Line while navigating Back and reopening the entry. Hidden entry inputs unmount to close detached clock/autocomplete popovers; draft state remains in the entry component. The normal calendar stays mounted. Account/HR capability boundaries unmount the entry. Saved records are edited/cancelled through the existing calendar/monthly history controls.
- Validation: 157 targeted component/backend tests passed with zero skips, followed by all six dedicated entry tests passing (including a new three-language/context-retention case). Typecheck passed. No fresh full-suite aggregate or complete desktop/mobile visual acceptance is claimed. Existing Site, DB/FILES, auth, grants and runtime configuration are preserved.

## Monthly HR back-entry, deadline and corrections (2026-10-17)
- Replaces LIVE543's incorrect week-bound entry limits with a selected calendar month. HR can enter October 5 while the calendar shows October 12–18. Approved references for the requested date come from the existing scoped approvedSchedules payload, including prior weeks; current-week approval is not a prerequisite to opening HR entry. Existing date-specific approval/eligibility and Line guards remain required.
- The entry month and its deadline are explicit. Shared hr-attendance-period policy allows recording through the end of day 10 of the following month in GMT+7. Backend checks cover HR line/order absence creation, edits, corrections and cancellation, including the original record date to prevent moving a closed record into an open month. Warehouse and personnel-transfer rules are unchanged. This adds the requested business deadline, not new grants or security/runtime configuration.
- Employee code and full name occupy one input. Removed the Cả ngày column and implicit full-day mode: 08:00–17:00 is an ordinary editable time interval. Input/select boxes use the same shared height; employee names no longer create a second row. Row actions use a wrapping flex group with 10px spacing and distinct button boxes.
- Unsaved rows are editable in place and have Xóa dòng. The new Đã ghi nhận trong tháng table exposes existing HR Sửa/Hủy bản ghi dialogs on the same screen, restricted to its Line; cancellation preserves history and recalculates related hours. All existing authentication, grants, scoped reads, journal, collision and idempotency checks remain intact.
- Validation: 98 relevant regressions passed, then all 31 focused entry/backend tests passed after extending deadline coverage, and all nine entry tests passed after final display cleanup. Typecheck passed. API tests include October 5 at November 10 23:59:59.999 GMT+7, rejection at November 11 00:00, and rejection of edit/cancel/correction after closure without writes. Historical September business fixtures now use a fixed in-window test clock instead of aging out. No fresh full-suite aggregate or complete desktop/mobile visual acceptance is claimed.
- No production records were written during verification. Site identity, DB/FILES bindings, credentials, stored grants, auth and environment configuration are unchanged.

## Employee-level HR attendance across A/B/C (2026-10-17, after LIVE544)
- Unrestricted HR uses one employee list across all loaded active A/B/C employees, without selecting a Line or requiring an approved production week or a current loan. The existing line-absence action accepts an explicit employee attendance scope, one employee per row; the server derives the native directory Line. Raw calendar-day records remain available for later production assignments. Scoped HR retains its existing Line workflow; the backend rejects creating, editing, cancelling, correcting or replaying personal originals from a scoped account. No grants are added.
- Recording does not create an assignment, movement, roster or hours for unused C staff. Existing named attendance math intersects HR facts with actual A/B assignments, borrowing intervals and working hours; no formula or historical record migration. Automatic adjustment audits follow each affected report's actual Line. Editing/cancelling recalculates related saved reports with before/after history; stable retries and overlap checks remain enforced.
- Scoped reads receive only read-only projections for their native staff or authorized incoming loan/approved roster windows. Foreign raw notes, original audit chains and unrelated C facts are excluded. A chained loan returns to its parent and then native Line; a station assignment cannot extend an expired loan. Only minimal authorized foreign employee identities are supplied for historical calculations. No additional database query or cross-request permission cache is introduced.
- HR drafts follow the selected month independently of the calendar's Line. Global history shows A/B/C records with same-screen edit/cancel; personal editing has no Line selector and allows one employee. The month deadline remains the end of day 10 of the following month in GMT+7. Existing legacy attendance records retain their original behavior.
- Validation: 90 targeted mounted/backend/calculation/scope/storage/read-performance tests passed with zero skips. Typecheck passed. Final focused checks also passed with zero skips; build/legacy are part of publication packaging. Tests use synthetic isolated databases and no production writes. No full desktop/mobile visual acceptance is claimed. Existing Site identity, DB/FILES, auth, credentials, grants, migrations and runtime configuration are preserved.

## HR keyboard entry, footer Save and focused haquyen presentation (2026-10-17)
- ArrowDown moves from any editable draft column to the same column in the next unsaved row; the last row creates one new row and focuses it. ArrowUp returns to the prior unsaved row. Capture handling includes native date/select and clock inputs without changing their values. Open unresolved employee suggestions and clock popovers retain their own arrow navigation; selecting a known employee lets ArrowDown move to the next row. IME, held-key repeats, modifiers, saving, revoked rights and the 100-row limit cannot append accidentally. No request is sent by navigation.
- One explicit Save sits below the input table in the shared document-footer-actions pattern used by BOM/SKU forms. Manual Add row remains beside it as an accessible alternative. The top toolbar holds month/deadline/Back. Draft/history tables opt out of automatic row pagination and retain the shared table scroll viewport. Existing validation, sequential confirmed-row saving, stable retry tokens, partial-failure handling and deadline checks remain unchanged.
- The authenticated haquyen login selects an attendance-only presentation in ActualWorkSchedule: an orange Ghi nhận chấm công entry button and the HR workspace; calendar/Line setup, schedule editing and production staffing inputs are not rendered in that presentation. Returning and reopening retains drafts. This is only UI presentation: no stored grant, server capability or other account's workflow is changed. Removing HR capability removes its entry immediately.
- Monthly HR history defaults to all authorized employee-level A/B/C facts in the selected month, sorted by event time. Displays employee code/name, type, date/start/end, full wrapped notes, actor, recording time and existing edit/cancel actions. Tất cả/Nghỉ/Đi trễ/Về sớm buttons include counts and filter loaded records in place without requests, Line changes, discarded drafts or scope expansion. Read-only scoped projections never expose original edit controls.
- Validation: 40 mounted/UI/lookup/control regressions passed with zero skips after these changes. Earlier 90 related backend/calculation/scope/storage/read-performance checks and 57 final focused checks passed for the employee-scope implementation. Typecheck passed; publication packaging runs final typecheck/build/legacy checks. The supplied screenshot path was unavailable; no complete desktop/mobile pixel acceptance is claimed. No production data, grants, credentials, authentication, DB/FILES bindings, migrations or runtime configuration are changed.

## HR keeps the actual schedule screen (2026-10-17, correction after LIVE545)
- Restores the normal Lịch SX thực tế screen for haquyen instead of the over-reduced attendance-only gateway. Week/Line viewing, the calendar, headcount and lookup remain visible. Calendar DOM and HR entry drafts survive opening/Back/reopening.
- Ghi nhận chấm công uses the orange launch styling in both the approved calendar and the fallback toolbar when the week is not approved. Reuses the existing orange token/selector, without changing shared toolbar rendering or labels.
- The haquyen presentation hides the schedule-change reason/Save controls and makes schedule values read-only; only its HR attendance controls are offered. Other manager profiles retain their existing scheduling, warehouse and transfer controls. Backend permissions/grants, employee attendance scope, hour math, DB/FILES/auth/config and all production records are unchanged.
- Validation: all 40 related mounted entry/keyboard/history/lookup/role-control regressions passed, zero skips. Covers visible calendar, disabled schedule inputs, hidden production staffing tabs, launch/open/Back/reopen draft retention, other-manager controls, footer Save and monthly filters. Final typecheck/build/legacy run during packaging. Screenshot upload was unavailable; no full desktop/mobile pixel acceptance is claimed.

## HR entry cannot remain without an input row (2026-10-17, after LIVE546)
- Read-only inspection of the signed-in HR screen confirmed an empty input tbody and Save count 0 while monthly history remained present. The entry permitted deleting its last draft and retained that empty context across reopening. Used only the local Add row control to restore one blank row immediately; DOM readback confirmed one row with seven input/select controls. No Save or production mutation was performed.
- Deleting the final unsaved row now replaces it with a fresh empty draft; confirmed rows remain intact. Context initialization repairs empty arrays, and opening an entry with only confirmed rows adds one new blank row. Existing unfinished drafts, other months, stable retry tokens and confirmed-row exclusion remain unchanged; opening/deleting/navigation sends no request.
- Validation: 42 related mounted entry/keyboard/history/lookup/role regressions passed, zero skips. New tests cover last-delete replacement, Back/reopen, month return, busy refresh retaining input, and reopening a fully saved batch without re-sending or deleting confirmed rows. Final typecheck/build/legacy are publication gates. No backend, data, grants, DB/FILES/auth/config or schema changes.

## Admin allocation operations across A/B/C (2026-10-19, after LIVE547)
- Replaces the explicit read-only Admin queue policy with trusted active, unscoped Admin authority across A/B/C. Uses the existing authenticated isAdmin capability and actual productionActorId; no per-account/department grant, role, credentials or manager configuration is written. Non-Admin managers still require their audited account-bound C or A+B configuration; quick Line, scoped/disabled accounts and role/name strings cannot obtain global authority.
- Server enables Admin offer, receive allocation, withdraw pending time and cancel future planning assignments in both directions. Offer source/target groups derive from the actual source Line, never ADMIN; audit/receipts retain the real Admin actor. Admin cannot impersonate another actor's retry. Existing snapshot CAS, conflicts/HR absence, native employee identity, same-group target rejection, time bounds, Capacity locks, actual-work protection, atomic rollback and idempotency remain required.
- Writable Admin UI offers all three source Lines, receives into A/B for C offers or C for A/B offers, shows cancellation and retains the scope editor. Pending acceptance and withdrawal use distinct explicit form modes: an Admin with both capabilities does not accidentally submit the wrong action or require a withdrawal reason while allocating. Managers' existing C/AB forms and read-only/unverified states remain guarded. No change to headcount/payroll formulas or production data.
- Validation: 113 related pure domain, isolated storage, configured dhtin/cnphuong flow, mounted UI, retained workspace, navigation, Capacity and role regressions passed with zero skips; typecheck passed. All 30 storage tests also passed after explicitly covering the second Admin receiving into B. Two synthetic Admin accounts each completed offer/allocate/cancel/withdraw with correct identity, C→A and C→B plus A→C and B→C, unchanged dedicated manager configuration and no actual production events. Admin tests also preserve locked-week rejection. Build/legacy complete during packaging. No production mutations were used for validation; existing Site, DB/FILES, auth and runtime configuration remain intact. No full browser pixel acceptance is claimed.

## Compact pending allocation list (2026-10-19, after LIVE548)
- Pending acceptance now uses one shared column heading and a compact row per offered interval: employee/source Line, receiving Line, start, end and Save. Bounded internal scrolling (320px) prevents a long roster from extending the calendar. Date/time and receiving controls retain their original accessible names and per-person form state.
- Pending text and controls use 16px Times New Roman inherited from the application. Expandable source/remaining-window detail retains the full GMT+7 bounds and cancellation explanation without repeating long paragraphs in every row. Withdrawal, cancellation, backend validation, Admin/manager permissions and production records remain unchanged.
- Validation: 47 related mounted/configured-flow/Capacity regressions passed, zero skips; typecheck passed. Includes retained edits/DOM through verification and errors, successful allocation command boundaries, cancellation explanation and Admin source/target capabilities. Local preview opened but isolated fixture navigation was blocked by browser infrastructure; no desktop/mobile pixel acceptance claimed. Build and legacy verification complete during packaging.

## Select people, then allocate one common Line/time (2026-10-19, after LIVE549)
- Replaces per-person receiving controls with a compact checklist showing name/code, source Line and all remaining windows. Shared receiving Line/date/time and Save count appear only after selection; select-all respects receiving group and duplicate employee identity. Existing 16px typography and bounded scrolling remain. Selected people/fields survive pending verification and failed writes; genuine denial removes restricted data. No production records were changed for testing.
- Adds allocate-many on the existing authenticated allocation endpoint. Each selection passes the existing domain scope, active employee, pending bounds, conflict, HR, locked Capacity and planned-roster rules. All prepared queue/calendar changes commit under the original single snapshot CAS in one D1 batch; any invalid employee or write failure prevents the entire group from committing. Stable actor-bound receipts prevent duplicate retries; audit retains individual allocations and a group summary. Single allocate, withdraw and cancel semantics remain unchanged. DB/FILES/auth/config/grants/schema are preserved.
- Validation: 122/122 related mounted, pure domain, isolated D1, configuration, navigation and Capacity checks passed (zero skips), including multi-person/all/select-one, stale/invalid selection, failed retry, one common receiving form, refresh identity, 34 storage cases, cross-offer batching and racing all-or-none receivers. Typecheck and 5 legacy tests passed. Browser QA at the internal root confirmed list-only before selection, selecting two people produces one shared form/Save (2), and readable 16px layout using synthetic records. Temporary QA page was restored before packaging; no full mobile pixel acceptance claimed.
- Broader regression detected two existing failures reproduced on untouched LIVE549 commit e41f5c9: missing disabledExplanation in HR attendance buttons; a September approval fixture attempts HR input after its October 10 cutoff. These are not marked fixed. The old picker test's global checkbox selector was updated to scope the send form and passes separately; the full run launched before that test adjustment still contains that stale assertion failure. No unrelated HR behavior was changed.
- Full regression completed: 974 tests, 970 passed, 4 failed. Two were obsolete pre-selection assertions (picker checkbox scope and 24h receiving fields); both were updated for the new checklist/shared form and rerun successfully. The two HR/approval failures above are confirmed baseline failures. No full-suite all-green claim is made. The additional 24h mounted checks retain offered times after selecting a person and disable Save outside the offered interval.

## Collapsed pending employee picker (2026-10-19, after LIVE551)
- Corrects the visual interpretation: pending employees are now behind a single arrow control, rather than a permanently expanded roster. Open the picker, select one/many/all eligible people, then close with Xong, Escape or an outside click. The collapsed control shows selected count; receiving Line/start/end/Save share its baseline in one wrapping strip. No explanatory paragraph or second input card is shown by default; 16px text and bounded dropdown scrolling remain.
- Reuses the unchanged allocate-many transaction, guards and retry receipts. Only presentation/component checks changed; no backend, permission, DB/FILES/auth/config or production data changes. Temporary root fixture was restored after browser QA.
- Validation: related mounted selection, retained state, Admin, date/time and queue checks passed; typecheck passed. Browser QA verified collapsed initial picker, opening the arrow, choosing both synthetic employees, Xong collapsing the list, and one-row control alignment at desktop width. No full mobile pixel acceptance claimed. The two pre-existing HR/approval test failures documented above remain unchanged. Build/legacy checked during packaging.

## Distinguish actions from data (2026-10-19, after LIVE552)
- Monthly labor lookup now groups Edit/Cancel in a shared nowrap row action group with a 12px gap. Edit is an outlined pale-green button; Cancel is explicitly marked with a pale-red danger appearance. HR monthly history uses the same danger distinction. Neither the action callbacks nor authorization/cancellation confirmation logic changed.
- FeedbackActionButton emits a presentation-only data marker distinguishing unstyled/default actions from explicitly styled controls. Shared table CSS gives default actions visible border, light background, padding, hover and keyboard focus; preserves custom primary/toolbar/tab/navigation appearances, disabled states and native submit semantics. Adjacent direct table action wrappers get a 12px gap. Table disclosure summaries, links, employee headcount triggers and order links retain their labels/arrows and gain visible link affordances. Static cell content remains unstyled as data. This is a shared style audit, not a claim of pixel acceptance for every screen.
- Reviewed the reported monthly lookup, HR saved/draft actions, actual calendar headcount, pending allocation picker and existing per-table action styling. Added missing explicit disabled explanations to HR copy/add/delete/cancel controls; the former HR missing-explanation static regression now passes. The unrelated old September approval fixture/cutoff failure remains documented and unchanged.
- Validation: 58 related mounted action/disabled/focus/lookup/HR/selection/duration checks passed, zero skips; typecheck passed. Browser QA of the actual monthly component plus shared table controls confirmed separated same-row Edit/Cancel, distinct danger color and recognizable disclosure links. Temporary root fixture was restored. No production mutations, DB/FILES/auth/config/grants or backend changes. Final build and legacy validation are packaging gates; no full mobile or full-site visual acceptance claimed.

## SX reporting grouped by plan week (2026-10-19, after LIVE553)
- Adds In Transit-style full-width week divider rows to SX báo công, showing ISO plan-week number and Monday–Sunday dates. Uses the order's authoritative week, not its actual reporting date; missing/invalid weeks are grouped separately instead of guessed. Sorting groups chronologically and preserves the current toolbar sort within each week without mutating the filtered input array.
- Ten-order pagination is unchanged: divider rows never count toward totals; a week heading repeats at the beginning of a subsequent page. Off-page order records remain available for the existing exporter. Mobile cards receive the same plan-week headings. Existing action menus, quantities, reports, entry/exit actions, permissions, filtering and server persistence are unchanged.
- Validation: related production detail/work-calendar/history/output regressions passed, including new grouping/unknown-week/input-immutability assertions and page-2 continuation with 2026 ISO week 53 crossing into January 2027. Typecheck and 5 legacy checks passed. Browser QA at desktop width confirmed the actual board component shows week 43 and week 44 separators with the expected two-order pager. Temporary synthetic root page was restored; no production writes or DB/FILES/auth/config changes. No full mobile visual acceptance claimed. Build completes during packaging.

## Complete source time-operation archive and missing historical order linkage (2026-10-19, after LIVE554)
- Existing admin preview/save history dialog accepts a bounded timeLog object alongside its existing completion-array format. Each row preserves original source event ID, Plan/LSX/SKU/Line, operation, effective vs recorded timestamp, cumulative source hours per worker, original actor, source mode and correction note. Source-event IDs deduplicate across batches; changed same-ID content is rejected. Snapshot revision/CAS, replay, admin-only and Line-read boundaries are enforced. Only the existing production_history_import entity is written.
- Source time events are immutable historical journal entries (kind source-time), never actual station/attendance assignments, payroll events or new production quantities. They appear in time journal with original operation/source and their explicit per-worker source-hour note; cumulativeLaborHours is deliberately null rather than mislabeling per-worker hours as total labor. Existing completion aggregates remain unchanged.
- A completion for an absent order can carry an explicit sourceOrder snapshot: validated exact Plan/SKU/Line/LSX, confirmed usable SKU, positive quantity, dates, Monday week and source reference. It is linked only as a historical order snapshot, never creates/updates In Transit or warehouse data. This supports the verified emergency 2-unit order from the source plan without inventing a current production session.
- Validation: 26 related source/baseline/preview/journal/history-action/auth tests passed, zero skips; typecheck and 5 legacy tests passed. New isolated DB tests cover read-only preview, stale revision, stable replay, source ID mismatch rejection, exact timestamps and cumulative units, zero native production_event/report writes, no extra quantities, Line isolation and missing-source-order validation without In Transit writes. Build is a packaging gate. Actual source-data import/readback follows publication through the existing authenticated UI; no production testing writes were used.
# Đối chiếu mốc giờ nguồn khi nhập bổ sung (19/10/2026)

- Cho phép Admin lưu mốc lũy kế đã đối chiếu, gồm thời điểm báo công trước, mã thao tác nguồn và tham chiếu dòng Sheet. Mốc phải khớp báo công trước và không được giảm giờ đã có; giữ nguyên dữ liệu báo công cũ.
- Kiểm tra 8 ca nhập lịch sử đạt, gồm lưu/đọc lại mốc 31,67 → 37 giờ/người, chống nhập trùng và ghi đủ thao tác nguồn. Việc nhập dữ liệu production được kiểm tra riêng qua giao diện Admin.

# Đối chiếu toàn bộ Google Sheet báo công và In transit (19/10/2026)

- Thực tế đã lưu qua phiên Admin: 235 báo công đã xác nhận (thêm 180, cập nhật 55), 225 lệnh (thêm 163), đủ 644 thao tác nguồn (thêm 594). Đọc lại toàn bộ 235 dòng: sản lượng/số người/ngày hoàn thành/giờ trực tiếp khớp nguồn; đủ 644 thao tác với thời gian ghi nhận, hiệu lực và người thao tác khớp. Một dòng khôi phục Kho 17082026-103VN0009-B thiếu giờ được giữ null. Khi hiển thị người ghi nhận, dữ liệu đã đối chiếu ưu tiên người ghi nhận nguồn, giữ người nhập/xác nhận riêng trong lịch sử.

- Nhập đối chiếu Admin qua giao diện Nhập lịch sử: đọc nguyên dòng SX_LOG, SX_TIME_LOG và In transit không định dạng. Xác nhận sản lượng và tổng giờ trực tiếp theo nguồn, giữ số lẻ, thời điểm ghi nhận/tác động, người thao tác và lý do. Liên kết lệnh phát sinh theo Plan ID + LSX + SKU + Line; sửa báo công đã có tại cùng ID, ghi lịch sử trước/sau, chống trùng khi thử lại.
- Tổng giờ trực tiếp dùng cột T SX_LOG (gồm khấu trừ), không dùng giờ đã làm tròn trong SX_TIME_LOG nhân số người. Giờ theo từng nhân viên không được giả lập từ số người nguồn. Dòng khôi phục từ Kho thiếu giờ giữ null và có cảnh báo; không tạo số giờ hoặc thời điểm không có căn cứ.
- Lưu nguyên tử với snapshot kiểm tra thay đổi và các phần JSON giới hạn kích thước D1. Chứng từ Kho có sẵn không đổi; nguồn đã Kho xác nhận không nhập tồn thêm, nguồn đang chờ Kho tạo đề nghị chờ xác nhận.
- TEST tách biệt đã đọc/lưu/đọc lại toàn bộ 235 báo công, 225 lệnh và 644 thao tác nguồn; cập nhật tại chỗ 55 báo công mẫu đang có, thêm 180 dòng nguồn còn thiếu. Giữ tổng giờ/ghi chú, không sinh trùng thao tác tổng hợp. Kiểm tra phân quyền Line, stale preview, audit, replay và thiếu giờ đạt. Số liệu TEST độc lập với kết quả nhập thực tế đã ghi ở trên.

# Người thao tác theo user web (19/10/2026)

- Nhật ký báo công, thao tác thời gian và chi tiết dùng user web. Ưu tiên đối chiếu email tài khoản; năm email nguồn cũ đã kiểm với danh sách user Sheet và web được quy đổi sang LINE_A, LINE_B, cnphuong, ntnphung, vthduyen. Email nguồn, người nhập và người xác nhận vẫn giữ trong lịch sử; quy đổi chỉ dùng hiển thị, không tham gia xác thực/phân quyền.

### LIVE561 — Phụ kho theo tuần (19/10/2026)
- Lịch SX thực tế dùng bảng Thứ Hai–Thứ Bảy, chọn đúng danh mục đang làm việc: Quách Chanh Thảo, Trần Quốc Việt, Huỳnh Vạn Tiền. Chọn người cho tuần, thay riêng ngày; không ghi dữ liệu khi chỉ mở trang. Lịch gắn tuần/Line đang xem.
- Nhập trực tiếp Từ giờ–Đến giờ 24h GMT+7. Dùng ClockInput chung, hộp chọn giờ mở tại ô bấm; nút đồng hồ chiếm phần riêng, không đè chữ. Bảng giữ cùng chiều cao ô người/giờ.
- Lưu phân công hoặc chỉ giờ bắt đầu được, chưa tạo khấu trừ. Đủ giờ tạo sự kiện Phụ kho hiện hữu, kiểm tra danh sách, lịch được duyệt, có mặt toàn khoảng, trùng nghỉ/phụ kho và quyền backend. Nếu ảnh hưởng báo công đã lưu vẫn qua luồng duyệt giờ hiện hữu. Lịch và sự kiện thực tế cùng giao dịch CAS, có user web và lịch sử, retry không ghi trùng.
- Giờ đã ghi sửa/hủy bằng Biến động đã ghi, không tạo lần tính mới từ bảng tuần. Tải lại hiển thị giờ đã sửa; hủy giờ trả dòng lịch về chưa nhập giờ. Bản ghi phụ kho cũ và dữ liệu sản xuất/kho được giữ nguyên.

### LIVE562 — Ô giờ Capacity không chồng đồng hồ (19/10/2026)
- Sửa xung đột chiều rộng/flex của ClockInput trong Capacity tuần → Lịch làm việc: khung 104px, grid riêng cho chữ và wrapper nút 28px. Bộ chuẩn hóa bảng giữ font chung nhưng không ép chữ giờ dưới nút; áp dụng các khoảng HC, nghỉ trưa, giải lao, TC và các khung chi tiết Capacity. Không đổi dữ liệu hoặc logic tính giờ.

### LIVE563 — Nhập phụ kho nhanh và Sửa/Hủy
- Chọn người trực tuần tự điền các ngày chưa ghi giờ, bỏ Áp dụng cả tuần. Ô Từ/Đến hiển thị 08:00 mặc định; cặp 08:00–08:00 chỉ lưu phân công, không tạo giờ phụ kho.
- Xong trong ClockInput ghi cả giá trị đang được chọn mặc định (sửa lỗi chọn lại 08:00 không có tác dụng).
- Sửa/Hủy ngay trên dòng: bản giờ đã ghi dùng hộp thoại hiện hữu có lý do và lịch sử; hủy lịch chưa ghi giờ xóa phân công trong bản đang nhập, lưu bằng Lưu ghi nhận. Hủy thay đổi phục hồi bản đã lưu.

## 2026-10-19 — tự ẩn tuần đã xử lý (564)
- In transit và Tiến độ SX mặc định Đang xử lý; thêm Đã ẩn / Tất cả, kết hợp bộ tra cứu tuần hiện hữu. Tự xét toàn bộ tuần trước lọc/phân trang, giữ tuần hỗn hợp và tuần chưa xác định.
- In transit chỉ tự ẩn tuần mọi lệnh đã đồng bộ, không còn SL chờ xác nhận, hoàn thành đủ SL và có ngày hoàn thành (hoặc đã hủy). Tiến độ yêu cầu mọi lệnh hoàn thành, mọi báo công xác nhận, không đang chạy và đã chuyển sang Kho. Không đợi Kho xác nhận phiếu.
- Giữ tùy chọn ẩn thủ công cũ; Tất cả bỏ qua mọi bộ lọc ẩn để tìm lại. In transit thêm chọn hàng loạt tuần đủ điều kiện. Tự ẩn được tính lại khi dữ liệu thay đổi; không ghi/xóa dữ liệu nghiệp vụ.
- Kiểm tra logic và typecheck/build; chưa nghiệm thu hình ảnh trình duyệt do công cụ duyệt bị chặn ở phiên trước.

## 2026-10-19 — thứ tự tháng Sản lượng và giờ công (565)
- Nhóm tháng tại Sản lượng theo ngày xếp mới → cũ theo cả năm/tháng (10 → 9 → 8). Ngày trong mỗi tháng giữ tăng dần; chưa có ngày ở cuối. Thứ tự áp dụng trước phân trang và xuất báo cáo; không thay đổi số liệu.

## 2026-10-19 — viền nhãn Sự kiện Nhật ký giờ công (566)
- Bổ sung màu nền/chữ/viền dự phòng cho sự kiện chưa có ánh xạ màu (bao gồm source-time từ Google Sheet). Tránh CSS var không xác định làm mất viền trái. Giữ nhãn dữ liệu và nút Chi tiết riêng; không đổi bản ghi.

## 2026-10-19 — giờ lũy kế và thứ tự giờ công (567)
- Nhật ký giờ công ẩn riêng source-time BÁO CÔNG khỏi danh sách, giữ bản ghi nguồn/báo công. Mốc HOÀN THÀNH hiển thị SL theo các báo công cùng thời điểm. Tổng giờ lũy kế tại mốc có báo công lấy tổng hours.total đã biết tới thời điểm đó; thiếu giờ không biến thành 0. Mốc không đủ tổng giờ hiển thị giờ/người nguồn với đơn vị rõ ràng.
- Giờ công theo LSX xếp ngày hoàn thành mới trước, chưa hoàn thành cuối. Không thay đổi phép tính giờ hoặc dữ liệu lưu.

## 2026-10-19 — độ rộng cột Giờ công theo LSX (568)
- Thu gọn Ngày hoàn thành, SL đã xác nhận, SL chờ xác nhận, Giờ công chuẩn/SP và Giờ công hoàn thành về 110px; tiêu đề được xuống dòng, số/ngày giữ nguyên dòng.
- Cột Lệch (%) rộng 155px, giữ giá trị và dấu % trên một dòng, mũi tên giải thích riêng. Chỉ chỉnh CSS của bảng giờ công.

## 2026-10-19 — Hủy chuyển nhân sự gọn (569)
- Mặc định một danh sách chọn nhân viên/lượt chuyển, có Line và khoảng ngày giờ để phân biệt. Chỉ hiện form của lượt đã chọn; không trải mọi form ra màn hình.
- Khoảng chờ cho nhập Từ/Đến và lý do rút sau khi chọn. Phân công đã nhận giữ quy trình hủy toàn phân công hiện hữu; không thay backend/quyền hoặc giới hạn thời gian.

## 2026-10-19 — hủy chuyển nhiều NV chung giờ (570)
- Danh sách nhân viên chờ rút dùng picker checkbox gọn, tên/mã/Line. Chọn nhiều NV rồi nhập một Từ–Đến/lý do và Hủy chuyển (n). Không trải dài khoảng giờ trong danh sách.
- withdraw-many tái sử dụng quyền, kiểm tra khoảng chờ và idempotency từng người; chuẩn bị toàn bộ rồi ghi một D1 batch/CAS. Một người không hợp lệ làm toàn bộ không ghi. Giữ audit người thao tác/lý do/danh sách/khoảng hủy. Phân công đã nhận vẫn dùng quy trình hủy phân công hiện hữu.

## 2026-10-19 — khôi phục ẩn thao tác SX báo công (571)
- Menu chỉ render lựa chọn trong productionWorkActions.allowed theo trạng thái hiện hành. Trước đó choices.map hiện cả thao tác không hợp lệ bằng aria-disabled.
- Chưa nhập trạm: nhập trạm/sự cố; đang chạy: xuất trạm/chuyển người/bổ sung/tạm ngưng/sự cố; tạm ngưng: tiếp tục/sự cố; hoàn thành hoặc chờ xác nhận hoàn thành: không có thao tác ghi nhận. Chi tiết luôn truy cập được. Kiểm tra backend giữ nguyên.

## 2026-10-19 — đối chiếu giờ công theo PDF (572)
- Giờ công có Đối chiếu PDF: nhập tên nguồn và bảng SKU/giờ công đã trích xuất, đọc dữ liệu hiện hành để xem giờ cũ/mới và số mã giữ nguyên. Không sửa mã ngoài PDF; số 0 là giá trị hợp lệ; không tự tạo SKU hoặc khôi phục bản đã hủy.
- Chỉ ghi các mã chênh lệch qua API giờ công hiện hữu, giữ ghi chú, kiểm tra quyền/version và ghi lịch sử/audit theo user web. Ghi tuần tự từng mã; lỗi thì dừng, báo số đã lưu và yêu cầu đối chiếu lại trước khi tiếp tục. Không tuyên bố giao dịch nguyên khối.
- Sau lưu đọc lại để kiểm tra số mã khớp. Source deployment không tự nhập dữ liệu; thao tác cập nhật diễn ra qua phiên web được cấp quyền.

## 2026-10-19 — bổ sung SKU từ danh sách nguồn (573)
- SKU Master có Thêm từ danh sách: đối chiếu mã với catalog hiện hành, chỉ gửi create các mã chưa tồn tại. Không ghi đè hoặc khôi phục SKU đã hủy.
- Dùng /api/sku-request hiện hữu, quyền backend, chống trùng/CAS và lịch sử theo user web. SKU mới Chờ xác nhận/Chưa sử dụng; chưa tự xác nhận. Tên/quy cách/nhóm/Line lấy nguồn; đơn vị tính, phương thức, công đoạn chưa biết để trống. Giờ công PDF chỉ lưu sourceLaborHour tham chiếu, chưa đưa vào giờ công hiệu lực.
- Từng SKU lưu tuần tự; lỗi thì dừng và báo số đã lưu, đối chiếu lại bỏ qua mã đã thêm. Sau lưu đọc lại catalog kiểm tra số có mặt và Chờ xác nhận. Triển khai source không tự nhập dữ liệu.

## 19/10/2026 — Khôi phục thao tác của LSX đang sản xuất từ dữ liệu cũ
- Tách trạng thái vận hành khỏi việc đã có phân công nhân viên trên web. Dùng chung bộ xác định trạng thái tại giao diện và backend; LSX đã bắt đầu/đang SX không được nhập trạm lần nữa.
- Đang SX: Tạm ngưng, Xuất trạm, Bổ sung người, Sự cố; chỉ Chuyển người khi có người được phân công. Tạm ngưng: Tiếp tục/Sự cố. Lệnh mới: Nhập trạm/Sự cố. Giữ khóa báo công chờ xác nhận và lệnh hoàn thành.
- Với lệnh cũ chưa có phân công, xuất trạm lưu sản lượng và giờ công chưa đủ dữ liệu (null), không sinh giờ 0 giả hoặc nhân viên giả. Nếu nguồn chỉ có ngày bắt đầu, yêu cầu nhập giờ thực tế trong khung xuất trạm 24h; không tự suy diễn giờ từ ngày.
- Giữ quyền Line, nhật ký tài khoản web, kiểm tra sản lượng và giao dịch hiện hữu. Kiểm thử trên DB tạm, không tạo sự kiện thử trên dữ liệu sống.

## 19/10/2026 — Danh sách chọn công đoạn Line B
- SKU Master thêm/sửa hiển thị đủ B-PHAO → B-HCT → B-ASSY → B-PACKING → B-FINAL, khớp công đoạn đã có trong dữ liệu. Sửa danh sách lựa chọn bị thiếu, không tự thay công đoạn hoặc xác nhận lại SKU đã lưu.

## 19/10/2026 — Gợi ý SKU trong Thêm lệnh phát sinh
- In Transit hiển thị mỗi kết quả trên một dòng gồm mã SKU, tên sản phẩm và quy cách. Danh sách cuộn gọn; màn hình nhỏ cho xuống dòng; chọn kết quả vẫn tự điền đúng thông tin và đóng gợi ý. Giữ điều kiện SKU đã xác nhận/đang sử dụng.

## 19/10/2026 — Xử lý liên tục danh sách SKU từ thông báo
- Bỏ nút Thêm từ danh sách theo yêu cầu. Lưu/sửa/xác nhận/đóng chi tiết hoặc lịch sử giữ bộ lọc đang áp dụng, không quay về toàn bộ SKU. SKU vừa xác nhận tự rời danh sách chờ; mã vừa sửa vẫn chờ xác nhận.
- Giữ bảng SKU gắn trong giao diện (ẩn khi mở form) để giữ phân trang và vị trí cuộn. Xóa lọc/tra cứu khác vẫn do người dùng chủ động thao tác. Không sửa quy tắc xác nhận hay dữ liệu SKU.

## 19/10/2026 — Gợi ý SKU lệnh phát sinh dạng danh sách
- In Transit: gợi ý SKU hiển thị các dòng liền mạch theo kiểu Thêm mới BOM, bỏ viền/bo góc riêng từng mã; mã, tên, quy cách căn cột, cả dòng bấm chọn. Khắc phục CSS nút/khung bọc làm từng mã rộng hẹp khác nhau. Không đổi dữ liệu hoặc luồng lưu lệnh.

## 19/10/2026 — Nhập báo công nguồn chờ QLSX
- Chế độ đối chiếu confirmSourceReports=false lưu báo công Chờ kiểm tra, approvedQuantity=0, không người/giờ xác nhận và không tạo phiếu Kho. Không ghi đè báo công đã xử lý. Giữ chính xác tổng giờ nguồn, nhật ký và tham chiếu dòng Sheet; số lượng đã xác nhận của lệnh giữ nguyên đến khi QLSX duyệt.

## 19/10/2026 — Tiến độ SX đọc toàn bộ In Transit
- API trả progressOrders riêng từ toàn bộ dòng In Transit còn tồn tại và đúng phạm vi Line, kể cả chưa mở LSX/chưa đồng bộ. Tiến độ hiển thị rõ Chưa mở LSX/Chưa đồng bộ SX/Đã hủy; không tự mở lệnh hoặc thay đổi trạng thái KHSX. Chi tiết bổ sung SL kế hoạch.
- SX báo công vẫn dùng orders đủ điều kiện đã mở và đồng bộ; kiểm tra thao tác ở backend giữ nguyên. Không ghi lại dữ liệu In Transit.

## 19/10/2026 — Cho QLSX duyệt tổng giờ báo công đã đối chiếu Sheet
- Sửa điều kiện chặn phân bổ: báo công có ID nguồn, đã đối chiếu và tổng giờ khớp chính xác SX_LOG được QLSX xác nhận theo tổng giờ. Không bịa hoặc chia giờ cho từng nhân viên. Giao diện ghi rõ xác nhận tổng giờ nguồn.
- Dữ liệu nhập lịch sử ước tính, thiếu giờ, tổng giờ nguồn không khớp hoặc biến động chưa xử lý vẫn bị chặn. Không tự xác nhận bất kỳ báo công nào.


### 20/10/2026 — Khung báo công theo công đoạn dạng hộp thoại
- Báo công → Nhập trạm mở khung nổi giữa màn hình, nền mờ và cuộn bên trong; không cuộn trang xuống dưới bảng.
- Giữ danh sách công đoạn, chọn NV, giờ 24h và xác nhận chuyển người trong cùng khung. Đóng bằng Quay lại, nút đóng hoặc Escape; nhấn nền không làm mất lựa chọn.
- Vẫn là bản thử trong bộ nhớ, chưa ghi báo công chính thức hoặc xác nhận QLSX.

### 20/10/2026 — Phản hồi bản thử công đoạn
- Nới cột Chọn và ô giờ; bỏ khung tìm NV, dùng trực tiếp danh sách tích chọn.
- Hiển thị thông báo thành công sau khi khung đóng, lỗi màu đỏ và cảnh báo nguồn phân công ngay khi chọn NV đang có công việc trong bản thử. Vẫn yêu cầu đồng ý chuyển trước khi áp dụng.
- Bản thử chỉ lưu trong state React, không gọi API ghi, không thay đổi dữ liệu sản xuất chính thức; nguồn phân công công đoạn hiện chỉ là các thao tác thử trong phiên.

- Danh sách NV trong khung thử giữ lựa chọn ngay khi tích; bấm ra ngoài tự thu danh sách, nút Xong màu xanh là tùy chọn. Các màn dùng picker khác giữ hành vi cũ.

### 20/10/2026 — Đủ thao tác bản thử theo công đoạn
- Thông báo thành công và lỗi dùng hộp thoại giữa màn hình, chữ lớn 22–26px; lỗi màu đỏ, nút Đã hiểu.
- Lệnh đã nhập trạm trong bản thử có các khung Tạm ngưng (lý do), Tiếp tục, Xuất trạm (SL và nơi nhận NV), Bổ sung người, Báo sự cố (nội dung, SL ảnh hưởng, tùy chọn tạm ngưng).
- Chỉ hiện công đoạn đúng trạng thái. Bổ sung giữ người cũ, loại người đã có ở công đoạn, xác nhận chuyển từ công đoạn khác. Sự cố không dừng vẫn giữ trạng thái; sự cố dừng chuyển sang tạm ngưng để tiếp tục.
- Vẫn chỉ là state trong phiên; không ghi hoặc xác nhận báo công thật. Lệnh đang chạy từ dữ liệu cũ giữ luồng chính thức vì chưa có phân công công đoạn để chuyển đổi.

### 20/10/2026 — Sửa nhánh khung báo công dữ liệu cũ
- Nguyên nhân: chỉ lệnh đã có state thử mở modal công đoạn; Xuất trạm dữ liệu cũ render riêng ở WorkBoard, Báo sự cố/Tiếp tục render ở ProductionManagement nên vẫn nằm dưới bảng.
- Gom lớp hiển thị các thao tác SX báo công cũ vào ProductionWorkActionDialog: giữa màn hình, nền mờ, cuộn bên trong. Xuất trạm, Báo sự cố, Tiếp tục, Tạm ngưng và Bổ sung người đều dùng cùng lớp khung.
- Giữ nguyên validation, quyền và submit nghiệp vụ cũ. Ghi rõ “Thao tác chính thức” trên khung cũ; bản thử công đoạn vẫn không ghi dữ liệu. Không chuyển đổi hay suy đoán phân công công đoạn cho lệnh cũ.

### 20/10/2026 — Chi tiết nhật ký test và người nhập lịch sử
- Sửa nền khung chi tiết thành màu kem đặc; bảng trước/sau có nền, viền, chữ rõ, cuộn trong khung. Không còn nhìn xuyên bảng phía sau.
- Các phần time của production_history_import trước đây chỉ lưu parentBatchId, thiếu actor/actorId. Nhật ký đọc người thao tác từ đúng đợt nhập cha đã tải nếu phần con thiếu; không suy đoán từ người đang đăng nhập hoặc nguồn Sheets.
- Những lần đối chiếu mới ghi actor/actorId ngay trên phần con. Lịch sử cũ không sửa; không có cha hoặc danh tính đã lưu thì vẫn để Không rõ. Quy tắc ẩn vthduyen tiếp tục áp dụng sau khi xác định user.

### 20/10/2026 — Quyền phụ kho cnphuong
- Nguyên nhân chặn Lưu ghi nhận: toolbar WarehouseDuty chưa được ánh xạ vào quyền Lịch SX thực tế, nên kiểm tra tên kỹ thuật và từ chối user thường trước khi gọi backend.
- Phụ kho dùng cùng định danh quyền ActualWorkSchedule như lịch thực tế, không thêm quyền rộng hoặc bỏ kiểm tra. Backend vẫn yêu cầu canManage và đúng Line; HR không được phụ kho.
- Rà luồng QLSX: báo công, duyệt báo công, lịch thực tế, sửa/hủy phụ kho, chuyển line, Capacity và điều phối. Không thay đổi bản ghi quyền tài khoản, quyền quản trị hoặc dữ liệu sản xuất. Việc đối chiếu toàn bộ quyền cá nhân đang lưu cần tài khoản quản trị để đọc màn phân quyền.

## 597 — 20/10/2026: mở đúng khung báo công theo công đoạn cho lệnh có sẵn

- SX báo công: Nhập trạm, Tạm ngưng, Tiếp tục, Xuất trạm, Bổ sung người và Báo sự cố đều đi vào khung thử theo công đoạn, không rơi về khung báo công toàn LSX khi lệnh chưa được nhập trạm thử trong phiên này. Kiểm tra quyền/Line trước khi mở giữ nguyên.
- Lệnh cũ chưa có trạng thái thử: người dùng chọn rõ công đoạn đang làm (hoặc đang tạm ngưng khi thử Tiếp tục) và nhân viên để khởi tạo lần thử đầu ngay trong khung. Không suy ra tất cả công đoạn đang chạy từ sự kiện cấp LSX; không tự gán toàn bộ nhân viên Line. Chỉ các công đoạn được chọn có trạng thái thử.
- Sau khởi tạo: Tạm ngưng/Xuất trạm chỉ hiện công đoạn đang chạy; Tiếp tục chỉ hiện công đoạn tạm ngưng. Xuất trạm ghi SL riêng từng công đoạn và chọn nơi nhận nhân viên như bản thử hiện có.
- Vẫn chỉ là state trong phiên trình duyệt; không POST báo công, không ghi D1/R2, không xác nhận sản lượng thật. Tải lại trang làm mất lượt thử. Chưa triển khai lưu báo công chính thức theo công đoạn.
- Kiểm tra: 13 test nghiệp vụ bản thử đạt; typecheck đạt. Browser TEST dùng component thật + dữ liệu giả định: mở lệnh đang SX chưa có trial, khởi tạo CUT 1 NV, Tạm ngưng → Tiếp tục → Xuất trạm 20 và về Chờ phân công; thông báo thành công đúng. Build kiểm tra trong gói phát hành.

## 598 — 20/10/2026: thông báo theo thao tác và thứ tự ngày ở Lịch SX thực tế

- Thông báo kết quả trong ProductionManagement tự đóng khi đổi Line, tuần, màn hình, tài khoản, tab workspace hoặc bấm/chỉnh một thao tác tiếp theo. Có nút đóng và tự ẩn sau 8 giây. Kết quả trả về muộn từ ngữ cảnh cũ không hiện sang Line/tuần mới, kể cả quay lại ngữ cảnh trước.
- Biến động đã ghi / Lịch sử chuyển Line sắp theo thời gian hiệu lực tăng dần, cùng mốc thì theo giờ kết thúc và ID ổn định. Không sắp theo thứ tự truy vấn/ID ngẫu nhiên.
- Giữ nguyên lưu lịch phụ kho chỉ chọn người/ngày, chưa có giờ (08:00–08:00 là mặc định chưa tính giờ); không yêu cầu lịch duyệt khi chỉ xếp người trước. Không thay đổi dữ liệu phụ kho đã lưu, quyền, xác nhận hoặc khấu trừ giờ.
- Kiểm tra: 3 test vòng đời thông báo đạt (đổi Line, phản hồi muộn, thao tác kế tiếp, đóng, tự ẩn); 4 test phụ kho mounted/backend đạt, gồm lưu trước khi có giờ/lịch duyệt. Typecheck/build qua workflow phát hành.

- Bản thử báo công: Tạm ngưng/Báo sự cố không yêu cầu chọn NV, kể cả lần thử đầu; chỉ công đoạn được chọn nhận trạng thái tạm ngưng. Báo sự cố luôn tự tạm ngưng, bỏ checkbox; giữ nhóm đang phân công và kết thúc khoảng giờ phát sinh tại thời điểm sự cố. Không ghi dữ liệu chính thức.

## 20/10/2026 — Điều chỉnh báo công và lý do tạm ngưng (606)
- Riêng menu Điều chỉnh báo công: bổ sung từng báo công completion và nhật ký nguồn Sheet trước đây bị lọc mất; nhóm các dòng theo LSX bằng cùng helper Nhật ký giờ công. Giữ trình sửa thời điểm/nhân lực hiện hữu cho sự kiện web; nhật ký nguồn hiển thị để đối chiếu, không sửa giả sự kiện lịch sử.
- Nút Điều chỉnh giờ công trên mỗi lần báo công: sửa HC/TC theo từng NV nếu có phân bổ; nếu nguồn chỉ có tổng thì sửa tổng. Xem trước → lưu, bắt buộc lý do; lưu giờ thực, version và lịch sử hours-adjustment, không tự xác nhận báo công, không đổi SL/kho. Hỗ trợ báo công lịch sử bằng bản ghi điều chỉnh, không ghi đè batch nguồn.
- API kiểm tra quyền QLSX/Line, trạng thái hủy, version/revision và ghi nguyên tử với cursor; đọc lại giữ giờ đã điều chỉnh. Không có migration/seed hay thao tác dữ liệu production khi phát triển.
- Tạm ngưng trong bản thử: lý do không bắt buộc; nội dung báo sự cố vẫn bắt buộc.
- Kiểm tra: typecheck đạt; 30/31 test ban đầu đạt, 1 test HTTP cũ so sánh toàn bộ DB không tính các dòng website_action_audit mới (không phải thay đổi nghiệp vụ). Hai test mục tiêu điều chỉnh giờ mới đạt, gồm lưu/đọc, nguồn lịch sử, quyền, revision, giữ SL/trạng thái. Chưa nghiệm thu hình ảnh trình duyệt.

## 20/10/2026 — Sửa đúng cách hiển thị Điều chỉnh báo công (607)
- Chỉ sửa cách trình bày tại menu Điều chỉnh báo công: BẮT ĐẦU → Nhập trạm, HOÀN THÀNH → Xuất trạm; chuẩn hóa Tạm ngưng/Tiếp tục theo SX báo công.
- Bỏ dòng BÁO CÔNG nguồn và dòng completion dư khi đã có sự kiện Xuất trạm tương ứng. Gắn nút điều chỉnh giờ vào dòng Xuất trạm bằng reportId hoặc đúng lệnh/thời điểm; nếu chưa có sự kiện thì hiển thị lần hoàn thành như một dòng Xuất trạm.
- Không đổi tên/kind trong dữ liệu nguồn, nghiệp vụ lưu giờ, API hay menu khác. Test ánh xạ tên, loại dòng dư và giữ liên kết giờ đạt.

## 20/10/2026 — Danh sách gọn và khung sửa thời điểm (608)
- Menu Điều chỉnh báo công thay danh sách sự kiện dài bằng mỗi LSX một dòng, cột Giờ công lũy kế; Chi tiết rồi Sửa cùng ô.
- Sửa mở Dialog theo mẫu: thông tin lệnh, chọn công đoạn, Sự kiện / Thời gian hiện tại / Thời gian điều chỉnh 24h, lý do, xem tác động và lưu qua API correction hiện hữu.
- Không nhập trực tiếp tổng HC/TC trong giao diện này. Dữ liệu web có sự kiện lưu chính thức được sửa thời điểm/tính lại theo cơ chế hiện hữu. Các dòng Sheet/historical chưa có dữ liệu công đoạn hiển thị riêng Toàn lệnh và chỉ đọc; không tự gán vào công đoạn SKU. Chọn công đoạn chưa có sự kiện hiển thị chưa ghi nhận, không tạo thời gian giả.
- Giới hạn: báo công theo công đoạn vẫn là trial state, chưa có lịch sử công đoạn chính thức để chỉnh; khung không biến dữ liệu trial thành production. Backend sửa nguồn Sheet chưa triển khai, không tuyên bố có thể sửa mọi dòng nguồn.
- Giữ phần duyệt giờ chờ duyệt, quyền Line và xử lý lỗi/thành công. Không ghi dữ liệu production lúc phát triển. Test gom LSX/tổng giờ/lọc công đoạn đạt; chưa nghiệm thu ảnh trình duyệt.

## 20/10/2026 — Khôi phục Tra cứu và sửa khung bị tràn (609)
- Khôi phục nút Tra cứu riêng ở Điều chỉnh báo công. Ban đầu chỉ nút; mở hiện Tra theo rỗng; chọn trường mới hiện Nội dung tra; chỉ Tìm kiếm/Enter áp dụng; Quay lại thu gọn và giữ kết quả, Xóa lọc khôi phục danh sách.
- Scoped CSS cho khung sửa: nền trắng, chiều rộng 900px giới hạn viewport, ngắt dòng và bảng co trong khung, tránh nền trong suốt/tràn ngang như ảnh phản hồi.
- Test component gắn DOM kiểm tra mở/chọn/nhập không đổi dữ liệu, Tìm kiếm/Enter lọc và Quay lại giữ lọc. Typecheck đạt. Đã thử preview nhưng browser bị chính sách chặn khi nhận tab lỗi, không vượt chặn; chưa xác minh trực quan CSS mới bằng trình duyệt. Không thay đổi API/dữ liệu.

## 20/10/2026 — Khung dọc chữ lớn, mở sửa thời gian Sheet (610)
- Khung sửa rộng tối đa 640px, cuộn dọc; mỗi sự kiện là một mục dọc gồm thời gian hiện tại và bộ nhập ngày/giờ 24h. Nội dung/input/nút 20px, tiêu đề 26px; nhập ngày/giờ cao tối thiểu 44px.
- Mở sửa sourceTimeLog qua API source-time correction (quyền QLSX/Line, lý do, version, snapshot revision, kiểm tra thứ tự và giờ tương lai). Giữ batch nguồn nguyên vẹn, lưu bản điều chỉnh theo ID nguồn và lọc trùng khi đọc; ghi event audit trước–sau và người thao tác.
- Tính lại giờ theo chênh lệch trước/sau bằng lịch SX đã duyệt và số người nguồn, cộng chênh lệch vào giờ nguồn; giữ khoản khấu trừ nghỉ/phụ kho đã đối chiếu. Không tự tạo tên NV hoặc chia HC/TC khi nguồn chưa có. Chặn khi thiếu lịch/số người/tổng giờ nguồn hoặc chênh lệch làm giờ âm; không ghi một phần.
- Giữ sản lượng và trạng thái xác nhận; cập nhật thời điểm báo công/biên lệnh liên quan. Không ghi ngược Google Sheet. Dữ liệu không có công đoạn vẫn sửa ở Toàn lệnh; không suy diễn thời gian công đoạn.
- Test source preview/apply/read đạt: 9h nguồn (đã trừ 1h) → 19h khi tăng 1h × 10 người; batch gốc giữ nguyên, không trùng sự kiện, stale/role/thứ tự bị chặn. Test component mở Sửa thấy input ngày không bị disable; Tra cứu/Enter vẫn đạt. Typecheck đạt. Chưa kiểm tra ảnh trình duyệt vì policy chặn ở lần trước; chỉ kiểm tra DOM và logic.

## 2026-10-20 — Phụ kho nhiều khoảng giờ cùng ngày (611)
- Nút Thêm dòng tại mỗi ngày giữ ngày/nhân viên, thêm khoảng từ–đến riêng; cập nhật theo rowId, thứ theo ngày thực tế.
- Lưu nhiều dòng mỗi ngày, tương thích lịch cũ một dòng/ngày; mỗi khoảng hoàn chỉnh tạo attendance riêng. Kiểm tra trùng giờ trong cùng lần lưu và với dữ liệu đã lưu; giữ sửa/hủy bản ghi, quyền và lịch làm việc hiện có.
- TEST: lưu/đọc lại hai khoảng cùng ngày, không ghi đè, từ chối trùng giờ; mounted UI kiểm tra thêm dòng và sửa độc lập. Không ghi dữ liệu thử lên production. Chưa nghiệm thu hình ảnh qua trình duyệt.

## 2026-10-20 — Đối chiếu thời gian điều chỉnh (612)
- Khung điều chỉnh: thời gian hiện tại và thời gian điều chỉnh đặt hai cột cạnh nhau trong từng sự kiện; giữ chữ lớn, các sự kiện theo chiều dọc. Màn hình hẹp dưới 560px xếp dọc tránh tràn.
- Chỉ sửa CSS, không thay đổi tính/lưu giờ công. Build kiểm tra; chưa nghiệm thu hình ảnh trình duyệt.
- Nút + Thêm dòng phụ kho chuyển vào ô Ngày, hiển thị trực tiếp cạnh thông tin ngày; Sửa/Hủy giữ ở cột thao tác.

## 2026-10-20 — Vị trí Thêm dòng phụ kho (613)
- Theo yêu cầu mới: + Thêm dòng nằm cuối cột Thao tác, sau Sửa và Hủy. Chỉ chuyển vị trí nút; giữ xử lý nhiều khoảng trong ngày.

## 2026-10-20 — Lưu trực tiếp thời gian điều chỉnh (614)
- Nới ô giờ HH:mm lên 112px trong khung sửa, tránh cắt chữ khi dùng font lớn.
- Nút Lưu thực hiện kiểm tra preview và apply theo revision trong một lần bấm; lỗi giữ dữ liệu nhập, chặn bấm trùng. Không cần bước Xem tác động riêng. Lưu thành công nhưng tải lại lỗi không báo nhầm lưu thất bại.

## 2026-10-20 — Phụ kho vừa khung và Demand event từ hình (615)
- Phụ kho dùng khung tối đa 1100px; thu cột ngày/NV, dành 32% cột Thao tác, nút xuống dòng khi màn hẹp; bỏ min-width gây cuộn ngang.
- Thêm mới Demand event có Tải hình — nhập nhiều mã. OCR trên trình duyệt, runtime/ngôn ngữ phục vụ cùng origin, tải khi sử dụng; bảng ảnh kẻ cột như mẫu. Không gửi ảnh sang dịch vụ OCR bên ngoài.
- Đọc tuần/ngày đầu tuần, SKU, cột SL thứ ba và ngày giao cuối; Loại Bù tải sửa được thành Phát sinh. Tên/quy cách theo SKU master; mã đọc nhầm I/L/1 chỉ ghép khi có một ứng viên và ghi chú để kiểm tra. Dòng lặp giữ riêng; ngày giao trống phải bổ sung trước khi lưu. Ưu tiên mặc định Thường và sửa được.
- Lưu từng dòng qua API records có quyền/validation/audit hiện hữu, khóa bấm trùng, createOnly và ID ổn định; lỗi giữa chừng hiển thị số đã lưu và thử lại không tạo lại các ID cũ. Không tự nhập dữ liệu mẫu vào production.
- Kiểm tra OCR thực trên ảnh cung cấp: 16 dòng, ngày yêu cầu 26/10/2026, SL 102XS04001=4000, giao 102XS06001=03/11/2026, giữ 8 ngày giao trống. 3 test parser/mounted UI đạt; typecheck đạt. Chưa nghiệm thu hình ảnh trình duyệt do phiên preview trước bị chặn.
- public/ocr là tài sản sinh lại từ package-lock bằng build/demand-ocr-assets.mjs tại cấu hình Vite, không đưa vào source snapshot/handoff; bản deploy vẫn chứa đủ tài sản.

## 2026-10-20 — Demand image: khung rộng, SKU và ngày (616)
- Gỡ giới hạn 720/760px của dialog nhập từng SKU bằng selector riêng cho nhập hình; khung gần toàn màn hình. Chia cột rõ, nới cột Loại 13%, tối thiểu 115px cho select để đọc đủ Bù tải/Phát sinh.
- Mặc định Bù tải giữ nguyên; từng dòng sửa được Phát sinh. Ngày yêu cầu hiển thị và lưu theo ngày bắt đầu tuần kế hoạch.
- Ghép OCR thừa 1 trước I/L với SKU master khi duy nhất; test 102X1L05001→102XL05001 và 102X106001→102XI06001. Không sửa SKU master hoặc dữ liệu Demand đã lưu.
- Parser/mounted UI và typecheck kiểm tra; chưa nghiệm thu hình ảnh trình duyệt.

## 2026-10-20 — Demand image nằm trong vùng nội dung (617)
- Khung nhập hình bắt đầu sau thanh menu trái 12px, rộng đến mép phải trừ 12px. Dùng biến --onspa-sidebar-width chung để theo menu mở/thu gọn và kích thước màn hình; không đổi dữ liệu hoặc thao tác.


## ERP báo công theo công đoạn — 21/10/2026
- Bổ sung nhập Admin qua Nhập lịch sử: 859 phiếu và 2.172 mốc nguồn tháng 9–20/10, nhân viên thực theo file chi tiết.
- Tính giờ từ mốc nguồn và lịch web, trừ nghỉ/tạm ngưng/phụ kho; lịch thiếu dùng HC đã thống nhất, ghi cảnh báo. Chỉ FINAL cộng sản lượng thành phẩm.
- Thay báo công cũ bằng bản theo công đoạn, giữ bản cũ hủy mềm và dữ liệu Kho; xác nhận theo yêu cầu người dùng. Giữ chồng giờ, cảnh báo từng nhân viên/lệnh/công đoạn.
- Kiểm thử tính giờ, thay thế giao dịch, chống nhập trùng, bảo toàn Kho và quyền đạt; kiểm thử lịch sử liên quan 11/11 đạt. Đã cài lại dependency OCR còn thiếu; typecheck đạt. Chưa ghi dữ liệu live ở thời điểm ghi chú này.
- Luồng thao tác công đoạn thử nghiệm hiện hữu không thuộc thay đổi này.
- Live v618 đã triển khai; đối chiếu toàn bộ bị giới hạn CPU, chưa ghi dữ liệu. Tối ưu phép tính bằng các mốc ca/nghỉ chính xác thay quét từng phút; 859 phiếu cho kết quả giờ và 1.372 giao đoạn chồng giống trước, thời gian kiểm tra cục bộ giảm 6,5 giây xuống 0,15 giây.

- Đối chiếu live v619 đạt: 859 phiếu, 170 lệnh, 174 báo công thay thế, 2.172 thao tác, 1.907 cảnh báo. Lần lưu chưa ghi do gói D1 RPC vượt 32 MiB. Giảm bản sao dữ liệu trong kiểm tra đồng thời bằng updated_at và độ dài payload; giữ so sánh revision đầy đủ trước giao dịch.

- Hoàn tất trên live v620 lúc 08:38 ngày 21/10/2026 (GMT+7): lưu và xác nhận 859 phiếu công đoạn, thay 174 báo công cũ, 2.172 thao tác nguồn trên 170 lệnh (169 lệnh có phiếu hoàn thành), giữ 1.907 cảnh báo chồng giờ. Đã đọc lại Chi tiết phiếu D401-20261020020: A-FINAL, 2.000 SP, 2 nhân viên, 0,74 giờ, Đã xác nhận. 62 ngày/Line thiếu lịch dùng HC mặc định đã thống nhất.

- Nhật ký báo công: thêm cột Công đoạn ngay sau Line, dùng tên/mã công đoạn đã lưu; dữ liệu cũ thiếu công đoạn ghi rõ chưa ghi nhận. Chỉ đổi hiển thị, không sửa giờ hoặc báo công đã xác nhận.
- Nhật ký báo công: mặc định loại bản hủy/đã thay thế khỏi danh sách hiện hành; bản thay thế vẫn tra cứu bằng trạng thái Đã thay thế. Thêm lũy kế giờ công công đoạn và lệnh theo các lần xuất trạm tới thời điểm dòng, tính trước lọc/phân trang; không cộng bản cũ đã thay, bản hủy hoặc lần xuất sau. ERP chỉ cộng báo công ERP cùng lệnh. Kiểm thử 6/6 đạt, không ghi thay đổi số giờ lưu trong DB.

### 21/10/2026 — Thứ tự công đoạn trong Nhật ký báo công
- Báo công nhóm theo lệnh (lệnh mới trước), công đoạn theo processes của SKU Master; các lần cùng công đoạn theo thời gian tăng dần. Giữ cách cộng lũy kế theo thời điểm đã ghi nhận.
- Ngày bắt đầu / Ngày hoàn thành hiển thị đầy đủ dd/MM/yyyy HH:mm:ss GMT+7, 24h. Không sửa dữ liệu hoặc các hạng mục nhật ký khác.

### 21/10/2026 — Tối ưu nhật ký sau nhập báo công công đoạn
- Tái sử dụng snapshot khi phản hồi không đổi; giữ bảng trong lúc tải nền, kiểm tra lại qua TTL khi mở menu. Lỗi mạng giữ dữ liệu; lỗi quyền/đổi phiên vẫn xóa cache.
- Memo hóa bảng nhật ký và dữ liệu suy ra; dùng giờ bắt đầu đã lưu, chỉ dựng chi tiết dự phòng nếu thiếu. Lọc không có điều kiện ngày không định dạng ngày cho từng dòng.
- Lũy kế dùng tổng chạy theo lệnh/công đoạn, xử lý đồng thời các phiếu cùng thời điểm, loại bản thay thế như trước.
- Kiểm tra lifecycle/cache, nhật ký, lũy kế và phản hồi không đổi.

### 21/10/2026 — Gọn cột giờ công nhật ký
- Bỏ cột lũy kế công đoạn; Tổng giờ công lệnh chỉ hiện ở lần báo công còn hiệu lực mới nhất của công đoạn cuối trong SKU Master, các dòng khác để trống. Chọn dòng tổng trước bộ lọc/phân trang; tổng vẫn tính đến mốc báo công đó.
- Bỏ dòng giải thích phía trên bảng theo ảnh người dùng. Giữ giờ công lần này và dữ liệu gốc.
- Kiểm tra FINAL 3 lần, chưa có FINAL, loại bản hủy, công đoạn cuối tùy cấu hình.
- Người ghi nhận (ID) chuyển ra cuối bảng Báo công, sau Chi tiết; các hạng mục nhật ký khác giữ nguyên.

### 21/10/2026 — Sản lượng/giờ công và nhật ký công đoạn
- Sản lượng theo ngày, Giờ công theo LSX, Tra cứu đặt cùng StandardToolbar.
- Báo công ERP công đoạn đã xác nhận đủ sản lượng FINAL, không còn phiếu chờ: suy ra ngày hoàn thành từ phiếu xác nhận cuối cho màn hình tổng hợp, mở phép tính giờ/SP khi trường ngày hoàn thành cũ còn thiếu. Không ghi đè lệnh/DB.
- Nhật ký giờ công thêm Công đoạn; xuất trạm ERP lấy SL công đoạn, cộng giờ/SL cùng công đoạn, loại tổng cũ thay thế. Dữ liệu chưa định danh công đoạn giữ theo lệnh.
- Tests: đủ/thiếu sản lượng, giờ/SP, không sửa order đầu vào, không trộn giờ CUT/FINAL hay tổng cũ.

### 21/10/2026 — Giờ chuẩn trong nhật ký công đoạn
- Bỏ Giờ/người lần này, nới LSX/Công đoạn và không ngắt mã xuống dòng.
- Cùng dòng tổng giờ lệnh cuối: giờ chuẩn = sản lượng báo công cộng dồn tới dòng × định mức LSX (hoặc menu Giờ công khi thiếu); lệch = tổng giờ lệnh/giờ chuẩn − 1. Công đoạn khác để trống vì không có định mức riêng công đoạn.
- Kiểm tra 2 lần FINAL 1.000 SP, chuẩn 0,07 => 140 giờ; so tổng 217,48; không lặp chuẩn trên lần FINAL trước.
- Tối ưu bổ sung: Nhật ký báo công/giờ công chỉ mount 20 dòng mỗi trang thay vì mount toàn bộ rồi ẩn bằng DOM. Giữ bộ lọc, toàn bộ dữ liệu xuất qua data-report-source, giờ lũy kế tính trước phân trang. Memo hóa lọc/sắp xếp, không tải API khi chuyển trang.

### 21/10/2026 — Chọn công đoạn trước khi sửa giờ
- Mở Sửa mặc định Chọn công đoạn, chưa hiện thời gian/lý do; chọn mới hiện các mốc tương ứng. Dữ liệu cũ chưa có công đoạn là lựa chọn riêng, không tự chọn.
- Nhận diện stageName/stageCode ERP, chuẩn hóa tiền tố Line để không gom toàn bộ ERP vào Toàn lệnh hoặc lặp CUT/A-CUT.
- Kiểm tra chọn CUT không lấy FINAL; trạng thái chưa chọn không có sự kiện. Không thay đổi dữ liệu báo công.

### 21/10/2026 — Đúng đơn vị cột giờ công chuẩn
- Nhật ký báo công đổi cột tổng chuẩn thành Giờ công chuẩn/SP, hiển thị định mức một sản phẩm với 4–6 số lẻ; xuất bảng dùng cùng giá trị. Ưu tiên định mức lưu ở LSX, thiếu mới lấy menu Giờ công theo SKU.
- Lệch vẫn so tổng giờ công với sản lượng × định mức; không chia tổng giờ công trực tiếp cho định mức một sản phẩm.

### 21/10/2026 — Dấu lệch và quy định màu
- Nhật ký báo công: độ lệch dương thêm +; âm giữ dấu trừ. Xuất bảng cùng định dạng. Sản lượng và giờ công giữ dấu + trên màn hình và bổ sung khi xuất bảng.
- Ghi chú tại tiêu đề Lệch ở cả hai bảng: trên +10% hoặc dưới −10% màu đỏ; khoảng −10% đến +10% kể cả biên dùng màu chữ bình thường. Có bản Việt/Trung phồn thể/Anh.

### 21/10/2026 — Thu gọn đầu trang và SX báo công
- Header chung giảm chiều cao/logo/padding, giữ các nhóm menu, ngôn ngữ, thông báo và tài khoản; màn hình hẹp tự xếp hàng. Không đổi chiều ngang workspace.
- SX báo công gom lịch ngày và StandardToolbar trong một hàng linh hoạt; ghim/đo chiều cao theo cả hàng để không chồng các phần tử.
- Plan ID cuối bảng, chữ 13px; Tên SP rộng hơn; Lệnh sản xuất/Trạng thái gọn, Có mặt hiện tại / Phân công tối thiểu 170px. Chỉ áp dụng work-table, không sửa cột Nhật ký.
- Nút menu có slot cố định riêng, không phụ thuộc lớp bọc FeedbackActionButton; vẫn hiện khi collapsed và trên màn hình hẹp.
- Nhãn Chờ xác nhận HT thay nhãn dài trong hàm hiển thị và dịch giao diện. Không thay enum, dữ liệu hoặc điều kiện xác nhận.
- Browser QA preview bị chính sách truy cập trình duyệt chặn; chưa nghiệm thu trực quan responsive. Typecheck/build và kiểm thử trạng thái được chạy riêng.
- Kiểm thử mục tiêu PASS: vị trí Plan ID cuối bảng, tiêu đề Lệnh sản xuất, nhóm tuần và sáu trạng thái. Bộ production-detail rộng hơn còn 3 lỗi kỳ vọng cũ: thời gian ngày-only, danh sách trạng thái Tiến độ, thứ tự tháng; không tuyên bố toàn bộ suite đạt. Typecheck đã đạt.

### 21/10/2026 — Nhãn SX và thứ tự khung/cột
- Nhãn trạng thái dùng chung Đang SX / Chưa SX / Hoàn thành SX, bao gồm bộ lọc và bản thử công đoạn; chỉ rút gọn hiển thị, giữ mã và điều kiện xử lý.
- SX báo công đưa khung Line/Sắp xếp/Tra cứu trước thông tin ngày/ca/nhân lực theo thứ tự DOM; hai khung stretch bằng chiều cao khi cùng hàng.
- Tiến độ sản xuất: Plan ID cuối bảng và cuối dữ liệu xuất, giữ nguyên thao tác chọn/mở dòng và nhóm tuần.

- Theo yêu cầu tiếp: cột Có mặt hiện tại / Phân công ở SX báo công giảm từ 170px còn 125px; giữ nguyên dữ liệu và cỡ chữ số người.

- SX báo công: lệnh còn sản lượng và quá hạn dùng nhãn trạng thái đỏ, bỏ dòng Quá hạn riêng; giữ tên trạng thái và title Quá hạn. Cột Quy cách tối thiểu 140px.
- Tiêu đề Trạng thái SX báo công có nút ghi chú màu, liệt kê đầy đủ trạng thái và quy tắc đỏ ưu tiên cho lệnh chưa hoàn thành còn sản lượng quá hạn.

### 21/10/2026 — In transit bố cục và nút mở menu
- Sửa quy tắc ẩn con của sidebar-collapsed để loại trừ sidebar-toggle-slot; nút mở/thu luôn còn hiển thị, giữ tùy chọn thu gọn đã lưu.
- Plan ID cuối bảng In transit và cuối hai đường xuất bảng; dịch chuyển CSS theo cột để không áp dụng nhầm kích thước. Tên SP tối thiểu 220px, trạng thái tiến độ 105–115px.
- Nhãn trạng thái qua productionProgressDisplay dùng chung SX báo công; chuẩn hóa cả fallback Đang SX / Chưa SX. Không sửa giá trị lọc hoặc dữ liệu lưu.

- Tiến độ SX đồng nhất nhãn một dòng với SX báo công, bỏ dòng Trong hạn/Quá hạn/Đến hạn riêng; quá hạn còn sản lượng chưa hoàn thành chuyển đỏ (trừ HỦY). Tiêu đề dùng chung ghi chú màu.

- 21/10: Đưa nút mở/thu menu ra ngoài vùng sidebar cuộn/ẩn, giữ callback và trạng thái; nút độc lập không bị cắt khi menu thu gọn, thêm aria-controls. Chưa nghiệm thu trực quan màn hình nhỏ do preview bị chặn.

- 21/10: In transit bỏ nút Nhập dữ liệu lịch sử, rút gọn Thêm lệnh PS/Nhật ký. Sửa mốc bắt đầu báo công có giờ ISO sang ngày Việt Nam trước chuẩn hóa In transit; giữ số lượng FINAL và logic xác nhận.

- 21/10: Rà 238 lệnh/923 báo công trên web: 230 lệnh thiếu ngày bắt đầu tổng hợp, không lệch tổng SL đã xác nhận. Chuẩn hóa timestamp tại normalizeTransit, build sạch cache/output để tránh bundle máy chủ cũ; In transit tải nền lại khi quay về tab. Chờ đối chiếu lại sau triển khai.

- 21/10: In transit thêm màu đỏ quá hạn cùng quy định SX báo công và chú giải màu. Bổ sung chuẩn hóa ERP ASSY 1 → ASSY qua luồng Nhập lịch sử Admin, preview/revision/ghi theo batch nguyên tử; giữ sourceRow, giờ, nhân sự, sản lượng, trạng thái xác nhận. Chờ thực thi dữ liệu sau triển khai.

## 21/10/2026 — Thu gọn Giờ công, In transit và tổng giờ Plan
- Bỏ nút Đối chiếu PDF và dòng đếm SKU giờ công theo đánh dấu; giữ các thao tác còn lại.
- In transit bỏ nút Xuất Excel và chữ Hiển thị; giữ bộ chọn có nhãn truy cập.
- Production Plan chỉ hiện Tổng giờ công theo đơn của danh sách chưa chuyển; hết đơn chưa chuyển thì 0. Tải và dư/thiếu hiển thị tính cùng tổng này. Không sửa quy tắc giữ capacity phía server hoặc dữ liệu đã đồng bộ.
- ASSY 1 → ASSY đã thực hiện trên live v636: 124 phiếu, 310 thao tác; 168 phiếu khác chỉ đổi nhãn cảnh báo chồng giờ.
- Điều chỉnh báo công: hàng Chi tiết/Sửa dùng production-row-actions thay khung footer form (đường viền/padding trên), loại khoảng trống làm giãn dòng.

## 21/10/2026 — Engine loại Demand đã lập kế hoạch
- Đọc lại Demand event khi nhận thay đổi; kết quả Engine cũ chỉ được dùng khi số lượng Bù tải/Phát sinh còn khớp nguồn chưa lập kế hoạch.
- Hiển thị tính lại nhu cầu; phải cập nhật bản Engine trước khi chuyển kế hoạch. Backend chặn chuyển snapshot có Demand cũ để tránh cộng lại. Giữ các bản lịch sử.

## 2026-10-22 — Phiếu thay đổi KHSX / QLSX
- Menu riêng ở hai không gian; không thêm nút In transit/Tiến độ SX.
- Máy chủ xác định KHSX: htndiem, nttvy; QLSX: cnphuong, ntnphung, dhtin. Không dựa bộ phận do client gửi.
- D1 app_records entity department_change: bản nháp riêng người lưu; nội dung gửi và lịch sử phản hồi chung; thời gian máy chủ, người thao tác theo login web; ngày giờ đề nghị độc lập.
- Gửi chuyển bộ phận chờ phản hồi; nhận thông báo từ góc phải, mở đúng phiếu. Poll nền khi tab hoạt động, giữ bảng cũ.
- CAS revision chặn gửi lặp/ghi đè, audit cùng transaction; không thay đổi dữ liệu kế hoạch hoặc báo công.
- Kiểm thử D1 bằng Miniflare đạt: quyền 5 users, chặn user khác, riêng tư bản nháp, gửi hai chiều, cạnh tranh phiên bản, lịch sử và audit. Typecheck đạt.
- Chưa kiểm thử bằng đăng nhập thực tế của 5 user; không tạo phiếu giả trên dữ liệu thật.

## 2026-10-22 — Bổ sung kho và khắc phục menu quản trị
- Quản trị xem menu Phiếu thay đổi tại Kế hoạch SX / Quản lý SX / Quản lý kho và đọc phiếu đã gửi, không tự đóng vai KHSX/QLSX.
- Phiếu KHSX gửi từ bản này: QLSX, Kho LK (ltphong), Kho BB (httung), Kho UT (nttnghiem). Các phiếu cũ giữ nguyên bên nhận đến lần KHSX gửi tiếp theo.
- tpnhi nhận thông báo cho cả 3 kho và chọn kho phản hồi thay; lưu login tpnhi + kho đại diện. Không tạo nghĩa vụ phản hồi riêng thứ tư.
- Trạng thái chờ độc lập theo bộ phận, phản hồi kho gửi lại KHSX; không xóa hàng đợi/draft của các bộ phận khác.
- Phiếu QLSX khởi tạo vẫn trao đổi riêng với KHSX. Kho không tạo phiếu và không xem phiếu không gửi cho kho.
- Miniflare kiểm thử bổ sung đạt: 3 kho, supervisor, admin view, chặn giả bộ phận, chặn xem/gửi ngoài phạm vi. Typecheck đạt. Chưa xác minh bằng phiên đăng nhập thực tế từng tài khoản.

## 2026-10-22 — Sửa vị trí menu Phiếu thay đổi
- Nguyên nhân thực tế: nút đặt trực tiếp dưới app-sidebar, bị quy tắc CSS hiện có `app-sidebar > [data-feedback-button] > button {display:none}` ẩn.
- Chuyển nút vào sidebar-children của planning / production / warehouse, cùng cấu trúc với menu đang hiển thị; không sửa CSS chung hoặc quyền nghiệp vụ.

## 2026-10-22 — Admin đầy đủ quyền Phiếu thay đổi
- Ghi quy định lâu dài vào AGENTS.md: mở quyền user phải đồng thời mở toàn bộ thao tác menu cho Admin, client và backend.
- Admin tạo/lưu/gửi phiếu theo KHSX hoặc QLSX, đọc/sửa bản nháp và phản hồi thay bộ phận đang chờ. Login thực tế không bị thay bằng user bộ phận.
- Duy trì kiểm tra trạng thái/revision và giới hạn user Kho chỉ phản hồi. vthduyen không ghi admin_audit theo yêu cầu cũ, thông tin người lập/phản hồi vẫn giữ trên phiếu.
- Miniflare kiểm thử tạo/gửi/phản hồi Admin, chống giả cờ Admin, quyền user thường; không tạo phiếu thử trên production.

- 22/10/2026: Phiếu thay đổi: sửa ToolbarPermissions chặn nhầm Thêm mới/Lưu của tài khoản theo bộ phận bằng quyền generic theo tên component. Hai toolbar dùng đúng danh sách tài khoản được phân công; điều kiện tạo/phản hồi vẫn kiểm tra tại component và backend. Kiểm thử save/send cho 5 user KHSX/QLSX và phản hồi của 4 user kho (tpnhi cả 3 kho); giữ quyền Admin và ngoại lệ audit vthduyen. Đồng hồ đề nghị dùng ClockInput 24h chung với Lịch SX thực tế, thời gian vẫn không bắt buộc.

- 22/10/2026: Ngày giờ Phiếu thay đổi/phản hồi tự ghi nhận bằng giờ máy chủ khi lưu/gửi, hiển thị Việt Nam 24h; không có ô cho sửa. Ngày giờ lập giữ nguyên khi sửa nháp/gửi; không nhận date/time/createdAt do client gửi. Không thay đổi thời gian của dữ liệu lịch sử.

- 22/10/2026: Bỏ tiêu đề Phiếu thay đổi bị lặp dưới tab ở cả KHSX, QLSX và kho (component chung); giữ tên tab và menu.

- 22/10/2026: Phiếu thay đổi thay window.confirm bằng xác nhận trong khung phiếu, hai lựa chọn Tiếp tục nhập / Đóng và bỏ thay đổi. Dùng StandardToolbar; không ghi dữ liệu khi đóng bỏ.

- 22/10/2026: Bỏ dòng ngày giờ lặp dưới ô nội dung; giữ ngày giờ ở đầu phiếu và trong lịch sử phản hồi, vẫn tự ghi nhận ở máy chủ.

- 22/10/2026: Lịch làm việc dự kiến: thêm khoảng cách 8px giữa HH:mm và nút đồng hồ, giữa hai ô từ–đến; tăng chiều rộng ô 104→112px để giữ đủ chữ.

- 22/10/2026: Menu Phiếu thay đổi hiển thị trong cả KHSX, QLSX và kho cho các user đã được chỉ định và Admin. Chỉ mở rộng điều hướng; dữ liệu, tạo phiếu và phản hồi vẫn theo quyền bộ phận ở backend.

- 22/10/2026: Tách Phiếu thay đổi KH/SX theo bộ phận lập; chỉ hiện Thêm mới cho đúng bộ phận hoặc Admin. Thông báo mở đúng menu nguồn, API kiểm tra nguồn phiếu khi client gửi originScope. Kho không tạo mới.

## 2026-10-22 — Tách quyền ghi theo menu, giữ quyền xem liên bộ phận
- Sửa kiểm tra ghi dùng nhãn nhóm quá rộng: kho theo từng nghiệp vụ, generic records/linked records theo entity cụ thể, duyệt báo công theo Tiến độ SX. Entity không ánh xạ không được mặc định thành Quản lý SX.
- Báo công, lịch thực tế, điều chỉnh báo công có capability riêng; chặn gọi API dùng quyền Capacity/lịch để báo công hoặc điều chỉnh. Giữ ngoại lệ HR, Line, quyền cá nhân và Admin. Không sửa dữ liệu quyền hay dữ liệu nghiệp vụ production.
- Toolbar kiểm tra đúng menu; nhận diện Nhập dữ liệu lịch sử, tải file và Đánh dấu đã lập kế hoạch là thao tác ghi. Giao diện báo công không suy diễn quyền làm việc từ quyền manager ở lịch thực tế.
- Kiểm thử mẫu 9 user/bộ phận, view-only, quyền cá nhân, sibling menus, HTTP từ chối và callback toolbar. Bộ test hồi quy sản xuất/quyền đạt trừ assertion HTTP cũ so sánh cả audit; đã cập nhật assertion bảo toàn dữ liệu nghiệp vụ và bắt buộc ghi nhật ký lỗi, chạy lại đạt.
- Giới hạn: phiên trình duyệt hiện là tpnhi, không có quản trị tài khoản. Chưa đối chiếu tất cả bản ghi quyền cá nhân/bộ phận đang lưu với lịch sử. Cần phiên Admin để hoàn tất kiểm tra dữ liệu quyền; không coi kiểm thử fixture là xác minh toàn bộ tài khoản thật.

## 2026-10-22 — Phiếu thay đổi: lưu rồi gửi ngay, nhãn bộ phận lập
- Lưu giữ khung và nội dung nháp, cập nhật revision/mã phiếu/thời gian từ kết quả đã lưu ở server; có thể gửi ngay cả phiếu mới và phản hồi. Gửi thành công vẫn đóng khung như trước.
- API trả lại bản ghi đã lưu theo cùng bộ lọc riêng tư bản nháp như GET, không lộ nháp của người khác.
- Nhãn chuông: “Thông báo từ KHSX/QLSX” lấy bộ phận lập phiếu, không thay đổi theo tác giả phản hồi cuối. Nội dung tóm tắt và lịch sử phản hồi giữ nguyên.

## 2026-10-22 — Bên lập phiếu chỉ nhận và xem phản hồi
- Loại bộ phận lập phiếu khỏi danh sách chờ phản hồi ở cả dữ liệu mới và phép chiếu dữ liệu cũ; không xóa lịch sử. Chặn bên lập lưu/gửi phản hồi trên phiếu đã gửi; khung chỉ có lịch sử và nút quay lại, không có ô nhập/Lưu/Gửi. Admin vẫn phản hồi thay bộ phận nhận còn chờ.
- Chuông tách Phiếu thay đổi cần phản hồi và “Thông báo phản hồi (số phiếu có phản hồi mới)”. Nhóm phản hồi chỉ hiện mã phiếu; người/bộ phận phản hồi xem trong chi tiết.
- Mốc đã đọc theo từng login lưu riêng department_change_read, không đổi revision/nội dung phiếu. Chỉ đánh dấu đến số thông điệp thực sự được mở; phản hồi đến đồng thời vẫn chưa đọc. Đã đủ phản hồi hiện “Đã phản hồi đầy đủ”.
- Kiểm thử cả KH/SX, các kho độc lập, dữ liệu cũ, chặn tự phản hồi, đọc theo từng user, concurrent reply và khung giao diện chỉ xem. Không gửi phản hồi thử lên production.


## 2026-10-22 — Thu hồi nhân sự theo khoảng tại Lịch SX thực tế
- Thêm thao tác Thu hồi nhân sự trong Biến động nhân lực, chọn nhiều nhân viên, từ/đến ngày giờ 24h, trả về Line gốc từ danh sách nhân viên.
- Ghi biến động thực tế có thời hạn, chỉ giao với các khoảng đã phân bổ/mượn; không sửa lịch dự kiến hay queue. Ví dụ thu hồi 28/10 vẫn giữ Line B ngày 29–30/10.
- Kiểm tra quyền Lịch SX thực tế tại API, phạm vi Line gốc và phạm vi điều phối nếu đã cấu hình; Admin được thực hiện. Ghi user/thời gian/nhân viên/khoảng thu hồi trong nhật ký. Không sửa bản thu hồi bằng khung sửa chuyển Line cũ.
- Kiểm thử miền và DB: nhiều người, khoảng trong ngày, trước/sau thu hồi, không ghi một phần khi lựa chọn sai, lặp request, bảo toàn Capacity/queue, từ chối user chỉ xem/HR. Không nhập dữ liệu thử vào production.


## 2026-10-22 — Thu hồi phải được QLSX đối phương đồng ý
- Thay thế thu hồi trực tiếp: Gửi yêu cầu chỉ tạo staff-recall-request và hồ sơ chờ; không tạo line-movement, không sửa nhân lực/giờ công.
- Dùng phạm vi QLSX C / A-B đã cấu hình; chỉ bên nhận nhân sự có quyền Đồng ý, người tạo không được tự xác nhận, kể cả Admin. Thiếu cấu hình thì dừng với hướng xử lý, không suy đoán quyền.
- Phiếu thay đổi SX có nút Lịch sử Nhân sự: hồ sơ thu hồi tách khỏi danh sách phiếu thay đổi thông thường. Thông báo Thu hồi nhân sự góc phải mở đúng hồ sơ.
- Đồng ý kiểm tra lại phân bổ, phiên bản và quyền; ghi hiệu lực thực tế + lịch sử xác nhận trong cùng giao dịch có kiểm soát đồng thời. Chỉ khi đồng ý mới tạo biến động có thời hạn.
- Ghi người gửi, người đồng ý, giờ máy chủ và khoảng thu hồi; phía gửi nhận Thông báo phản hồi. Bảo toàn lịch dự kiến và các ngày ngoài khoảng thu hồi.
- Kiểm thử DB và giao diện với dữ liệu riêng; không gửi/xác nhận yêu cầu nhân sự thật khi kiểm thử.

## CV khác và khung điều phối (22/10/2026)
- CV khác tại Lịch SX thực tế: chọn nhiều nhân viên, ngày/giờ 24h, nội dung công việc; sửa/hủy qua lịch sử. QLSX/Admin thao tác, kiểm tra trùng thời gian tại server.
- Khoảng CV khác loại khỏi giờ làm lệnh nhưng không ghi thành nghỉ; ghi user và thời gian thực hiện. Hiện nhập đủ từ giờ–đến giờ trong cùng ngày.
- Thu gọn khung nhận nhân viên từ Line khác, căn giờ và ngày cùng hàng. Triển khai đồng thời hai môi trường, dữ liệu riêng.

## Lưu cập nhật giờ công PDF (22/10/2026)
- Khung nhập PDF là trang riêng, Lưu và Đóng ở cuối bảng đối chiếu. Mã hợp lệ thêm mới/cập nhật; mã thiếu SKU Master hoặc chưa hợp lệ hiển thị lỗi và hướng xử lý, không ghi. Mã ngoài PDF giữ nguyên. Không tự nhập file mẫu.

- 22/10/2026: SKU Master cho sửa Nguồn (Tự chế/Mua ngoài/Gia công), mở sửa lấy nguồn hiện tại; nguồn được chọn quyết định Line/công đoạn khi lưu qua quy trình SKU hiện có. Áp dụng cả hai môi trường.
- SKU Master: Line luôn chọn được; A/B/C tự điền Tự chế, lựa chọn để trống tự điền Mua ngoài và không yêu cầu công đoạn. Lưu theo quy trình xác nhận SKU hiện có.

- 22/10/2026: Số trên chuông thông báo tăng 9px lên 16px, nền đỏ đậm 26px. Đồng bộ SKU cho Admin: xuất web chính, xem số thay đổi, nhập riêng SKU vào thử; giữ metadata, lưu lịch sử đồng bộ, bảo vệ phiên bản trong giao dịch. Line trống không tự đổi Gia công ngoài thành Mua ngoài.


## 23/10/2026 — Phiếu báo sự cố theo công đoạn
- SX báo công → Báo sự cố mở phiếu lưu thật; bỏ số lượng ảnh hưởng, chọn loại/nội dung/công đoạn, số giờ dự kiến và nguy cơ trễ. Lưu phiếu cùng sự kiện stage-incident trong một D1 batch; retry dùng cùng request ID. Không sửa toàn bộ trạng thái/giờ của lệnh khi chỉ một công đoạn bị sự cố.
- QLSX (cnphuong, ntnphung, dhtin) xác nhận trước khi KHSX (htndiem, nttvy) nhận và phản hồi. Admin có mọi thao tác theo bước. Kho không được xác nhận/phản hồi phiếu sự cố. Backend kiểm tra quyền, Line, revision, giá trị nhập; giữ ngoại lệ audit vthduyen.
- Phiếu thay đổi có Phiếu báo sự cố (số phiếu chờ QLSX xác nhận); thông báo góc phải tách phiếu sự cố và phản hồi, mở đúng phiếu. Ghi lịch sử người/giờ máy chủ, giờ dự kiến/thực tế và nguy cơ trễ. Hướng xử lý chuyển lệnh chỉ là chỉ dẫn, không tự điều chuyển người/lệnh.
- Mốc tạm ngưng công đoạn được lưu bền vững và nạp vào giao diện công đoạn. Các thao tác theo công đoạn khác còn là bản thử của hệ thống trước đó; chưa chuyển toàn bộ engine giờ công legacy sang engine công đoạn và không tự sửa giờ công báo công cũ trong thay đổi này.
- Kiểm thử bằng DB riêng: lưu/gửi/xác nhận/phản hồi/hoàn tất; quyền tất cả tài khoản liên quan, Admin, Line, dữ liệu sai, retry, phiên bản cũ, stage hoàn thành và bảo toàn stage không chọn. Không tạo phiếu giả lên web chính.

- 23/10/2026: Hướng xử lý sự cố có tùy chọn Thay thế LSX: chọn nhiều lệnh đã mở cùng Line (trừ chính lệnh sự cố), kiểm tra lại ở backend khi gửi, lưu thông tin lệnh cùng lịch sử phản hồi. Không tích vẫn gửi nội dung bình thường. Chỉ là chỉ dẫn; không tự nhập trạm/chuyển người.

- 23/10: Nhật ký ghi bản dữ liệu JSON trước khi gửi qua sessionFetch, tên thao tác/phiếu/route và mã đối chiếu với nhật ký máy chủ; lỗi kết nối giữ bản dữ liệu đó. Khung không dùng form cũng chụp trường nhập khi bấm toolbar/nút dùng chung. Hàng chờ nằm trong bộ nhớ tab (mất khi đóng/tải lại hoặc đổi phiên); không cam kết khôi phục dữ liệu lỗi cũ hoặc các nút chưa tích hợp. Không ghi mật khẩu/tệp nhị phân; giữ ngoại lệ vthduyen ở server.

- 23/10/2026: KHSX phản hồi sự cố được bỏ trống Hướng xử lý; vẫn lưu người/thời gian phản hồi và thông báo QLSX. Chọn Thay thế LSX vẫn bắt buộc chọn lệnh hợp lệ; giữ kiểm tra ghi chú nguy cơ trễ và kết quả xử lý SX.

- 23/10/2026: Xác nhận Lịch làm việc dự kiến khi Line chưa có lịch vệ sinh yêu cầu người dùng đồng ý rõ; có thể quay lại nhập. API kiểm tra theo từng Line; lịch sử xác nhận lưu noCleaningAcknowledged cùng người/thời gian hiện có. Lưu nháp không hỏi.


## 2026-10-23 — Engine → Plan validation diagnostics
- Preserve server validation details by SKU in the response, error dialog and operation audit. Remove misleading generic permission advice on validation failures.
- Distinguish missing, cancelled, unconfirmed and inactive SKU records. Recompute SKU availability from current master, including clearing stale pending flags. Batch transfer remains atomic; no business records are repaired automatically.
- Apply shared changes to production and training without changing environment bindings.

- Plan POST now validates the same read-only siteCatalog projection as Plan GET and Engine. Legacy status normalization and fallback SKU visibility no longer differ between display and mutation; explicit cancellations still override compatibility records.


## ERP incremental stage import — 23/10/2026
- Add explicit merge-documents mode for bounded date ranges. Match ERP document IDs; preserve unrelated reports and Line C. Missing start can only use the matching existing report, never inferred ERP hours.
- Retain overlaps, source actor, pause/resume/cancel-start events; calculate hours with web calendar. Only FINAL contributes finished output.
- Preview precedes atomic revision-guarded save; matching documents update without duplicate quantity. Backfill only missing FINAL warehouse proposals for this batch, preserving existing receipts and surfacing conflicts.

- 2026-10-23: Engine uses union of monthly Forecast and pending weekly Demand Event SKUs. Demand-only entries use Daily Demand 0 and SKU Master metadata; existing Bù tải/Phát sinh, MOQ, stock, and approval rules unchanged. Snapshot validation rejects omitted pending-demand SKUs.

- 2026-10-23: Cancelled orders are excluded from SX báo công and default active lists in Tiến độ SX / In transit. Data retained; hidden/all views remain available for history.

## 23/10/2026 — SX báo công chính thức theo công đoạn (web chính)
- Khung theo công đoạn lưu bằng API và giao dịch D1: nhập trạm, tạm ngưng, tiếp tục, bổ sung người, xuất trạm, làm việc phát sinh. Không nhập dữ liệu thử trong bộ nhớ sang dữ liệu thật.
- Kiểm tra quyền menu/Line, trạng thái từng công đoạn, số lượng, nhân viên, xác nhận chuyển, chống lưu trùng và cập nhật đồng thời.
- Báo công xuất trạm chờ QLSX; chỉ công đoạn FINAL (hoặc công đoạn cuối nếu SKU không có FINAL) ghi nhận thành phẩm, chưa gửi Kho trước xác nhận. Giờ theo phân công từng công đoạn, lịch/HR thực tế; phát sinh ngoài lịch giới hạn HC 17h.
- Site thử giữ bản riêng, không thay dữ liệu hay chế độ của site thử trong lần này.
- Kiểm chứng: luồng mới và API xác nhận CUT/FINAL đạt. 4 lỗi test legacy tại production-approval-integration/production-quantity-sync đã tái hiện nguyên trạng ở commit nền 5b22688 (fixture quyền cũ và kỳ vọng toàn bộ snapshot audit), không tuyên bố đã sửa các lỗi nền này.

## Điều phối nhân sự – Lịch sử và sửa phân bổ (23/10/2026)
- Đổi nút Lịch sử chuyển / hủy thành Lịch sử. Hiển thị phân bổ, thay thế khi sửa, hủy, người và thời gian thao tác; nút Sửa / Hủy phân bổ ngay trong lịch sử.
- Sửa phân bổ kế hoạch chưa bắt đầu là thay thế nguyên tử (hủy giữ chỗ cũ + nhận khoảng mới); kiểm tra quyền phía nhận/Admin, thời gian còn trong đề nghị, xung đột, khóa Capacity, phiên bản và idempotency. Lưu bản cũ và liên kết bản thay thế. Không sửa ngược lịch thực tế; hướng dẫn Thu hồi nhân sự.
- QLSX phía chuyển xem danh sách nhân viên và thời gian còn chờ ở Chờ phân bổ; không được phân bổ thay phía nhận.
- Kiểm thử: 73 test domain/storage/Capacity đạt, gồm đổi Line/giờ, hủy sau sửa, replay, sai quyền, lịch khóa, xung đột và giữ nguyên dữ liệu khi thất bại. UI kiểm tra trên preview với fixture tách riêng (đã gỡ): khung lịch sử, sửa, quyền theo dõi phía gửi. Không ghi thử lên dữ liệu thật.

## 23/10/2026 — Pro plan: chi tiết giờ khả dụng theo ngày
- Nhấn Khả dụng tuần mở bảng 7 ngày: HC, TC, tổng giờ công, khả dụng sau hệ số và người vắng mặt từ Lịch làm việc dự kiến.
- Chỉ đọc khi QLSX đã đồng bộ và KHSX đã xác nhận bản hiện hành; kiểm tra tại API và nút giao diện. Không thay đổi dữ liệu lịch.
- Lịch cũ nghỉ tổng tuần không tự chia số giờ nghỉ vào từng ngày.

## 23/10/2026 — Ghi chú theo lệnh In transit / QLSX
- Cột Ghi chú trước Plan ID tại In transit, nhập và lưu khi rời ô; không bắt buộc ở tạo lệnh PS / tạo thêm LSX / sửa lệnh.
- Cùng dữ liệu planningNote hiển thị sau Line tại SX báo công và Tiến độ SX; ghi chú riêng từng dòng, không ghi đè ghi chú báo công.
- Cập nhật riêng ghi chú giữ trạng thái đồng bộ, lượng lệnh và giờ báo công; API dùng quyền ghi In transit hiện hữu, kiểm tra revision và ghi nhật ký trước/sau. Giới hạn 2000 ký tự.

- 23/10: bảng giờ khả dụng căn giữa, cho xuống dòng tiêu đề; thêm Số NV HC trước Giờ HC, loại nghỉ cả ngày và giữ người nghỉ một phần theo lịch.

- Ghi chú KHSX tại SX báo công và Tiến độ SX: nội dung có nền vàng nhạt, chữ nâu đậm và viền cam; ô trống không tô màu. Không thay đổi dữ liệu hay đồng bộ.

## 2026-10-23 — Pro plan daily capacity warning
- Earliest-day-first allocation through selected finish date; existing active plans reserve daily capacity once.
- Uses approved/synced planned working schedule; incomplete sources are explicitly reported as unchecked.
- Overload requires explicit confirmation before save, revalidates capacity token, preserves edits on cancel, and records actor/time/overload in plan audit.
- Verified unit/integration tests and local warning dialog; production and training deploy together.
- Validation: 43 targeted plan/capacity tests pass. Broader shared feedback suites retain 9 pre-existing failures reproduced with baseline data-sync; not claimed fixed by this change.

## 2026-10-23 — Preserve HC staff when toggling workday
- HC off moves selected names into savedHc while active HC/OT remain empty. HC on restores the exact saved subset, including after JSON save/reload. No automatic changes to previously lost data or employee assignments.
- Mounted real-editor checkbox test passes 10 → 0 → 10 and preserves overtime guard. Three pure regressions and 12 column rendering cases pass. Broader Capacity suite: 29 pass, 3 existing unrelated cutoff/cleaning-confirmation failures; those handlers are unchanged.

## 2026-10-23 — Pro plan reserves unfinished In transit orders
- Uses canonical merged In transit progress. Includes unfinished orders whose planned finish is in the selected ISO week; keeps separate LSX sharing a Plan ID, excludes cancelled/completed rows, and replaces linked plan reservations instead of double counting.
- Remaining hours are estimates: unconfirmed remaining quantity × current standard hours/unit. Pending completion quantity is labelled; missing standards remain unknown. Backlog reserves earliest days from week start (or later planned start) to due date before new plans.
- Capacity cards show previous-week hours, total In transit backlog, combined load/balance and a detail dialog. Search filters no longer release reserved hours. Warning sections separate backlog details from overload days; confirmation revalidates progress and records the backlog basis.
- Verified canonical In transit tests, new pure/DB integration tests (partial completion, cancelled/completed, cross-week due dates, extra LSX, deduplication, missing standards, changed-progress approval), TypeScript and local desktop warning layout. No production business data changed.


## 2026-10-24 — Pro plan weekly load and rules
- Exclude future-start orders from viewed-week load; allocate overlapping orders earliest-day-first against confirmed daily capacity. Preserve full-order hours.
- In transit overlap backlog is deduplicated and prioritized; show its source week number (e.g. Tuần 43) under LSX.
- Add final Quy tắc action with scoped rules. Missing future calendars no longer discard known current-week reservations.
- Validation: 44 targeted tests passed; additional weekly allocation regression checks passed; local browser verified week label and Rules dialog. No business-data migration.


## 2026-10-24 — Official stage reporting continuity
- Project verified ERP stage start/pause/resume/exit history into official stage state; normalize Line prefixes and ASSY aliases. Never infer a running stage from order-level status.
- Backend uses the same complete history as the UI, retaining permissions, idempotency and concurrent-state checks.
- Retain imported stage timeline in newly issued reports so earlier hours survive read-back and attendance recalculation; missing source people cannot silently produce a zero-hour exit.
- Keep established dialogs and live data unchanged; no migration or test writes to production.
- Validation: 12 targeted tests passed, including persisted imported start → pause → resume → exit (1.5 hours before and after reload), official lifecycle, transfer confirmation, partial/full completion, incidents, permissions and approval/receipt flow.

## 24/10/2026 — ERP theo công đoạn chờ QLSX
- Hỗ trợ `confirmSourceReports:false` trong chế độ merge-documents: báo công Chờ kiểm tra, không approvedQuantity, không tạo kho hoặc cập nhật sản lượng In transit.
- Phiếu đã có cùng chứng từ giữ nguyên (kể cả người xác nhận); dữ liệu khác bị chặn để đối chiếu. Mốc nhập trạm thiếu chỉ lấy từ sự kiện nguồn đã xác minh của đúng lệnh/công đoạn, không đoán thời gian.
- Kiểm thử pending import trên TEST: bảo toàn phiếu đã duyệt, chặn ghi đè, giữ dữ liệu kho/In transit và đọc lại đúng trạng thái.

- ERP pending review: validate timestamp-calculated hours without requiring Sheets cumulative hours; retain missing employee-allocation blockers and tolerate per-person 4-decimal rounding.

- 24/10: Tiến độ SX hiển thị Công đoạn trước Xuất trạm ở mọi bảng xác nhận. Khôi phục chi tiết giờ có tên khi lịch vệ sinh chung chưa có danh sách; không đổi cách trừ vệ sinh có tên. Nhập sửa giờ ERP chỉ sửa phiếu chờ kiểm tra khớp nguồn, giữ ID/trạng thái/người báo, không duyệt hoặc tạo kho.

## 24/10/2026 — Điều chỉnh nhân lực theo công đoạn
- Khung sửa đặt Số nhân lực cạnh Thời gian điều chỉnh; danh sách nhân viên phải khớp số người, không tự gán tên hoặc phân bổ giờ cho người không được chọn.
- ERP: sửa theo lần báo công/công đoạn, tính lại HC/TC và giờ từng người từ lịch, thời gian nghỉ/phụ kho; bảo toàn trạng thái xác nhận và sản lượng.
- Báo công trực tiếp: sửa nhân lực tại Nhập trạm/Tiếp tục/Bổ sung người, có hiệu lực tới lần thay đổi nhân lực tiếp theo. Tạm ngưng/Xuất trạm hiển thị số người để tham khảo.
- Máy chủ kiểm tra quyền, Line, phiên bản, thứ tự thời gian, nhân viên và số người; lưu nguyên tử cùng lịch sử trước/sau. Cảnh báo chồng giờ được giữ lại.
- Kiểm thử tích hợp: ERP song song nhiều công đoạn; thay đổi số người có tên; chỉnh đồng thời thời gian và người; giữ phiếu chờ xác nhận; quyền, dữ liệu cũ, đảo thứ tự và sai số người.

- Điều chỉnh báo công: thêm Ngày hoàn thành đầu bảng (ngày xuất trạm mới nhất, dd/MM/yyyy) và SL hoàn thành trước Giờ công lũy kế. SL lấy reportedQuantity của các phiếu đang hiệu lực, không cộng stageQuantity; không sửa dữ liệu gốc.

- Sửa danh sách nhân viên Điều chỉnh báo công: chỉ chọn người thuộc Line trong khoảng làm việc của ngày VN đã chọn, theo roster đã duyệt và điều chuyển/phân bổ còn hiệu lực. Bỏ người nghỉ cả ngày, người chuyển sang Line khác, phiếu hủy/hết hạn/chưa duyệt. Máy chủ áp dụng cùng điều kiện; tên cũ không hợp lệ chỉ hiển thị để bỏ chọn, không tự xóa lịch sử.

- Khung Điều chỉnh báo công mở rộng tối đa 1120px; ngày và giờ cùng hàng. Danh sách nhân viên mở ngang toàn khung thao tác, tên từng người một dòng; bỏ ghi chú thừa bên trên danh sách.

## 24/10/2026 — Tăng tốc mở công đoạn trong Điều chỉnh báo công
- Lập chỉ mục sự kiện/báo công theo lệnh trong một lượt; useMemo giữ kết quả khi chọn công đoạn, nhập giờ/lý do hoặc mở danh sách.
- Chỉ lọc và dựng danh sách nhân viên khi mở Chọn nhân viên; cache theo ngày/Line, tự bỏ cache khi nhân viên/lịch/sự kiện thay đổi.
- Lọc bỏ sự kiện báo công không liên quan trước khi tính hiện diện; giữ xử lý hủy, thay thế và nguồn điều chuyển trước khi giới hạn ngày. Máy chủ vẫn kiểm tra hợp lệ khi lưu.
- Kiểm thử: 6 ca điều chỉnh/lọc/nghiệp vụ đạt; 12.000 sự kiện giả định kiểm tra giao diện mở công đoạn và nhân viên. Benchmark 2.000 lệnh/20.000 sự kiện/10.000 báo công: tổng hợp 567ms xuống 17ms, kết quả giống hệt (không phải số đo mạng hoặc thời gian tải toàn trang).


## 24/10/2026 — Nhập kho: thanh công cụ và xác nhận đã chọn
- Gộp chọn nguồn nhập, Tra cứu, điều kiện tìm và xác nhận vào StandardToolbar.
- Checkbox đầu bảng; chọn tất cả chỉ lấy phiếu SX đang chờ trong kết quả lọc. Khung kiểm tra yêu cầu xác nhận đã nhận đủ, ghi SL thực nhận theo đề nghị và user máy chủ.
- API kiểm tra quyền Xác nhận của menu Nhập kho (Admin đầy đủ), revision, trạng thái và CAS; kết quả báo rõ các dòng chưa cập nhật nếu có tranh chấp. Nhật ký thao tác giữ ngoại lệ vthduyen.
- PASS: typecheck; kiểm thử Miniflare quyền Kho/viewer/menu khác/Admin, revision cũ, không lặp, phạm vi đã chọn; mounted test chọn tất cả/trạng thái một phần/khung review/nút lưu bị khóa trước khi xác nhận số lượng.
- Preview local mở được nhưng cần đăng nhập TEST; chưa nghiệm thu hình ảnh desktop/mobile tại thời điểm đóng gói. Không thao tác xác nhận dữ liệu thật.

## 24/10/2026 — Người xác nhận báo công tại Tiến độ SX
- Hiển thị tài khoản xác nhận và thời gian Việt Nam 24h ở từng dòng công đoạn; chi tiết dùng cùng quy tắc tài khoản.
- Dùng reviewedById/reviewedBy/confirmationBasis đã lưu; không dùng người báo công hoặc người sửa cuối làm người xác nhận. Chưa xác nhận hiển thị —; đã xác nhận thiếu dữ liệu hiển thị Chưa ghi nhận.
- Backend hiện có đã ghi reviewedById và reviewedAt từ phiên máy chủ. Không sửa dữ liệu lịch sử hoặc xác nhận thay người dùng.
- Kiểm tra attribution, typecheck và build; chưa nghiệm thu giao diện bằng phiên người dùng thực tế.

## 24/10/2026 — Lý do trễ khi hoàn thành công đoạn cuối
- Bắt lý do khi công đoạn cuối xuất trạm trễ kế hoạch, kể cả xuất một phần chưa đủ lệnh. Công đoạn trước không bị chặn. UI/API dùng chung điều kiện, kể cả báo công cuối đang chờ xác nhận.
- Lý do gửi lên phải có nội dung; không tự lấy lý do cũ từ lệnh khi ô nhập trống. Xóa trắng không khôi phục giá trị cũ. Từ chối trước khi ghi/đồng bộ.
- Không thay đổi các xác nhận đã tồn tại. Kiểm thử quy tắc, API, typecheck và build hai môi trường.

## 24/10/2026 — In Transit: số trong khung Leadtime bị cắt
- Đã xác minh DOM web chính: lệnh 510-26101901 có Leadtime thực tế 0, trễ 0; bảng có min-width 920px và mép phải vượt viewport 18px nên số căn phải bị khuất.
- Chỉ sửa min-width của bảng trong it-drawer; không đổi bảng chính, dữ liệu hay công thức leadtime.

## 24/10/2026 — Leadtime chuẩn In Transit
- Sửa nguồn đọc: In Transit lấy phiên bản Leadtime đang hiệu lực, bản lưu riêng, rồi dữ liệu nền; trước đây chỉ đọc bản lưu riêng nên bỏ sót SKU nền. Không sử dụng nháp/chờ xác nhận và không khôi phục mã đã hủy.
- Chênh lệch = leadtime thực tế - chuẩn; không đổi cách tính leadtime thực tế hoặc số ngày trễ.

- In Transit: chế độ Tất cả xếp tuần mới trước; giữ thứ tự lệnh trong tuần và thứ tự các chế độ khác.

## 24/10/2026 — Google Sheet kho
- API cầu nối khóa riêng (chỉ hash trong DB), cấu hình chỉ Admin. Phiếu mới từ duyệt sản lượng thành phẩm được đánh dấu chờ gửi, giữ nguyên tạo phiếu web.
- Apps Script tại scripts/warehouse-sheet: tự kiểm tra mỗi phút, ghi NHAP chống trùng ID; xác nhận kho gửi về web, retry giữ người/thời điểm; ngày xuất trạm thay đổi cập nhật riêng ngày nhập.
- Chặn file kho thật trên host khác web chính; không bù lịch sử tự động. Chưa cài Apps Script/khóa trên file kho thật nên chưa hoạt động end-to-end. Không giả lập xác nhận dữ liệu thật.

## 24/10/2026 — Chốt kế hoạch vượt tải
Nút Chốt kế hoạch dùng chung khung xác nhận dailyCapacityConfirmation với lưu chỉnh sửa. Chỉ gửi lại với token máy chủ khi người dùng đồng ý; quay lại sửa giữ nguyên lựa chọn, không chốt. Kiểm tra tải và ghi nhận người đồng ý tại backend giữ nguyên.

- 24/10/2026: kết nối kho gửi khóa riêng trong HTTPS JSON, giữ tương thích Bearer; tách lỗi khóa thiếu/sai/chưa cấu hình/đã tắt; sửa trạng thái sau tạo khóa và ghi nhận lần kết nối gần nhất. GAS có khôi phục kết nối bằng khóa đã lưu. Chưa xác minh chạy Apps Script thật end-to-end.

- 24/10/2026: Admin có thể kiểm tra và đưa phiếu SX cũ theo ngày xuất trạm vào luồng Sheets; kiểm tra báo công đã duyệt/số lượng/SKU, chống dữ liệu thay đổi và không xếp lại phiếu đã có sheetSync. Không xác nhận kho thay người dùng.

- 24/10/2026: mở lại lối vào Thêm từ danh sách của SKU Master cho Admin; dùng luồng thêm mã còn thiếu hiện hữu, giữ mã đã có, trạng thái Chờ xác nhận và trường chưa biết để trống.

- 26/10/2026: SX báo công/Tiến độ SX hiển thị SL kế hoạch từ planQty In transit trước SL lệnh, màu xanh/cam riêng, ghi chú gọn. Lệnh hủy còn hiển thị, khóa báo công/công đoạn/báo sự cố/xác nhận; giữ dữ liệu lịch sử.

- 26/10/2026: theo yêu cầu hiệu chỉnh, SX báo công bỏ SL kế hoạch trên bảng/thẻ; chỉ hiện dòng có mã LSX, lệnh đã mở rồi hủy vẫn xem được và khóa thao tác. Tiến độ SX giữ SL kế hoạch và lệnh chưa mở.


## 26/10/2026 — Đồng bộ dữ liệu sang môi trường thử
- Trang Admin `/environment-refresh`: web chính tạo snapshot nghiệp vụ có hạn 24h; môi trường thử sao lưu SQL và toàn bộ tệp nghiệp vụ vào R2 riêng trước khi nhập.
- Chuyển app_records nghiệp vụ, file_objects, marker SKU và dữ liệu mẫu (nếu có); giữ tài khoản, phiên đăng nhập, quyền, cấu hình môi trường và khóa thiết bị riêng. Không chuyển cấu hình/khóa Google Sheet.
- Tải theo trang, kiểm checksum, staging và áp dụng DB trong một batch. Bản thử tạm khóa thao tác trong lúc chuyển; có Tiếp tục khi mất kết nối.
- Training chặn toàn bộ API warehouse-sheet; web chính giữ luồng kho hiện có. Kiểm thử end-to-end local đạt; kết quả dữ liệu hosted phải xác minh sau chạy.


## 26/10/2026 — Sản lượng theo ngày chỉ hiển thị thành phẩm
- Bỏ các báo công không phát sinh số lượng thành phẩm khỏi nhóm ngày/LSX và số lần Xuất trạm tại Sản lượng theo ngày (cả bảng và xuất file).
- Giữ thành phẩm xuất từng phần và chờ xác nhận có số lượng dương. Giữ nguyên báo công nguồn, giờ công tất cả công đoạn và Giờ công theo LSX.

- Rà các màn thống kê: áp dụng chung bộ lọc thành phẩm cho Sản lượng theo ngày, bảng ngày trong Chi tiết LSX/nhật ký, Giờ công theo LSX và danh sách LSX trong Hiệu suất/tiền sản lượng (kèm xuất file). Không ẩn nhật ký công đoạn, lịch nhân sự hay lệnh đang chờ/đang SX.

## Danh sách nhân viên — 26/10/2026
- Hai cột Ngày bắt đầu / Ngày ngưng làm việc; thêm mới bắt buộc ngày bắt đầu, dữ liệu cũ để trống nếu chưa biết. Ngày ngưng là ngày đầu tiên không làm; ngày trước đó vẫn hợp lệ.
- Bỏ Hủy và checkbox đang làm việc; trạng thái theo ngày. API Hủy nhân viên bị chặn. Nhân viên đã hủy trước đây được khôi phục rõ ràng qua quyền sửa, giữ phiên bản và lịch sử.
- Lịch mới lọc danh sách theo ngày, báo công/phân bổ lấy trạng thái hiện hành; không thay đổi lịch chốt và nhật ký cũ.

## Quy tắc tiền sản lượng — bảng phổ biến HR 26/10/2026
- Đổi phần Quy tắc tính sang 4 bảng: quỹ line, thời gian và công thức cá nhân, điều kiện nhận mới, theo dõi quỹ. Có ví dụ tỷ trọng 120/80 giờ và chia lại.
- Công khai rõ quy tắc mới chưa tự động tính: nghỉ chưa đủ tháng mất toàn bộ tiền tháng nghỉ; NV mới mốc ngày 10/11; Line C hoàn quỹ chung; dư giữ xét cuối năm. Không sửa phép tính hoặc chi trả trong đợt trình bày này.

- Chỉnh phần phổ biến: bỏ phân biệt cũ/mới; giải thích chuyển line bằng ví dụ 100/60 giờ, tách làm tròn và thiếu dữ liệu; thống nhất cột 23/33/44 và bỏ gutter của bảng con. Chỉ sửa nội dung/bố cục, chưa thay phép tính.

- Bảng quy tắc phân rõ trách nhiệm HR (hồ sơ/vắng mặt), QLSX (báo công, sản lượng, lịch thực tế, phụ kho, phân bổ/chuyển line) và đối chiếu chung trước chốt. Nội dung hướng dẫn, không bổ sung quyền hay bước duyệt tự động.

## 26/10/2026 — Áp dụng quy tắc tính Hiệu suất và tiền sản lượng
- Tính điều kiện từ ngày bắt đầu/ngày ngưng của Danh sách NV: mốc 01–10 hưởng tháng sau; 11–cuối tháng hưởng tháng thứ hai; ngưng trước khi hết tháng không nhận toàn tháng. Ngày ngưng là ngày đầu không làm.
- Giữ giờ đóng góp của mọi NV; chia lại phần NV mới/nghỉ chưa đủ tháng theo tỷ trọng người đủ điều kiện cùng line. Line C tính phần đóng góp rồi hoàn quỹ, không chia lại. A/B nhận trực tiếp theo giờ tại từng line.
- Hiệu suất trừ phụ kho và CV khác (hợp nhất khoảng chồng nhau), tiền theo giờ hiện diện. Không tự sửa lịch/báo công/hồ sơ NV.
- Làm tròn theo phần lẻ lớn nhất; tổng quỹ = thực trả + chưa phân bổ + hoàn quỹ. Bảng và Excel/PDF có điều kiện, tháng hưởng, phần ban đầu/chia thêm/hoàn quỹ.
- Thiếu ngày, line gốc, lịch/định mức hoặc không có người nhận khoản chia lại: chặn kết quả tiền, không biến thiếu dữ liệu thành 0. Đây vẫn là kết quả xem thử, chưa chốt/chi trả.
- Kiểm tra source chính: typecheck đạt, 28/28 kiểm thử mục tiêu đạt (phép tính, tháng, lịch, mounted UI, Excel/PDF). Browser TEST chỉ tới đăng nhập; chưa nghiệm thu dữ liệu LIVE. Chưa tuyên bố triển khai tại thời điểm ghi tài liệu này.

## 26/10/2026 — Theo dõi quỹ sản lượng nhiều tháng
- Tab Theo dõi quỹ sản lượng: chọn Từ tháng–Đến tháng (tối đa 24 tháng), mỗi tháng/line có quỹ phân bổ, dự tính trả, chưa phân bổ, hoàn quỹ, tổng giữ lại và lũy kế riêng theo line.
- Dùng chung payrollMonth cho màn tháng và lịch sử; giữ quy tắc hiện hành và quyền xem. Lũy kế bắt đầu ở tháng chọn; không tự chuyển phần giữ lại thành quỹ tháng sau.
- Tháng thiếu dữ liệu không được quy thành 0; tổng/lũy kế có khoảng thiếu để trống, cho biết lý do và số tháng đủ dữ liệu. Xuất Excel/PDF cả khoảng có trạng thái thiếu dữ liệu.
- Đây là tính lại từ nguồn hiện tại, chưa phải sổ quỹ chốt/ghi nhận chi. Quỹ mặc định 6 triệu/tháng; chỉnh quỹ/lựa chọn NV vẫn chỉ trong phiên mở menu như trước, ghi rõ trên bảng và file xuất. Không thêm ghi DB hay tự đồng bộ dữ liệu.
- Main: typecheck đạt, 32/32 kiểm thử mục tiêu đạt gồm mounted đổi tab/khoảng tháng, cộng dồn/thiếu tháng/qua năm, tính tiền cũ, xuất Excel/PDF. Chưa nghiệm thu trình duyệt có đăng nhập trên dữ liệu LIVE.


## 2026-10-26 — Quỹ hoàn về công ty
- Dùng lại cột Quỹ hoàn lại, đổi nhãn Quỹ hoàn lại CTY; không thêm cột trùng.
- Tiền Line C hoàn về công ty không cộng lũy kế Line A/B. Lũy kế line chỉ gồm phần chưa phân bổ.
- Bổ sung bảng quỹ công ty theo tháng và lũy kế, cùng bảng xuất Excel/PDF.
- Kiểm tra: typecheck main và 8 kiểm thử liên quan đạt. Chưa nghiệm thu trình duyệt đăng nhập hoặc xác minh tiền thực tế.
- Không thay đổi DB, tài khoản, tệp tải lên, cấu hình kho hoặc đồng bộ dữ liệu.


## 2026-10-26 — Rút gọn theo dõi quỹ
- Ẩn tháng trước 10/2026 khỏi tính toán, tổng và xuất báo cáo; mặc định năm 2026 bắt đầu tháng 10.
- Bỏ bảng công ty riêng. Giữ cột hoàn CTY và lũy kế chưa phân bổ theo line, thay cột giữ lại trùng bằng Tổng quỹ còn lại = chưa phân bổ + hoàn CTY; tổng cuối bảng cùng công thức. Tiền hoàn CTY không cộng vào lũy kế line.
- Excel/PDF còn một bảng tương ứng. Typecheck main và 9 kiểm thử liên quan đạt; chưa nghiệm thu trình duyệt đăng nhập/dữ liệu thực tế. Không ghi hoặc đồng bộ dữ liệu nghiệp vụ.


## 2026-10-26 — Chi tiết hoàn quỹ và giờ nghỉ theo line nhận
- Mũi tên Quỹ hoàn lại CTY ở từng dòng và tổng: tháng, NV, line gốc/line làm việc, giờ tính, tiền hoàn, lý do; lấy từ kết quả phân bổ hiện tại, không phải sổ chốt lịch sử. Không thay công thức tiền.
- Tra cứu nhân lực tính thời lượng từng NV theo khoảng điều chuyển có hiệu lực hoặc roster/window của line nhận; lịch của từng line áp dụng theo thời gian, loại nghỉ trưa/giải lao. Mũi tên giờ hiển thị chi tiết từng người và khoảng/line. Line nhận và lọc line có đối chiếu line thực tế, giữ nguyên line nguồn của bản ghi.
- Giữ nguyên DB/FILES/bản ghi HR, không nhập lại, không đồng bộ dữ liệu.
- Typecheck main và 23 kiểm thử liên quan đạt (kiểm thử hủy điều chuyển đã chạy lại đạt). Chưa nghiệm thu trình duyệt đăng nhập hoặc xác minh dữ liệu live của Phát.


## 2026-10-26 — PDF hiệu suất gọn và A4 ngang
- PDF chỉ dùng tên cột, không ghép ghi chú công thức; bỏ ghi chú đầu trang/ghi chú quỹ trong PDF. Excel giữ nội dung cũ.
- Dùng cỡ chữ gọn cho bảng nhiều cột. A4 ngang 842×595 pt, thêm ViewerPreferences PickTrayByPDFSize và PrintScaling None. Thiết lập máy in/trình đọc PDF có thể ghi đè; chưa thử máy in thực tế.
- 9 kiểm thử xuất PDF/Excel/quỹ đạt, đã render và xem trang NV Line A của PDF thử; không cắt dữ liệu nhân viên. Không sửa công thức hoặc dữ liệu DB.


## 2026-10-26 — Cột PDF theo ảnh duyệt
- Chỉ PDF bảng nhân viên ẩn Mã NV, Trạng thái, Tháng bắt đầu hưởng, Phần theo đóng góp, Tiền chia thêm, Tiền hoàn quỹ. Giữ Điều kiện nhận. Đưa Giờ CV khác trước Giờ phụ kho.
- Thứ tự và tổng dữ liệu được ánh xạ cùng cột; Excel và dữ liệu gốc không đổi. A4 ngang giữ nguyên.
- 10 kiểm thử xuất/quỹ đạt; đã render xem trang nhân viên PDF thử. Không chỉnh dữ liệu nghiệp vụ.


## 2026-10-26 — Tra cứu nhiều loại biến động
- Bảng tổng hợp nhân lực đưa Nhân viên lên cột đầu. Bộ lọc loại biến động có checkbox chọn nhiều loại (OR), gồm Tất cả biến động; áp dụng cùng tháng/Line/nhân viên khi Tìm kiếm. Xóa lọc trả về tất cả loại.
- 9 kiểm thử tương tác tra cứu đạt, gồm chọn Nghỉ + Đi trễ + Về sớm, chờ Tìm kiếm, thứ tự cột và phạm vi Line. Typecheck đạt. Không thay đổi DB, quyền ghi hay quy tắc tính giờ.

- Bổ sung: bấm Tổng hợp tháng mở ngay bảng kết quả với bộ lọc hiện hành; Quay lại giữ bản nháp lịch. Lọc tháng/loại/NV trước khi tính thời lượng; tái sử dụng danh sách biến động hiệu lực và dự tính nhân lực khi dữ liệu không đổi. 17 kiểm thử tra cứu/thời lượng đạt, gồm hủy và chờ duyệt điều chuyển.

- Sửa giao diện bộ lọc nhiều loại: nền kem kín, checkbox 16px, nhãn một dòng, khung riêng chống CSS chung làm giãn ô tích.


## 2026-10-26 — Tự cập nhật báo công theo nhân sự
- Nhận diện báo công ERP theo nhân viên và phần giao thời gian (gồm khoảng trước khi sửa); dùng đúng bộ tính ERP, lịch web và fallback đã chốt khi nhập ERP, loại nghỉ/phụ kho/CV khác một lần, xét điều chuyển theo khoảng hiệu lực.
- HR và QLSX ghi dữ liệu thuộc quyền được tự lưu điều chỉnh giờ cùng giao dịch; áp dụng cho thêm/sửa/hủy, phụ kho theo tuần và thu hồi được duyệt. Giữ quyền ghi và ngoại lệ nguồn/chồng giờ, sản lượng và phiếu kho.
- Admin có Đối chiếu/Tính bù theo tháng, xem trước từng báo công và từng NV, khóa phiên bản trước khi cập nhật. Chỉ thêm nhật ký hours-adjustment có giờ trước/sau; không sửa báo công gốc. Bỏ qua giờ thủ công/nguồn thiếu phân công và hiển thị để đối chiếu riêng. Biến động cũ chờ duyệt không tự được phê duyệt.
- 51 kiểm thử nghiệp vụ và tra cứu đạt; typecheck đạt. Kiểm chứng triển khai/dữ liệu thực tế được báo riêng, không coi kiểm thử tổng hợp là nghiệm thu toàn bộ.


## 26/10/2026 — Giải thích kết quả hiệu suất và quỹ
- Quy tắc và công thức dùng tên cột đang hiển thị. Tổng hợp tháng: bấm kết quả mở khung nhỏ cạnh ô, tự tránh mép màn hình; số hiển thị làm tròn giống cột (giờ/%: 2 số lẻ; tiền: 1 đồng), dấu ≈ cho phép tính minh họa; ô kết quả màu xanh, ô nguồn màu vàng, có nút tới ô nguồn.
- Xem nguồn LSX của Giờ công hoàn thành và nguồn nhân viên của giờ/tiền tổng. Giờ CV khác được hiển thị trong bảng đầu vào. Không thay đổi công thức tiền, dữ liệu, quyền hoặc xuất PDF.
- 13 kiểm thử payroll/trace đạt; typecheck đạt. Nghiệm thu trình duyệt được thực hiện sau triển khai riêng mỗi môi trường.

- 26/10/2026: chi tiết Giờ phụ kho / Giờ CV khác chỉ liệt kê nhân viên có giờ > 0 trong line/tháng đang xem; số nguồn đếm sau lọc, không đổi tổng giờ hoặc dữ liệu phân công.

## 26/10/2026 — Tự cập nhật giờ khi lưu lịch thực tế
- Lưu giờ làm việc thực tế tự tính lại báo công liên quan (kể cả đã xác nhận), ghi hours-adjustment cùng lịch trong một batch có kiểm tra phiên bản/cursor. Không cần bấm tính lại. Giữ dữ liệu báo công gốc, sản lượng, trạng thái và phiếu kho.
- Không tự ghi đè giờ đã điều chỉnh thủ công hoặc lịch sử thiếu phân công; thông báo số lượng và LSX cần đối chiếu riêng. Giữ quyền QLSX/Admin, Capacity đã duyệt và lý do bắt buộc. Nút Admin đổi tên Đối chiếu báo công, dành cho rà soát dữ liệu cũ.
- Kiểm thử lịch trên DB tạm: sửa/khôi phục giờ, báo công xác nhận tự đổi, quyền HR bị chặn, phiên bản cũ bị từ chối, không lặp điều chỉnh khi lịch không đổi. Không sửa lịch thật chỉ để thử.

## 26/10/2026 — Phân biệt giờ chuẩn và giờ báo công
- Giờ công hoàn thành đổi thành Giờ công chuẩn HT ở bảng, quy tắc, truy nguồn và tiêu đề xuất. Tab đổi thành Giờ công theo LSX.
- Thêm Giờ báo công sau Giờ công chuẩn HT tại bảng LSX, tổng các báo công đã xác nhận trong tháng của LSX đang hiển thị, gồm công đoạn trung gian; bỏ hủy/thay thế, dùng giờ sau điều chỉnh. Thiếu giờ = —. Không đổi công thức hiệu suất/phân bổ.
- Tiêu đề có mũi tên mở giải thích, mặc định đóng; giữ PDF tiêu đề không note.

## 26/10/2026 — Sửa phạm vi Giờ báo công theo LSX
- Thay phạm vi tháng vừa thêm ở 743/84 bằng lũy kế toàn LSX qua orderLaborOutput dùng chung với Sản lượng và giờ công. Giữ nguyên SL và Giờ công chuẩn HT theo tháng; không sửa DB hoặc công thức tiền. Ghi chú nêu rõ hai phạm vi.

## 27/10/2026 — Đối chiếu toàn bộ giờ LSX tháng 10
- Web chính: 67 LSX (A52/B15) khớp tổng các dòng nguồn đã xác nhận; Nhật ký có 3 tổng thiếu công đoạn kết thúc sau FINAL: 510-26100802, 510-26100905, 510-26101202.
- Tổng giờ công lệnh tại dòng FINAL dùng tổng toàn LSX chung với bảng hiệu suất và Sản lượng/giờ công. Giữ nguyên giờ từng lần, lũy kế theo thời điểm ở nguồn khác và thời gian gốc.

## 27/10/2026 — Tạm khóa báo công khi nhập ERP (web chính)
- Khóa tại API và thông báo tại các màn SX từ 27/10 đến hết 31/10/2026 GMT+7; tự hết 00:00 01/11. Host web thử/local không bị khóa.
- Chặn nhập/xuất trạm, tạm ngưng/tiếp tục, thay người theo lệnh, phát sinh, sự cố và duyệt báo công; không chặn nhập ERP, dữ liệu HR/lịch, hoặc chức năng hủy có kiểm tra.
- Admin có bước xem trước/hủy mềm thao tác trực tiếp ghi nhận ngày 27/10 tại Điều chỉnh báo công; chọn theo recordedAt/reportedAt GMT+7, không theo ngày sản xuất. Giữ ERP, snapshot trước/sau và lịch sử; từ chối bản đã xác nhận/có phiếu kho, dữ liệu phụ thuộc, bản cũ không theo công đoạn hoặc revision thay đổi.
- Kiểm tra tích hợp DB local: backdate, bảo toàn ERP, audit, quyền, môi trường, stale revision và phiếu kho. Kết quả hủy dữ liệu thật phải ghi sau thao tác, không suy từ test.
- Thực hiện trên web chính: hủy mềm thành công 7 báo công + 16 thao tác của 6 lệnh (27/10/2026), xác nhận từ giao diện sau phản hồi máy chủ. Dữ liệu ERP không nằm trong tập ghi; không sửa kho.
- Thông báo và thời điểm mở lại dùng thời gian còn lại do máy chủ trả về, tránh lệch đồng hồ máy người dùng.


### 2026-10-27 — Scoped new-order transfer
Admin `/order-transfer`: trial inventory → main read-only export → trial preview/apply. Only missing or unsynced In Transit orders plus directly linked production events/reports/audits/history. Refuses mixed-order dependencies and existing trial activity, preserves all unrelated data and integration configuration. Atomic revision guard, before/after audit and post-write comparison. No warehouse calls, uploads, account or master-data transfer. Validated by tests/order-transfer.test.mjs.


## Bổ sung người và cảnh báo chờ phân công — 28/10/2026
- Bổ sung người cho công đoạn waiting/running/paused/partial; không mở lại công đoạn đã hoàn thành hoặc lệnh hủy. Giữ trạng thái công đoạn; không tự tiếp tục khi tạm ngưng. Nhập trạm gợi lại người đã bổ sung trước đó.
- Giờ của người bổ sung chỉ phát sinh từ thời điểm thực sự làm việc; giữ kiểm tra quyền/Line, lịch, xung đột, thời điểm, nhật ký và khóa báo công chính tới hết 31/10.
- Trong SX báo công đang mở và có quyền thao tác: cảnh báo đỏ giữa màn hình khi có nhân viên được xác định đủ lịch/có mặt nhưng chưa được phân công liên tục quá 10 phút. Không tính giờ nghỉ/nghỉ trưa/giải lao/phụ kho/CV khác; không suy đoán khi thiếu roster hoặc phân công không xác định tên.
- Bấm Đã hiểu đóng cảnh báo; sau 5 phút nếu còn chờ thì nhắc lại. Bộ đếm theo nhân viên, khoảng chờ và tài khoản nhận cảnh báo lưu vào entity production_unassigned_reminder của app_records hiện hữu; không migration. Tải lại trang không xóa bộ đếm; nhiều tab cùng tài khoản không cộng trùng. Phân công hoặc không còn đủ điều kiện thì ngừng nhắc; khoảng chờ mới có bộ đếm mới.
- Kiểm tra cảnh báo mỗi 30 giây khi màn hình hoạt động; không gửi thông báo nền khi đóng website. Trì hoãn hộp cảnh báo trong lúc đang mở thao tác để không ngắt biểu mẫu. Trong thời gian khóa báo công chính, không hiện cảnh báo yêu cầu phân công.
- Kiểm thử: lifecycle/giờ công, ERP, sự cố, khóa báo công và workflow 73/73; kiểm thử cảnh báo và lưu bộ đếm 6/6. Giao diện kiểm tra trên trình duyệt local với dữ liệu giả; không ghi dữ liệu nghiệp vụ lên hai Site để thử.


## 28/10/2026 — Hủy thao tác công đoạn và sửa tải cảnh báo
- Điều chỉnh báo công → Sửa → chọn công đoạn → Hủy thao tác đã ghi sai: chọn Nhập trạm, Tạm ngưng, Tiếp tục, Xuất trạm (cả Bổ sung người/làm phát sinh); xem trước, lý do bắt buộc và xác nhận. Giữ sự kiện gốc dạng voided và nhật ký người hủy/thời gian.
- Hủy Xuất trạm loại báo công khỏi tổng hợp, phục hồi trạng thái trước thao tác; báo lại không cộng trùng giờ. Thao tác phụ thuộc phải xử lý từ sau về trước hoặc chọn cả nhóm trong cùng công đoạn.
- Chưa cho hủy trực tiếp dữ liệu ERP; không tự hủy nhóm chuyển người liên kết, sự cố hoặc phiếu kho đã gửi Sheet/được xử lý. Các tình huống này báo chặn cụ thể, không ghi dở dang. Giữ quyền Điều chỉnh báo công và giới hạn Line. Không nới khóa báo công web chính đến 31/10.
- Cảnh báo unassigned dùng workflow không tính giờ dẫn xuất. Bộ tính giờ tạo biên theo ngày thay cho quét từng phút; không đổi quy tắc giờ. Xử lý lỗi exceededCpu thấy ở log web thử v88; cần kiểm chứng lại log sau phát hành.
- Test cô lập lifecycle hủy 4 thao tác, nhóm phụ thuộc, kho, quyền, xung đột phiên bản, đồng thời, báo lại và lịch 31 ngày; không chạy hủy trên dữ liệu thật. Không thay DB/uploads/quyền/secrets/cấu hình hosting.

- Kiểm tra bản thử v89: workflow HTTP 200, CPU khoảng 3–4s; cảnh báo HTTP 200 nhưng còn CPU ~12s. Tối ưu tiếp: dựng lịch sử công đoạn một lần/Line trong mỗi lượt kiểm tra, bỏ lượt xét lịch sử khi hiện tại ngoài ca. Không đổi điều kiện 10 phút/nhắc lại 5 phút.


## 28/10/2026 — Sửa cảnh báo mất do lịch sử ẩn danh; giới hạn Làm việc phát sinh
- Đối chiếu dữ liệu thử v90: các công đoạn ERP cũ tạm ngưng không có danh sách người đã làm biến unknown chặn toàn bộ cảnh báo Line A/B. Bỏ chặn toàn Line: lịch sử không định danh không chứng minh một người cụ thể đã được phân công. Xét từng nhân viên theo roster, nghỉ/phụ kho/CV khác, điều chuyển và phân công theo tên.
- Giờ nghỉ tạm dừng cộng thời gian chờ, không xóa số phút đã chờ. Không hiện cảnh báo trong giờ nghỉ; khi vào ca, người đã chờ quá 10 phút được nhắc lại. Phân công trong giờ nghỉ vẫn kết thúc lượt chờ. Giữ lịch sử số lần nhắc, Đã hiểu hoãn 5 phút, không thay dữ liệu báo công.
- Làm việc phát sinh chỉ được chọn nếu Line không có lịch HC/TC trong ngày thao tác. Có lịch thì ẩn lựa chọn trên bảng và chặn cả form/API, kể cả giờ nghỉ hoặc ngoài ca của ngày đó. Kiểm tra lại ngày khi đổi thời điểm. Không tự hủy dữ liệu làm phát sinh đã ghi trước.
- Kiểm thử: hồi quy ẩn danh, chờ qua nghỉ trưa, phân công trong nghỉ, nhắc lại, nghiệp vụ công đoạn; API chặn ngày có lịch và cho ngày không có lịch. Hai môi trường giữ cấu hình và dữ liệu riêng.

## 28/10/2026 — Hủy thao tác ngay tại dòng
- Bỏ khung hủy riêng phía trên; chọn Hủy thao tác tại từng Nhập trạm/Xuất trạm/Tạm ngưng/Tiếp tục/Bổ sung người. Dùng chung một lý do, nút cuối đổi thành Xem ảnh hưởng hủy rồi Xác nhận hủy. Không lưu lẫn điều chỉnh thời gian khi hủy.
- Thay lý do hoặc lựa chọn phải xem trước lại. Lỗi nghiệp vụ nêu rõ nguyên nhân; trùng phân công hiển thị tên nhân viên, LSX và công đoạn liên quan. Giữ chặn phụ thuộc/kho, quyền, chống ghi đè và nhật ký; không tự hủy dữ liệu sống để thử.
- SX báo công theo công đoạn lấy người theo roster/lịch thực tế tại ngày giờ chọn, bao gồm C→B; backend bỏ chặn Line gốc cho thao tác có lịch và vẫn kiểm tra đủ điều kiện. Tài khoản giới hạn Line nhận thêm tên người đã bố trí vào roster của Line, không thêm quyền hoặc tiết lộ hồ sơ riêng.


## 28/10/2026 — Hủy Xuất trạm và phân bổ lại nhân viên
- Hủy một lần Xuất trạm mở lựa chọn nhân viên ngay tại thao tác; lấy danh sách theo lịch/khung giờ thực tế, gồm nhân viên đang được phân công ở công đoạn khác và nhân viên mượn Line.
- Hai cách: vẫn làm liên tục từ giờ xuất nhầm; hoặc giữ giờ đã làm ở nơi khác và quay lại từ giờ chọn. Người không chọn rời công đoạn ở giờ xuất nhầm. Xem trước nêu rõ tên, LSX/công đoạn, mốc hiệu lực và phiếu bị hủy; một lý do chung. Đổi người/cách/giờ/lý do làm hết hiệu lực bản xem trước.
- API tạo kế hoạch hủy/điều chỉnh/khôi phục và lưu cùng audit trong một batch có kiểm tra phiên bản toàn bộ dữ liệu liên quan. Giữ nhân viên khác, lịch nghỉ/giải lao, giờ công trước mốc điều chỉnh. Kiểm tra trùng người trên các mốc lịch sử, không chỉ trạng thái cuối.
- Chặn nhân viên ngoài lịch/Line, báo công đã xác nhận, báo công phụ thuộc ở nơi nhận, phiếu kho đã xử lý/gửi Sheet, sự cố, dữ liệu ERP/phát sinh cần xử lý riêng, phân công lại và chuỗi nhiều công đoạn. Không tự hủy dây chuyền. Hủy nhiều thao tác cũ vẫn dùng luồng chọn các thao tác phụ thuộc, không áp dụng phân bổ lại đơn lần.
- Lỗi hủy hiển thị trong biểu mẫu; chỉ luồng cancel-stage không bật thêm hộp lỗi toàn cục, audit và các luồng khác giữ nguyên.
- Kiểm tra: TypeScript; kiểm thử API SQLite/Miniflare dữ liệu giả lập, quyền/phiên bản/cạnh tranh, bảo toàn người khác, giờ liên tục và quay lại (trừ giải lao), phụ thuộc/kho; kiểm thử React mounted gồm biểu mẫu thật, xem trước và đổi lựa chọn, picker VI/繁體中文/EN.
- Kiểm thử mở rộng action-feedback-production và client-session-boundary có 12 lỗi có sẵn: tái hiện đúng trên source gốc 22939e7 trước sửa (fixture audit và kỳ vọng thông báo cũ). Không đánh dấu đã sửa các lỗi đó.
- Preview trình duyệt nội bộ: route terminal.local bị ERR_BLOCKED_BY_CLIENT, chưa nghiệm thu hình ảnh desktop/mobile tại local. Không tạo dữ liệu/hủy thử trên hai Site. Giữ project, DB/FILES, tài khoản/quyền, khóa kho Google Sheet, khóa ERP web chính và hạn thử riêng. Triển khai được xác minh riêng qua version/commit/deployment; mục này ghi trạng thái mã và kiểm thử.

## 28/10/2026 — Promote approved TEST v94 corrections to LIVE
- User explicitly approved LIVE promotion after TEST v94. Applies only the correction/cancellation, bounded D1 reads/SQLite comparison, inline overlap handling, optional reason and clock picker changes from TEST commit 1c213e2c2634eaa922b42c5555ebd60aa75a980d.
- Preserve LIVE Site/DB/FILES, identity, permissions, Google Sheet secrets and ERP hold; no TEST config or business data copied. GitHub PR #3 remains untouched.
- TEST validation: 17 focused tests, TypeScript/build passed; clock picker selected hour/minute, Done and manual input verified in browser fixture. Authenticated deployed end-to-end write testing not performed.
- D1 comparison copies use short-lived _onspa_correction_compare rows, with exact payload checks and cleanup; no original history removed. Unconfirmed receiving reports recalculate hours without changing output; locked/foreign-scope/ERP dependencies remain guarded.

## 28/10/2026 — Staff picker borders and immediate reminder acknowledgement
- Production staff picker separates each employee with a bordered row and displays assignment notes on their own line; selection, roster and transfer checks unchanged.
- Acknowledge hides the dialog immediately, queues server acknowledgement even while polling/show is in progress, and ignores stale read responses. Failed acknowledgement restores the warning with retry guidance. Existing server 10-minute eligibility, persisted five-minute snooze and count rules unchanged.
- Synthetic UI regression covers pending read and slow/failed acknowledgement; no real report/cancellation is submitted for testing.

## 28/10/2026 — Production staff picker columns
- Staff selector uses bordered columns: selection, employee name/code, current stage, current order, and Working/Awaiting assignment status. Assignment data is passed as fields, not parsed from display notes.
- Select-all and disabled/selected employee handling remain unchanged. Other uses of the shared picker retain their original layout. Popup scrolls horizontally on narrow screens and does not widen the report table. No database or reporting mutation changes.

### SX báo công: xem nhanh Phân công (28/10/2026)
- Nút Phân công cạnh Tra cứu mở bảng chỉ đọc: Nhân viên, Line, Lệnh, Công đoạn, Trạng thái. Giữ phân công chưa kết thúc từ hôm trước; người chưa có phân công hiển thị Chờ phân bổ. Có lọc Line/trạng thái và cập nhật dữ liệu; dùng quyền và dữ liệu workflow hiện hành, không tạo báo công.
- Kiểm helper với dữ liệu giả: chuyển line theo thời điểm, công đoạn tạm ngưng, phân công qua ngày, hủy/future, giới hạn line và phát hiện nhiều phân công.

- 28/10: Thu gọn Phân công với 5 cột cố định vừa khung, ghi đè min-width của bảng báo công. Khóa lọc theo rights.line từ máy chủ (fallback sessionLine), không hiện Tất cả Line/line khác cho tài khoản Line; giữ phạm vi orders/events ở backend hiện hành.

- 28/10: Nhật ký giờ công/nhân lực gom sự kiện chuyển người tự sinh đã đối chiếu vào Chi tiết thao tác chính. Chi tiết ghi nhân viên, LSX/công đoạn nguồn → đích, thời điểm. Liên kết bằng cùng lần ghi nhận, thời điểm hiệu lực, người thao tác, Line, trạng thái hủy và phần nhân viên thay đổi; không ghép theo giờ đơn thuần. Dữ liệu không đủ/không rõ vẫn giữ dòng lịch sử; không sửa sự kiện gốc, tính giờ hoặc chuyển Line của QLSX.

## 29/10/2026 — Tích hợp xác nhận QLSX theo ngày từ PR #3
- Lấy riêng UI/selection/CAS từ PR head 91a942004861528dc1dfd607a0b89521b4d4fd50 trên source LIVE v761 (9d65484324a340db64be10a3b1764038daad6d3d); không nhập auth/provider/dữ liệu TEST.
- Chọn phiếu chỉ ở client; lô giữ từng phiếu/ngày/công đoạn, lý do trễ và quyền backend. Snapshot bao gồm stageQuantity; chặn dữ liệu đổi, nhấp lặp; một lần làm mới sau lô, không tự gửi lại.
- Giữ nguyên chức năng v761 và ràng buộc riêng LIVE/TEST. Khung HC/TC/tổng nổi trong cột Nhân viên; tổng quan mặc định thu gọn.
- Typecheck và 12 test riêng đã đạt trên cả hai checkout. Kiểm hồi quy thêm roster/cảnh báo/hủy/chuyển người/phân công; fixture approval cũ cập nhật quyền nhập trạm, cố định đồng hồ tháng của fixture và loại nhật ký từ chối khỏi so sánh dữ liệu nghiệp vụ (không thay quyền runtime).
- Kiểm trình duyệt với component thật/dữ liệu tổng hợp: chọn không gọi lưu; dữ liệu đổi xóa chọn và yêu cầu kiểm lại; mở khung giờ giữ nguyên kích thước dòng/vị trí cuộn. Kiểm trực tiếp TEST sau deployment và giới hạn kiểm tra được ghi trong bàn giao cuộc trò chuyện.
- Không xác nhận/hủy/sửa phiếu thật để kiểm thử. Không chạy seed/migration hoặc thay DB/FILES/account/Sheet secrets. Trạng thái triển khai và provenance chính xác xem kết quả Sites trong bàn giao.

## 29/10/2026 — Xuất từng phần và người làm tiếp
- Nhập trạm bỏ trống số lượng nhận toàn bộ phần còn lại của công đoạn; số lượng nhận riêng được kiểm giới hạn. Lưu admittedQuantity trong snapshot thao tác, không migration hoặc sửa dữ liệu cũ.
- Xuất một phần giữ running và nhân viên; chọn đổi người ngay trong khung xuất, giữ lịch/Line, xác nhận chuyển khỏi lệnh khác, kiểm phiên bản bên cho và bên nhận. Bỏ hết người làm tiếp thì paused. Xuất hết phần nhận giải phóng người; chưa nhận hết lệnh cho nhập phần còn lại.
- Bản cũ partial thiếu admittedQuantity không tự đổi dữ liệu/phân công; có thể Tiếp tục với người thực tế, không cần nhập trạm lại. Giờ từng phiếu tính theo timeline, trừ nghỉ/giải lao; intermediate không tạo thành phẩm. Giữ khóa ERP web chính đến hết 31/10 và hạn TEST.
- Kiểm: 4 DB integration mới (2000/1000/1000 A/B, giờ giải lao, nhận một phần, giữ người/tạm ngưng, chuyển người/xung đột/idempotency); suite liên quan 60 ca, 2 kỳ vọng test cũ đã cập nhật đúng semantics mới và rerun 16/16. Typecheck đạt.
- Browser QA cô lập dùng component thật/CSS build: chọn B từ PACKING cần xác nhận, xuất 1000 giữ running và có thể xuất tiếp1000, picker 360px nằm trong dialog344px, cuộn danh sách riêng; không có API/dữ liệu thật.
- QLSX: người dùng chấp nhận TEST và chuyển kết quả PCB QA chỉ đọc Chrome Admin v100 (209d625aa73cd1162f1e47017aa3a6ae2053758f): 360/390/767/1187/1440px, chọn0/khóa nút, thu gọn, HC/TC/tổng, Esc, không xô bảng. Đây là bằng chứng PCB, không phải lượt browser Website tự chạy. Website connector vẫn HTTP401; chưa kiểm tài khoản QLSX riêng hoặc benchmark dữ liệu thật. Không xác nhận phiếu thật.


## 29/10/2026 — Nhật ký nhân lực theo công đoạn
- Sửa projection chỉ đọc: đọc stageBefore/stageAfter, cả người rời và người tiếp tục; vị trí hiện tại theo projectLiveStages, fallback legacy khi chưa có mốc công đoạn. Lịch sử cũ có báo cáo/nguồn xác minh và tên cụ thể được dựng chỉ đọc; không suy tên từ số người.
- Chuyển người đã liên kết hiển thị trong thao tác nhận, bản ghi thiếu liên kết giữ riêng. Hủy/thay thế không đổi vị trí hiện tại. Tách chuyển Line QLSX khỏi phân công công đoạn.
- Xem lịch sử nhân viên mở portal ngay, có ngày từ/đến, Esc/bấm ngoài, focus trap/return, công đoạn nguồn/đích. Không ghi API/DB khi tra cứu.
- Kiểm: 25/25 ca gồm legacy/stage journal, DOM modal/date/Esc/zero-network, transfer detail, assignment overview, QLSX selection; typecheck LIVE đạt. Browser component thật + dữ liệu giả desktop và iframe360px: modal trong viewport, bảng cuộn riêng. Chưa kiểm phiên QLSX thật/đối chiếu từng bản ghi DB trên web. Không thay DB/uploads/accounts/permissions/Sheet keys.

## 29/10/2026 — TEST: nhập trạm bù, nhật ký đúng người, bổ sung sau nhập
- Nhập trạm > Nhập trạm bù: QLSX/Admin kiểm lịch và phân công theo khoảng thực tế, chọn người, xem ảnh hưởng; tùy chọn xuất cùng lúc với số lượng. Chọn/preview không ghi bản ghi nghiệp vụ. Áp dụng CAS toàn scope, chặn nhấp lặp, không tự gửi lại khi kết quả không chắc chắn.
- Khoảng đóng tách phần giao ở công đoạn khác và khôi phục phân công tại cuối khoảng; không đổi phân công hiện tại. Khoảng mở để công đoạn chạy tiếp và chuyển người hiện tại theo xác nhận. Báo công trừ lịch nghỉ/giải lao; phiếu mới và phiếu bị ảnh hưởng chờ kiểm tra. Phiếu khóa/đã xác nhận hoặc kho đã xử lý chặn và nêu rõ phiếu.
- Chỉ bổ sung khi running/paused; waiting/partial đã xuất hết phần nhập/done bị chặn ở giao diện và API. Người giữ nguyên trong snapshot add/transfer không phát sinh dòng nhật ký nhân lực riêng; không xóa dữ liệu cũ.
- Giới hạn bản thử: khoảng tối đa 31 ngày, cần đủ lịch đã duyệt; chặn dữ liệu lịch sử không xác định công đoạn, chuyển khác Line, thao tác có sẵn bên trong khoảng đích. Chưa hỗ trợ sửa/hủy riêng mốc của lô backfill (chặn để không bỏ sót liên kết). Không tự xử lý báo công đã xác nhận hoặc kho.
- Kiểm thử bằng DB tạm và nhân viên giả: đóng/mở khoảng, nghỉ qua đêm, cập nhật giờ donor, giữ phân công hiện tại, stale revision, replay, khóa phiếu, chặn add trước nhập và trùng người; DOM chọn không ghi, consent, double-click. Không chạy ghi trên DB hosted. QA trình duyệt dùng component thật với API fixture; không thay thế kiểm phiên QLSX trên hosted.

- TEST 29/10: nút Đổi nhân viên làm tiếp có nền xanh nhạt, viền, chữ đậm, hover/focus rõ; khóa lúc đang lưu. Chỉ đổi cách trình bày, giữ nguyên xử lý bàn giao.
- Mục Nhập trạm bù có khung nền vàng nhạt, viền và tiêu đề đậm; bấm cả nhãn để chọn, chuyển nền xanh khi bật. Không tự bật chế độ bù.
- Nhập/xuất bù mặc định số còn lại theo từng công đoạn, không dùng toàn bộ SL lệnh; kiểm tra lấy lại remainingQuantity từ máy chủ và giới hạn ô nhập tương ứng.

## TEST 29/10/2026 — nhập bù: hiệu năng, quyền Line, phản hồi lỗi
- Cho tài khoản có quyền ghi Báo công sản xuất và phạm vi Line nhập bù trong chính Line đó; giữ kiểm tra phía máy chủ, không cấp quyền xem/ghi Line khác hoặc cho tài khoản chỉ xem. Không thay bản ghi tài khoản/quyền.
- Kiểm nhân viên không tạo bảng snapshot/ghi transport; preview/apply vẫn so sánh snapshot đầy đủ chống xung đột. Đọc workflow không tính lại toàn bộ giờ lịch sử; chỉ tính phiếu bị tác động. Idempotency nhập bù chỉ tra khi apply, trả đúng một event, không tải toàn bộ event cho bước inspect.
- Chuẩn bị timeline một lần; hạn chế các lệnh chiếu lại theo mốc; gom phân công theo nhân viên một lần mỗi mốc thay vì quét tất cả lệnh/sự kiện cho từng người. Mẫu giả 150 lệnh/40 người/320 sự kiện: 2179 ms -> 89 ms, cùng candidate JSON. Đây là CPU trong môi trường kiểm, chưa phải benchmark hosted/network.
- Phản hồi HTML lỗi không còn lộ Unexpected token; inspect báo chưa ghi dữ liệu, apply báo kết quả chưa xác định và chặn tự gửi lại. Log Sites truy vấn lúc xử lý không có sự kiện, chưa xác định nguyên nhân nền tảng trả HTML.
- Kiểm thử DB tạm bao gồm quyền Line, chặn Line khác/viewer; DOM bao gồm HTML 502, chọn không ghi và nhấp lặp. Không thử lưu trên dữ liệu hosted.

### 2026-10-29 — TEST production menu background loading
- Prefetch the production screen module and permission-scoped work snapshot after authenticated workspace initialization. Keep mounted menu state and display existing data during background refresh.
- Separate work/full caches; work omits derived historical hours for the initial board, then adopts the full snapshot in the background. Confirmation continues to read full data. Session invalidation and authentication failures clear both caches.
- Group events once per render and memoize per-order active crew calculations. Deduplicate paginated event/report/history reads within one server request; no cross-user server cache.
- Validation: 28 focused cache/lifecycle/render/read-performance tests pass; TypeScript passes. Fixtures are synthetic. Hosted latency and signed-in browser behavior for this revision have not been measured; no real production operations were submitted. LIVE unchanged.

### 2026-10-29 — TEST missing admission after legacy staff addition
- Detect explicit legacy Add into waiting/fully-exited partial stage. Backfill can establish the missing admission using its existing crew, with no donor-transfer confirmation for that same stage. Preserve the original Add and link the new admission by repairsAllocationEventId. Genuine admissions/report overlaps remain blocked.
- Closed repair reports only remaining quantity, releases the repaired crew at exit, preserves later assignments and keeps CAS/Line/locked-report guards. Target actions inside the window still require resolving the exact boundary; no blind overwrite. Open repair leaves the stage running without fabricating a report.
- Auto-inspect after editing time and auto-preview after choosing staff; abort/discard obsolete responses. Inputs remain editable during reads. One final write button, explicitly confirming donor transfers when needed; no automatic write/retry.
- Exit dialog shows partially completed/paused orphan stages with the appropriate next action rather than silently omitting them. Remaining output is not labeled proof of missing admission.
- Same-instant stage ordering compares recorded timestamps as instants, including mixed UTC/GMT+7 strings.
- Validation: 23 synthetic backfill/partial exit/stage/history tests pass, TypeScript passes. Component fixture checked on desktop and 360px; live browser read was blocked by connector HTTP401, so the actual Viet order/history and hosted latency remain unverified. No real business data written; LIVE unchanged.

### 2026-10-29 — TEST direct backfill save and orphan carry repair
- Backfill now saves directly after staff selection; no preview request or preview wait. The server recalculates and validates once inside the snapshot/CAS write workflow. Exact donor assignment intervals must match the list the operator confirms; changed allocation rejects without business writes. Replay protection includes direct saves; uncertain saves are never automatically resent.
- Closed legacy-admission repairs remove only unchanged orphan crew carried in later no-op Add/outgoing Transfer snapshots, retaining audit before/after. Genuine new assignments, restarts, extra work and other protected dependencies remain intact and report person/stage/time explicitly. Later assignments on other orders remain untouched.
- Verification: 17 backfill/partial exit tests plus one targeted orphan-carry guard test pass; TypeScript passes. UI fixture checked for direct save on 360px. Actual Viet history and hosted elapsed time remain unverified; no real business records submitted, LIVE unchanged.

### 2026-10-29 — TEST exact exit/handoff boundary
- A repaired orphan admission may exit at the same timestamp as an existing outgoing transfer, when that transfer only removes the old crew. A real new assignment at that boundary remains protected.
- Verified synthetic timeline: old Add into PHAO 13:59, backfill from 14:00, later Add into ASSY 08:40 next day. Exits at both 08:30 and 08:40 preserve the ASSY event bytes, finish only remaining PHAO quantity and leave no PHAO crew after exit. 16 backfill tests and TypeScript pass; two exact-boundary tests rerun with ASSY fixture. No production data writes; actual hosted order still not directly inspected.
- Follow-up from screenshots: 08:39 is a duplicate Add within/on the requested exit window. Repair now carries the established admission through unchanged Add snapshots inside the window, preserving original events in the audit. Genuine crew changes inside the window remain blocked. Tested exits 08:30, 08:39 and 08:40 with a duplicate at 08:39 and ASSY handoff at 08:40, including break-adjusted hours and unchanged ASSY records.

### 2026-10-29 — TEST mutation read performance and stable modal background
- Stage actions skip recalculation of unrelated historical report/journal hours during validation and response sanitization. The submitted completion still calculates its own exact hours before commit. Idempotency lookup reads the matching event directly instead of transferring the whole event entity.
- Backfill and stage-action workflow reads share identical event/report/history pagination pages within each read phase only. Fresh wrappers are used after writes; no cache spans transactions, users or requests. Synthetic workflow read count: 29 -> 20 DB calls; hosted operation latency has not been benchmarked.
- While a reporting/incident/action modal is open, workspace data refresh requests are held and merged. In-flight results/full enrichment cannot replace the visible board; close triggers one pending refresh. Authentication failures still clear private data immediately. The background status line reserves stable height.
- Checks: 28 API/read/backfill/stage tests, 22 reader/render tests and TypeScript pass. Actual component fixture: board top 62.1875px / height 117px unchanged after simulated duplicate background updates and typing 1000 -> 900 in the modal. No real business writes; LIVE unchanged.


## LIVE integration of TEST v103–v110 — 2026-10-29

Integrated the focused TEST a63fb6e..b035f456 changes onto LIVE v764 (606556199a922fc6987d72ac8d41577c437668ad). Preserved LIVE reporting hold, cancel-reporting-day controls, menu naming, production SKU transfer behavior, hosting bindings, authentication and Sheet integration. Adds guarded historical backfill and legacy allocation repair, Line-scoped access, lightweight cached reads and stable background layout while reporting dialogs are open. No production business records are used for write tests. Individual backfill marker correction/cancellation remains explicitly unsupported.


## 29/10/2026 — Chuyển Line và phân công
- Phân công hiển thị dòng nguồn Đang chuyển Line kèm khoảng giờ, dòng nhận Đang chờ phân bổ/Đang làm; đếm nhân viên duy nhất và giữ giới hạn Line.
- Chuyển Line giải phóng phân công công đoạn nguồn từ mốc hiệu lực. Hết khoảng mượn về chờ phân bổ, không tự tiếp tục công đoạn cũ. Phân công tại Line nhận gắn lượt mượn và kết thúc theo lượt đó.
- Backend chặn phân bổ ở Line nguồn trong khoảng chuyển; nhận người hợp lệ không sửa/xóa lịch sử phân công nguồn. Giữ kiểm phiên bản, quyền và xung đột cùng Line.
- Cảnh báo dùng cùng quy tắc >10 phút làm việc, xác nhận ẩn ngay/nhắc 5 phút; tính từ lúc đến hoặc quay về, không từ lúc mở màn hình.
- Kiểm bằng DB local dữ liệu giả và component UI thực với fixture độc lập. Không tạo dữ liệu giả trên Site. Trạng thái triển khai được đối chiếu qua Sites, không suy từ tài liệu này.

## 29/10/2026 — Chuyển Line tiếp và vệ sinh thực tế
- Lớp kiểm phân bổ hỗ trợ chuyển tiếp có giới hạn từ Line đang mượn sang Line nhận; phân công tại đích dùng chuỗi chuyển thực tế, giữ kiểm xung đột, thời hạn và khóa đồng thời. Không sửa lượt phân bổ kế hoạch gốc.
- Lịch thực tế cho thêm/xóa nhóm vệ sinh và chỉnh giờ/số người trên mọi ngày làm việc, kể cả thứ Bảy chưa có vệ sinh dự kiến. Giữ quyền, lý do cập nhật lịch, lịch sử và kiểm phiên bản hiện hành.
- Kiểm thử bằng DB giả: chuyển tiếp/nhập trạm/chặn trùng; lưu, sửa, xóa vệ sinh thứ Bảy và giữ lịch dự kiến. Không dùng dữ liệu thật để kiểm thử.

- Điều chỉnh giao diện vệ sinh theo phản hồi 29/10: giữ khung vệ sinh ban đầu, đổi tiêu đề ngày thành ô chọn ngày. Đổi ngày chuyển toàn bộ nhóm bên dưới, giữ số người/giờ và các nhóm sẵn có ở ngày nhận. Không hiển thị khung ngày trống hoặc nút Thêm/Xóa lặp lại. Giữ lưu lịch/kiểm phiên bản/lịch sử hiện hành.

## 29/10/2026 — Lịch SX thực tế tải nền
- Lịch dùng snapshot nhẹ `view=work`, không tính lại giờ từng báo công khi đọc; vẫn giữ đầy đủ lịch, nhân viên, sự kiện và quyền. Không tải bổ sung bản full ở menu lịch.
- Đã có dữ liệu thì làm mới yên lặng, giữ bảng; lỗi tải vẫn hiển thị kèm Thử lại. Lần đầu chưa có dữ liệu vẫn báo tải, không giả báo lịch trống.
- Bản lịch đang chỉnh giữ nguyên ngày/giờ và phiên bản gốc khi dữ liệu nền đổi. Đổi tuần/Line tải đúng ngữ cảnh; lưu vẫn chịu kiểm xung đột backend.
- Memo danh sách người chuyển Line; bỏ tính trạng thái công đoạn báo công trong menu lịch.
- Kiểm thử dữ liệu giả và render/mounted; chưa đo thời gian trên DB production, không ghi dữ liệu thật để test.

## 30/10/2026 — Giảm thời gian xác nhận báo công
- API review dùng reviewReportId nội bộ: chỉ tính lại metadata/giờ cho phiếu đang xác nhận; bỏ tính giờ lũy kế nhật ký và phạm vi ảnh hưởng của các lệnh không phục vụ xác nhận.
- Vẫn đọc đầy đủ lịch/nhân lực/sự kiện liên quan; giữ nguyên kiểm quyền, snapshot/phiên bản, con trỏ xung đột, lý do trễ, batch ghi lịch sử và phiếu kho. Không chạy song song các phiếu tranh chấp con trỏ.
- Kiểm đối chiếu phiếu đích giữa luồng đầy đủ và luồng tối ưu bằng dữ liệu giả. Không xác nhận phiếu thật, chưa có benchmark production.

## 30/10/2026 — Khóa nhập nhưng cho xác nhận báo công
- Trong thời gian khóa nhập ERP, cho phép API production-report action=review với approve=true; vẫn kiểm quyền QLSX, phiên bản, giờ, lý do trễ và xung đột hiện hành.
- Giao diện xác nhận không bị chặn bởi reportingHold. Nhập báo công/stageEntries vẫn bị khóa tới 00:00 GMT+7 ngày 01/11/2026; không mở các thao tác khác trên API production-report.

## 30/10/2026 — Giảm tính và đọc lặp khi xác nhận
- Tái sử dụng kết quả reportCalculation cho metadata và giờ của cùng phiếu, thay vì tính hai lần đối với công đoạn/ERP.
- Luồng review dùng workflowReadSnapshot trong riêng một request để dùng chung các trang production_event/report/history giữa In Transit và workflow. Không cache qua request hoặc qua lần ghi.
- Giữ toàn bộ kiểm tra snapshot, version, cursor và quyền; không coi dấu Đã kiểm tra ở client là quyền bỏ kiểm xung đột.


## 30/10/2026 — nhận Chờ phân bổ theo lịch thực tế đã lưu
- Khi Line nhận đã có production_schedule, nhận phân bổ kiểm ngày/giờ theo lịch SX thực tế và tham chiếu KHSX hiện hành, ghi điều chuyển Line có giới hạn thời gian; không mở khóa hoặc sửa Capacity dự kiến. Không tự nhập trạm.
- Chưa có lịch thực tế: giữ luồng phân bổ kế hoạch hiện có. Thiếu lịch/ngoài giờ/nhân viên có xung đột: chặn toàn bộ lô, nêu Line/ngày.
- Giữ snapshot CAS, quyền QLSX/Admin, chống gửi trùng; nhật ký phân biệt phân bổ thực tế/kế hoạch. Luồng hủy/sửa phân bổ kế hoạch không dùng để hủy một điều chuyển đã ghi thực tế.
- Kiểm thử cô lập: ngày dự kiến nghỉ nhưng thực tế làm, hai người nhận cùng lô, không đổi Capacity, hiện diện Line đích và hết hạn, gửi trùng, ngoài giờ, race và rollback khi ghi thất bại. Không dùng dữ liệu thật để test.


## 2026-10-30 — Giới hạn xuất FINAL
- Backend xuất trạm và nhập bù có xuất trạm chặn FINAL lũy kế vượt sản lượng đã xuất của bất kỳ công đoạn trước FINAL trong quy trình SKU, tại thời điểm xuất. Tính cả phiếu Chờ kiểm tra; loại phiếu hủy, vô hiệu, trả điều chỉnh và phiếu tương lai. Cùng lô xuất được tính nguyên tử.
- Thông báo công đoạn thiếu, số đã xuất và số FINAL được phép xuất thêm. Không sửa phiếu lịch sử.
- Kiểm thử mục tiêu: 7/7 đạt, gồm API ghi thực tế trên DB tạm, từ chối không ghi phiếu và xuất một phần hợp lệ; nhánh nhập bù bị chặn. Chưa nghiệm thu tương tác UI bằng thao tác ghi trên dữ liệu sống.


## 30/10/2026 — Chuyển phân công liên kết Line
- Gói chuyển chọn lọc mang theo lịch chuyển Line được tham chiếu, cùng lịch sửa/hủy và liên kết cha. Giữ ID để phân công và tính giờ dùng đúng lịch.
- Không ghi đè bản đích thay đổi; chặn trùng người/giờ. Lưu bản sao và đối chiếu sau ghi trong giao dịch hiện có. Không thay lịch kế hoạch, tài khoản hoặc cấu hình.
- Kiểm thử SQLite: xuất đúng phạm vi, giữ thời gian/ID, chống lặp và chặn lịch chồng; toàn bộ 6 kiểm thử chuyển chọn lọc đạt.

- Đối chiếu lệnh bằng LSX/SKU/Line/số lượng duy nhất khi ID giữa hai môi trường khác nhau; giữ Plan ID đích. Nối lịch chuyển Line có cùng giờ/người/hướng sang bản đích đã lưu, không tạo lịch trùng. 9 kiểm thử SQLite đạt, gồm lịch khác giờ và lệnh không duy nhất bị chặn.

- Đọc lại đúng các bản ghi vừa nhập thay vì tải thêm toàn bộ dữ liệu vào bộ nhớ. Giữ kiểm tra payload khớp tuyệt đối sau ghi và kiểm soát cập nhật đồng thời.


## Local cutover patch · 30/10/2026 17:00 GMT+7
- Reporting-entry hold now expires exactly at `2026-10-30T17:00:00+07:00`; the UI uses the same server-returned expiry and refreshes on expiry. Existing role/department permissions and QLSX approval exception are unchanged.
- Trial entry remains available for viewing beyond the previous 31/10 expiry. This patch does not transfer records, change configuration, or deploy itself.


## 30/10/2026 — Trạng thái lệnh đã nhập trạm, chưa xuất sản lượng
- SX báo công dùng trạng thái vận hành khi đã có nhật ký nhập trạm; không lấy nhãn Chưa SX còn lưu ở kế hoạch để che trạng thái đang chạy/tạm ngưng. Giữ dữ liệu, Plan ID và phân công.
- Kiểm thử hồi quy lệnh 2903 có ASSY chạy 6 người, CUT tạm ngưng; toàn bộ tạm ngưng; chưa nhập trạm.

- Bổ sung: sửa cả badge tại ProductionWorkBoard; kiểm thử trực tiếp biểu thức hiển thị bảng, không chỉ bộ lọc danh sách.

## 31/10/2026 — Tối ưu SX báo công, Lịch SX thực tế, Tiến độ SX
- Cập nhật nền không chèn dòng trạng thái/khoảng trống vào giao diện; giữ thông báo lỗi và nút thử lại. Không trình bày lỗi tải lần đầu thành dữ liệu rỗng.
- Nạp trước song song dữ liệu work/full theo quyền từ phiên đăng nhập; làm mới khi trang hiện, chu kỳ 45 giây và khi lấy lại focus. Dùng chung full snapshot còn hạn cho work/schedule, vô hiệu khi có ghi dữ liệu/đổi phiên. Không cache chéo tài khoản.
- Tiến độ SX giữ instance khi chuyển tab, không xóa bộ lọc/chi tiết. Bảng work/progress lập chỉ mục báo công/nhật ký theo lệnh, dùng lại tổng hợp; trạng thái thực tế vẫn quyết định khi đã nhập trạm.
- Lịch thực tế dùng lại kết quả nhân sự hợp lệ; chỉ tính ứng viên chuyển Line khi mở đúng thao tác. Không đổi kiểm tra lưu, quyền, giờ công, ERP hoặc dữ liệu.
- Kiểm tra: typecheck đạt; 31 kiểm tra cache/render/index/trạng thái và 9 kiểm tra mounted lịch thực tế đạt; thêm kiểm tra full→work reuse. Đo synthetic 600 lệnh/6.000 phiếu/6.000 sự kiện: 155,7ms→18,7ms cho tính tổng hợp (không phải độ trễ mạng).
- Bộ kiểm tra attendance-controls có 4 kỳ vọng cũ lỗi giống baseline khi sửa shim useMemo của fixture; không tuyên bố đã sửa các kỳ vọng nghiệp vụ này.

## 31/10/2026 — Tối ưu xác nhận báo công
- Dùng chung các trang dữ liệu báo công/nhật ký trong một yêu cầu xác nhận; đọc song song các nguồn độc lập. Không cache dữ liệu xác nhận giữa các yêu cầu/người dùng.
- Nhánh reviewReportId giữ tính giờ, cảnh báo, lệnh và báo công; bỏ dựng các danh sách hiển thị nhân sự, lịch, nhật ký không dùng cho xác nhận.
- Giữ nguyên cursor/payload/version/expectedReview, quyền, kiểm tra sản lượng, audit và phiếu kho. Các phiếu vẫn xác nhận tuần tự và đọc lại sau khi hoàn tất; không tự duyệt phiếu thực để thử.
- MAIN: 13 kiểm thử tích hợp API/giờ/công đoạn/lịch sử qua; kiểm thử snapshot đầy đủ và nhánh xác nhận khớp nhau, các trang dữ liệu dùng chung chỉ đọc một lần. Chưa đo thời gian xác nhận thực tế trên dữ liệu production.

## 31/10/2026 — Phân công nhân viên cập nhật nền yên lặng (MAIN)
- Bỏ dòng trạng thái tải có điều kiện phía trên bảng và chữ tải thay thế dòng rỗng trong khung phân công. Giữ nguyên bảng, bộ lọc và DOM vùng cuộn trong lúc refresh; lỗi tải vẫn hiển thị rõ. Nút cập nhật chỉ khóa trong khi đang tải. Không đổi dữ liệu phân công.
- Chỉ triển khai MAIN theo yêu cầu mới; không cập nhật web thử.

## 31/10/2026 — Ô giờ Lịch làm việc dự kiến (MAIN)
- Nới khung giờ lên 82px, giữ ô HH:mm 52px không co lại, cách biểu tượng 4px; nới cột tương ứng để hai giờ cùng hàng. Áp dụng cả lịch khóa; không đổi giá trị hay quyền sửa.

## 31/10/2026 — Lưu công đoạn và bổ sung liên tiếp (MAIN)
- ProductionStageTrial dùng productionApiFetch để vô hiệu cache khi lưu thành công và bảo vệ phản hồi theo phiên đăng nhập. Trước đây fetch trực tiếp không thông báo thay đổi, nên cache full có thể ghi đè phân công mới bằng bản cũ.
- API trả đầy đủ sự kiện đã commit, kể cả công đoạn nguồn khi chuyển người. Quick Line lọc các sự kiện/báo công trả về qua cùng phép chiếu quyền hiện hữu. Giao diện ghép dữ liệu đã lưu ngay, loại phản hồi cũ, sau đó tải nền đối chiếu. Không bỏ kiểm tra expectedStages, xung đột hay idempotency.
- Dùng chung đọc capacity/production_schedule trong một yêu cầu; đọc workflow và lịch song song thay vì đọc lịch lặp nối tiếp.
- Typecheck qua; kiểm thử nhận dữ liệu khi khung đang mở, phản hồi cũ, bổ sung liên tiếp không GET trung gian, giờ công và đọc request-scoped qua. Bộ 28 test có 26 qua; 2 assertion line-auth cũ không khớp audit từ chối hiện hữu và thứ tự props JSX, không đổi quyền để vượt qua. Chưa đo thời gian lưu phiếu thật trên production.

## 31/10/2026 — Giảm lượt DB trong luồng báo công (MAIN)
- Log thực tế sau v787: POST production-workflow 25.813 giây; GET workflow khoảng 13–18 giây, có mẫu 119 lượt DB. Không quy lỗi này thành lỗi 500 của web.
- readRecordPages lấy metadata tối đa 1000 khóa, tái sử dụng phần khóa chưa đọc, giữ payload page 512 KiB và ngoại lệ một bản ghi lớn như trước. Không cache dữ liệu giữa các yêu cầu.
- Workflow bỏ đọc in_transit_audit chỉ dùng cho lịch sử của menu In Transit; giữ đầy đủ dữ liệu lệnh, trạng thái, giờ, leadtime và revision. Menu In Transit vẫn đọc lịch sử bình thường.
- POST báo công/xác nhận/điều chỉnh có Server-Timing và log slow write không chứa payload/nhân sự. Giữ nguyên audit, quyền và commit.
- Bộ 1500 dòng: 6 DB calls thay vì 31; đối chiếu đủ dữ liệu và giới hạn byte. Kiểm thử API, cập nhật đồng thời, xuất trạm, giờ và bổ sung liên tiếp qua. Chưa có phép đo POST thật sau triển khai.

## 31/10/2026 — Tiếp tục đo thời gian lưu MAIN
- Sau v788, log GET giảm 119 xuống 61 DB calls nhưng vẫn 15–17 giây: chưa coi là đạt tối ưu.
- Từ cùng một cửa sổ khóa, đọc song song tối đa 3 trang payload 512 KiB, giữ thứ tự kết quả, bỏ lượt hỏi metadata rỗng khi cửa sổ đã hết. Không cache liên yêu cầu hay bỏ kiểm tra phiên bản khi ghi.
- Bổ sung số lượt/thời gian theo danh mục DB cố định trong log đo chậm; không ghi SQL, tham số, mã lệnh hoặc thông tin nhân viên.
- 1500 bản ghi giữ đầy đủ và đúng thứ tự với 5 DB calls (ban đầu 31); kiểm thử luồng công đoạn/bổ sung liên tiếp/giờ công, quyền đọc và thu hồi phiên qua. Thời gian production cần đo lại sau triển khai; không tạo phiếu thật để thử.

## 31/10/2026 — Tách đường lưu công đoạn khỏi đọc lịch sử nặng (MAIN)
- Log v789: GET có mẫu 4.65–6.21 giây nhưng vẫn có mẫu 11–16 giây; 51 DB calls, trong đó production_report 15 và production_history_import 14. Không coi giảm số calls là bằng chứng đã hết chậm.
- Chỉ khi kiểm tra mutation stageEntries, SQL bỏ bản sao sourceSnapshot/overlapWarnings/laborNotes/history trong báo công và các báo công nằm trong batch nhập ERP. Giữ đầy đủ thời gian, phân công, giờ, sản lượng, mốc tạm ngưng, sourceRow, importedStageTimeline và phạm vi ERP. Đọc màn hình/nhật ký/xác nhận vẫn giữ đầy đủ trường; không sửa dữ liệu lưu.
- Quick Line nhận chính các events/reports vừa commit trong cùng Line, kèm tên nhân viên, không chạy lại readProductionWorkflow sau commit. Nhánh backfill/replay và các thao tác khác vẫn dùng bộ lọc quyền trước đây.
- Kiểm thử Quick Line nhập trạm → bổ sung → xuất trạm không GET trung gian: phản hồi từng event/report khớp đọc lại, không SELECT sau commit, lệnh Line khác bị chặn. Fixture lịch sử nặng được chiếu nhẹ nhưng bản ghi gốc không đổi. Typecheck và kiểm thử hồi quy chạy trước đóng gói. Chưa có số đo POST thực tế của bản này; không tạo báo công giả trên MAIN.

## 31/10/2026 — Tổng giờ tuần chỉ tính lịch bắt đầu trong tuần (MAIN)
- Production Plan cộng các dòng hợp lệ thay vì ẩn toàn bộ tổng khi một dòng thiếu định mức/ngày/capacity. Hiển thị tổng tạm tính và giữ cảnh báo thiếu dữ liệu; dòng bị bỏ qua không chiếm khả dụng của dòng hợp lệ.
- Chỉ lịch có ngày bắt đầu từ thứ Hai đến Chủ nhật của tuần đang xem được cộng. Dùng ngày bắt đầu gốc của In Transit để tránh ngày hiển thị được đẩy về đầu tuần làm cộng sai. Lệnh tồn vẫn có trong danh sách xem chi tiết; không đổi lịch hoặc dữ liệu nghiệp vụ.
- 53 kiểm thử về tổng tuần, ngày biên, dòng thiếu, tồn In Transit, phân bổ ngày và xác nhận kế hoạch đã qua. Kiểm tra TypeScript/build thực hiện trước đóng gói; chưa đối chiếu số tổng thực tế qua màn hình production.

## 31/10/2026 — Sửa ngoại lệ lệnh tồn sau v791 (MAIN)
- Điều kiện ngày bắt đầu trong tuần chỉ áp dụng Pro Plan; In Transit còn dở có lịch giao với tuần vẫn cộng giờ còn lại, kể cả bắt đầu ở tuần trước. Giữ chống trùng Plan/LSX và tổng phần hợp lệ khi thiếu dữ liệu.
- Sửa Quy tắc mục 1–2, ngày cập nhật 31/10/2026 ở cả ba ngôn ngữ. Giờ tuần cũ là thành phần của giờ tồn, không cộng thêm lần nữa.
- 25 kiểm thử tổng tuần, tồn, chống trùng và phân bổ ngày qua; kiểm tra cả nhánh có ngân sách ngày và snapshot cũ. Không sửa bản ghi nghiệp vụ.

## 31/10/2026 — Capacity bắt buộc duyệt yêu cầu điều chỉnh, kể cả Admin
- Bỏ hủy xác nhận trực tiếp tại API; nút lịch chuyển sang Yêu cầu điều chỉnh. KHSX đồng ý mới tự mở lịch; từ chối giữ khóa và trạng thái trước yêu cầu. Bản mới phải xác nhận, đồng bộ và được duyệt lại.
- Trạng thái hiển thị Đồng ý điều chỉnh/Từ chối điều chỉnh; lịch sử giữ tài khoản/thời gian/phản hồi. Hướng dẫn ngay tại lịch áp dụng cả Admin.
- Tải tuần và kiểm tra khả dụng ngày dùng snapshot lần KHSX duyệt gần nhất khi bản mới đang chỉnh/chờ; hiển thị rõ đang dùng bản đã duyệt. Không sửa dữ liệu production.
- Kiểm thử mới toàn luồng Admin qua. Bộ capacity legacy còn lỗi fixture (thiếu ngày bắt đầu nhân viên, quy tắc xác nhận vệ sinh); không coi toàn bộ bộ cũ đã đạt. TypeScript/build kiểm tra trước triển khai.

## 31/10/2026 — Hủy xác nhận bản chưa đồng bộ (sửa v793)
- Lịch làm việc dự kiến giữ nút Hủy xác nhận, chỉ cho phiên bản Đã xác nhận / await-sync. Đã đồng bộ hoặc được KHSX duyệt bị chặn với mọi tài khoản, kể cả Admin. Yêu cầu điều chỉnh chỉ ở Tổng hợp Capacity cho bản đã được KHSX đồng ý.
- Bổ sung riêng quyền revoke Capacity cho tài khoản cnphuong và ntnphung bằng ID tài khoản do máy chủ xác thực; không cấp quyền duyệt KHSX hay đổi quyền khác. Giữ kiểm tra quyền xem và phạm vi Line hiện có.
- Áp dụng cả bản điều chỉnh xác nhận lại nhưng chưa đồng bộ. Giữ audit và snapshot đã duyệt khi trở về nháp; cập nhật hướng dẫn ba ngôn ngữ.
- Kiểm thử API hai tài khoản có quyền xem: hủy trước sync, chặn sau sync/duyệt, từ chối/đồng ý yêu cầu, hủy bản điều chỉnh trước sync đều qua; TypeScript qua. Không thao tác vào phiếu production để thử.

## 31/10/2026 — Pro Plan tính tuần theo ngày hoàn thành
- Theo yêu cầu mới: Pro Plan chỉ cộng lịch có ngày hoàn thành từ thứ Hai đến Chủ nhật của tuần đang xem; bắt đầu tuần trước vẫn tính. Hoàn thành ngoài tuần không cộng. Không đổi ngày đã lưu.
- Giữ ngoại lệ lệnh tồn In Transit và chống cộng trùng; giữ tổng các dòng hợp lệ khi dòng khác thiếu dữ liệu. Áp dụng cả nhánh ngân sách ngày và snapshot tổng hợp cũ. Cập nhật Quy tắc và chú thích trên giao diện.
- 25 kiểm thử tuần/lệnh tồn/phân bổ ngày qua, bổ sung kiểm thử biên thứ Hai/Chủ nhật, ngày hoàn thành trống, trước/sau tuần và hai nhánh tổng hợp. TypeScript/build kiểm tra trước phát hành.

## 31/10/2026 — Thứ tự SX trên SX báo công
- Thêm cột Thứ tự SX ngay trước SL lệnh, đọc trực tiếp sequence của lệnh In Transit đã có trong phản hồi workflow. Chưa có thứ tự hiển thị dấu —; không tự đánh số hoặc đổi thứ tự sắp xếp.
- Cập nhật số cột dòng chia tuần/dòng trống và thông tin thẻ trên màn hình nhỏ. Không ghi dữ liệu nghiệp vụ. TypeScript/build kiểm tra trước triển khai.

## 2026-10-31 — Điều chỉnh số lượng và thêm lần nhập/xuất
- Modal Điều chỉnh báo công theo công đoạn: số lượng sau nhân lực cho Nhập trạm/Xuất trạm, ngày giờ cho cả hai; thêm dòng tại từng nhóm thao tác; xóa dòng mới trước lưu; xem thay đổi rồi xác nhận lưu.
- Áp dụng nhật ký công đoạn native web, kể cả báo công đã xác nhận. ERP/Sheet hoặc công đoạn có nhập bù liên kết chưa hỗ trợ sửa số lượng/thêm dòng bằng nhánh này; giữ chức năng giờ/người hiện hữu.
- Server dựng lại trình tự, kiểm tổng nhập/xuất, nhân viên và trùng giờ; chia khoảng giờ giữa các lần xuất không cộng lặp. Phiếu ảnh hưởng trở về Chờ kiểm tra. Lưu nguyên tử có snapshot/revision guard, nhật ký trước/sau.
- Phiếu kho chưa gửi/chưa xử lý được lưu bản hủy với ID lịch sử, giải phóng khóa liên kết để xác nhận lại. Chặn phiếu đã có sheetSync, xác nhận kho hoặc nhận hàng. Không sửa dữ liệu nghiệp vụ thật trong quá trình triển khai.
- Kiểm thử: 14/14 hồi quy backend và danh sách; 4/4 kiểm thử điều chỉnh (gồm kho lịch sử) chạy lại đạt. Test hook hủy có assertion đạt nhưng tiến trình không thoát nên không tính là suite hoàn tất. Preview cục bộ tới màn đăng nhập; chưa nghiệm thu modal trên phiên Admin thực tế.

### 2026-10-31 — Sửa bộ nhớ khi xem điều chỉnh số lượng
- Log web chính v797: POST /api/production-correction exceededMemory, 49.099 giây.
- Không tính giờ dẫn xuất của toàn bộ báo công khi dựng preview; chỉ tính phiếu công đoạn bị ảnh hưởng. Không deep clone lịch sử/snapshot của lệnh không liên quan. Băm revision theo từng bản ghi rồi băm danh sách digest, giữ cơ chế kiểm tra thay đổi đồng thời.
- Kiểm tra trùng phân công trên các lệnh có chung nhân viên với công đoạn bị sửa; giữ đầy đủ timeline của các lệnh đó. Lỗi phản hồi HTML không còn lộ lỗi JSON, giữ nội dung form và yêu cầu đối chiếu nếu đã gửi lưu.
- Kiểm thử nghiệp vụ 4 ca, typecheck/build trước triển khai; chưa tái hiện bằng dữ liệu/phiên production. Không thay đổi báo công thực tế.
# Trạng thái phần bổ sung: Line xem Pro Plan

Mô tả bảng theo tuần dưới đây là lịch sử v811; giao diện mới theo ảnh đánh dấu được mô tả tại mục 07/11/2026 cuối tài liệu.

Bản sửa đang kiểm thử, chưa triển khai và không tự cấp quyền cho tài khoản thực.

- Admin có khung riêng tại Phân quyền người dùng để cấp/thu hồi duy nhất quyền Xem Pro Plan cho LINE_A hoặc LINE_B. Có xác nhận từng tài khoản, so sánh phiên bản trước ghi và nhật ký trước/sau trong cùng batch.
- Quyền lưu riêng, không sửa bản ghi quyền cá nhân/bộ phận hiện hữu. Mặc định chưa cấp; ngưng hoạt động, xóa hoặc định danh không hợp lệ sẽ không được mở quyền.
- Phiên Line đọc quyền mới tại máy chủ mỗi request. Sau cấp quyền cần tải lại trang để hiện menu; sau thu hồi API chặn ngay cả phiên đang mở.
- Pro Plan của Line là bảng chỉ đọc theo tuần, hiển thị từng dòng kể cả dòng tách, SKU/tên/quy cách, số lượng, Line, ngày, loại, ưu tiên và trạng thái. Chỉ trả các trường scalar cho đúng Line; không trả nguồn Engine, envelope, lịch sử, tổng nhóm hay dữ liệu lồng nhau.
- Capacity/detail/export và dữ liệu raw không thuộc quyền mới. Mọi thao tác ghi/chốt/mở lại/tách/chuyển kế hoạch vẫn bị chặn. Quyền báo công Line và quyền Admin giữ nguyên.
- Khung chỉnh quyền Line tổng quát vẫn khóa. Lỗi 409 của thiết lập quyền bổ sung do bản ghi cũ chưa đối chiếu không được sửa hoặc dọn dữ liệu trong bản này.
- Kiểm thử local không thay thế nghiệm thu trình duyệt full app, kiểm tra đúng source đang chạy hoặc phê duyệt triển khai.


## 07/11/2026 — Line A/B xem kế hoạch chưa hoàn thành theo tuần
- Bản sửa local từ MAIN v811, đang kiểm thử; chưa triển khai. Không thay đổi quyền, dữ liệu nghiệp vụ hoặc giao diện Admin.
- Theo ảnh đánh dấu: chỉ 9 cột SKU, Tên SP, Quy cách, SL kế hoạch, Ngày SX, Ngày hoàn thành, Loại kế hoạch, Ưu tiên, Thứ tự. Bỏ Dòng kế hoạch và các cột không được chọn. Mặc định gom tất cả tuần còn việc, từ cũ đến mới; tiêu đề nhóm có số tuần và khoảng ngày. Chọn tuần chỉ áp dụng khi Tìm kiếm; Xóa lọc trả tất cả tuần.
- API máy chủ chỉ chiếu các trường cần thiết cho đúng Line; đọc dữ liệu qua các trang giới hạn byte. Không trả dữ liệu nguồn, tổng nhóm, Capacity, lịch sử, báo công, raw records hoặc xuất file. Các cổng ghi và quyền Admin/báo công giữ nguyên.
- Không xem Đã chuyển In Transit là hoàn thành: dùng normalizeTransit/mergeProduction hiện hữu để đối chiếu báo công đã xác nhận; từng LSX phải có ngày hoàn thành, đủ số lượng và không còn báo công chờ. Tổng hoàn thành của các LSX cùng Line phải đủ số lượng riêng của dòng kế hoạch. Dòng Hủy bị loại, Tạm hoãn được giữ. LSX hủy không được tính như sản lượng hoàn thành.
- Dòng tách đối chiếu bằng liên kết riêng. Thiếu liên kết/ID, ID trùng, số lượng chưa biết, hoặc báo công cũ có thể bị áp dụng cho nhiều LSX thì giữ dòng để tránh ẩn nhầm việc còn dở. Không cộng sản lượng Line khác.
- Kiểm thử tự động dùng dữ liệu tổng hợp; nghiệm thu trình duyệt và kết quả kiểm tra tổng hợp cần ghi trong bàn giao trước triển khai.

## 07/11/2026 — Line A/B dùng giao diện KHSX chuẩn, chỉ xem
- Bản local từ MAIN v812, chưa triển khai. Phần này thay thế giao diện riêng 9 cột nêu ở trên: tuyến Pro Plan của Line dùng trực tiếp `ProductionPlan`, cùng bảng 16 cột, phân trang, tuần và bộ lọc chuẩn. Mặc định `Chưa chuyển In Transit`, không tự chuyển sang tất cả trạng thái hoặc tất cả tuần.
- Tài khoản Line chỉ nhận các trường hiển thị scalar của dòng đúng Line. Bổ sung Nhóm SP, SL đề xuất, giờ công đã lưu, trạng thái và định danh dòng tách; không đọc thêm dữ liệu SKU/giờ công để làm giàu giá trị. Thuật toán chọn dòng chưa hoàn thành của v812 giữ nguyên, không sửa cách tính hoàn thành hoặc giờ công.
- Dữ liệu Line không dùng cache hoặc tuần Engine của tài khoản thường. Marker readOnly, Line và tuần được xác minh trước khi hiển thị; tải lại bị từ chối hoặc sai phạm vi sẽ xóa dòng và chi tiết đang mở.
- Khóa nhập/sửa/chọn dòng, tự lưu, tách, chốt, mở chốt, chuyển và xuất file ở component. Không mở GET Engine, yêu cầu duyệt Capacity, chi tiết Capacity hoặc các dữ liệu raw. Không đổi grants, quyền ghi phía máy chủ, quyền người dùng khác hay dữ liệu nghiệp vụ.
- Capacity/tồn In Transit chưa có dữ liệu tổng hợp trong projection Line nên hiện thông báo không có dữ liệu này, không tạo số 0 giả. Nguồn và lịch sử không được trả hoặc hiển thị trong chế độ Line. Giao diện/tính năng tài khoản thường giữ nguyên.
- Kiểm thử phải bao gồm worker API thực với DB TEST, mounted UI Line A/B, đổi tuần/Line, tải lại/thu hồi, đóng chi tiết, khóa mutation/export và hồi quy tài khoản thường. Kiểm thử local không thay thế nghiệm thu trình duyệt hoặc xác nhận triển khai.

## 07/11/2026 — Chọn nhân viên Phụ kho theo Line

- Danh sách Người trực tuần và Người phụ kho lấy tất cả nhân viên đang hoạt động trong Line A/B được chọn, thay danh sách tên cố định. UI và API dùng chung bộ lọc; không đổi quyền hoặc dữ liệu nhân viên.
- Giữ các bản ghi giờ phụ kho đã có, cơ chế phiên bản/chống gửi lại, điều kiện lịch được duyệt và kiểm tra hiện diện khi ghi giờ thực tế. Chuyển Line mở đúng danh sách của Line đó.
- Đây là bản sửa riêng từ source MAIN v814, không bao gồm PR9, editor Pro Plan hoặc thay đổi cách tính giờ/hoàn thành. Kiểm thử bằng dữ liệu giả; kết quả triển khai được đối chiếu riêng qua Sites.

## 07/11/2026 — Giữ lịch Phụ kho cũ khi danh sách nhân viên thay đổi

- Dòng lịch đã lưu nhưng chưa đủ giờ được giữ nguyên khi người cũ đổi Line/ngưng hoạt động/không còn trong danh sách và người dùng sửa ngày khác. Không tạo giờ thực tế từ dòng này; đổi giờ, gán mới hoặc thêm dòng vẫn phải thỏa điều kiện nhân viên hiện hành.
- Thêm dòng chỉ kế thừa nhân viên còn hợp lệ của Line, hoặc lựa chọn tuần hợp lệ; nếu không có thì để trống. Dòng cũ và giờ đã ghi vẫn giữ lịch sử, khóa sửa đúng luồng cũ.
- Không đổi quyền, lịch duyệt, kiểm hiện diện/giờ trùng, CAS hoặc idempotency. Kiểm bằng dữ liệu giả, tách khỏi PR9.

## 11/11/2026 — bản ghép MAIN báo sản lượng (LOCAL, CHƯA PHÁT HÀNH)

- Bản ghép chọn lọc từ MAIN v816 và runtime báo sản lượng/Giờ công theo ngày của QA v28. Không thay manifest DB/FILES, migration, Pro Plan chỉ xem, Engine, Leadtime hoặc Phụ kho.
- Adapter MAIN riêng kiểm project/origin, nguồn build, Admin toàn quyền, CSRF, revision, idempotency và giới hạn dữ liệu; không tự chạy lúc khởi động. Không có ngày kích hoạt cố định. T là receivedAt do server ghi cùng giao dịch kích hoạt thành công; chuẩn bị không tạo T. Giữ nguyên dữ liệu trước T và tách T khỏi ngày hiệu lực/lịch sử cập nhật Giờ công/SP. Frozen membership vẫn được kiểm nguyên tử.
- Kiểm đồng thời Kho/SX so toàn bộ DB sau giao dịch Kho hợp lệ; điều chỉnh bị từ chối phải giữ nguyên snapshot đó, số lượng, mức giờ và lịch sử, không sinh giữ chỗ thừa.
- Đã kiểm local bằng dữ liệu giả; chưa nghiệm thu browser trên bản ghép hosted, chưa save/push/deploy/activate MAIN.
- Cổng phát hành còn mở: bản sao lưu đầy đủ đã xác minh; căn cứ bảo toàn mức giờ của MAIN độc lập với registry QA. Không chép registry/biến môi trường QA, không điền 0 hoặc dùng mức hiện tại thay lịch sử chưa có căn cứ. Công cụ nhập registry kế thừa còn khóa QA và chưa được coi dùng được trên MAIN.

## Thời điểm chuyển đổi thực tế — bản thử trên candidate ec112dac (CHƯA PHÁT HÀNH)

- Đã bỏ cổng ngày cố định và nhãn giao diện áp dụng theo ngày cũ. Chuẩn bị chỉ chốt nguồn; T là receivedAt do server ghi cùng giao dịch kích hoạt thành công. Replay giữ nguyên T; yêu cầu client không được chọn T.
- T chỉ đổi cách tiếp nhận báo sản lượng, gồm lệnh đang dở dang. Ngày nghiệp vụ và hiệu lực/lịch sử cập nhật Giờ công/SP độc lập với T. Giữ nguyên bytes phiếu, mức đã lưu và giờ thực tế trước đó; thiếu căn cứ lịch sử không lấy mức hiện hành điền bù.
- Kiểm trong TEST local với dữ liệu synthetic: giao dịch thất bại/cạnh tranh không để lại activation dùng được, pending cũ và receipt mới không trùng, nhập bù qua T chọn đúng mức cũ; mức có ngày hiệu lực hoặc fallback ngày cập nhật đều được kiểm.
- Hai assertion cũ yêu cầu lấy mức menu hiện tại tính lại legacy đã được thay bằng giữ mức lưu hoặc thiếu căn cứ; không đổi mã tính payroll để khớp assertion lỗi thời.
- Kết quả kiểm và phạm vi diff được bàn giao riêng; chưa ghi MAIN, chưa push/save version/deploy/activate. Backup MAIN hiện có, căn cứ bảo toàn riêng của MAIN, trạng thái writer và nghiệm thu hosted vẫn là các cổng trước phát hành.

### Bổ sung bảo trì activation và phương án vận hành — chưa triển khai MAIN

- `tests/main-hosted-integration.test.mjs` nay dùng chính route Worker đã build để prepare → activate → GET → replay activate/prepare → báo công → duyệt → Kho xác nhận. Không seed activation trực tiếp. Kiểm T bất biến, snapshot toàn bộ app_records không đổi khi replay, phiếu legacy đã xác nhận không đổi bytes, giờ phiếu chờ được giữ sau duyệt, sản lượng 400 + 300 mới + 200 chờ = 900, 2 phiếu Kho tổng 500, quyền Kho/Admin/Line, xác nhận không lặp, tài khoản và R2 nguyên trạng. Miniflare mới, synthetic, outbound bị chặn.
- Ca CAS nguồn đổi kiểm thêm prepare replay trả snapshot/revision cũ, receivedAt null; nonce mới bị từ chối; GET vẫn prepared; activation tiếp tục bị từ chối, DB không có thay đổi từng phần. Replay là idempotency, không phải refresh nguồn. Không sửa cơ chế staging trong lượt này.
- Đã đọc `review-built-activation.test.mjs` và `built-tests.log` người dùng chuyển (Library IDs libfile_c31fcfc87c888191be6fa038413a1416, libfile_3eaa8f5f10948191ba54971d862fce89). Ca bảo trì hiện bao phủ toàn bộ nhánh kiểm của tệp độc lập, kể cả prepare replay sau active, và bổ sung xác nhận Kho thực/phân quyền. Không chép thành test trùng, không thi hành tệp độc lập. Log 2/2 là bằng chứng do bước độc lập báo lại, không phải lần chạy mới tại đây. Báo cáo 80/80, TypeScript/build của bước độc lập cũng được ghi nhận đúng nguồn.

#### Phương án khoảng dừng ghi (đề xuất, chưa thực hiện)

1. Chỉ áp dụng sau khi backup hiện có được xác minh, căn cứ MAIN và nghiệm thu TEST đạt, người dùng chấp thuận khoảng dừng và người có thẩm quyền kiểm tất cả writer. Không tự dừng người dùng, đồng bộ nền hoặc đổi quyền.
2. Trước prepare phải xác nhận trạng thái unprepared và không có activation/policy/lease xung đột. Dừng và chờ hoàn tất mọi yêu cầu đang ghi vào bốn nguồn `in_transit`, `production_report`, `production_history_import`, `warehouse_in`, kể cả SX, Kho, duyệt/điều chỉnh, nhập lịch sử và tác vụ nền. Ghi bằng chứng người chấp thuận, thời điểm, source/build, trạng thái và revision.
3. Admin chuẩn bị một lần, đối chiếu snapshot/revision/ngân sách và nguồn, activate cùng nonce + expectedRevision + xác nhận rõ. Chỉ công nhận thành công sau GET kiểm active/T và manifest; không tự chọn T trước. Nếu kết quả chưa rõ, đọc trạng thái rồi replay cùng yêu cầu; không đổi nonce hay xóa marker.
4. Nếu nguồn đã đổi sau prepare: dừng quy trình kích hoạt, giữ nguyên snapshot cũ và audit. Dừng ghi lúc này không làm snapshot cũ khớp trở lại. Không sửa ngược dữ liệu nghiệp vụ để ép khớp, không xóa marker/snapshot, không tự kích hoạt lại. Mở lại hoạt động theo quyết định người có thẩm quyền; không coi khoảng dừng được chấp thuận là đã tồn tại.
5. Trường hợp snapshot đã cũ cần một quy trình restage được duyệt riêng, hiện CHƯA CÓ trong adapter. Yêu cầu thiết kế tối thiểu: Admin + xác nhận lý do, revision của operation cũ và source/build, khóa/CAS cả nguồn lẫn operation tại commit, cấm restage khi đã active hoặc có kết quả chưa rõ, audit bất biến liên kết snapshot cũ/mới, giữ bản cũ để truy vết, nonce/revision mới có kiểm soát và kiểm concurrent/rollback/replay. Chưa cài đặt hoặc triển khai cơ chế này; chưa được coi là cách phục hồi sẵn dùng.

#### Cổng dữ liệu và nghiệm thu còn mở

- Backup: mã `scripts/windows/OnspaSync.ps1` chỉ tạo `HOAN-TAT.json` sau kiểm tải/hash và phản hồi complete của server; marker cập nhật sau chuyển folder hoàn tất. Đây là cơ chế, không chứng minh một lần chạy mới nhất. Không thử lại đọc Windows bị sandbox từ chối. Cần chủ hệ thống đính kèm `C:\website onspa\_sync\sao-luu-cuoi.json` và trong folder marker trỏ tới: `HOAN-TAT.json`, `manifest.json`, `checksums.json`. Không cần gửi SQL hoặc R2 thật để đối chiếu metadata ban đầu. Đối chiếu project MAIN, ID/thời điểm/sourceSnapshotId, tableCounts/recordCount, entries/fileCount, kích thước và checksum; metadata hoàn tất chưa thay cho kiểm hash bytes tại chỗ hoặc diễn tập khôi phục. Secrets triển khai phải thiết lập riêng khi khôi phục.
- Căn cứ MAIN: lỗi INVALID_ARGUMENT hàng quá lớn ở app_records offset3325 vẫn giữ nguyên chỗ dừng, không retry/nhảy offset/đổi limit. Source và fixture không xác minh mức lịch sử từng SKU/phiếu thật. Phải có đường hỗ trợ chính thống xử lý lỗi hoặc nguồn bằng chứng lịch sử được cấp quyền; không lấy mức hiện tại điền bù và không coi thiếu ngày hiệu lực riêng là blocker nếu lịch sử cập nhật đủ căn cứ.
- Hosted: Worker Miniflare không phải browser acceptance trên hosted TEST. Chưa có endpoint hosted được xác minh đúng bản thử cùng D1/R2 TEST tách biệt và dữ liệu synthetic. Chưa publish/deploy để tạo endpoint; bước đó nằm ngoài quyền của lượt hiện tại. Không dùng MAIN làm môi trường nghiệm thu candidate.

### Guard preview local — đã sửa theo phê duyệt riêng, chưa phát hành

- `scripts/local/server.mjs`: lấy địa chỉ/cổng bằng `httpServer.address()` tại mỗi request; chỉ chấp nhận server bind loopback với cổng TCP hợp lệ, peer loopback, Host 127.0.0.1/localhost và Origin HTTP đúng cổng thật. Không xác minh được socket thì từ chối. Không tin Forwarded/X-Forwarded-*, không wildcard, không đổi config/network/bindings hoặc guard MAIN. URL nội bộ của API dùng authority đã kiểm.
- `tests/local-preview-guard.test.mjs`: 6/6 ca đạt, gồm server socket không xác định/wildcard/ngoài loopback, cổng thực 4173/5173/cổng khác, Host/Origin sai, peer ngoài loopback và forwarding giả; có ca HTTP trên server loopback thật, không mở DB hoặc seed. Lần đầu 4/6 do helper test gán mặc định khi cần mô phỏng undefined; đã sửa helper và chạy lại 6/6 đạt.
- Helper HTTP của `tests/local-environment.test.mjs` được cập nhật dùng cổng server thật; chưa chạy lại suite nghiệp vụ này, tránh ghi fixture ngoài phê duyệt guard. Không chạy lại các suite đã đạt hoặc TypeScript/build vì thay đổi chỉ ở local middleware/test/tài liệu, không đổi Worker phát hành.
- Sau test đạt, chạy sites-preview đúng checkout, mở nguyên URL CLI http://127.0.0.1:4173/. Browser hiển thị TEST local; GET /api/test-environment trả environment TEST, remote false, database .local-data/d1, engine Miniflare D1, setupRequired true. Không sửa Host/header/origin, không đăng nhập, không nạp fixture, không prepare/activate hoặc ghi nghiệp vụ. app_records trước/sau đều 0. Preview đã stop và status xác nhận stopped.
- Bằng chứng này gỡ lỗi tương thích cổng preview local; không phải nghiệm thu UI nghiệp vụ/cutover hay hosted MAIN. T vẫn là mốc kích hoạt thực tế; dữ liệu production không được chạm tới. Gói source được lưu để bàn giao, chưa push/save Sites version/deploy/publish.

### Kiểm bổ sung chuyển đổi bằng dữ liệu synthetic sau gói phiên bản 2

- Trước kiểm: đối chiếu toàn bộ 996 tệp source với candidate gốc cộng gói sửa phiên bản 2, không lệch bytes. Không sửa mã nghiệp vụ; chỉ bổ sung một ca bảo trì vào `tests/main-hosted-integration.test.mjs` và cập nhật tài liệu. Worker build dùng lại mã runtime nghiệp vụ đã kiểm, không phải một build/phát hành mới cho toàn cây source.
- Chạy duy nhất `node --test --test-name-pattern='cutover maintenance:' tests/main-hosted-integration.test.mjs`: 1/1 đạt. Không chạy lại ca Worker cũ, suite 80 hoặc UI/chức năng TEST v28 đã nghiệm thu.
- Fixture dùng Miniflare mới, cf:false, không d1Persist/r2Persist, không dùng DB local đang lưu hoặc credentials production; synthetic accounts/rows/R2 tự tạo, outboundService từ chối mọi truy cập mạng và cuối ca kiểm outboundCalls=0. Dùng route prepare/activate/GET/replay thật trong Worker nội bộ, không gửi request tới hosted MAIN dù URL định danh MAIN là đầu vào của runtime dispatchFetch cô lập.
- Lệnh dở: 400 đã hoàn thành và 200 chờ trước T. Sau T tạo báo 200 nhập bù mức 0.1, 100 ngày mức 0.2; cập nhật định mức mới rồi thêm 100 mức 0.4. Giờ chuẩn lần lượt 20/20/40. Các ngày fixture được tính tương đối ngày chạy, không dùng ngày kích hoạt cố định. T do server sinh khi activate; ngày nghiệp vụ nhập bù độc lập T.
- Cập nhật định mức không đổi bytes phiếu approved/pending/phiếu mới đã lưu. Sau duyệt cả phiếu chờ và phiếu mới, completedQty=1000, pendingReportQty=0; 4 phiếu Kho đề nghị/xác nhận tổng 600, không cộng lại 400 ban đầu. Phiếu approved cũ giữ nguyên bytes và 5 giờ thực tế; phiếu pending cũ giữ 2 giờ; phiếu sản lượng mới không lấy giờ chuẩn gán thành giờ thực tế. Replay sau Kho giữ nguyên T và toàn bộ app_records; object R2 synthetic giữ nguyên.
- Bằng chứng lịch sử ngày cập nhật khi thiếu ngày hiệu lực, backfill sau cập nhật mức và guard/cạnh tranh dùng lại các log đã đạt trước; không coi chúng là lần chạy mới. Chưa kiểm mọi menu bằng browser trong lượt này.
- Điểm khác biệt preview đã xác minh bằng source: local GET workflow ở `scripts/local/server.mjs` trả workflow thuần, thiếu dailyOutputPolicy mà `worker/site-api.mjs` bổ sung; `components/production-management.tsx:93` quyết định dailyMode từ trường đó. Vì vậy preview local chưa đủ để chứng minh UI đi vào báo theo sản lượng sau T, dù guard cổng đã sửa. Chưa sửa hợp đồng response local, chưa giả policy hoặc bỏ guard MAIN. Bước riêng cần thiết là cho local GET trả trạng thái policy có thật bằng đường đọc giống Worker, rồi kiểm đúng ca chuyển đổi bằng fixture; không tự kích hoạt hoặc áp policy khi mở UI.
- Không khởi chạy preview ở lượt bổ sung này; không tạo fixture trong hosted TEST hoặc MAIN, không chia sẻ dữ liệu thật, không save Sites version/deploy/publish. Backup/khôi phục MAIN, căn cứ lịch sử MAIN còn thiếu, writer và quyền phát hành vẫn phải xác minh trước phát hành.

### Hợp đồng policy LOCAL GET — đã sửa, browser cutover chưa hoàn tất

- `scripts/local/server.mjs` đọc `readDailyOutputPolicy()` từ DB local thật, trả dailyOutputPolicy khi có; không hardcode active/T. Như Worker, policy đã tới mốc nhưng thiếu manifest bảo toàn hợp lệ trả 503, không giả chuyển đổi thành công. Dùng `readLegacyPreservation()` và ngừng tính giờ legacy từ nguồn hiện tại khi policy active. Giữ điều kiện đăng nhập, guard socket/cổng, quyền, config/bindings; không thêm endpoint activation local hoặc auto-policy/seed.
- Test mới `tests/local-workflow-policy.test.mjs` chạy HTTP qua middleware thật trên cổng loopback thật, DB/R2 thư mục tạm riêng. GET trước chuyển đổi không có policy; sau trusted synthetic activation trả đúng policy và T từ DB, GET/repeat/alert GET không đổi app_records; manifest synthetic bị làm không hợp lệ thì 503 và policy active=false. Session test được tạo theo endpoint TEST hiện hữu, không dùng phiên hosted. 1/1 đạt; test guard bị ảnh hưởng chạy riêng 6/6 đạt. Không chạy suite cũ hoặc nghiệm thu lại TEST v28.
- Thử chuẩn bị fixture browser trong store local đã xác minh rỗng: helper dừng tại await openDatabase(), không trả lỗi cụ thể. Đã hủy lệnh fixture và lần chẩn đoán read-only (exit 130), không chạy lệnh trùng. app_records vẫn 0, không có browser-fixture-evidence.json; prepare/activate/fixture insert chưa thực hiện trong store local lưu sẵn. Chưa xác định nguyên nhân runtime; không coi đây là access denied, không sửa ACL/config/network/reset dữ liệu hoặc đổi store để né lỗi.
- sites-preview chính thống vẫn start được tại URL CLI http://127.0.0.1:4173/. Browser thực mở màn đăng nhập TEST; local auth.json chưa tồn tại, không tự ghi tài khoản/credentials hoặc dùng cookie phiên khác. Chưa chạy browser báo công/nhập bù/duyệt/Kho hay chứng minh UI chuyển đổi. Preview đã stop và status xác nhận stopped. Không coi màn login là nghiệm thu cutover.
- Việc còn lại: xác định/khắc phục runtime mở store local bằng luồng được hỗ trợ; sau đó thiết lập/đăng nhập tài khoản local qua luồng bảo mật hợp lệ, nạp fixture synthetic đã cấp quyền và chạy riêng ca browser chuyển đổi. Không yêu cầu nhập credentials vào chat. Giữ bằng chứng Worker synthetic trước đó, nhưng tách khỏi browser acceptance. Không deploy/publish MAIN hoặc hosted TEST.

### Chẩn đoán runtime mở store local — đã khắc phục cách chạy helper

- Nguyên nhân: lần gọi trước dùng `node --input-type=module` cho stdin. Miniflare SyncFetcher tạo Worker eval dùng CommonJS `require` nhưng không đặt execArgv riêng; worker kế thừa --input-type=module và lỗi ReferenceError: require is not defined in ES module scope. SyncFetcher đang chờ Atomics.wait nên lỗi không được trả tới luồng đang chờ mở binding. Đã tái hiện worker con độc lập, không DB/network, với đúng flag và lỗi này.
- Khắc phục ở cách thực thi: lưu helper thành tệp `.mjs`, chạy `node /absolute/path/helper.mjs` không có --input-type=module. Không thay ứng dụng, dependency, config/network/ACL, guard hay bindings. Cùng openDatabase() mở kho hiện hữu trong 372ms; rows=0, objects=0. Không reset hoặc đổi kho để tránh lỗi.
- Helper synthetic ngoài source deployment đã seed local sau kiểm rỗng DB/R2, rồi chạy verify độc lập thành công. 12 app_records, T=2026-11-12T06:52:19.105Z do trusted local fixture activation sinh; ngày này là thời điểm chạy thật, không phải ngày cutover cố định. Hai phiếu cũ 400 approved/200 pending và hours 5/2 giữ nguyên bytes; R2 chỉ có sentinel SYNTHETIC. Không có hosted request hoặc dữ liệu thật. Helper/fixture không được thêm vào source triển khai.
- Browser cutover còn chờ đăng nhập local lần đầu qua luồng người dùng hợp lệ; chưa coi fixture seed/verify là nghiệm thu browser. Không nhập/ghi credentials qua công cụ model-visible và không dùng phiên hosted khác. Preview chỉ phục vụ đúng URL CLI để tiếp tục ca còn thiếu.


## Kiểm tương thích trước activation — 13/11/2026
- Bổ sung hai regression vào tests/main-hosted-integration.test.mjs, dùng cùng harness Worker build thật và D1/R2 synthetic trong RAM, chặn outbound. Không dùng fixture browser hoặc dữ liệu vận hành.
- Đã chạy hai ca tương đương trước khi ghép vào suite: 2/2 PASS. Báo công legacy lưu được trước prepare và khi prepared; nguồn đổi sau prepare làm activation trả 409 nhưng báo công mới và phiếu cũ còn nguyên. Đây là CAS đúng, không phải lỗi gián đoạn báo công.
- Trường hợp prepare còn khớp: activation thành công; báo mới 300 theo mức .2 và nhập bù 200 theo mức .1. Cộng old400 + legacy100 = 1000, không trùng khi replay; T và raw phiếu legacy giữ nguyên.
- Không sửa logic ứng dụng/guard/auth/quyền/CAS vì chưa tái hiện chặn sai đường legacy. 409 của daily-output khi chưa bật vẫn phải giữ. Không có triển khai hoặc activation live.
- Giới hạn: chưa có cancel/re-prepare cho stale staging; không xóa marker. 8 migration giống baseline, nhưng trạng thái ledger live (đặc biệt 0006) và cách nền tảng nhận diện migration vẫn chưa được xác minh; không coi deploy là phép thử.

## Re-prepare có thẩm quyền — candidate TEST, chưa phát hành
- API MAIN guard hiện hữu nhận thêm action `reprepare`, bắt buộc `expectedRevision`, `acknowledge:true`, mã `requestIdempotency` mới và `reason` 1–240 ký tự. Giữ nguyên Admin không giới hạn Line, source/project/DB/FILES, origin/CSRF và ngân sách request/nguồn. Không có tự động reprepare hoặc nút UI mới.
- Chỉ supersede operation prepared chưa có T, chưa có policy/activation và không có legacy lease hoạt động. LIVE được chụp trong cùng transaction với đổi con trỏ, history, receipt idempotency và admin audit. Snapshot cũ giữ nguyên; không ghi bốn entity nguồn, không ghi T. Lỗi/race rollback toàn bộ; nguồn đổi sau reprepare vẫn bị activate CAS chặn.
- Receipt replay trả bản prepared đã commit cùng `current` và `currentOperation`; receipt lịch sử không được hiểu là quyền kích hoạt con trỏ hiện tại. Request cũ không điều khiển snapshot mới. Khi phản hồi thất lạc, đối chiếu receipt cùng mã, không tự sinh mã mới.
- Entity bổ sung nằm trong app_records: production_quantity_activation_history và production_quantity_reprepare_request; không thêm migration hoặc schema. Lưu operation raw trước, lý do, actor, source, revision trước, snapshot trước/sau và operation prepared mới. Không sửa nghiệp vụ báo công/giờ công/auth/quyền và không xóa marker.
- Phạm vi kiểm và kết quả chi tiết nằm trong gói bằng chứng reprepare; chưa triển khai MAIN, chưa nghiệm thu UI hosted. Ledger migration 0006 chưa có nguồn mới để xác minh, không suy đoán skip.

## 14/11/2026 — Giữ phiếu cũ khi sửa lần xuất sau

- Điều chỉnh công đoạn chỉ tính lại và ghi các phiếu từ mốc cũ/mới sớm nhất của thao tác đang sửa hoặc hủy. Các sự kiện, báo công và phiếu kho trước mốc đó được giữ nguyên, kể cả phiếu kho đã xác nhận.
- Vẫn chặn chỉnh phiếu đang sửa nếu kho đã xác nhận/nhận hàng; giữ snapshot/CAS, quyền, kiểm lượng, trình tự và audit. Kiểm hồi quy bằng DB giả gồm hủy Tiếp tục sai, chuyển ngày xuất sau, giữ nguyên raw phiếu cũ và cạnh tranh với Kho.

## 14/11/2026 — Bản ghép báo sản lượng/Giờ công trên nền v817, local chưa phát hành

- Giữ nguyên sửa v817 cho lần xuất sau khi phiếu kho trước đã xác nhận và kiểm hồi quy tương ứng. Ghép báo sản lượng, căn cứ giờ theo ngày và adapter MAIN từ gói nguồn được đối chiếu hash; không đổi SQL/journal, hosting, quyền hoặc cấu hình kho.
- Trước kích hoạt, kiểm yêu cầu giờ chưa duyệt đang chặn phiếu cũ; từ chối kích hoạt với thông báo xử lý trước. Kiểm lại cùng điều kiện trong transaction vì sự kiện nhân lực có thể đổi sau lượt đọc. Không tự duyệt, sửa giờ hoặc mở ghi lịch sử sau chuyển đổi.
- Kiểm bằng dữ liệu giả cho vòng đời duyệt giờ trước T, báo công sau T, baseline đã duyệt, ARRAY/import history, yêu cầu đã hủy/duyệt và cạnh tranh tại commit. Đây là bản ghép local; chưa publish, chưa activation và chưa nghiệm thu QA hosted.

## 16/11/2026 — Gói báo sản lượng/Giờ công và đăng nhập trong bảo trì

- Gói runtime đã phát hành MAIN v819, commit 4c730d40bf60be9bd7e8a6676a5b5f64fbb92f83; deployment appgdep_6afa5d4e55a481918f7328cea3f213f1 succeeded. Đây là phát hành mã; chưa kích hoạt receipt/cutover và chưa mở khóa SX. Không coi kết quả API QA giả hoặc deployment succeeded là nghiệm thu dữ liệu MAIN.
- Bản sửa tiếp theo hiển thị đăng nhập Admin trên trang kích hoạt khi không có phiên hợp lệ. Chỉ POST /api/auth/login được đi qua khóa để xác thực mật khẩu bằng handler hiện có với loginMode admin; mọi API kích hoạt vẫn kiểm Admin/Line/origin/CAS. Không đổi tài khoản, quyền, SQL/journal, DB/FILES hoặc cấu hình Kho.
- Đăng nhập không tự chuẩn bị dữ liệu, kích hoạt hay mở khóa. Các thao tác SX/Kho, thiết lập/reset mật khẩu và cấp mã thiết bị vẫn bị khóa. Phân biệt thông tin phát hành ở mục này với các kết quả local lịch sử phía trên; chứng từ triển khai được đọc lại riêng sau khi lưu bản.


## Đồng bộ PR #29 vào MAIN (16/11/2026)

- GitHub PR #29 head `8a5a3ce36a0e04e6de63fead7fd263fdfd76b384`, merge staging `22263efbde4caa9f02cca7a9c42b3d8f901ff2a5`. CI run 43825407051 đạt TypeScript và đủ ba shard. Người dùng yêu cầu merge và đồng bộ MAIN trực tiếp; đây không phải nghiệm thu mọi luồng Kho.
- Promotion dùng MAIN v824 / `baad5ae1cd4ee95e6aa3fba57269eae7a35c698a` làm baseline; áp đúng delta PR #29 cho hai file GS/TXT, hướng dẫn và test tách trigger. Giữ các khác biệt source MAIN khác staging; không đưa toàn bộ Apps Script phát triển sửa/hủy từ staging vào MAIN trong bước này.
- `ONSPA_kiemTraKetNoi` và tên tương thích `ONSPA_khoiPhucKetNoi` chỉ ping cấu hình đã lưu; setup không tự tạo trigger. Bật lịch là hàm riêng. File WEB.gs trong Apps Script Kho đã được cập nhật đúng delta này, lưu và đọc lại khớp; trang Kích hoạt hiển thị 0 trigger. Không chạy hàm hoặc cấp lại khóa.
- Phạm vi Kho chỉ gồm dữ liệu đồng bộ từ ONSPA_WEB theo ID; không sửa công thức tháng, dữ liệu nhập tay/ERP, phiếu, URL/khóa, tài khoản hay quyền. Giữ Site/D1=DB/R2=FILES/public.
- Kiểm riêng trên nguồn MAIN: test tách trigger 4/4 và TypeScript đạt; build/package theo luồng phát hành. Chưa nghiệm thu quyền/tốc độ Line A/B thật hoặc queue/ACK live theo ID. Trigger tiếp tục ngưng; deployment không tự cho phép chạy job.


## Đồng bộ cảnh báo Kho PR #30 vào MAIN (16/11/2026)

- GitHub head 4f4710c8626a971373c7343fadae8b04f1ba1fad; merge staging ba5eef2924c44defd823568d0568287b59d03201. CI run 43831465854 đạt TypeScript và đủ ba shard. Người dùng yêu cầu merge và đồng bộ web chính.
- Promotion lấy MAIN v825 / d8113f4e28b9eb4db4e55c966bbd28de09c491f1 làm baseline, chỉ ghép delta PR #30. Bảo toàn các khác biệt cũ của MAIN về trạng thái/chọn phiếu và xử lý xung đột, không chép toàn bộ component staging. Mã đọc cảnh báo và hai suite logic/API giống PR; mounted test MAIN giữ ca có sẵn và bổ sung ca điều hướng/cập nhật lỗi của PR.
- Kiểm trên source MAIN: 12/12 test mục tiêu (9 logic, 1 API/quyền/bất biến, 2 mounted), TypeScript/build đạt. Baseline trước triển khai đọc được 101 phiếu bridge để đối chiếu sau. Không ghi phiếu/công thức, không đổi tài khoản/quyền/khóa, không bật trigger hoặc thêm cron.
- Cảnh báo kiểm trạng thái và bằng chứng ACK khi web đang mở; không trực tiếp đọc lại công thức/tồn Sheet hoặc bảo đảm phát hiện sửa tay sau ACK. Chưa có nghiệm thu luồng Sheet TEST thật; ca cảnh báo dương chỉ dùng dữ liệu cô lập.


## 16/11/2026 — promotion PR #31

PR #31 đã merge staging tại 48196440756deba5701053b9cfe14ba48e617a23, cả 4 CI đạt. Áp dụng riêng delta vào MAIN bc80974c8c1d088128b50b36eb29cfa8dc8ace26: giữ phân trang khi tải nền, cache theo phiên và tải trước một trang, giảm đọc SKU/Leadtime. Hai file in-transit/site-api được ghép theo source MAIN, không chép staging. Không sửa cấu hình, dữ liệu hoặc trigger. Kiểm tra production sau deployment còn chờ.


## 16/11/2026 — promotion PR #32

Người dùng yêu cầu merge và đồng bộ MAIN. Áp riêng delta head `8634b407a14447b688687075686d56f356a1d20b` trên MAIN v827 / `7bfbe3a574ce7c2c37c285ed35a0ee524ea90ac3`: tăng cửa sổ tổng hợp SX lên 100 lệnh, giữ snapshot hết TTL để hiển thị khi mở lại, giữ thao tác trang đã xác minh khi tải nền. Không sửa menu khác, manifest, schema, dữ liệu hay trigger. 37 test mục tiêu, TypeScript và build trên source MAIN đạt. Bằng chứng fixture 45→17 lượt đọc; chưa xác nhận mục tiêu 3–5 giây trên production. CI run 43842152510 đạt cả 4 job; PR #32 merge staging tại `714af4a12cac5829f4fb0877e8579c229a4539dc`. Kiểm tra live sau phát hành còn chờ.

## 17/11/2026 — promotion PR #33

- Người dùng yêu cầu merge và triển khai PR #33. Head `2a7f60c660b350dd12e702660f3abd26d6996b6c`, merge staging `8232a2fcab3d6fe4045577e99941b7c59d28cdb6`; CI run 43845296379 đạt đủ 4 job.
- Áp riêng delta vào MAIN v828 / `60653fcc97eaba80001b4860ed98a7c196d9edbb`. Giữ khác biệt MAIN trong worker/site-api.mjs, gồm quickLinePlan; không thay toàn bộ source bằng staging.
- Tiến độ sản xuất dùng profile đọc gọn, mặc định đang xử lý; ẩn hoàn thành/đã hủy, chỉ tải chi tiết lịch sử khi chọn phạm vi tương ứng. Giữ phiếu chờ xác nhận kể cả công đoạn số lượng 0; cache tách theo phạm vi, giới hạn thời gian yêu cầu và cho thử lại. Backend vẫn đọc metadata gọn để xác định lệnh đang xử lý.
- Trên nguồn MAIN: 46/46 test mục tiêu và TypeScript đạt; build/package là bước phát hành tiếp theo. Không sửa manifest, schema, dữ liệu, quyền hay trigger. Không coi số liệu fixture là thời gian tải thực tế; chưa nghiệm thu mục tiêu 3–5 giây từ lúc bấm menu tới dữ liệu trên production.


## Tiến độ sản xuất — PR #37 (17/11/2026)

Giữ phạm vi, bộ lọc và trang gần nhất theo tài khoản/quyền/Line; mở lại tải nền ngay và gộp request đang chạy. Tái sử dụng dữ liệu đọc trong cùng request progress toàn bộ. Không sửa schema, dữ liệu hay quyền. PR #37 đã merge; chuẩn bị phát hành trên nền MAIN v834, giữ toàn bộ sửa đổi PR #36. Kiểm thử và giới hạn: `docs/PRODUCTION-PROGRESS-PERFORMANCE-20261117.md`.

## 17/11/2026 — ứng viên giữ cache nhiều tab và giảm đọc SX sau PR #36

Nhánh riêng; hợp nhất snapshot theo từng khóa trong cùng phạm vi đã xác minh, chuyển khóa lưu để tab phiên bản cũ không ghi đè. Giảm đọc SKU không liên quan, kế hoạch chưa đồng bộ và lịch sử nhập đã duyệt trong scope tóm tắt SX; giữ dữ liệu và quyền. TypeScript/build cùng kiểm thử cache/API mục tiêu đạt; chưa nghiệm thu tốc độ MAIN sau sửa. Tách khỏi PR #37 Tiến độ sản xuất. Chi tiết: docs/PRODUCTION-CACHE-ISOLATION-20261117.md.

Bổ sung sau MAIN v836: giữ trang/dữ liệu đã xác minh trên trình duyệt, nhưng Admin còn đọc 8–10 giây. Nhánh riêng tiếp tục lọc sớm kế hoạch có nhãn đồng bộ nhưng chưa đủ mã LSX/lượng/ngày mở; không đổi kết quả hoặc dữ liệu. Xem docs/SX-READY-SCAN-20261117.md; chưa nghiệm thu tốc độ bản bổ sung.

PR39 cũng giảm đọc lặp lệnh hoàn thành bằng cửa sổ tối đa 500 ứng viên (trang UI 10, payload 512 KiB); không bỏ tổng hợp chờ duyệt/điều chỉnh. Fixture 501 lệnh hoàn thành vẫn đủ kết quả qua hai cửa sổ và dữ liệu không đổi.

## 2026-11-17 — PR41 standalone release preparation
- PR41 merged as d18c7d02; full GitHub CI passed for head 13660830. Apply its ACK/cache/policy delta only; PR40 UI is excluded.
- Source HEAD v837 contained PR39 but the live deployment was rolled back to v836. For this standalone release, production-order-pages.mjs retains the exact v836 application implementation; PR39 history/docs/tests remain for PR42 follow-up. No schema, D1/R2 binding or permission changes.
- Confirmation checks use synthetic data only. Production save latency and real business approval have not been measured or executed.

## 2026-11-17 — PR40 release preparation
- PR40 full CI succeeded; merged as 0f0fa6b5. Apply the six-file daily approval UI delta on v838, preserving PR41 and existing DB/FILES bindings.
- 19 mounted/profile/retention/ACK checks passed on the combined Site source. Per-report approval, date grouping, display selector, double-click protection and error retention covered. No real business confirmation submitted.
- Production browser verification is pending publication; do not interpret synthetic timing as production save latency.

## 17/11/2026 — PR42 trên MAIN v839

Giữ nguyên PR40/41 của v839/source 176a04c4; thêm riêng runtime PR39+42 cho đọc SX (lọc ứng viên, cửa sổ 500, scope bound parameters). Không đổi các tệp ứng dụng giao diện xác nhận/ACK/cache/policy của PR40/41 hoặc ứng dụng PR37. Full CI PR42 đạt 2.293 test; bản ghép v838 trước đó đạt 52 ca. Regression mã dài bắt SQLITE_TOOBIG của v837, bản sửa đạt 21.722 byte/6 tham số. Đang kiểm bản ghép v839 và đo thực tế sau triển khai tuần tự. Không thay DB/FILES/schema/quyền/dữ liệu.
