# Preview Private bằng Worker đầy đủ và dữ liệu giả

Adapter QA `scripts/verification/codespace-private-preview.mjs` phục vụ việc nghiệm thu PR #7 trên Codespace cũ. Nó **không nằm trong mã triển khai**, không được app/Worker/Vite/package scripts nhập và không thay `allowedHosts`, cookie, quyền, config DB/FILES hay bảo mật production. Không dùng dev server local-owner để chứng minh quyền KHSX.

## Phạm vi cố định

- Chỉ origin `https://spooky-poltergeist-p7pj9xpvjj96f9rj5-5173.app.github.dev`; không wildcard, origin tham số hoặc suy từ `X-Forwarded-*`.
- Node gateway chỉ bind `127.0.0.1`; CLI chỉ cổng 5173 và opt-in trong `CODESPACE_NAME` đã định. Các bài kiểm nội bộ dùng cổng loopback ngẫu nhiên, không forward. Biến môi trường là chốt nhầm môi trường, không là bằng chứng quyền truy cập GitHub.
- Trước launch phải kiểm **cổng vẫn Private** bằng phiên GitHub được phép. Script không đọc/thay visibility, không login GitHub, tạo môi trường hay mua quota. Chạy script không chứng minh port đang Private hoặc truy cập ngoài đã hoạt động.
- Host phải đúng hostname nói trên, không localhost, không cổng/đuôi domain khác. Peer phải loopback. Nếu proxy GitHub thực tế thay Host hoặc dùng đường mạng khác thì **403**, không tự tin `X-Forwarded-Host` hoặc mở allowlist. Cần đọc metadata đã làm sạch qua phiên được phép rồi đối chiếu trước khi điều chỉnh có kiểm thử.
- GET/HEAD cho navigation/assets không bắt có Origin; nếu có phải đúng HTTPS origin. POST/PUT/PATCH/DELETE bắt buộc Origin đó. OPTIONS/TRACE/CONNECT không được chuyển. Kiểm Host/Origin trước Worker; không sửa Origin để hợp thức hóa yêu cầu sai. Duplicate Host/Origin, absolute/protocol-relative URI và body trong GET/HEAD bị chặn.
- Request được chuyển bằng `Miniflare.dispatchFetch()` với URL HTTPS cố định và path đã kiểm. Cookie, Origin, JSON body giữ nguyên; bỏ transport Authorization/forwarded claims, không tạo actor/session hoặc giả Admin. Worker vẫn kiểm auth, quyền, CAS và audit như bình thường. Cookie `__Host-onspa_session; Secure; HttpOnly; SameSite=Strict` được giữ nguyên. Không có CORS wildcard, sửa Domain hoặc bỏ Secure.
- Response body được stream, giữ nhiều Set-Cookie riêng, không follow/chuyển redirect khác origin. Payload QA tối đa 16 MiB (không thay giới hạn production); lỗi guard/oversize đóng kết nối để không tái dùng socket còn body chưa đọc. Lỗi chưa rõ kết quả trả thông báo có thể đã commit, không tự submit lại.

## Dữ liệu và tài khoản

Tái sử dụng `daily-output-loopback.mjs`: full Worker/assets được build từ checkout; Miniflare `cf:false`, DB/R2 volatile mới cho **mỗi tiến trình**, không credential/binding remote và outbound bị chặn. Chỉ migrate/seed vào fixture mới đó, không reset/import `.local-data` cũ, không nối DB/Sheet thật. JSON nền tương thích đã được duyệt vẫn ở source, không phải dump production mới.

QA_KHSX/QA_HR/QA_QLSX/QA_KHO là tài khoản USER giả theo profile hiện có; QA_ADMIN riêng, quick-Line theo luồng thông thường. Mật khẩu giả sinh mới từng tiến trình, chỉ in terminal riêng khi launch, không trả trên endpoint hoặc đưa vào source/chat/log công khai. Đăng nhập bằng form bình thường. Reload cùng tiến trình giữ session; stop/restart bỏ fixture và session, không phải lỗi mất dữ liệu production. Không chia sẻ session/cookie thật.

Phản hồi có `X-ONSPA-Preview: SYNTHETIC; ...`; header này không thay kiểm tra nhãn TEST và khả năng phân biệt dữ liệu giả trên giao diện khi nghiệm thu browser. Không gọi endpoint/bridge Google thật là đã kiểm; outbound bị chặn, không dùng bridge luôn báo thành công.

## Trình tự cho assistant chuẩn bị môi trường

