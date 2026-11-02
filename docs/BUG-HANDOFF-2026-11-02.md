# Bàn giao lỗi đã biết — lưu để xử lý sau

Người dùng yêu cầu dừng sửa lỗi và lưu toàn bộ kết quả lên GitHub trước. Báo cáo này chỉ là bàn giao tài liệu; không sửa mã ứng dụng, harness, dữ liệu hoặc quy tắc nghiệp vụ. PR #4 tiếp tục là draft, **chưa đủ nghiệm thu, không merge hoặc deploy**.

## Mốc bằng chứng và phạm vi

- Source được kiểm: [`051a1c413fda17c85f13949aa03fe9d3f40259fc`](https://github.com/vuhuongduyen/shintung-production-web/commit/051a1c413fda17c85f13949aa03fe9d3f40259fc), nhánh `source-sync/live-v807-20261102`, [PR #4](https://github.com/vuhuongduyen/shintung-production-web/pull/4).
- [CI 41414855502](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502): completed/failure. TypeScript và cả ba build đạt.
- 246/246 file kiểm thử đã chạy: 211 file đạt, 35 file có lỗi. Node báo 1.484 test: **1.382 pass, 102 fail, 0 cancelled, 0 skipped, 0 todo**. Không timeout, không file thiếu thống kê cuối.
- Danh sách bên dưới có đủ 102 mục `not ok` của TAP. Có **3 mục tổng hợp `subtestsFailed`** do subtest thất bại; không phải 102 lỗi sản phẩm độc lập và chưa xác định được tổng số nguyên nhân gốc.
- Snapshot nguồn ONSPA v807: `8b22aa8cc69ab9c7d2e9d2e098ccb8923d88c5fe`. Cây tệp snapshot trước CI: `6768b1f330f59339e73db6da512ea09a7ee712dc`. Xem `SOURCE-TRANSFER-MANIFEST.json` và `SOURCE-TRANSFER-NOTICE.md`; đây là source đã lọc, không phải backup DB hay archive triển khai nguyên trạng.
- Giữ JSON nền và danh tính nhúng được duyệt; không đưa runtime DB, uploads, backups, credentials hay raw log chứa payload vào báo cáo. Trích thông báo lỗi để đối chiếu; log đầy đủ vẫn ở Actions riêng tư.
- Chưa chạy lint hoặc QA trình duyệt thật cho bản bàn giao. DOM/Miniflare/synthetic test không xác nhận quyền, dữ liệu hoặc vận hành production thực tế.
- Vấn đề dữ liệu cũ thay đổi khi danh mục/đơn giá thay đổi (ngày hiệu lực/hồi tố) và yêu cầu chuyển báo sản lượng ngày **chưa được xử lý trong lượt này**, chưa được chứng minh bao phủ đầy đủ bởi bộ test. Không áp dụng nguyên trạng kết luận audit v796 cho v807 khi chưa kiểm lại.
- **Điều kiện trước merge:** phải có link test cô lập đúng bản cần review và được nghiệm thu. Báo cáo này không cấp link preview và không tuyên bố môi trường test đã được triển khai. Không dùng localhost hoặc fixture riêng làm bằng chứng nghiệm thu toàn app.

## Tổng hợp theo nhóm

Số lượng cộng theo file/test lỗi để bàn giao, không khẳng định mọi test trong một nhóm có chung một nguyên nhân. Ưu tiên phản ánh rủi ro cần điều tra, không khẳng định lỗi đã tồn tại trên production.

| Nhóm | Test lỗi | File | Ưu tiên | Phân loại | Hướng xử lý sau |
|---|---:|---:|---|---|---|
| Audit và quyền ghi | 21 | 6 | P1 | Xung đột hợp đồng test/source; chưa kết luận lỗi sản phẩm | Giữ dữ liệu nghiệp vụ bất biến; quyết định có ghi receipt cho denied rồi kiểm đầy đủ actor/route/status/outcome. Không bỏ qua audit khi so sánh. |
| Capacity | 3 | 1 | P1 | Khác biệt số liệu chưa rõ | Đối chiếu ba giá trị với công thức được duyệt bằng fixture tính tay; không thay expected hoặc công thức để xanh. |
| Điều phối nhân sự | 14 | 4 | P1 | Trộn selector/fixture cũ và hành vi chưa xác minh | Tái hiện sender/receiver và quyền bằng fixture; đổi selector chỉ khi chứng minh cùng thao tác; giữ kiểm tra draft, phạm vi hủy và API. |
| Tìm kiếm | 22 | 3 | P2 | Chưa phân định fixture với hành vi sản phẩm | Ghi request và trạng thái đang nhập/đã áp dụng trong từng ca; kiểm Search/Enter trước khi sửa test hoặc ứng dụng. |
| Nhãn và cấu trúc giao diện | 22 | 12 | P2 | Một phần cấu trúc test cũ; phần hành vi chưa rõ | Đối chiếu thiết kế được duyệt; kiểm DOM/role và kết quả thao tác, không chỉ nới regex/selector. |
| Quyền và xác nhận theo nhóm | 5 | 2 | P1 | Hợp đồng test cũ xung đột luồng hiện tại | Đối chiếu quyền API/menu/Line và hành vi busy/denied trước khi thay bài test cũ. Test đường batch hiện tại đã chứng minh thiếu quyền không gửi request. |
| Kế hoạch, báo cáo và workflow | 11 | 3 | P1 | Chưa phân định cấu trúc card với sai số liệu | Tách cách đọc card theo vị trí khỏi công thức, kiểm fixture nhỏ độc lập; không sửa công thức/giá trị mong đợi khi chưa quyết định. |
| Giới hạn Final | 1 | 1 | P1 — ưu tiên điều tra đầu | Có khác biệt helper/workflow; quy tắc cần quyết định | Chốt quy tắc Final không vượt công đoạn trước, rồi kiểm đường preview/backfill/complete không ghi khi bị từ chối và partial hợp lệ. |
| Phiên bản, danh mục và cache | 3 | 3 | P1/P2 tùy tác động | Ba nguyên nhân độc lập chưa kết luận | Forecast: kiểm CAS; danh mục: chốt ngưng việc theo ngày thay hủy; cache: kiểm generation và reference với dữ liệu mới. |

## Bằng chứng nguyên nhân đã xác minh

- `components/production-management.tsx:92`: quyền thao tác đọc từ `rights.work/manager/hr/correct` theo mode, không còn chỉ suy từ quyền menu client. Hàm `reviewSelected` tại dòng 224 thay đường xác nhận từng phiếu cũ. Test cũ tìm `review` và kỳ vọng quyền Line/manager vẫn được giữ lỗi, chưa nới assertion.
- `worker/site-api.mjs:119` bọc mutation bằng audit; `worker/action-audit.mjs:27` ghi receipt trước/sau, kể cả denied. Đây là xung đột với assertion yêu cầu toàn bộ records, kể cả audit, bất biến. Chưa tự quyết định bỏ/giữ hợp đồng cũ.
- `scripts/local/capacity.mjs:163` bắt acknowledgement vệ sinh; `scripts/local/employees.mjs:27` bắt ngày bắt đầu cho nhân viên mới. Fixture đã được bổ sung trước mốc CI này, không sửa backend; số lỗi Capacity giảm từ 12 xuống 3. Các ca thiếu/sai Line/phiên bản và ngày hiệu lực vẫn được chạy.
- Ba giá trị Capacity còn khác: expected `null`, actual `691.125`; expected `674.975`, actual `673.55`; expected `670.3833333333333`, actual `676.7166666666667`. Chưa đổi công thức hoặc expected.
- `lib/production-final-limit.mjs` có helper kiểm giới hạn; tìm kiếm source tại mốc này không thấy helper được gọi trong scripts/local workflow. Test tích hợp yêu cầu rejection nhưng không nhận được. Đây là bằng chứng cần điều tra đường workflow, chưa phải phê duyệt thay quy tắc Final.
- Các lỗi selector, nhãn, tab và snapshot DOM chỉ chứng minh test và source khác nhau; chưa đủ để kết luận tất cả là test cũ hoặc tất cả là lỗi sản phẩm.

## Danh sách từng test thất bại

Tên test giữ nguyên tiếng Anh để tìm chính xác trong source/log. `~` trong TAP là null. Expected/actual chỉ chép khi giá trị ngắn; trường hợp DOM/record lớn ghi thông báo lỗi gốc hoặc trích đoạn và liên kết log, không chép payload nhạy cảm. Mỗi mục kế thừa phân loại/hướng xử lý của nhóm ở bảng trên.

### tests/action-feedback-production.test.mjs

#### F001 — ProductionManagement click: missing category/text explains and preserves previously applied results

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L47) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #1.
- Expected: `1`; actual: `2`.

