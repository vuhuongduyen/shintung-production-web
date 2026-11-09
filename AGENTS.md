# ONSPA local development

- Quy trình làm việc chính duy nhất: đọc `docs/ONSPA-DEVELOPMENT-WORKFLOW.md` trước mỗi việc. Toàn bộ trình tự, điều phối, kiểm thử, merge và triển khai được cập nhật tại đó; không tạo hoặc duy trì bản quy trình song song trong tệp này.

- Khi người dùng yêu cầu thiết lập menu Sản xuất/Báo công, đọc `docs/PRODUCTION-REPORTING-DESIGN-2026-09-23.md` cùng `docs/CAPACITY-DESIGN-DECISIONS-2026-09-23.md`; đây là thiết kế đã thảo luận, chưa mặc nhiên là chức năng đang chạy. Kiểm tra source và yêu cầu mới nhất trước khi sửa.

- This folder is the authoritative source. Save application, API, schema and migration changes here.
- No GitHub/Vercel connections, remote pushes, new Sites or publication unless the user explicitly requests that action. Local commits are allowed. Preserve .openai/hosting.json.
- Run preview with `npm run dev`. Only use TEST database configured by config/local-test.json. Never use production D1 credentials, remote bindings or production URLs for writes.
- Preserve .local-data and existing records. No database reset or automatic seed on startup/menu navigation. Seed/import is explicit and requires an empty database.
- Never commit node_modules, cache, build outputs, .local-data, backups, handoff archives, credentials or secret files.
- When asked “Chuẩn bị folder gửi Sếp”: run `npm run handoff`; inspect its report. Do not bypass failed checks or claim completion if packaging fails. Package source, migrations, TEST export and README only via the allowlist; never zip the raw working directory.
- Keep docs/FUNCTION_STATUS.md accurate. Distinguish working persistence from unfinished business workflows. Do not silently declare inherited TypeScript or test failures resolved.
- Keep every module visually consistent with the shared ONSPA layout. Data tables must use the Production Engine table typography, row rhythm and responsive sizes unless a user explicitly requests an exception. Do not create one-off font sizing per menu.
- Show descriptive business values in normal sentence case (for example: `Thường`, `Gấp`, `Kế hoạch tuần`, `Phát sinh đột xuất`). Reserve uppercase for codes and acronyms such as SKU, LSX and Plan ID, or for a status design that is already shared across the whole site.

## Quy chuẩn thanh công cụ ONSPA

- Khi người dùng nói “Tạo thanh công cụ theo quy chuẩn ONSPA”, áp dụng toàn bộ `docs/ONSPA-TOOLBAR-STANDARD.md` tự động.
- Mọi thanh công cụ danh sách mới hoặc sửa phải dùng `components/standard-toolbar/StandardToolbar.tsx`. Menu chỉ khai báo cấu hình bằng `toolbar.action/field/input/select/group/note`, quyền, trạng thái và callback; không sao chép JSX/CSS thanh công cụ.
- Không tạo bộ màu, chiều cao hoặc bố cục riêng. Thao tác → Tra theo → Nội dung tra → Xóa lọc → Tìm kiếm → Quay lại trong một khung CHỨC NĂNG ngay trên bảng.
- Tự phân tích dữ liệu nghiệp vụ để cấu hình trường tra cứu, không đưa ID kỹ thuật/hash/token/secret vào danh sách. Yêu cầu trường cụ thể của người dùng được ưu tiên.
- Phải kiểm tra quyền tại Backend; `allowed`, `disabled` và ToolbarPermissions chỉ điều khiển giao diện. Không biến việc chuẩn hóa toolbar thành thay đổi nghiệp vụ hoặc cơ chế xác thực.
- Khi sửa component chung: chạy typecheck, build, kiểm tra trạng thái chọn dòng/quyền/lọc/ba ngôn ngữ; kiểm tra các menu đã tích hợp trong `docs/TOOLBAR-INTEGRATION-STATUS.md`. Kiểm tra desktop/mobile trước khi tuyên bố đạt nghiệm thu hình ảnh.
- Giữ nguyên Site, URL, Project ID, DB/FILES, quyền public và dữ liệu; không tự publish, migration hoặc seed để làm toolbar.

- Điều chỉnh 21/09/2026: các nút và trường nối tiếp sát nhau, không dùng margin-left:auto để đẩy tra cứu sang mép phải. TRA THEO và NỘI DUNG TRA luôn liền nhau; tháng/ngữ cảnh không chen giữa. Nút và ô nhập cùng chiều cao, căn cùng đường đáy; quy tắc này áp dụng trong StandardToolbar cho mọi menu. Base Forecast có nút Tải file Forecast PDF dùng chức năng lưu tệp gốc hiện có.