1. Dùng đúng Codespace đã có qua kết nối được phép; không tạo mới, đổi cổng Public hoặc tự sửa quyền. Kiểm repo, branch, HEAD, dirty/untracked work, các server/cổng đang dùng. Không chuyển nhánh/reset/xóa dữ liệu hoặc ngắt preview đang dùng. Tách checkout/worktree QA sạch khi cần, giữ nguyên workspace cũ và `.local-data`.
2. Xác minh đúng commit cần review và dependencies Node24 theo lockfile. Không dùng gói/source/build cũ chỉ vì tên branch giống. Application baseline của lượt này là `8cdebaaa88d88845a14171744e66ebdd1a71fccb`; adapter/tests/docs là thay đổi QA riêng, không sửa app/Worker nghiệp vụ của baseline. Commit QA cuối cần ghi riêng, không gọi toàn bộ gói byte-identical8c.
3. Đọc AGENTS/quy trình/skill runtime/browser khả dụng. Không có browser tool thì không tuyên bố đã kiểm browser. Khi CLI/API bị từ chối, dừng đường đó, không đổi token/quyền hoặc đăng nhập thay Duyên.
4. Khi đã đủ quyền launch TEST và đã kiểm Private, chạy trong checkout QA:
   ```bash
   node scripts/verification/codespace-private-preview.mjs --synthetic-codespace-private
   ```
   CLI tự build mới checkout trước khi tạo fixture và mở listener; build hoặc cổng bận thì dừng, không tự dùng cổng khác/kill server. Không cần tài khoản Cloudflare, không tạo Site/DB cloud. Không sửa biến CODESPACE_NAME để giả kết quả truy cập Codespace từ cloud khác.
5. Giữ server. Mở chính URL forwarded bằng phiên chủ sở hữu GitHub, xác minh đúng trang/app/login, Host/Origin, cookie Secure, reload, QA_KHSX không Admin, dữ liệu mẫu, Plan/LSX/sản lượng và layout desktop/mobile. Browser QA phải chặn/kiểm mọi request ngoài origin, không truy cập production. Tự thử trước khi gửi Duyên; URL lịch sử chưa được mở không được gọi là link test đang chạy.
6. Bàn giao SHA ứng dụng/SHA QA, URL đã xác minh, trạng thái Private/server, phạm vi dữ liệu/role giả và giới hạn. Đây là nghiệm thu logic phân quyền bằng USER giả, **không chứng nhận tài khoản KHSX production**, thật sự nhận hàng Sheet hoặc quyền merge/deploy. Stop có chủ đích chỉ sau review/bàn giao và báo rõ mất fixture giả.

## Kiểm cục bộ

Build đúng source trước, rồi:
```bash
node --test --test-concurrency=1 tests/codespace-private-preview.test.mjs tests/daily-output-loopback-qa.test.mjs tests/production-additional-lsx-worker.test.mjs
```

Các bài kiểm HTTP gọi loopback với Host/Origin HTTPS được giả lập: đúng/sai/thiếu/duplicate, forwarded claims không đổi origin, guard không ghi dữ liệu/audit/session, giữ cookie, assets stream, đăng nhập sai, USER KHSX/HR, reload, chốt Plan theo ngày hiệu lực/CAS/Capacity ACK, HR403 với audit receipt chính xác, logout, giới hạn body và restart không dùng lại dữ liệu/session. Không giả result của Worker hoặc giảm assertion quyền.

Đây **không phải** browser HTTPS qua GitHub: chưa chứng minh GitHub thực tế truyền Host/scheme ra sao, Private login/forwarding đang hoạt động, cookie được browser chấp nhận hay layout đạt. `externalAccessVerified:false` luôn giữ trong kết quả factory/CLI đến khi bên nghiệm thu có bằng chứng riêng. Không chạy thêm CI giống hệt chỉ để cập nhật tiến độ.

Kiểm chốt local: **26/26** (5 adapter + 2 HTTP Worker kế thừa + 19 quick-contract có giao với full CI), TypeScript và build đạt. Header HTTPS được mô phỏng bằng HTTP loopback; có Line A ghi lượng25 và replay đúng một phiếu, mọi raw report cũ bất biến. Guard so toàn bộ business rows và auth accounts/sessions/login-limits trước–sau yêu cầu sai, không so timing metadata của D1 như dữ liệu. Source guard từng từ chối literal mật khẩu giả dài trong test; đổi thành giá trị sai sinh từ passphrase ngẫu nhiên lúc chạy, không nới rule. Có một lượt kiểm phụ thuộc build bị chạy song song khi dist đang được xóa/build; không tính lượt thiếu artifact đó là lỗi sản phẩm hoặc bằng chứng đạt. Lượt26/26 trên chạy sau khi build đã hoàn tất. CI head mới ghi riêng khi terminal; không gán CI8cdebaa cho commit QA mới. Chưa có URL/browser Codespace đã xác minh.