```text
Expected values to be strictly equal:

2 !== 1
```

#### F002 — ActualWorkSchedule click: blank employee/week/month criteria explain without changing applied results

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L60) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #2.

```text
The input was expected to not match the regular expression /NOTE-BETA/. Input:

'Thứ Hai (12/10/2026)HC bắt đầu 12/10/2026 · chọn giờ 24h◷–HC kết thúc 12/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 12/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 12/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 12/10/2026Chưa đủ dữ liệu ▸Thứ Ba (13/10/2026)HC bắt đầu 13/10/2026 · chọn giờ 24h◷–HC kết thúc 13/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 13/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 13/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 13/10/2026Chưa đủ dữ liệu ▸Thứ Tư (14/10/2026)HC bắt đầu 14/10/2026 · chọn giờ 24h◷–HC kết thúc 14/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 14/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 14/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 14/10/2026Chưa đủ dữ liệu ▸Thứ Năm (15/10/2026)HC bắt đầu 15/10/2026 · chọn giờ 24h◷–HC kết thúc 15/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 15/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 15/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 15/10/2026Chưa đủ dữ liệu ▸Thứ Sáu (16/10/2026)HC bắt đầu 16/10/2026 · chọn … [trích đoạn]
```

#### F003 — ActualWorkSchedule click: locked Line explains and unlocked Line applies only on search

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L70) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #3.
- Expected: `0: 'B'`; actual: `xem thông báo/log`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'B'
- ]
```

#### F004 — ProductionManagement enter: missing category/text explains and preserves previously applied results

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L47) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #4.
- Expected: `1`; actual: `2`.

```text
Expected values to be strictly equal:

2 !== 1
```

#### F005 — ActualWorkSchedule enter: blank employee/week/month criteria explain without changing applied results

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L60) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #5.

```text
The input was expected to not match the regular expression /NOTE-BETA/. Input:

'Thứ Hai (12/10/2026)HC bắt đầu 12/10/2026 · chọn giờ 24h◷–HC kết thúc 12/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 12/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 12/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 12/10/2026Chưa đủ dữ liệu ▸Thứ Ba (13/10/2026)HC bắt đầu 13/10/2026 · chọn giờ 24h◷–HC kết thúc 13/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 13/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 13/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 13/10/2026Chưa đủ dữ liệu ▸Thứ Tư (14/10/2026)HC bắt đầu 14/10/2026 · chọn giờ 24h◷–HC kết thúc 14/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 14/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 14/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 14/10/2026Chưa đủ dữ liệu ▸Thứ Năm (15/10/2026)HC bắt đầu 15/10/2026 · chọn giờ 24h◷–HC kết thúc 15/10/2026 · chọn giờ 24h◷Nghỉ trưa bắt đầu 15/10/2026 · chọn giờ 24h◷–Nghỉ trưa kết thúc 15/10/2026 · chọn giờ 24h◷——Người thực tế và người nghỉ 15/10/2026Chưa đủ dữ liệu ▸Thứ Sáu (16/10/2026)HC bắt đầu 16/10/2026 · chọn … [trích đoạn]
```

#### F006 — ActualWorkSchedule enter: locked Line explains and unlocked Line applies only on search

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L70) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #6.
- Expected: `0: 'B'`; actual: `xem thông báo/log`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'B'
- ]
```

