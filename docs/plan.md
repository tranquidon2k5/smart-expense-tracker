# Kế hoạch backend Sổ Tiền — NestJS + Prisma + PostgreSQL + OpenAI, Docker Compose

## Context

Frontend (Next.js 16) đã xong gần hết tính năng, nhưng toàn bộ dữ liệu đang là mock trong bộ nhớ (`src/services/mock/*`), phiên đăng nhập nằm ở localStorage và quyền admin chỉ được kiểm tra ở trình duyệt. PRD yêu cầu kiến trúc 3 tầng (§9): REST backend có 4 module (Tài khoản, Tài chính, AI, Gamification), PostgreSQL 17 bảng (§10), JWT + bcrypt, kiểm tra quyền ở server (§8), và LLM chỉ dùng để chọn công cụ, còn mọi con số đều do backend tính.

Mục tiêu: làm backend theo 6 giai đoạn nhỏ, giai đoạn nào xong cũng kiểm thử được độc lập. Frontend chuyển dần từ mock sang API mà không phải viết lại giao diện, vì UI chỉ import từ `@/services` và chữ ký các hàm giữ nguyên.

**Đã chốt:** NestJS + Prisma; OpenAI là nhà cung cấp chính (vẫn tách lớp provider); backend nằm ở thư mục `server/` cạnh frontend, logic thuần dùng chung nằm ở `shared/`.

---

## Cấu trúc repo đề xuất

```
/                     ← Next.js hiện tại (giữ nguyên)
├─ shared/            ← logic thuần dùng chung FE + BE (chuyển từ src, không đổi code)
│   ├─ types.ts             (từ src/types/index.ts)
│   ├─ text.ts              (normalize — từ src/lib/text.ts)
│   ├─ rules.ts             (extractKeyword, matchesKeyword, planRuleApplication)
│   ├─ csv-import.ts        (parseCsvText, guessMapping, checkRows, splitDuplicates…)
│   └─ assistant-engine.ts  (parseMonths, parseCategory, refuse/out-of-scope, câu gợi ý)
├─ server/            ← NestJS
│   ├─ prisma/schema.prisma, migrations/, seed.ts
│   ├─ src/{auth,users,wallets,categories,transactions,budgets,stats,import,ai,chat,
│   │       gamification,notifications,admin,common}/
│   └─ test/ (e2e supertest)
├─ docker-compose.yml  (postgres, api, mailpit; web tuỳ chọn)
└─ .env.example
```

- `src/types`, `src/lib/text.ts` và `src/services/{rules,csv-import,assistant-engine}.ts` chuyển sang `shared/` và được re-export ở chỗ cũ. Nhờ vậy import của frontend và các test hiện có không phải đổi.
- Thêm alias `@shared/*` cho cả `tsconfig.json` gốc và `server/tsconfig.json`.

---

## Giai đoạn 1 — Khung dự án, database, migration 17 bảng

**Làm**
- `nest new server`: ConfigModule (đọc env và kiểm tra bằng zod), Prisma service, ValidationPipe toàn cục (class-validator), bộ lọc lỗi trả `{ message, field? }` bằng tiếng Việt (giống `AuthError` hiện có), Swagger tại `/api/docs`, endpoint `/api/health`.
- **Docker Compose:** `postgres:16` có volume và healthcheck; `api` (multi-stage Dockerfile, dev dùng `nest start --watch`); `mailpit` để xem email nhắc nhở và quên mật khẩu khi dev. Next vẫn chạy trên máy (xem D6).
- **Prisma schema**, gồm 17 bảng theo PRD §10:
  - users, wallets, categories, transactions, budgets, classification_rules, chat_messages, ai_logs, activity_logs, user_streaks, user_levels, missions, user_missions, badges, user_badges, motivation_messages, notifications.
  - Các trường mà frontend đang dùng nhưng PRD chưa liệt kê:
    - `missions.title`, `missions.is_active`;
    - `badges.is_active`;
    - `notifications.title`, `notifications.link`;
    - `users.reminder_enabled`, `users.reminder_time`, `users.reminder_email`.
  - Kiểu dữ liệu:
    - tiền: `BIGINT` (đồng, luôn dương; dấu do cột `type` quyết định);
    - `transactions.date`: `DATE`, tính theo múi giờ người dùng;
    - mốc thời gian: `timestamptz`;
    - enum Postgres cho type, source, status, role, feature, period, context.
  - Index: `(user_id, date)`, `(user_id, status)`, `(user_id, category_id, date)` cho transactions; `(user_id, date)` cho activity_logs; unique `(user_id, category_id, month)` cho budgets.
