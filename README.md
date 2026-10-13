# Sổ Tiền — quản lý chi tiêu cá nhân có AI

Đồ án web giúp người trẻ ghi chép chi tiêu với ít thao tác nhất: gõ một câu như *“hôm qua ăn phở 45k”* là có giao dịch, nhập sao kê ngân hàng trong vài bước, hỏi trợ lý *“tháng này mình chi nhiều nhất vào đâu?”*, và giữ thói quen nhờ chuỗi ngày, nhiệm vụ, huy hiệu.

Nguyên tắc AI: **LLM chỉ hiểu câu và chọn việc cần làm; mọi con số do backend tính từ dữ liệu thật.** AI lỗi hoặc chậm thì ứng dụng vẫn chạy bằng bộ luật.

## Tính năng

| Nhóm | Có gì |
|---|---|
| Ghi chép | Ghi nhanh bằng câu tự nhiên (có xem trước), thêm/sửa/xoá hàng loạt, nhiều ví, chuyển tiền giữa ví, danh mục riêng |
| Nhập sao kê | Đọc CSV (UTF-8 / Windows-1258), tự đoán cột, báo lỗi đúng dòng, loại giao dịch trùng, phân loại hàng loạt |
| Phân loại AI | Luật của người dùng → luật mặc định → LLM; độ tin cậy < 0,7 vào hàng chờ duyệt; sửa danh mục thì gợi ý tạo luật |
| Trợ lý AI | Hỏi đáp về thu chi bằng function calling (6 công cụ), kèm giao dịch nguồn; từ chối câu hỏi đầu tư, vay mượn, ngoài phạm vi |
| Ngân sách & thống kê | Hạn mức theo danh mục, cảnh báo 80% / 100%, xu hướng nhiều tháng, so sánh hai tháng |
| Gamification | Chuỗi ngày theo múi giờ, thẻ đóng băng, XP và cấp độ (giới hạn theo ngày), nhiệm vụ ngày/tuần, 9 huy hiệu, câu khích lệ, nhắc nhở 20:00 |
| Tài khoản | Đăng ký/đăng nhập, quên mật khẩu qua email, cài đặt, xuất dữ liệu (JSON/CSV), xoá toàn bộ dữ liệu |
| Quản trị | Thống kê hệ thống, khoá tài khoản, danh mục mặc định, câu khích lệ, nhiệm vụ, huy hiệu |

## Công nghệ

- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind CSS 4, shadcn/ui, Recharts, Lucide
- **Backend:** NestJS 11, Prisma 7, PostgreSQL 16, JWT + bcrypt, Nodemailer, `@nestjs/schedule`
- **AI:** OpenAI (Chat Completions: structured output + function calling), sau lớp `LlmProvider` có bản dự phòng chỉ dùng luật
- **Test:** Vitest, Supertest; Docker Compose cho Postgres, Mailpit và DB test

## Cấu trúc

```
.
├─ src/                 Next.js — giao diện chỉ gọi dữ liệu qua src/services
│  └─ services/         mỗi hàm có 2 bản: mock (trong bộ nhớ) và api (REST); chọn bằng NEXT_PUBLIC_DATA_SOURCE
├─ shared/              logic thuần dùng chung FE + BE: kiểu dữ liệu, luật phân loại, đọc CSV,
│                       engine trợ lý, quy tắc XP/chuỗi, thống kê, kiểm tra tài khoản
├─ server/              NestJS
│  ├─ prisma/           schema (17 bảng PRD + 6 bảng hỗ trợ), migration, seed
│  ├─ src/              auth, users, wallets, categories, transactions, budgets, stats,
│  │                    import, ai, chat, gamification, notifications (job), admin
│  ├─ test/             e2e (Supertest, DB riêng)
│  └─ scripts/          eval-ai (đánh giá AI), run-jobs (chạy job với thời điểm giả)
├─ docs/                plan.md, eval-results.md, PRD
├─ design-system/       MASTER.md — quy chuẩn giao diện
└─ docker-compose.yml   postgres, api, mailpit, db-test
```

## Chạy trên máy

Cần **Node 22** và **Docker Desktop**.

```bash
# 1. Cài thư viện
npm install
cd server && npm install && cp .env.example .env && cd ..

# 2. Database, API, Mailpit
docker compose up -d

# 3. Tạo bảng và dữ liệu demo (dữ liệu tính lùi từ hôm nay)
cd server && npx prisma migrate deploy && npx prisma db seed && cd ..

# 4. Giao diện, nối với API thật
NEXT_PUBLIC_DATA_SOURCE=api npm run dev
```

| Địa chỉ | Là gì |
|---|---|
| http://localhost:3000 | Ứng dụng web |
| http://localhost:3001/api/docs | Tài liệu API (Swagger) |
| http://localhost:8025 | Mailpit: xem email nhắc nhở, mã đặt lại mật khẩu |

**Tài khoản demo**

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Người dùng (Lan, khoảng 5 tháng dữ liệu) | `lan.nguyen@example.com` | `matkhau123` |
| Quản trị viên | `admin@sotien.vn` | `quantri123` |

File sao kê mẫu để thử nhập: `public/mau/sao-ke-techcombank-10-2026.csv`, `public/mau/sao-ke-co-loi.csv`.

### Chỉ chạy giao diện (không cần backend)

```bash
npm install && npm run dev
```

Mặc định `NEXT_PUBLIC_DATA_SOURCE=mock`: dữ liệu giả lập trong trình duyệt. Thêm `?demo=empty`, `?demo=loading`, `?demo=error` hoặc `?demo=slow` vào URL để xem các trạng thái trống, đang tải, lỗi, trợ lý chậm.

### Bật LLM thật

