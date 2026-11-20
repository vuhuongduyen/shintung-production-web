# ONSPA-SKU-Master — phát triển TEST cục bộ

Folder này là nguồn mã chính thức trong giai đoạn phát triển. Không push, kết nối GitHub/Vercel, tạo Site hoặc xuất bản nếu chưa được yêu cầu. Giữ nguyên `.openai/hosting.json`.

**Web thử cố định và nhánh staging:** [quy trình PR → staging → web thử → nghiệm thu → main](docs/STAGING-WORKFLOW.md). Hướng dẫn local bên dưới không phải lệnh khởi tạo/reset dữ liệu của web thử đang chạy.

**Quy trình làm việc cố định:** đọc [PR → link test full ONSPA → nghiệm thu → merge](docs/ONSPA-DEVELOPMENT-WORKFLOW.md) cùng `AGENTS.md` trước mỗi thay đổi. Tài liệu này quy định các điểm kiểm chứng và bàn giao; không thay thế quyền thực hiện từng bước của người dùng.

## Môi trường

- Windows 10/11, macOS hoặc Linux; Node.js **22.13 trở lên** kèm npm (đã kiểm tra Node 24).
- Kết nối npm registry khi cài dependencies. Không cần Bash, tài khoản Cloudflare hoặc token D1 LIVE cho các lệnh bên dưới.
- Chỉ chạy trên máy cá nhân tin cậy. API TEST không phải hệ thống production.

## Cài và chạy trên máy mới

Mở terminal tại folder Project:

```text
npm ci
npm run db:init
```

Chọn **một** nguồn dữ liệu:

```text
npm run db:seed
```

Lệnh trên nhập bộ dữ liệu giả lập nhỏ từ `seed/test/records.json` (SKU TEST, dấu xóa, forecast, Demand Event). Hoặc, khi nhận folder bàn giao có bản xuất mới nhất:

```text
npm run db:import -- test-data/latest.json
```

Import/seed từ chối database đã có bản ghi; không tự ghi đè. Nếu chưa cần dữ liệu, bỏ qua cả hai lệnh.

```text
npm run dev
```

Mở http://127.0.0.1:5173/. Lần đầu, trang đăng nhập hướng dẫn tạo tài khoản TEST của máy này: tên 3–40 ký tự chữ/số/gạch nối/gạch dưới, mật khẩu đúng 4 chữ số. Không có tài khoản/mật khẩu dùng chung trong seed. Lần sau dùng lại tài khoản này. Đăng nhập nhanh Line chỉ xem giao diện, không cấp quyền lưu TEST.

Có thể tạo tài khoản trước bằng `npm run test:account`. Mật khẩu được hỏi trực tiếp, không đưa vào tham số shell; file chỉ lưu salt/hash scrypt. Tài khoản đã tồn tại không bị ghi đè. Danh sách “Quản lý người dùng” trong nghiệp vụ không thay đổi tài khoản đăng nhập TEST này.

## Database và xác nhận TEST

- Endpoint http://127.0.0.1:5173/api/test-environment phải trả `environment: TEST`, `remote: false`, `engine: Miniflare D1`, `database: .local-data/d1`.
- Preview có nhãn **MÔI TRƯỜNG TEST · Dữ liệu local**.
- Database thật của preview lưu trên ổ đĩa trong `.local-data/d1`; đóng Codex, Ctrl+C, mở lại máy hoặc khởi động preview không làm mất dữ liệu.
- Không xóa `.local-data`. Không chạy các script tạm cũ trong `.sites-runtime` để khởi động.
- Cấu hình TEST nằm tại `config/local-test.json`. Khởi động bị chặn nếu sửa host/remote/database ID/vị trí lưu hoặc có biến môi trường Cloudflare/D1/production nguy hiểm.
- API TEST chặn origin ngoài local và yêu cầu đăng nhập để ghi. Không có token, remote binding hoặc đường ghi vào D1 LIVE.
- API nghiệp vụ dùng chung `/api/records` với schema hiện tại. Các thao tác gọi API và nhận thành công được lưu bền vững. Những màn hình chỉ là khung hoặc chỉ đổi React state chưa được coi là chức năng lưu hoàn chỉnh.

## Migration và backup

Schema: `db/schema.ts`. Migration: `drizzle/`, thứ tự trong `drizzle/meta/_journal.json`.

```text
npm run db:init
npm run db:export
```

Khởi tạo chỉ áp dụng migration chưa chạy; checksum chặn thay đổi migration cũ. Migration không chứa seed. Mỗi export tạo JSON có ngày giờ và checksum trong `backups/test/`, giữ nguyên `entity`, `record_key`, chuỗi `payload`, `updated_by`, `updated_at` và `_deleted`.

Khi chuyển máy: giữ mã nguồn/migration và bản xuất TEST; khởi tạo database mới rồi import. Không mang file SQLite đang chạy hoặc file tài khoản sang máy Sếp.