- **Bảng phụ ngoài 17 bảng** (xem D1): wallet_transfers, conversations (thêm `chat_messages.conversation_id`), password_reset_tokens, refresh_tokens, freeze_usages.
- **Seed:** dùng lại bộ sinh dữ liệu tất định trong `src/services/mock/db.ts` (persona Lan có khoảng 5 tháng dữ liệu, giao dịch chờ duyệt, luật, ngân sách, huy hiệu, 8 câu khích lệ, 5 nhiệm vụ, 9 huy hiệu, danh mục mặc định), cộng tài khoản admin và khoảng 38 người dùng mẫu từ `mock/accounts.ts`. Lệnh: `npx prisma db seed`.

**Kiểm thử:** `docker compose up` chạy được; `prisma migrate dev` tạo đủ bảng; seed chạy hai lần vẫn ra cùng kết quả; `GET /api/health` trả 200; một test vitest đếm đủ 17 bảng chính và kiểm tra các ràng buộc (FK, unique budgets).

---

## Giai đoạn 2 — Tài khoản: JWT, bcrypt, phân quyền ở server

**Làm**
- **AuthModule:**
  - `POST /auth/register|login|logout|refresh`, `POST /auth/forgot-password`, `POST /auth/reset-password`, `GET /auth/me`, `PATCH /auth/password`.
  - Mật khẩu băm bằng bcrypt (cost 12). Quy tắc mật khẩu dùng lại `passwordChecks`, chuyển sang `shared/validation.ts`.
  - Token (D2): access JWT 15 phút và refresh token 7 ngày, có xoay vòng và lưu trong `refresh_tokens`. Cả hai nằm trong cookie `httpOnly; SameSite=Lax; Secure` (khi production).
  - Đăng nhập sai: cùng một thông báo cho mọi trường hợp; giới hạn 5 lần mỗi 15 phút theo IP + email (`@nestjs/throttler`). Tài khoản bị khoá trả 403 với thông báo hiện có.
  - Quên mật khẩu: mã 6 số, hết hạn sau 15 phút, lưu dạng băm, gửi qua Nodemailer (dev xem ở Mailpit); API luôn trả thành công để không lộ email nào đã đăng ký.
- **Phân quyền:** `JwtAuthGuard` toàn cục (đánh dấu `@Public()` cho route công khai) và `RolesGuard` với `@Roles('admin')`. Mọi truy vấn dữ liệu đều lọc theo `userId` lấy từ token, không bao giờ lấy từ body/query. Nếu tài nguyên không thuộc người dùng thì trả 404, không trả 403, để không lộ ID có tồn tại hay không.
- `UsersModule`: `GET/PATCH /me/profile`, `PATCH /me/preferences`, `PATCH /me/reminder`, `GET /me/export` (JSON, CSV), `DELETE /me/data` (body `{confirmation}`, kiểm tra cụm từ giống `settingsService.deleteAllData`).

**Kiểm thử (e2e supertest + DB test riêng):**
- đăng ký → đăng nhập → `/auth/me`;
- sai mật khẩu và email không tồn tại cho cùng thông báo;
- tài khoản bị khoá trả 403;
- user A không đọc được dữ liệu của user B (404);
- user thường gọi `/admin/*` bị 403;
- refresh token cũ dùng lại bị từ chối;
- reset mật khẩu với mã hết hạn bị từ chối.

Các tình huống này lấy theo `src/services/account-admin.test.ts`.

---

## Giai đoạn 3 — Ví, danh mục, giao dịch, ngân sách (+ thống kê, import)