## Quy chuẩn cuộn bảng và chọn hàng ONSPA
- Mọi menu hiện tại và tương lai dùng `.table-wrap` (hoặc `.pp-table`/`.it-table` hiện hữu) cho bảng dữ liệu: cuộn dọc trong vùng bảng, cuộn ngang khi tràn, thanh cuộn xanh/xám 12px dùng chung trong `app/planning-compact.css`.
- `AutoTablePagination` đo chiều cao khả dụng cho tất cả wrapper qua `--onspa-table-height`, cập nhật khi đổi menu, dữ liệu hoặc kích thước màn hình; giữ phân trang ngoài vùng cuộn. Không tạo quy chuẩn cuộn riêng theo menu.
- Với bảng chọn nhiều dòng, đặt checkbox chọn tất cả tại tiêu đề cột đầu, có trạng thái chọn một phần; chỉ chọn dòng đủ điều kiện trong danh sách đã lọc. Đặt nút thao tác hàng loạt trong StandardToolbar, không tạo dải chọn tất cả riêng.

## Đồng bộ source ONSPA về Windows (07/10/2026)
- Không dùng GitHub cho đồng bộ này. Mỗi build phải giữ `sourceSyncSnapshot()` trong Vite: tạo gói source bằng allowlist `scripts/handoff/safety.mjs`, không có .env/.git/DB/tệp R2/cache/secrets. Gói chỉ ở Worker server, không đưa source ZIP/base64 vào public hoặc dist/client.
- API `/api/source-sync/*` dùng mã thiết bị đọc source hoặc phiên Admin hiện hành; không dùng khóa Git/Sites. Mã DB chỉ lưu SHA-256, có hạn/thu hồi và phụ thuộc quyền tài khoản/mật khẩu; mã setup hết cùng quyền setup. Mã scope source cũ KHÔNG được đọc dữ liệu: chỉ mã cấp rõ `full-backup` mới được vào `/api/full-backup/*`. Giữ xác thực trước mọi trả manifest/ZIP.
- Bộ cài `scripts/windows` mặc định `C:\website onspa`; source được quản lý riêng dưới `source`, config DPAPI dưới `_sync`, bản trước dưới `versions`. Dừng nếu file local sửa, file riêng hoặc symlink; kiểm tra SHA-256 trước thay folder và khôi phục bản trước nếu đổi folder thất bại. Không tự ghi dữ liệu lên web, không xóa bản cũ.

## Sao lưu đầy đủ về PC (07/10/2026)
- Giữ một Site/DB/FILES. `/api/full-backup` chốt toàn bộ bảng nghiệp vụ bằng D1 batch vào bảng SQL trung gian, sau đó đọc từng trang tối đa 256 dòng / 2 MiB và tải R2 multipart 5 MiB; `quote()` trong SQLite giữ nguyên BLOB/số nguyên lớn. Không lọc bớt entity, không reset/seed. Chỉ bỏ bảng nội bộ Cloudflare/sqlite quản lý (giữ sqlite_sequence nếu có).
- Liệt kê toàn bộ object R2 qua mọi trang, gồm cả file chưa có metadata. Chỉ bỏ prefix transport `_onspa_pc_backup/`; không bỏ các bản lưu nghiệp vụ `backups/`. DB metadata thiếu file = thất bại. Download conditional etag, kiểm tra checksum và danh sách object lần cuối. Không đánh dấu hoàn tất nếu thiếu/thay đổi. Transport có hạn 24h, dọn giới hạn prefix riêng, không xóa file gốc.
- Windows sao lưu theo ngày khi đăng nhập/online, thử lại mỗi 15 phút nếu lỗi; `Sao-luu-ngay.cmd` tạo thêm bản. Mỗi bản dưới `backups` gồm SQL, source ZIP, file gốc đánh số (key và metadata trong manifest), checksums và HOAN-TAT.json. Không tự xóa bản cũ, không phục hồi trên web.
- Toàn bộ auth_accounts/quyền được sao lưu, chỉ hash mật khẩu; khi phục hồi phải vô hiệu auth_sessions, cấp lại mã thiết bị, cấu hình secrets riêng. Không lộ nội dung DB/ZIP/token trong public hay log.

