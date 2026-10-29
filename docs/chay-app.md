# Mở app Sổ Tiền trên máy

Cần **Node 22** và **Docker Desktop**. Mọi lệnh chạy ở thư mục gốc dự án.

## Mở app hằng ngày (đã cài đặt từ trước)

1. **Bật Docker Desktop** và chờ biểu tượng cá voi báo "running".
2. **Bật database, API và Mailpit:**

   ```bash
   docker compose up -d
   ```

3. **Bật giao diện, nối với API thật:**

   PowerShell:

   ```powershell
   $env:NEXT_PUBLIC_DATA_SOURCE="api"; npm run dev
   ```

   Git Bash:

   ```bash
   NEXT_PUBLIC_DATA_SOURCE=api npm run dev
   ```

4. Mở http://localhost:3000. Lần đầu mở mỗi trang có thể mất vài giây vì Next phải biên dịch trang đó.

| Địa chỉ | Là gì |
|---|---|
| http://localhost:3000 | Ứng dụng web |
| http://localhost:3001/api/docs | Tài liệu API (Swagger) |
| http://localhost:3001/api/health | Kiểm tra API còn chạy không |
| http://localhost:8025 | Mailpit: email nhắc nhở, mã đặt lại mật khẩu |

**Tài khoản demo**

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Người dùng (Lan) | `lan.nguyen@example.com` | `matkhau123` |
| Quản trị viên | `admin@sotien.vn` | `quantri123` |

## Lần đầu cài đặt

```bash
npm install
cd server && npm install && cp .env.example .env && cd ..
docker compose up -d
cd server && npx prisma migrate deploy && npx prisma db seed && cd ..
```

Sau đó làm tiếp bước 3 ở trên.

Muốn dùng LLM thật thì điền `OPENAI_API_KEY` vào `server/.env` rồi chạy `docker compose up -d api`. Để trống thì app chỉ dùng bộ luật, mọi tính năng vẫn chạy.

## Tắt app

- Giao diện: bấm `Ctrl + C` ở cửa sổ đang chạy `npm run dev`.
- Database, API, Mailpit: `docker compose stop`. Dữ liệu vẫn được giữ lại.

## Làm mới dữ liệu demo

```bash
cd server && npx prisma db seed
```

Lệnh này **xoá toàn bộ dữ liệu hiện có** rồi tạo lại bộ demo, tính lùi từ hôm nay.

## Chỉ chạy giao diện, không cần backend

```bash
npm run dev
```

Dữ liệu là giả lập trong trình duyệt. Thêm `?demo=empty`, `?demo=loading`, `?demo=error` hoặc `?demo=slow` vào URL để xem các trạng thái trống, đang tải, lỗi, trợ lý chậm.

## Khi gặp lỗi

- **`docker compose` báo `cannot find the file specified` / `dockerDesktopLinuxEngine`:** Docker Desktop chưa bật. Mở Docker Desktop, chờ chạy xong rồi gõ lại lệnh.
- **Đăng nhập báo lỗi kết nối:** kiểm tra http://localhost:3001/api/health. Không trả về được thì xem log bằng `docker compose logs api`.
- **Sửa code mà Next không nhận** (Turbopack trên Windows): dừng `npm run dev`, xoá thư mục `.next/dev`, chạy lại.
- **Bị 429 khi đăng nhập:** đã đăng nhập quá 5 lần trong 15 phút với cùng email. Đợi một lúc hoặc chạy `docker compose restart api`.