**Endpoint (REST, tiền tố `/api`, chữ ký khớp `src/services/*`)**

| Module | Endpoint chính | Ghép với hàm frontend |
|---|---|---|
| wallets | `GET /wallets` (kèm thu/chi tháng), `POST/PATCH/DELETE /wallets/:id`, `GET/POST /transfers` | `wallet.service.ts` |
| categories | `GET /categories?type=`, `GET /categories/usage`, `POST/PATCH /categories/:id`, `DELETE /categories/:id?moveTo=` | `category.service.ts` |
| transactions | `GET /transactions` (bộ lọc `TransactionFilter`, phân trang theo cursor), `GET /transactions/:id`, `GET /transactions/pending`, `GET /transactions/search?q=`, `POST /transactions`, `PATCH /transactions/:id`, `POST /transactions/bulk-update`, `POST /transactions/bulk-delete`, `POST /transactions/:id/review` | `transaction.service.ts` |
| rules | `GET /rules`, `POST /rules/preview`, `POST /rules` | `previewRule`, `createRule` (dùng `shared/rules.ts`) |
| budgets | `GET /budgets?month=`, `PUT /budgets/:categoryId?month=`, `DELETE /budgets/:id` | `budget.service.ts` |
| stats | `GET /dashboard/summary`, `/dashboard/trend?months=`, `/dashboard/breakdown`, `/dashboard/budget-watchlist`, `GET /stats?from=&to=`, `GET /stats/compare?a=&b=`, `GET /stats/months` | `dashboard.service.ts`, `stats.service.ts` |
| import | `POST /import/csv` (multipart hoặc JSON đã parse; xem D4) | `import.service.ts` (dùng `shared/csv-import.ts`) |

**Nguyên tắc**
- Số dư ví được cập nhật trong cùng transaction DB với giao dịch (`prisma.$transaction`), gồm cả xoá, sửa số tiền và đổi ví.
- Thống kê viết bằng SQL `GROUP BY` có tham số. Hai hàm `buildBreakdown` và `sumTotals` trong `mock/queries.ts` dùng làm đặc tả: giao dịch chờ duyệt không được tính, gộp nhóm "Khác" khi có hơn 5 lát.
- Luật phân loại dùng lại `planRuleApplication`; preview và áp dụng thật đi chung một hàm.
- Phần phân loại khi import ở giai đoạn này chỉ dùng luật từ khoá. Bước "LLM đoán" được thêm ở giai đoạn 5.

**Kiểm thử:**
- Chuyển các test hiện có sang chạy với API: `transaction.service.test.ts`, `rules.test.ts`, `pages-logic.test.ts`, `import-stats.test.ts` (dữ liệu tháng 10 khớp giữa thống kê và tổng quan; file mẫu Techcombank ra 8 giao dịch mới, 13 trùng).
- Thêm test cho số dư ví sau khi sửa/xoá giao dịch và cho chuyển tiền giữa hai ví.

---

## Giai đoạn 4 — Nối frontend với API thật

**Làm**
- `next.config.ts`: thêm rewrite `/api/:path*` → `http://localhost:3001/api/:path*` (khi production thì đọc từ env). Frontend và API cùng origin nên cookie `httpOnly` hoạt động mà không cần CORS.
- `src/services/http.ts`:
  - wrapper quanh `fetch` (`credentials: 'include'`);
  - đọc lỗi `{message, field}` thành `Error`/`AuthError` như hiện tại;
  - gặp 401 thì tự gọi `/auth/refresh` một lần rồi thử lại; vẫn lỗi thì phát sự kiện "hết phiên".
- Cờ `NEXT_PUBLIC_DATA_SOURCE=mock|api`:
  - Mỗi file `*.service.ts` giữ nguyên chữ ký hàm. Phần thân chọn mock hoặc API tuỳ theo cờ.
  - Mock giữ lại để: test vitest hiện có tiếp tục chạy, demo khi không có backend, và giữ các kịch bản `?demo=empty|loading|error|slow`.