- Quy tắc Tra cứu (09/10/2026): Nhấn Tra cứu chỉ mở trường Tra theo với lựa chọn rỗng “Chọn hạng mục”; giữ nguyên màn hình, bảng dữ liệu, bộ lọc và vị trí hiện tại. Không tự chọn hạng mục, đổi bảng hay mở rộng dữ liệu. Chỉ chuyển giao diện khi người dùng chủ động chọn hạng mục tương ứng. Nội dung tra chỉ xuất hiện sau khi chọn. Hạng mục tổng hợp đặt trong Tra theo, không thêm nút Tổng hợp riêng khi đã có Tra cứu.

- Bổ sung bắt buộc 09/10/2026: Chọn Tra theo cũng KHÔNG đổi bảng, dữ liệu hay điều kiện đang áp dụng. Tách điều kiện đang nhập với điều kiện đã áp dụng; chỉ Tìm kiếm (hoặc Enter tương đương) mới áp dụng nội dung tra. Đổi hạng mục phải giữ nguyên kết quả hiện tại đến lần tìm tiếp theo. Không tìm bằng nội dung rỗng cho SKU/LSX/tên.

- Quy chuẩn lớp giao diện 10/10/2026: bảng cuộn tự cô lập lớp tiêu đề; thanh ghim z-index 10, tab 11, header/menu 17. Khung che/chi tiết cũ bắt đầu từ 20. Không nâng thanh ghim lên trên overlay/dialog; khi sửa phải rà nhóm .overlay/.detail-panel/.drawer, .page-overlay (In Transit/Plan), modal SX, Capacity và hộp thoại quản trị. Không ghim thông báo nằm bên trong khung chi tiết.

- Sửa sao lưu 21/10/2026: bảng `_onspa_pc_snapshot_<13 số>_<32 hex>` chỉ là transport nội bộ; không đưa vào bản sao. Chốt INSERT SELECT trong một batch để giữ snapshot nhất quán; dọn sau thành công/lỗi và thu hồi bảng transport quá 24h. Không thay đổi hoặc bỏ dữ liệu nghiệp vụ. Giữ định dạng SQL/manifest v1 tương thích bộ sao lưu Windows hiện có.

# Quyền Admin bắt buộc (yêu cầu người dùng 22/10/2026)
- Khi thêm menu hoặc mở bất kỳ quyền menu nào cho user, đồng thời mở đầy đủ mọi thao tác hiện có của menu cho tài khoản có vai trò Admin, ở cả giao diện và backend.
- Không dùng danh sách username/bộ phận của user thường để loại Admin khỏi thao tác. Vai trò Admin phải được xác minh từ phiên đăng nhập ở máy chủ, không tin cờ do client gửi.
- Nếu thao tác đại diện bộ phận, Admin được chọn bộ phận hợp lệ; người thao tác vẫn ghi đúng login Admin. Giữ kiểm tra dữ liệu, phiên bản và trạng thái nghiệp vụ để tránh ghi đè/lặp.
- Trước bàn giao kiểm tra menu thực sự hiện và thao tác khả dụng trên giao diện Admin, không chỉ dựa vào build. Giữ ngoại lệ nhật ký vthduyen đã được người dùng yêu cầu.

## Phân quyền bộ phận (22/10/2026)
- User thao tác theo quyền bộ phận và quyền bổ sung riêng đã được người dùng chỉ định. Ngoài phạm vi đó chỉ xem; việc mở menu/tra cứu không cấp quyền ghi.
- Không suy diễn quyền một menu thành quyền mọi menu cùng nhóm. Ví dụ sửa Capacity không cho sửa báo công; sửa nhập kho không cho sửa xuất kho. Kiểm tra ở giao diện và API theo đúng menu.
- Giữ quyền cá nhân đã cấp; không tự xóa hoặc thay bằng mẫu bộ phận khi chưa đối chiếu dữ liệu phân quyền/lịch sử. Rà toàn bộ user từ bảng quyền, không yêu cầu người dùng nhắc lại từng tài khoản.
- Không báo đã kiểm tra toàn bộ quyền thực tế khi chỉ kiểm thử mẫu quyền hoặc chưa đọc được bảng phân quyền bằng phiên Admin.

## Quy trình và phạm vi triển khai hiện hành

Đọc [Quy trình thay đổi ONSPA](docs/ONSPA-DEVELOPMENT-WORKFLOW.md), tài liệu chính duy nhất đã gom quy trình cũ và các điều chỉnh ngày 09/11/2026. Các mặc định đồng bộ hai môi trường ngày 22/10 và chỉ MAIN ngày 31/10 là lịch sử đã được thay thế, không dùng làm chỉ dẫn triển khai hiện tại. Hướng dẫn kỹ thuật/nghiệp vụ khác trong tệp này vẫn giữ nguyên.