#### F007 — ProductionProgressReview click: blank SKU/LSX/name explains and retains applied rows

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L90) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #9.

```text
The input did not match the regular expression /LSX-ALPHA/. Input:

'Tuần kế hoạch 42: 12/10/2026 – 18/10/2026LSX-BETALSX-BETASKU-BETAProduct BETA—A—12/10/202618/10/2026—100000Nhân viênChưa ghi nhận nhân viên00Chưa đồng bộ SXPLAN-BETA\n' +
  'Chưa ghi nhận nhân viên'
```

#### F008 — ProductionProgressReview enter: blank SKU/LSX/name explains and retains applied rows

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-production.test.mjs#L90) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #10.

```text
The input did not match the regular expression /LSX-ALPHA/. Input:

'Tuần kế hoạch 42: 12/10/2026 – 18/10/2026LSX-BETALSX-BETASKU-BETAProduct BETA—A—12/10/202618/10/2026—100000Nhân viênChưa ghi nhận nhân viên00Chưa đồng bộ SXPLAN-BETA\n' +
  'Chưa ghi nhận nhân viên'
```

### tests/business-menu-views.test.mjs

#### F009 — business menu views add no mutations, preserve custom/department records and respect disabled grants

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/business-menu-views.test.mjs#L10) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #1.

```text
GETs and denied mutations preserve all stored rights, scopes and production records
+ actual - expected
... Skipped lines

  [
    {
      entity: 'admin_audit',
[Lược nội dung record/credential; xem log riêng tư]
      record_key: '2744712e-c491-498b-8b64-ab5959520c9d',
...
    },
+   {
+     entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: '202aa5e2-3bd2-4138-9148-094b961ddfa3',
+     updated_at: '2026-11-02T08:42:13.830Z',
+     updated_by: 'department'
+   },
+   {
+     entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: '2c85bc30-72e5-4229-8450-be24e250251a',
+     updated_at: '2026-11-02T08:42:12.371Z',
+     updated_by: 'custom'
```

### tests/forecast-import.test.mjs

#### F010 — September report imports into October from the stored PDF, preserving previous rows and history

- Nhóm: **Phiên bản, danh mục và cache** · Ưu tiên: P1/P2 tùy tác động.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/forecast-import.test.mjs#L11) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #1.

```text
'Dữ liệu đã được người khác sửa. Nội dung bạn đang nhập được giữ lại; hãy tải bản mới và đối chiếu trước khi lưu lại.'
```

### tests/pcb493-single-back.test.mjs

#### F011 — disabled or unauthorized current layer never falls back to an outer callback

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/pcb493-single-back.test.mjs#L65) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #6.

```text
The input was expected to not match the regular expression /<button/. Input:
```

#### F012 — SKU guarded form/history/detail beats lookup, Capacity panel beats lookup and lookup beats parent

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/pcb493-single-back.test.mjs#L75) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #7.

```text
The input did not match the regular expression /onClick:onNavigateSummary\},t\('Quay lại','返回','Back'\), true, 'back', 'parent'/. Input:
```

#### F013 — all changed menu action callbacks, disabled and permission props retain their original fingerprints

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/pcb493-single-back.test.mjs#L87) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #9.
- Expected: `288`; actual: `325`.

```text
app/page.tsx

325 !== 288
```

#### F014 — Labor history has one whole-screen Back in the foreground; callback and dirty guard remain intact

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/pcb493-single-back.test.mjs#L110) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #11.
- Expected: `1`; actual: `0`.

```text
history must have one Back in the entire rendered tree

0 !== 1
```

### tests/production-backfill-dom.test.mjs

#### F015 — backfill selection is read-only, preview consent required, repeated apply sends once

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-backfill-dom.test.mjs#L2) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #1.

```text
"Cannot read properties of undefined (reading 'click')"
```

### tests/production-detail.test.mjs

#### F016 — timestamps are date first in Vietnam and employee count keeps names inside a closed disclosure

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-detail.test.mjs#L90) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #7.

```text
The input did not match the regular expression /<details class="production-employee-count" name="onspa-employee-lists"><summary[^>]*>4<\/summary>/. Input:
```

#### F017 — progress opens with every planning-synced order, including orders without any production reports or events

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-detail.test.mjs#L147) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #12.
- Expected: `true`; actual: `false`.

```text
'Chưa SX'
```

#### F018 — daily output follows productionDate and groups exits per LSX/day; unit labor waits for the whole order across months

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-detail.test.mjs#L193) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #16.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    [
+     '2026-10-02',
+     200
+   ],
+   [
      '2026-09-30',
      100
    ],
-   [
-     '2026-10-02',
-     200
-   ]
  ]
```

### tests/production-final-limit.test.mjs

#### F019 — workflow API rejects excessive Final without writes and allows partial exit

- Nhóm: **Giới hạn Final** · Ưu tiên: P1 — ưu tiên điều tra đầu.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-final-limit.test.mjs#L13) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #7.

```text
'Missing expected rejection.'
```

### tests/production-payroll-export.test.mjs

#### F020 — payroll workbook exports only monthly summary and both employee lines, with column formulas; totals conserve funds

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-payroll-export.test.mjs#L13) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #1.

```text
The input did not match the regular expression /Giờ hoàn thành Line ÷ Giờ SX Line × 100%/. Input:

'Hiệu suất và tiền sản lượng · 10/2026\n' +
  'Thời điểm xuất\n' +
  '13:30 07/10/2026\n' +
  'Trạng thái\n' +
  'Dữ liệu ví dụ - dùng để tính thử.\n' +
  'Quỹ chung A + B (đồng)\n' +
  '6000000\n' +
  'Kết quả hiệu suất và tiền sản lượng\n' +
  'Line\n' +
  'Hiệu suất (%)\n' +
  'Giờ công chuẩn HT (line đang chọn) ÷ Giờ SX (line đang chọn) × 100%\n' +
  'Hệ số quỹ\n' +
  'Tra Hiệu suất (%) trong Bảng hệ số\n' +
  'Tỷ trọng phân bổ (%)\n' +
  'Giờ công chuẩn HT (line đang chọn) ÷ (Giờ công chuẩn HT (Line A) + Giờ công chuẩn HT (Line B)) × 100%\n' +
  'Quỹ phân bổ trước hệ số\n' +
  'Quỹ chung A + B (đồng) × Tỷ trọng phân bổ (%) ÷ 100\n' +
  'Quỹ sản lượng được hưởng\n' +
  'Quỹ phân bổ trước hệ số × Hệ số quỹ\n' +
  'Line A\n' +
  '0.98\n' +
  '0.95\n' +
