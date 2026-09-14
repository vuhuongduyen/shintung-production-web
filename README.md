# ONSPA Production Management Web

Mã nguồn website quản lý sản xuất ONSPA, gồm các phân hệ dữ liệu cơ bản, cấu trúc thành phẩm/BOM, kế hoạch sản xuất, quản lý sản xuất, quản lý kho và quản trị hệ thống.

## Tình trạng hiện tại

- Giao diện và các luồng nghiệp vụ hiện tại đã nằm trong mã nguồn.
- Dữ liệu nền dùng để hiển thị thử nằm trong các tệp JSON tại `app/`.
- Một số nghiệp vụ đã đọc/ghi dữ liệu qua API `app/api/records` và Cloudflare D1.
- Dữ liệu D1 đang chạy trên máy chủ **không được chứa trong repository hoặc ZIP này**. Cần xuất/khôi phục cơ sở dữ liệu riêng khi chuyển môi trường.
- Phần đăng nhập, phân quyền, sao lưu/khôi phục và các quy trình xác nhận cần tiếp tục kiểm thử, hoàn thiện trước khi dùng chính thức.
- Đây chưa phải bản triển khai sản xuất hoàn chỉnh có thể thay thế ngay hệ thống đang vận hành.

Chi tiết phạm vi đã có và còn thiếu xem tại [`docs/SOURCE_STATUS.md`](docs/SOURCE_STATUS.md).

## Công nghệ

- Node.js 22.13 trở lên
- Next.js 16, React 19, TypeScript
- Vinext/Vite và Cloudflare Worker
- Cloudflare D1, Drizzle ORM

## Chạy trên máy tính

### Khuyến nghị cho Windows

Các script build hiện tại dùng Bash, vì vậy nên chạy bằng WSL 2 (Ubuntu) hoặc môi trường Linux.

```bash
cd shintung-production-web
npm ci
npm run dev
```

Mở địa chỉ do cửa sổ lệnh hiển thị, thông thường là `http://localhost:3000` hoặc địa chỉ Vite tương ứng.

### Kiểm tra bản build

```bash
npm run build
```

`npm run build` đã chạy thành công tại thời điểm đóng gói. Bộ `npm test` hiện còn hai kiểm tra cũ chưa tương thích với cấu hình hiện tại (Cloudflare module khi chạy trực tiếp bằng Node và kiểm tra CSS scrollbar); xem ghi chú trong `docs/SOURCE_STATUS.md`.

## Cơ sở dữ liệu

Schema hiện tại nằm tại:

- `db/schema.ts`
- `drizzle/0000_early_princess_powerful.sql`

Ứng dụng cần một Cloudflare D1 binding tên `DB`. Việc tải mã nguồn lên GitHub không tự tạo database và không chuyển dữ liệu đang có trên máy chủ.

## Đưa vào GitHub an toàn

1. Giải nén toàn bộ nội dung ZIP vào một thư mục mới.
2. Không chép các file `.env`, token, mật khẩu hoặc khóa API vào thư mục.
3. Đưa mã nguồn lên một nhánh mới, ví dụ `website-import`.
4. Chạy `npm ci`, `npm run build` và kiểm tra giao diện.
5. Tạo Pull Request vào `main`; chỉ gộp sau khi kiểm tra thành công.

Ví dụ:

```bash
git checkout -b website-import
git add .
git commit -m "Import ONSPA website source"
git push -u origin website-import
```

## Dữ liệu nhạy cảm

- `.env*`, chứng thư `.pem`, thư mục build, dependency và dữ liệu tạm đã được loại khỏi Git bằng `.gitignore`.
- ZIP phát hành không chứa `.git`, `node_modules`, `.env*`, file build hoặc token truy cập.
- Chỉ lưu tên biến cần cấu hình trong `.env.example`; không ghi giá trị bí mật vào repository.

## Cấu trúc chính

```text
app/            Giao diện, dữ liệu nền và API routes
components/     Thành phần giao diện dùng chung
db/             Kết nối và schema D1
drizzle/        Migration cơ sở dữ liệu
docs/           Tài liệu bàn giao
public/         Logo, favicon và tài nguyên công khai
scripts/        Script cài đặt, build và nhập dữ liệu
tests/          Kiểm tra build/giao diện
worker/         Điểm vào Cloudflare Worker
```
