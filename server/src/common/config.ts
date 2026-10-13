import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { z } from "zod";

/** Chuỗi rỗng trong .env coi như không đặt */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" ? undefined : v), schema.optional());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().default(3001),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET cần ít nhất 32 ký tự"),
  ACCESS_TOKEN_TTL_MIN: z.coerce.number().int().positive().default(15),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  SMTP_HOST: optional(z.string()),
  SMTP_PORT: z.coerce.number().int().default(1025),
  MAIL_FROM: z.string().default("Sổ Tiền <no-reply@sotien.vn>"),
  OPENAI_API_KEY: optional(z.string()),
  OPENAI_MODEL: z.string().default("gpt-4.1-mini"),
  OPENAI_BASE_URL: optional(z.string().url()),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(3000),
  CHAT_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  BCRYPT_COST: z.coerce.number().int().min(4).max(15).default(12),
  LOGIN_RATE_LIMIT: z.coerce.number().int().positive().default(5),
  LOGIN_RATE_WINDOW_MIN: z.coerce.number().int().positive().default(15),
  CLOCK_NOW: optional(z.string().datetime({ offset: true })),
  JOBS_ENABLED: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(raw: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(raw);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Cấu hình môi trường chưa hợp lệ:\n${lines.join("\n")}`);
  }
  return parsed.data;
}

/** Cấu hình đã kiểm tra, có kiểu */
@Injectable()
export class AppConfig {
  constructor(private readonly config: ConfigService<Env, true>) {}

  get<K extends keyof Env>(key: K): Env[K] {
    return this.config.get(key, { infer: true });
  }

  get isProduction(): boolean {
    return this.get("NODE_ENV") === "production";
  }
}