```

### tests/production-plan-transferred-display.test.mjs

#### F021 — default working list hides transferred rows in table, report, pagination and export without losing capacity/history

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L79) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #1.

```text
list hours exclude transferred/cancelled/deferred; weekly allocation remains committed
+ actual - expected

  [
    '20',
+   '0',
+   '0 false',
    '20',
+   '100 ▾',
+   '80'
-   '100',
-   '60'
  ]
```

#### F022 — default retains cancelled and deferred rows, visibly marked, after reset and Back without reserving their hours

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L191) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #13.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    '0',
+   '0',
+   '0 false',
+   '0',
+   '100 ▾',
-   '10',
    '100',
-   '90'
  ]
```

#### F023 — 22 transferred rows leave zero list hours, retain weekly overload and reappear across history pages without double counting

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L206) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #14.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    [
      '0',
+     '0',
+     '0 false',
+     '0',
+     '430.825 ▾',
-     '518.5',
      '430.825',
-     '-87.67500000000001'
    ],
    [
      '0',
+     '0',
+     '0 false',
+     '0',
+     '517.275 ▾',
-     '552',
      '517.275',
-     '-34.72500000000002'
    ]
```

#### F024 — status, SKU and type filters partition workload while weekly capacity, balance and load remain invariant

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L220) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #15.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    '30',
+   '0',
+   '0 false',
+   '30',
+   '100 ▾',
+   '70'
-   '20',
-   '100',
-   '50'
  ]
```

#### F025 — Line filters preserve each whole-line allocation including a completely hidden Line C

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L232) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #16.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    'A',
    'B',
-   'C'
  ]
```

#### F026 — switching weeks does not reuse hours from the previous week and cached return keeps the correct partition

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L239) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #17.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
-   '15',
    '0',
+   '0',
+   '0 false',
+   '0',
+   '80 ▾',
    '80',
-   '65'
  ]
```

#### F027 — pending, rejected, uncertain and verified transfers change card partitions only after authoritative readback

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L267) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #19.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    '50',
    '0',
+   '0 false',
-   '100',
    '50',
+   '100 ▾',
+   '50'
  ]
```

#### F028 — real API and isolated TEST database: partial transfer updates rendered totals, preserves capacity/history, and retry cannot duplicate

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L282) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #20.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
-   '50',
    '0',
+   '0',
+   '0 false',
+   '0',
+   '100 ▾',
    '100',
-   '50'
  ]
```

#### F029 — row status changes cannot finalize a plan; only the explicit close toolbar action can

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-transferred-display.test.mjs#L315) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #21.
- Expected: `'Dự kiến'`; actual: `xem thông báo/log`.

```text
wait for server confirmation
+ actual - expected

+ undefined
- 'Dự kiến'
```

### tests/production-workflow.test.mjs