- **Phiên đăng nhập:**
  - `session-store` ở chế độ api lấy phiên từ `GET /auth/me`.
  - `AuthGate` giữ nguyên cách ẩn/hiện hiện tại.
  - Thêm `src/proxy.ts` (Next 16): chưa có cookie mà vào app thì chuyển sang `/dang-nhap`; không có cookie admin thì không vào được `/quan-tri`. Đây chỉ là lớp trải nghiệm; quyền thật vẫn do server kiểm tra.
- **Bỏ phần chỉ dành cho mock** khi chạy ở chế độ api: `mock/dataset.ts` (nạp lại bộ dữ liệu theo tài khoản), localStorage tài khoản, `DEMO_RESET_CODE`.
- Chuyển theo thứ tự rủi ro thấp trước: auth → ví/danh mục → giao dịch → ngân sách/thống kê → import → cài đặt/thông báo → admin. Bước nào cũng có thể bật/tắt bằng cờ.

**Kiểm thử:** chạy lại toàn bộ danh sách kiểm tra trên trình duyệt đã làm (Playwright) với `DATA_SOURCE=api`. Số liệu tổng quan của Lan phải khớp với seed. Đăng ký tài khoản mới phải ra sổ trống thật. Khoá tài khoản ở trang admin thì người đó bị đăng xuất ở lần gọi API kế tiếp.

---

## Giai đoạn 5 — AI: ghi nhanh, phân loại hybrid, chatbot function calling

**Lớp provider:** interface `LlmProvider { extract(), classify(), chat(tools) }` có hai bản cài đặt: `OpenAiProvider` (chính) và `RuleOnlyProvider` (dự phòng khi lỗi hoặc quá thời gian). Mọi lần gọi đều ghi vào `ai_logs` (feature, số token, latency, thành công hay không). Model chọn qua env (xem D3). Khoá API chỉ nằm ở server.

1. **Ghi nhanh (F07, §9.1):**
   - Bước tiền xử lý dùng lại `parseAmount`, `parseDate` và `cleanDescription` (chuyển từ `transaction.service.ts` sang `shared/quick-entry.ts`).
   - Gọi LLM với structured output theo JSON schema `{so_tien, loai, ngay, mo_ta}`, timeout 3 giây. Hết giờ thì trả kết quả của bộ parser luật, đánh dấu `confidence` thấp.
   - `POST /ai/quick-entry/parse` → `QuickEntryPreview`; `POST /ai/quick-entry` → lưu.
2. **Phân loại hybrid (F08):** `classifyDescription` chạy luật người dùng, rồi luật mặc định. Nếu không luật nào khớp thì gọi LLM few-shot với danh sách danh mục của người dùng, nhận `{categoryId, confidence}`. Độ tin cậy dưới 0,7 thì giao dịch vào hàng chờ duyệt. Khi người dùng sửa danh mục thì đề xuất luật mới (đã có `buildRuleSuggestion`). Import CSV phân loại theo lô (gộp nhiều dòng vào một request) để tiết kiệm token.
3. **Chatbot (F10):**
   - Đăng ký 6 tool tương ứng các hàm trong `assistant-engine.ts`: `tong_theo_danh_muc`, `so_sanh_hai_thang`, `tong_thu_chi_thang`, `chi_theo_danh_muc`, `top_khoan_chi`, `tinh_trang_ngan_sach`.
   - Mỗi tool là một truy vấn Prisma/SQL có tham số. LLM chỉ chọn tool và diễn đạt câu trả lời; số liệu và `sourceIds` lấy từ kết quả truy vấn.
   - Từ chối câu hỏi ngoài phạm vi; giới hạn 300 ký tự và 5 giây giống frontend.
   - Lưu lịch sử vào `conversations`/`chat_messages`. Mỗi câu hỏi hợp lệ phát sự kiện cho module gamification (nhiệm vụ hỏi trợ lý, huy hiệu CHAT_10).
4. **Quyền riêng tư (§8):** chỉ gửi mô tả giao dịch, số tiền và tên danh mục; không gửi tên hay email.