## Kiểm tra và chuẩn bị bàn giao

```text
npm test
npm run typecheck
npm run build
npm run test:legacy
npm run handoff
```

`handoff` thực hiện đủ kiểm tra, build, export TEST, dựng database kiểm chứng rồi nhập/đối chiếu, quét bí mật và đóng gói. Có lỗi thì dừng với báo cáo BLOCKED; không coi folder dở dang là bản bàn giao.

Folder hoàn chỉnh nằm trong `handoff/ONSPA-TEST-<ngày giờ>/`, kèm `HANDOFF-REPORT.json`, checksum, số bản ghi và `docs/FUNCTION_STATUS.md`. Gửi **folder đã tạo này**, không gửi nguyên workspace có `.local-data` hoặc `.sites-runtime`.

Không đưa `.git`, node_modules, cache, dist, file database, tài khoản/mật khẩu, token, backup cũ và file tạm vào gói. Dữ liệu TEST có thể chứa thông tin do bạn nhập: kiểm tra nội dung được phép chia sẻ trước khi gửi. Bộ quét tự động không thay thế kiểm tra nội dung thủ công.

Chi tiết: `docs/HANDOFF.md` và `docs/FUNCTION_STATUS.md`. JSON gốc và một số bảng viết sẵn vẫn có trong mã nguồn; seed TEST không phải bản sao dữ liệu D1 LIVE.

## Production Plan

Luồng mới dùng `/api/production-plan` trên D1 TEST local. Chọn tuần → nhận bản Engine đã lưu → chọn dòng và sửa → Lưu → Chốt → Chuyển In Transit. Mở chốt cần lý do và tài khoản chủ TEST đã xác thực. Mỗi thao tác lưu cả dữ liệu và lịch sử trong một giao dịch; ghi trực tiếp Plan/In Transit qua API records cũ bị chặn.

Xem `docs/production-plan/IMPLEMENTATION.md` để biết quy tắc chuyển đổi, nguồn GIO_CONG/LINE_CAPACITY còn thiếu và cách nghiệm thu. Migration `0001_production_plan_revision.sql` tự áp dụng khi khởi động; giữ nguyên dữ liệu hiện có.


## Forecast/Demand PDF — khôi phục và lưu bền vững

Database ở `.local-data/d1`; install/build/start không reset hoặc seed. `npm run db:init` áp dụng migration không phá hủy dữ liệu, kiểm tra checksum migration.

- Backup: `npm run db:export`, file ngày giờ trong `backups/test`.
- Restore trên máy mới/database rỗng: `npm run db:init`, rồi `npm run db:import -- <export.json>`. Không xóa database đang dùng để thử restore; dùng folder bàn giao riêng.
- Preview: `npm run dev`, mở http://127.0.0.1:5173/. `/api/test-environment` phải có remote=false, database `.local-data/d1` và nhãn TEST.
- Đã nhập Forecast SX08=302, SX09=304, Demand104 đã lập. Giữ thêm1 Forecast TEST và1 Demand TEST ngoài PDF. Xem `docs/FORECAST-RESTORE-RESULT.md`.
- Nhập lại đúng bộPDF: Python có pdfplumber chạy `scripts/local/extract-planning-pdfs.py <PDF07> <PDF08> <PDFDemand> .local-data/imports/planning-pdfs.json`; kiểm tra kết quả rồi chạy `node scripts/local/import-planning.mjs`. Tự backup trước nhập; upsert và giữ dòng ngoài PDF. Không chạy tự động khi khởi động.
- Parser khóa kỳ/số lượng302/304/104 của bộ này. PDF mới cần kiểm tra nguồn trước khi mở rộng điều kiện, không sửa dữ liệu cho khớp bộ đếm. Trình nhập PDF cũ trên web đã ngừng ghi đè kỳ.
- PDF/JSON nằm ngoài public, trong `.local-data`/`backups`; chặn HTTP, loại khỏi Git. `npm run handoff` xuất TEST mới và quét bí mật khi chuẩn bị folder Sếp.


## Sao lưu dữ liệu D1 và tệp R2 local

Đăng nhập Super Admin TEST rồi mở Quản trị hệ thống → Sao lưu & Bàn giao. FILES local lưu bền vững tại `.local-data/r2`, metadata/lịch sử nằm trong D1 hiện có. Có thể xuất bằng `node scripts/local/export-handover.mjs`; chỉ tài khoản được ghi vai trò Super Admin trong D1 mới được phép. ZIP dữ liệu nằm ở `handoff/` và FILES/backups; không đưa vào Git. Hướng dẫn khôi phục có trong ZIP. Xem [giới hạn và báo cáo kiểm thử](docs/STORAGE-HANDOVER.md) trước khi sử dụng: chưa chuyển hết dữ liệu nguồn cũ sang D1 và chưa tích hợp mọi menu upload.
