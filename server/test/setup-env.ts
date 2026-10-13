/**
 * Môi trường test: DB riêng (docker compose --profile test up -d db-test), bcrypt nhẹ, không job tự
 * chạy, không gọi OpenAI thật, "bây giờ" cố định 12/10/2026 10:00 giờ Việt Nam như bản demo.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://sotien:sotien@localhost:5434/sotien_test";
process.env.JWT_SECRET = "test-secret-0123456789abcdef0123456789abcdef";
process.env.BCRYPT_COST = "4";
process.env.JOBS_ENABLED = "false";
process.env.OPENAI_API_KEY = "";
process.env.SMTP_HOST = "";
process.env.CLOCK_NOW = "2026-10-12T10:00:00+07:00";
process.env.LOGIN_RATE_LIMIT = "5";
// Thời gian chờ AI ngắn để test quá giờ chạy nhanh
process.env.AI_TIMEOUT_MS = "600";
process.env.CHAT_TIMEOUT_MS = "1500";