**Kiểm thử:**
- Unit test các tool SQL, so với kết quả của engine hiện tại trên cùng bộ seed.
- Mock `LlmProvider` trong e2e để test chạy ổn định, không phụ thuộc API thật.
- Script `server/scripts/eval-ai.ts` chạy bộ dữ liệu §11.1 (150–200 giao dịch, 50 câu trích xuất, 30 câu hỏi chatbot), xuất accuracy/F1 cho 3 cách (chỉ luật, chỉ LLM, hybrid) để đưa vào báo cáo.
- Ghi lại chi phí token để đối chiếu ngưỡng dưới 100.000đ/tháng.

---

## Giai đoạn 6 — Gamification + job định kỳ

**Làm**
- **Event bus** (`@nestjs/event-emitter`): `transaction.created|deleted`, `transaction.reviewed`, `chat.asked`, `budget.set`, `user.login`. Listener ghi `activity_logs` rồi cập nhật chuỗi, XP, nhiệm vụ và huy hiệu.
- **Chuyển logic từ `mock/queries.ts`** sang các service có test riêng:
  - `levelFromXp`, `awardXp` (giới hạn 10 lần/ngày theo `XP_RULES`), `revokeTransactionXp` (xoá giao dịch trong ngày thì trừ lại đúng số XP đã cộng);
  - `recordActivity` (lần đầu trong ngày thì chuỗi +1; thẻ đóng băng mỗi 7 ngày, tối đa 2; thưởng mốc `STREAK_MILESTONES`);
  - `bumpMission`, `evaluateBadges`, `computeStreaks`;
  - `celebrate()`: ghi vào `notifications` và trả kèm sự kiện chúc mừng trong response để frontend hiện hiệu ứng.
- **Endpoint:** `GET /gamification/status|missions|achievements|motivation`, `POST /gamification/no-spend-day`, `GET/PATCH /notifications`, `POST /notifications/read-all`, `POST /notifications/test-reminder`.
- **Job** (`@nestjs/schedule`, chạy mỗi 15 phút và xử lý theo múi giờ của từng người dùng):
  - Tới giờ nhắc mà hôm nay chưa có hoạt động → tạo một notification, gửi email nếu người dùng bật. Mỗi người tối đa một lần/ngày; tắt nhắc nhở thì bỏ qua.
  - 00:00 giờ địa phương: chốt ngày hôm qua. Không có hoạt động thì dùng thẻ đóng băng nếu còn, không thì chuỗi về 0 (kỷ lục vẫn giữ). Sau đó làm mới nhiệm vụ ngày; thứ Hai thì làm mới cả nhiệm vụ tuần.
  - Cuối tuần, nếu chi dưới 80% ngân sách thì gửi câu "Ngân sách tốt". Cảnh báo ngân sách khi vượt 80% được tạo ngay lúc ghi giao dịch.
  - Job phải chạy lại được nhiều lần mà kết quả không đổi (khoá theo `period_key`); dùng advisory lock của Postgres để nhiều instance không chạy trùng.
- **Câu khích lệ:** chọn câu đang bật theo ngữ cảnh, ưu tiên câu chưa hiện trong 7 ngày (cần lưu lịch sử đã hiện, xem D1).
- **AdminModule:** các API trong `admin.service.ts` (thống kê hệ thống tính thật từ users, transactions, ai_logs, activity_logs; khoá/mở khoá; danh mục mặc định; câu khích lệ; nhiệm vụ; huy hiệu). Giữ nguyên các ràng buộc đang có ở mock: không xoá danh mục đang dùng, mỗi ngữ cảnh phải còn ít nhất một câu đang bật, không tự khoá chính mình.

**Kiểm thử:**
- Unit test theo §11.3: đổi ngày, múi giờ (UTC+7 và UTC−5), dùng thẻ đóng băng, mất chuỗi, mốc 14 ngày, giới hạn XP, trừ XP khi xoá.
- Chuyển `gamification.test.ts`, `xp-limit.test.ts`, `xp-revoke.test.ts` sang chạy với service thật.
- Gọi job trực tiếp với thời điểm giả (`now` được truyền vào), không phụ thuộc đồng hồ máy.