#### F030 — Capacity forecast does not deduct hours; HR actual absence immediately adjusts saved reports

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-workflow.test.mjs#L11) · [Log shard 1](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122704) · TAP #1.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   {
-     approvedAt: undefined,
-     days: [
-       {
-         breaks: [
-           {
-             end: '10:10',
-             start: '10:00'
-           },
-           {
-             end: '15:10',
-             start: '15:00'
-           }
-         ],
-         cleaning: [],
-         date: '2026-09-21',
-         hcEnd: '17:00',
-         hcStart: '08:00',
-         lunchEnd: '13:00',
```

### tests/basic-master.test.mjs

#### F031 — cancellation retains SKU, labor and employee values and history, excludes future use and rejects stale/duplicate cancellation

- Nhóm: **Phiên bản, danh mục và cache** · Ưu tiên: P1/P2 tùy tác động.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/basic-master.test.mjs#L16) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #1.

```text
'Không dùng Hủy nhân viên. Hãy sửa và nhập Ngày ngưng làm việc.'
```

### tests/capacity.test.mjs

#### F032 — Plan waits for KHSX, preserves frozen basis, blocks new close while adjusting

- Nhóm: **Capacity** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/capacity.test.mjs#L142) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #12.
- Expected: `~`; actual: `691.125`.

```text
Expected values to be strictly equal:

691.125 !== null
```

#### F033 — aggregate leave saves without employees and retains total changes in confirmation history

- Nhóm: **Capacity** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/capacity.test.mjs#L173) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #14.
- Expected: `true`; actual: `false`.

```text
'673.55 != 674.975'
```

#### F034 — counted leave rows persist, revise with history and update Plan; old totals remain until explicitly replaced

- Nhóm: **Capacity** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/capacity.test.mjs#L205) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #18.
- Expected: `true`; actual: `false`.

```text
'676.7166666666667 != 670.3833333333333'
```

### tests/menu-permission-matrix.test.mjs

#### F035 — menu visibility: LINE_A

- Nhóm: **Quyền và xác nhận theo nhóm** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/menu-permission-matrix.test.mjs#L22) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #9.
- Expected: `false`; actual: `true`.

```text
LINE_A: Lịch sản xuất thực tế

true !== false
```

#### F036 — menu visibility: LINE_B

- Nhóm: **Quyền và xác nhận theo nhóm** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/menu-permission-matrix.test.mjs#L22) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #10.
- Expected: `false`; actual: `true`.

```text
LINE_B: Lịch sản xuất thực tế

true !== false
```

### tests/permission-denial-feedback.test.mjs

#### F037 — QLSX entry points guard before network or editor mutation

- Nhóm: **Quyền và xác nhận theo nhóm** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/permission-denial-feedback.test.mjs#L60) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #8.

```text
The input did not match the regular expression /async function review.*if\(!data.rights.confirm\|\|!confirmReportAllowed\).*return false;.*fetch\(/. Input:

'"use client";\n' +
  "import {mergeProductionSavedResult} from '../lib/production-saved-result.mjs';\n" +
  "import {createReviewRunner,submitReviewSelection} from '../lib/production-review-selection.mjs';\n" +
  "import type {ReviewSelection} from './production-report-day-review';\n" +
  'import ProductionAssignmentOverview from "./production-assignment-overview";\n' +
  "import ProductionReportingDayCancel from './production-reporting-day-cancel';\n" +
  "import {projectLiveStages} from '../lib/production-stage-live.mjs';\n" +
  'import {useProductionActionNotice} from "./production-action-notice";\n' +
  "import ProductionWorkActionDialog from './production-work-action-dialog';\n" +
  'import {productionRuntime} from "../lib/production-runtime.mjs";\n' +
  "import {notifyInvalidAction,notifyActionFailure} from '../lib/action-feedback';\n" +
  "import {FeedbackActionButton} from './action-feedback';\n" +
  'import {vietnamMond… [trích đoạn]
```

#### F038 — real production handler bodies deny view-only calls before fetch, editor state or form parsing

- Nhóm: **Quyền và xác nhận theo nhóm** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/permission-denial-feedback.test.mjs#L70) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #9.
- Expected: `true`; actual: `xem thông báo/log`.

```text
'review'
```

#### F039 — actual production guard preserves Lưu-only, line, and manager access while denying view-only and HR work

- Nhóm: **Quyền và xác nhận theo nhóm** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/permission-denial-feedback.test.mjs#L100) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #13.
- Expected: `true`; actual: `false`.

```text
Expected values to be strictly equal:

false !== true
```

### tests/production-allocation-workspace-ui.test.mjs

#### F040 — 403 clears retained queue and uses bounded server diagnosis; unverified or read-only submission remains denied

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-workspace-ui.test.mjs#L14) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #2.
- Expected: `xem thông báo/log`; actual: `''`.

```text
The input did not match the regular expression /await allocationDenialMessage\(response\)/. Input:

''
```

#### F041 — absent QLSX scope preserves backend reason and adds relevant setup path

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-workspace-ui.test.mjs#L21) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #3.
- Expected: `xem thông báo/log`; actual: `'Chưa được cấu hình phạm vi QLSX cho Chờ phân bổ. Admin thiết lập tại Capacity tuần → Lịch làm việc dự kiến → Điều phối nhân sự → Thiết lập QLSX.'`.

```text
The input did not match the regular expression /Admin thiết lập tại Capacity tuần → Lịch làm việc → Điều phối nhân sự → Thiết lập QLSX/. Input:

'Chưa được cấu hình phạm vi QLSX cho Chờ phân bổ. Admin thiết lập tại Capacity tuần → Lịch làm việc dự kiến → Điều phối nhân sự → Thiết lập QLSX.'
```

### tests/production-correction-lookup.test.mjs

#### F042 — lookup starts closed, opening/selecting preserves rows, search and Enter apply, back preserves filter

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-correction-lookup.test.mjs#L6) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #1.
- Expected: `true`; actual: `~`.

```text
The expression evaluated to a falsy value:

  assert.ok(document.querySelector('.correction-time-entry'))
```

### tests/production-examples.test.mjs

#### F043 — retired examples routes enforce auth, exact 410 response and no DB/R2 mutation

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-examples.test.mjs#L13) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #1.

```text
POST /api/production-examples must not write DB/R2
+ actual - expected
... Skipped lines

  {
    examples: [],
    objects: [],
    rows: [
      {
...
      },
+     {
+       entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+       record_key: '3b0f8037-763c-4a7c-8801-a5b9b54171c8',
+       updated_at: '2026-11-02T08:44:02.154Z',
+       updated_by: 'TEST_USER_016@example.test'
+     },
+     {
+       entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+       record_key: '92896633-6dbf-480c-a69f-108e9c51e01c',
+       updated_at: '2026-11-02T08:44:02.104Z',
+       updated_by: 'viewer@example.test'
```

### tests/production-quantity-sync.test.mjs

#### F044 — confirmed output synchronizes exact LSX cumulatively; pending, repeat and concurrent review never double count

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-quantity-sync.test.mjs#L52) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #1.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F045 — rejection and failed confirmation keep quantity unchanged and do not create warehouse receipts

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-quantity-sync.test.mjs#L100) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #3.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

### tests/production-work-calendar-headcount.test.mjs

#### F046 — provisional banner leaves LSX staffing, action callbacks and saved report hours unchanged

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-work-calendar-headcount.test.mjs#L84) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #7.

```text
The input did not match the regular expression /Có mặt tại giờ xuất \/ Phân công/. Input:
```

### tests/search-enter.test.mjs

#### F047 — ACTUAL schedule monthly lookup Enter from month field opens chosen month without touching HR save

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-enter.test.mjs#L158) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #13.
- Expected: `false`; actual: `true`.

```text
Expected values to be strictly equal:

true !== false
```

#### F048 — ACTUAL schedule category select accepts an open picker then closed Enter applies monthly lookup

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-enter.test.mjs#L164) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #14.
- Expected: `false`; actual: `true`.

```text
Expected values to be strictly equal:

true !== false
```

#### F049 — ACTUAL schedule closed Line filter Enter equals click and cannot change a locked or busy Line

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-enter.test.mjs#L168) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #15.
- Expected: `0: 'B'`; actual: `xem thông báo/log`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'B'
- ]
```

#### F050 — ACTUAL schedule older-browser pointer fallback conservatively requires a second Enter or refocus

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-enter.test.mjs#L193) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #18.
- Expected: `0: 'B'`; actual: `xem thông báo/log`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ []
- [
-   'B'
- ]
```

### tests/site-api.test.mjs

#### F051 — Site APIs use trusted identity, isolate bindings, retain D1/R2 data and never seed on reads

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/site-api.test.mjs#L10) · [Log shard 2](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122657) · TAP #1.

```text
retiring examples must not mutate actual records
+ actual - expected
... Skipped lines

  [
    {
      entity: 'admin_audit',
[Lược nội dung record/credential; xem log riêng tư]
      record_key: '411a04de-00a4-4166-a5fd-dc6378ec3a91',
...
    },
+   {
+     entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: '98ebc3c7-d4dd-42e1-b4d9-2529856e5cec',
+     updated_at: '2026-11-02T08:45:32.699Z',
+     updated_by: 'admin@example.test'
+   },
+   {
+     entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: 'e0e84027-e0fd-434f-961f-775edf9a8dca',
+     updated_at: '2026-11-02T08:45:32.793Z',
+     updated_by: 'admin@example.test'
```

### tests/action-feedback-lifecycle.test.mjs

#### F052 — failure notice has visible title, icon and actionable detail; permission failure explains next step

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-lifecycle.test.mjs#L17) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #6.
- Expected: `'THAO TÁC KHÔNG THÀNH CÔNG'`; actual: `'Thao tác không thành công'`.

```text
Expected values to be strictly equal:
+ actual - expected

+ 'Thao tác không thành công'
- 'THAO TÁC KHÔNG THÀNH CÔNG'
```

#### F053 — notification heading, close label and permission guidance follow all three languages

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/action-feedback-lifecycle.test.mjs#L18) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #7.
- Expected: `'THAO TÁC KHÔNG THÀNH CÔNG'`; actual: `'Thao tác không thành công'`.

```text
Expected values to be strictly equal:
+ actual - expected

+ 'Thao tác không thành công'
- 'THAO TÁC KHÔNG THÀNH CÔNG'
```

### tests/global-action-feedback.test.mjs

#### F054 — shared host is role-independent, fixed and dismissible; no global click interception or raw payload

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/global-action-feedback.test.mjs#L10) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #4.

```text
The input did not match the regular expression /role="alert"/. Input:
```

#### F055 — all explicit application native disabled buttons use shared explained action components

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/global-action-feedback.test.mjs#L11) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #5.
- Expected: `true`; actual: `false`.

```text
'actual-work-schedule.tsx missing explicit reason'
```

### tests/hr-attendance-entry.test.mjs

#### F056 — HR button replaces three tabs, opens separate retained workspace; warehouse/transfer and calendar drafts remain

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/hr-attendance-entry.test.mjs#L50) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #5.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    'Phụ kho',
+   'CV khác',
    'Chuyển Line',
+   'Thu hồi nhân sự'
  ]
```

### tests/line-auth.test.mjs

#### F057 — Line users are explicitly created, persist, stay scoped, and cannot acquire admin access

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/line-auth.test.mjs#L14) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #1.

```text
denied writes leave every record unchanged
+ actual - expected
... Skipped lines

  [
    {
      entity: 'admin_audit',
[Lược nội dung record/credential; xem log riêng tư]
      record_key: '1801ed9b-f6f8-41e2-90a5-6bf5e38fde91',
...
      entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: '0ff2994c-71f8-4fb8-beae-cbcdf39a3801',
+     updated_at: '2026-11-02T08:42:36.665Z',
+     updated_by: 'LINE_A'
+   },
+   {
+     entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: '2e1b4a63-b9df-45f0-83b9-b050d1778994',
+     updated_at: '2026-11-02T08:42:36.633Z',
+     updated_by: 'LINE_A'
+   },
+   {
```

#### F058 — correction Line filter is locked to session while unrestricted users keep all choices

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/line-auth.test.mjs#L112) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #3.
- Expected: `true`; actual: `false`.

```text
The expression evaluated to a falsy value:

  assert.ok(parent.includes('<ProductionCorrections sessionLine={viewLine}'))
```

### tests/pcb493-employee-toolbar.test.mjs

#### F059 — load/save/import and permission expressions remain separate from lookup actions

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/pcb493-employee-toolbar.test.mjs#L46) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #5.

```text
The input did not match the regular expression /toolbar\.action\(\{disabled:busy\|\|!allowed,onClick:/. Input:
```

### tests/production-allocation-compact-mounted.test.mjs

#### F060 — receiver cancellation opens explicit reason confirmation and retains durable visible history

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-compact-mounted.test.mjs#L82) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #4.
- Expected: `true`; actual: `xem thông báo/log`.

```text
The expression evaluated to a falsy value:

  assert.ok(node)
```

#### F061 — allocation error notice expires after four seconds while retry details and verification guards remain

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-compact-mounted.test.mjs#L117) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #6.
- Expected: `1`; actual: `0`.

```text
Expected values to be strictly equal:

0 !== 1
```

#### F062 — open cancellation confirmation and typed reason survive six verification cycles without replacing the confirm button

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-compact-mounted.test.mjs#L130) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #7.
- Expected: `true`; actual: `xem thông báo/log`.

```text
The expression evaluated to a falsy value:

  assert.ok(node)
```

### tests/production-allocation-queue-ui.test.mjs

#### F063 — scope C permits only C source and target, sender can withdraw pending subwindows only

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-queue-ui.test.mjs#L35) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #2.

```text
The input did not match the regular expression /Rút Ngọc/. Input:
```

#### F064 — expired, fully allocated, unrelated and unconfigured scopes offer no mutation controls

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-queue-ui.test.mjs#L43) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #3.

```text
The input did not match the regular expression /0 người đang chờ nhận/. Input:
```

#### F065 — withdrawal is a selected pending subwindow, never a whole-offer cancellation

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-queue-ui.test.mjs#L74) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #7.

```text
"Cannot read properties of undefined (reading 'type')"
```

#### F066 — planning allocations and old actual records remain distinct and unconverted

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-queue-ui.test.mjs#L113) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #13.

```text
The input did not match the regular expression /Lịch kế hoạch/. Input:
```

### tests/production-allocation-stable-mounted.test.mjs

#### F067 — queue shell and edited form retain DOM, dates and draft through refresh, error and week/Line context verification

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-stable-mounted.test.mjs#L28) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #1.
- Expected: `true`; actual: `false`.

```text
all five controls exist together before permission/data verification

false !== true
```

#### F068 — denial retains the outer shell, removes restricted data and blocks commands; identity change clears old drafts

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-stable-mounted.test.mjs#L62) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #2.
- Expected: `true`; actual: `xem thông báo/log`.

```text
The expression evaluated to a falsy value:

  assert.ok(req)
```

#### F069 — calendar mounts coordination immediately, before latest-week and capacity reads; loaded calendar keeps the same shell

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-stable-mounted.test.mjs#L75) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #3.
- Expected: `true`; actual: `~`.

```text
The expression evaluated to a falsy value:

  assert.ok(shell)
```

#### F070 — Save allocation keeps the same button and edited fields through six refresh/verification cycles and recoverable errors

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-stable-mounted.test.mjs#L88) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #4.
- Expected: `true`; actual: `xem thông báo/log`.

```text
The expression evaluated to a falsy value:

  assert.ok(req)
```

#### F071 — verified cancellation stays enabled during six background reads; read failure and revocation still lock or clear it

- Nhóm: **Điều phối nhân sự** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-allocation-stable-mounted.test.mjs#L138) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #6.
- Expected: `true`; actual: `xem thông báo/log`.

```text
The expression evaluated to a falsy value:

  assert.ok(n)
```

### tests/production-attendance-controls.test.mjs

#### F072 — HR uses one entry button; managers and combined/Admin retain warehouse/transfer tabs

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-attendance-controls.test.mjs#L37) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #1.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    'Phụ kho',
+   'CV khác',
    'Chuyển Line',
+   'Thu hồi nhân sự'
  ]
```

#### F073 — HR lookup choices exclude production actions and rejects a stale/forged lookup value

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-attendance-controls.test.mjs#L41) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #2.
- Expected: `true`; actual: `xem thông báo/log`.

```text
The expression evaluated to a falsy value:

  assert.ok(select)
```

#### F074 — cnphuong preserves warehouse and transfer inputs with existing combined rights

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-attendance-controls.test.mjs#L115) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #13.

```text
Expected values to be strictly deep-equal:
+ actual - expected

  [
    'Phụ kho',
+   'CV khác',
    'Chuyển Line',
+   'Thu hồi nhân sự'
  ]
```

#### F075 — schedule provisional range does not become a numeric cleaning limit or change action employee directory

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-attendance-controls.test.mjs#L179) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #18.

```text
"Cannot read properties of undefined (reading 'props')"
```

### tests/production-exit-restore-ui.test.mjs

#### F076 — actual correction dialog: cancel exit reveals staff restoration, preview then changed selection requires new preview

- Nhóm: **Nhãn và cấu trúc giao diện** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-exit-restore-ui.test.mjs#L24) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #2.
- Expected: `true`; actual: `~`.

```text
The expression evaluated to a falsy value:

  assert.ok(dialog.querySelector('[aria-label="Cách khôi phục nhân viên"]'))
```

### tests/production-plan-permissions.test.mjs

#### F077 — API reopen denies view/edit/confirm and wrong-menu grants without changing data or audit, then accepts Hủy xác nhận

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L101) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #3.

```text
denied reopen must not write plan, transit or audit
+ actual - expected
... Skipped lines

  [
    {
      entity: 'admin_audit',
[Lược nội dung record/credential; xem log riêng tư]
      record_key: 'cbc2cb71-1648-4226-a062-b2d357e9641c',
...
    },
+   {
+     entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: '01d47bce-8432-4910-b6a4-3f4c6c13ba08',
+     updated_at: '2026-11-02T08:44:17.736Z',
+     updated_by: 'TEST-plan-permissions'
+   }
  ]
```

#### F078 — API separates Xác nhận, Hủy xác nhận and Sửa, and requires Sửa for edits sent with close

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L130) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #5.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F079 — empty envelope

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L163) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #1.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F080 — empty row edit

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L163) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #2.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F081 — same numeric value

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L163) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #3.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F082 — equivalent normalized fields

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L163) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #4.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F083 — same status and labels

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L163) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #5.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F084 — Xác nhận-only closes unchanged edit envelopes without Sửa, using normalized authoritative values

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L156) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #6.
- **Mục tổng hợp lỗi subtest**, không tính là một nguyên nhân gốc mới.

```text
'5 subtests failed'
```

#### F085 — USER

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L198) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #1.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F086 — ADMIN

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L198) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #2.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F087 — Admin retains reopen capability but the transferred-row guard still applies to Admin and Hủy xác nhận

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L197) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #8.
- **Mục tổng hợp lỗi subtest**, không tính là một nguyên nhân gốc mới.

```text
'2 subtests failed'
```

#### F088 — API preserves authentication, same-origin and quick-Line restrictions

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L210) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #9.

```text
Expected values to be strictly deep-equal.
So sánh toàn bộ records thất bại; log có chênh lệch audit. Không chép payload record vào tài liệu; cần kiểm từng thay đổi theo log riêng tư.
```

#### F089 — confirm only

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L234) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #1.

```text
confirm-only cannot normalize a legacy priority or write audit
+ actual - expected
... Skipped lines

  [
    {
      entity: 'admin_audit',
[Lược nội dung record/credential; xem log riêng tư]
      record_key: 'b7f125b3-5bb9-4380-8d4a-9ac89add3132',
...
    },
+   {
+     entity: 'website_action_audit',
[Lược nội dung record/credential; xem log riêng tư]
+     record_key: '15458b73-9046-41a3-ad79-d6f25a9d0557',
+     updated_at: '2026-11-02T08:44:26.814Z',
+     updated_by: 'TEST-plan-permissions'
+   }
  ]
```

#### F090 — close checks normalization-induced priority changes even when submitted row edits are empty

- Nhóm: **Audit và quyền ghi** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-plan-permissions.test.mjs#L233) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #10.
- **Mục tổng hợp lỗi subtest**, không tính là một nguyên nhân gốc mới.

```text
'1 subtest failed'
```

### tests/production-profile-cache.test.mjs

#### F091 — light work cache cannot satisfy full confirmation read; both caches clear on session change

- Nhóm: **Phiên bản, danh mục và cache** · Ưu tiên: P1/P2 tùy tác động.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/production-profile-cache.test.mjs#L2) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #1.

```text
Expected "actual" not to be reference-equal to "expected":

{
  actualSchedules: [],
  approvedSchedules: [],
  employees: [],
  events: [],
  orders: [
    {
      id: '/api/production-workflow'
    }
  ],
  reports: [],
  rights: {
    work: true
  }
}
```

### tests/search-route-components.test.mjs

#### F092 — ProductionPayroll real month and closed Line lookup apply by generated Search/enter

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L166) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #3.
- Expected: `true`; actual: `xem thông báo/log`.

```text
'Expected mounted button'
```

#### F093 — ProductionJournal real date, text and closed Line lookup apply by enter

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L199) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #5.
- Expected: `xem thông báo/log`; actual: `0: '/api/production-standards'`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   '/api/production-standards'
+ ]
- []
```

#### F094 — ProductionProgressReview real SKU and closed Line lookup apply by enter

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L229) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #7.

```text
The input was expected to not match the regular expression /LSX-ALPHA/. Input:

'Tuần kế hoạch 42: 12/10/2026 – 18/10/2026LSX-ALPHALSX-ALPHASKU-ALPHAProduct ALPHASyntheticA—12/10/2026 08:00:0031/10/2026 17:00:00—100000Nhân viênChưa ghi nhận nhân viên00Chưa đồng bộ SXPLAN-ALPHALSX-BETALSX-BETASKU-BETAProduct BETASyntheticB—12/10/2026 08:00:0031/10/2026 17:00:00—100000Nhân viênChưa ghi nhận nhân viên00Chưa đồng bộ SXPLAN-BETA\n' +
  'Chưa ghi nhận nhân viên\n' +
  'Chưa ghi nhận nhân viên'
```

#### F095 — ProductionPayroll real month and closed Line lookup apply by generated Search/click

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L166) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #11.
- Expected: `true`; actual: `xem thông báo/log`.

```text
'Expected mounted button'
```

#### F096 — ProductionJournal real date, text and closed Line lookup apply by click

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L199) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #13.
- Expected: `xem thông báo/log`; actual: `0: '/api/production-standards'`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   '/api/production-standards'
+ ]
- []
```

#### F097 — ProductionProgressReview real SKU and closed Line lookup apply by click

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L229) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #15.

```text
The input was expected to not match the regular expression /LSX-ALPHA/. Input:

'Tuần kế hoạch 42: 12/10/2026 – 18/10/2026LSX-ALPHALSX-ALPHASKU-ALPHAProduct ALPHASyntheticA—12/10/2026 08:00:0031/10/2026 17:00:00—100000Nhân viênChưa ghi nhận nhân viên00Chưa đồng bộ SXPLAN-ALPHALSX-BETALSX-BETASKU-BETAProduct BETASyntheticB—12/10/2026 08:00:0031/10/2026 17:00:00—100000Nhân viênChưa ghi nhận nhân viên00Chưa đồng bộ SXPLAN-BETA\n' +
  'Chưa ghi nhận nhân viên\n' +
  'Chưa ghi nhận nhân viên'
```

#### F098 — ProductionLaborJournal current real text, Line lookup applies by enter

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L289) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #19.
- Expected: `xem thông báo/log`; actual: `0: '/api/production-standards'`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   '/api/production-standards'
+ ]
- []
```

#### F099 — ProductionLaborJournal history real text, Line and date lookup applies by enter

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L289) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #20.
- Expected: `xem thông báo/log`; actual: `0: '/api/production-standards'`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   '/api/production-standards'
+ ]
- []
```

#### F100 — ProductionLaborJournal current real text, Line lookup applies by click

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L289) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #26.
- Expected: `xem thông báo/log`; actual: `0: '/api/production-standards'`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   '/api/production-standards'
+ ]
- []
```

#### F101 — ProductionLaborJournal history real text, Line and date lookup applies by click

- Nhóm: **Tìm kiếm** · Ưu tiên: P2.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/search-route-components.test.mjs#L289) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #27.
- Expected: `xem thông báo/log`; actual: `0: '/api/production-standards'`.

```text
Expected values to be strictly deep-equal:
+ actual - expected

+ [
+   '/api/production-standards'
+ ]
- []
```

### tests/table-report.test.mjs

#### F102 — strict ±10% warning only for complete confirmed orders with positive standard

- Nhóm: **Kế hoạch, báo cáo và workflow** · Ưu tiên: P1.
- [Source tại mốc kiểm](https://github.com/vuhuongduyen/shintung-production-web/blob/051a1c413fda17c85f13949aa03fe9d3f40259fc/tests/table-report.test.mjs#L16) · [Log shard 3](https://github.com/vuhuongduyen/shintung-production-web/actions/runs/41414855502/job/125176122500) · TAP #2.
- Expected: `0.18`; actual: `~`.

```text
Expected values to be strictly equal:

null !== 0.18
```

## Cách tiếp tục sau bàn giao

1. Xác nhận hợp đồng Final và audit denied trước khi sửa nghiệp vụ hoặc đổi kỳ vọng test liên quan.
2. Với mỗi nhóm, tạo ca tái hiện nhỏ, ghi rõ expected/actual, chỉ sửa trong phạm vi được duyệt; chạy test nhóm tác động và ca âm bảo vệ.
3. Đối chiếu thiết kế được duyệt trước khi cập nhật selector/nhãn. Không xóa, skip hoặc giảm assertion chỉ để xanh.
4. Chỉ chạy toàn bộ CI sau thay đổi có mục tiêu. Push tài liệu này có thể tự kích hoạt workflow hiện hữu; đó không phải một đợt sửa lỗi mới. Không đổi workflow, không dùng skip-ci và không rerun thủ công trùng.
5. Cung cấp link test cô lập của đúng bản và nghiệm thu trước merge. Main, PR #3 và production giữ nguyên; không merge/deploy trong lượt bàn giao.
