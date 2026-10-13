# Sổ Tiền

Ứng dụng quản lý chi tiêu cá nhân có AI (ghi nhanh bằng câu tự nhiên, phân loại hybrid, trợ lý hỏi đáp) và gamification (chuỗi ngày, XP, nhiệm vụ, huy hiệu).

```
/            Next.js 16 (giao diện) — src/
├─ shared/   logic thuần dùng chung FE + BE (kiểu dữ liệu, luật phân loại, CSV, engine trợ lý, quy tắc XP…)
├─ server/   NestJS 11 + Prisma 7 + PostgreSQL (REST /api, job định kỳ, OpenAI)
└─ docker-compose.yml   postgres, api, mailpit (+ db-test cho test)
```

## Chạy nhanh

Cần Node 22 và Docker Desktop.

```bash
npm install && (cd server && npm install)
cp server/.env.example server/.env          # đặt OPENAI_API_KEY nếu muốn dùng LLM thật

docker compose up -d                         # postgres :5433, api :3001, mailpit :8025
cd server && npx prisma migrate deploy && npx prisma db seed && cd ..

NEXT_PUBLIC_DATA_SOURCE=api npm run dev      # http://localhost:3000
```

Tài khoản demo: `lan.nguyen@example.com` / `matkhau123` (khoảng 5 tháng dữ liệu) và `admin@sotien.vn` / `quantri123`.

- Tài liệu API (Swagger): http://localhost:3001/api/docs
- Email nhắc nhở và mã đặt lại mật khẩu: http://localhost:8025 (Mailpit)

### Hai nguồn dữ liệu

| `NEXT_PUBLIC_DATA_SOURCE` | Dữ liệu | Dùng khi |
|---|---|---|
| `mock` (mặc định) | Giả lập trong bộ nhớ trình duyệt, kịch bản `?demo=empty\|loading\|error\|slow` | Demo offline, test giao diện |
| `api` | Backend NestJS qua rewrite `/api` (cookie httpOnly, cùng origin) | Chạy thật |

Giao diện chỉ import từ `@/services`; chữ ký hàm giống nhau ở hai chế độ.

## Backend

- Xác thực: access JWT 15 phút + refresh token 7 ngày (xoay vòng, lưu băm) trong cookie `httpOnly`; mật khẩu bcrypt; giới hạn 5 lần đăng nhập / 15 phút theo IP + email. Mọi truy vấn lọc theo người dùng trong token; tài nguyên của người khác trả 404, `/admin/*` cần vai trò admin.
- Database: 17 bảng theo PRD §10 và 6 bảng hỗ trợ (`wallet_transfers`, `conversations`, `password_reset_tokens`, `refresh_tokens`, `freeze_usages`, `motivation_history`). Tiền lưu `BIGINT`, ngày giao dịch lưu `DATE` theo múi giờ người dùng.
- AI (`server/src/ai`): lớp `LlmProvider` với hai bản: `OpenAiProvider` (một model, đặt bằng `OPENAI_MODEL`) và `RuleOnlyProvider` (khi không có khoá API, khi LLM lỗi hoặc quá 3 giây). LLM chỉ trích xuất, đoán danh mục và chọn công cụ; mọi con số do truy vấn SQL tính. Mỗi lần gọi đều ghi vào `ai_logs`.
- Job định kỳ (15 phút/lần, theo múi giờ từng người): nhắc nhở lúc 20:00, chốt ngày (dùng thẻ đóng băng / mất chuỗi), "Ngân sách tốt", huy hiệu "Giữ đúng lời hứa". Chạy lại không đổi kết quả và có advisory lock.

```bash
cd server
npm run test                                   # unit test
docker compose --profile test up -d db-test    # (ở thư mục gốc) DB test :5434
npm run test:e2e                               # 101 test e2e (supertest)
npm run jobs:run -- 2026-10-13T20:00:00+07:00  # chạy job một lần với thời điểm giả
npm run eval:ai                                # bảng accuracy/F1 cho báo cáo (PRD §11.1)
```

Test frontend (chế độ mock) chạy ở thư mục gốc: `npm run test`.