---

## Giả định

1. Đơn vị tiền chỉ có VND trong phạm vi đồ án. USD/EUR vẫn để "sắp có" như giao diện hiện tại.
2. "Hôm nay" lấy theo giờ thật ở server. Mốc `MOCK_TODAY = 12/10/2026` chỉ còn dùng cho mock và seed: seed sinh dữ liệu tương đối so với ngày chạy seed để demo luôn có dữ liệu mới.
3. Chưa cần đa ngôn ngữ, OAuth hay xác thực email khi đăng ký.
4. Số người dùng nhỏ (demo, thử nghiệm 5–10 người) nên một instance API là đủ; chưa cần hàng đợi (BullMQ hoặc tương tự).
5. Test backend dùng vitest (cho đồng nhất với frontend) cùng supertest, chạy trên một database Postgres riêng trong compose (`db-test`).
6. Triển khai (Vercel cho frontend, Render/Railway cho API và DB, theo §9.2) để sau cùng, không nằm trong 6 giai đoạn này.

## Điểm cần bạn quyết định

- **D1 — Bảng ngoài 17 bảng của PRD.** Frontend đang dùng: chuyển tiền giữa ví, nhóm hội thoại chatbot, mã đặt lại mật khẩu, refresh token, lịch sử dùng thẻ đóng băng, lịch sử câu khích lệ đã hiện. Có hai cách:
  - Đề xuất: giữ 17 bảng chính như PRD và thêm 6 bảng phụ, ghi rõ trong ERD là "bảng hỗ trợ".
  - Hoặc sửa PRD/báo cáo cho khớp.
- **D2 — Cơ chế token:** access 15 phút + refresh 7 ngày trong cookie `httpOnly` (đề xuất, an toàn hơn), hay một JWT 7 ngày cho đơn giản?
- **D3 — Model OpenAI:** dùng model rẻ cho trích xuất/phân loại và model mạnh hơn cho chatbot, hay một model cho tất cả? Ngân sách token/tháng cụ thể là bao nhiêu?
- **D4 — Đọc CSV ở đâu:** giữ bước đọc và xem trước file ở trình duyệt, chỉ gửi các dòng đã ánh xạ lên server (đề xuất, ít thay đổi giao diện), hay upload file thô để server làm hết?
- **D5 — Ghi nhanh khi AI lỗi:** trả ngay kết quả của bộ parser luật (đề xuất, đúng §8 "vẫn cho nhập"), hay báo lỗi để người dùng nhập bằng form?
- **D6 — Môi trường dev:** chạy Next trên máy, chỉ Postgres + API + Mailpit trong Docker (đề xuất, vì bộ theo dõi file của Turbopack trên Windows đã nhiều lần không nhận thay đổi), hay đưa cả web vào compose?
- **D7 — Email:** chỉ dùng Mailpit khi dev; khi demo có cần gửi email thật (SMTP Gmail hoặc Resend) không?
- **D8 — Giữ chế độ mock lâu dài:** giữ `DATA_SOURCE=mock` làm chế độ demo offline và để test frontend (đề xuất), hay xoá mock sau khi chuyển xong?

## Kiểm tra end-to-end sau cùng

1. `docker compose up -d && cd server && npx prisma migrate deploy && npx prisma db seed`.
2. `npm run test` (frontend, chế độ mock) và `cd server && npm run test && npm run test:e2e`: tất cả qua.
3. `NEXT_PUBLIC_DATA_SOURCE=api npm run dev`, rồi dùng Playwright chạy 4 luồng demo của PRD §7: ghi nhanh có AI, import sao kê và duyệt, hỏi chatbot, giữ chuỗi; thêm luồng admin khoá tài khoản.
4. Gọi job nhắc nhở với `now` = 20:00 giờ địa phương: notification xuất hiện ở chuông và email xuất hiện trong Mailpit.
5. `server/scripts/eval-ai.ts`: xuất bảng accuracy/F1 cho báo cáo §11.1.