Đặt `OPENAI_API_KEY` (và tuỳ chọn `OPENAI_MODEL`, mặc định `gpt-4.1-mini`) trong `server/.env`, rồi `docker compose up -d api`. Không có khoá thì API dùng `RuleOnlyProvider`, mọi tính năng vẫn chạy.

## Biến môi trường chính (`server/.env`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | `postgresql://sotien:sotien@localhost:5433/sotien` | Database (container `api` tự trỏ tới `postgres`) |
| `JWT_SECRET` | — | Chuỗi ngẫu nhiên ≥ 32 ký tự; **đổi khi triển khai** |
| `ACCESS_TOKEN_TTL_MIN` / `REFRESH_TOKEN_TTL_DAYS` | `15` / `7` | Thời hạn phiên |
| `OPENAI_API_KEY` / `OPENAI_MODEL` | trống / `gpt-4.1-mini` | LLM; trống = chỉ dùng luật |
| `AI_TIMEOUT_MS` | `3000` | Quá giờ thì ghi nhanh dùng kết quả bộ luật |
| `SMTP_HOST` / `SMTP_PORT` | `localhost` / `1025` | Gửi email (dev: Mailpit) |
| `LOGIN_RATE_LIMIT` / `LOGIN_RATE_WINDOW_MIN` | `5` / `15` | Giới hạn đăng nhập theo IP + email |
| `CLOCK_NOW` | trống | Dời "bây giờ" để demo (ISO 8601) |
| `SEED_TODAY` | hôm nay | Ngày neo cho dữ liệu seed |

Frontend (`.env.local`): `NEXT_PUBLIC_DATA_SOURCE=mock|api`, `API_URL` (mặc định `http://localhost:3001`).

## Kiến trúc & bảo mật

- Web và API **cùng origin**: Next rewrite `/api/*` sang NestJS, nên cookie `httpOnly` chạy mà không cần CORS.
- **Phiên đăng nhập:** access JWT 15 phút và refresh token 7 ngày, đều trong cookie `httpOnly`. Refresh token đổi mới mỗi lần làm mới phiên và lưu dạng băm; dùng lại token cũ thì cả phiên bị thu hồi.
- **Phân quyền ở server:** mọi truy vấn lọc theo người dùng trong token; dữ liệu của người khác trả 404, `/api/admin/*` cần vai trò admin. Tài khoản bị khoá bị chặn ngay ở lần gọi API kế tiếp. `src/proxy.ts` chỉ chuyển hướng cho mượt, không phải lớp bảo vệ.
- **Toàn vẹn dữ liệu:** số dư ví, XP và chuỗi ngày được cập nhật trong cùng transaction với giao dịch. Tiền lưu `BIGINT` (đồng); ngày giao dịch là `DATE` theo múi giờ người dùng.
- **Quyền riêng tư với LLM:** chỉ gửi mô tả giao dịch, số tiền, tên danh mục; không gửi họ tên hay email. Mỗi lần gọi đều ghi vào `ai_logs` (tính năng, token, độ trễ, thành công).
- **Job định kỳ** (15 phút/lần, theo múi giờ từng người): nhắc nhở, chốt ngày (dùng thẻ đóng băng hoặc mất chuỗi), "Ngân sách tốt", huy hiệu "Giữ đúng lời hứa". Chạy lại nhiều lần vẫn ra cùng kết quả; advisory lock của Postgres đảm bảo chỉ một instance chạy.

## Kiểm thử

```bash
# Frontend + logic dùng chung (chế độ mock)
npm run test

# Backend
docker compose --profile test up -d db-test     # DB test riêng, cổng 5434
cd server
npm run typecheck
npm run test                                    # unit test
npm run test:e2e                                # e2e qua HTTP: auth, tài chính, AI, gamification, quản trị
npm run jobs:run -- 2026-10-13T20:00:00+07:00   # chạy job một lần với thời điểm giả
```

Test e2e dùng `LlmProvider` giả và đồng hồ cố định (12/10/2026), nên chạy ổn định và không gọi OpenAI.

## Đánh giá AI (PRD §11.1)

`cd server && npm run eval:ai`. Thêm `EVAL_DRY=1` để chỉ đếm số lần sẽ gọi LLM trước khi tốn token. Kết quả đầy đủ ở [docs/eval-results.md](docs/eval-results.md).

Lần chạy 2 (`gpt-4.1-mini`), độ chính xác phân loại:

| Bộ dữ liệu | Chỉ luật | Chỉ LLM | Hybrid |
|---|---:|---:|---:|
| Bộ gốc (166 giao dịch) | 67,5% | 93,4% | 95,8% |
| Bộ giữ riêng, chỉ để đo (40 giao dịch) | 22,5% | 92,5% | 87,5% |

LLM trích xuất đúng cả số tiền, loại thu/chi và ngày ở 50/50 câu. Chatbot chọn đúng công cụ ở 96,7% (bộ gốc) và 100% (bộ giữ riêng). Luật từ khoá chỉ đúng 22,5% trên dữ liệu chưa gặp, nên luật mặc định cần được dùng thận trọng.

## Gỡ lỗi thường gặp

- **Sửa code mà Next không nhận** (Turbopack trên Windows): dừng `npm run dev`, xoá `.next/dev`, chạy lại.
- **API trong Docker không nhận file mới ngoài `src/`, `prisma/`, `shared/`:** `docker compose up -d --build api`.
- **Bị 429 khi đăng nhập:** đã gửi quá 5 lần đăng nhập trong 15 phút cho cùng email từ cùng IP (tính cả lần đúng); đợi hoặc khởi động lại API.
- **Muốn dữ liệu demo như mới:** `cd server && npx prisma db seed` (xoá sạch rồi tạo lại).
