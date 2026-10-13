import { readFileSync } from "node:fs";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { ThrottlerStorage } from "@nestjs/throttler";
import request from "supertest";
import type TestAgent from "supertest/lib/agent";
import { parseCsvText } from "@shared/csv-import";
import { AppModule } from "../src/app.module";
import { configureApp } from "../src/app.setup";
import { LLM_PROVIDER, type LlmProvider } from "../src/ai/llm.provider";
import { ClockService } from "../src/common/clock.service";
import { MailService } from "../src/common/mail.service";
import { PrismaService } from "../src/common/prisma.service";
import { JobsService } from "../src/notifications/jobs.service";
import { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD, LAN_EMAIL, seedDatabase, type SeedOptions } from "../prisma/seed-data";

export { ADMIN_EMAIL, ADMIN_PASSWORD, DEMO_PASSWORD, LAN_EMAIL };
export const TODAY = "2026-10-12";
/** 12/10/2026 10:00 giờ Việt Nam */
export const DEFAULT_NOW = new Date("2026-10-12T10:00:00+07:00");

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
  clock: ClockService;
  mail: MailService;
  jobs: JobsService;
  http: () => ReturnType<typeof request>;
  /** Agent đã đăng nhập (cookie httpOnly), dùng lại trong cùng app để không chạm giới hạn đăng nhập */
  as: (email: string, password?: string) => Promise<TestAgent>;
  reset: (options?: SeedOptions) => Promise<void>;
  close: () => Promise<void>;
}

export async function createTestApp(options: { provider?: LlmProvider } = {}): Promise<TestContext> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  if (options.provider) builder = builder.overrideProvider(LLM_PROVIDER).useValue(options.provider);
  const moduleRef = await builder.compile();
  const app = moduleRef.createNestApplication({ bodyParser: false, logger: ["error"] });
  configureApp(app);
  await app.init();

  const prisma = app.get(PrismaService);
  const clock = app.get(ClockService);
  const agents = new Map<string, TestAgent>();
  const server = app.getHttpServer();

  return {
    app,
    prisma,
    clock,
    mail: app.get(MailService),
    jobs: app.get(JobsService),
    http: () => request(server),
    as: async (email, password = email === ADMIN_EMAIL ? ADMIN_PASSWORD : DEMO_PASSWORD) => {
      const cached = agents.get(email);
      if (cached) return cached;
      const agent = request.agent(server);
      await agent.post("/api/auth/login").send({ email, password }).expect(200);
      agents.set(email, agent);
      return agent;
    },
    reset: async (seedOptions = {}) => {
      clock.set(DEFAULT_NOW);
      await seedDatabase(prisma, { anchor: TODAY, bcryptCost: 4, minimal: true, ...seedOptions });
      agents.clear();
      // Mỗi test bắt đầu với bộ đếm giới hạn đăng nhập trống
      // (bản in-memory giữ số lần gọi ở hai Map: storage và hitExpirations)
      const throttle = app.get<{ storage: Map<string, unknown>; hitExpirations: Map<string, unknown> }>(ThrottlerStorage, { strict: false });
      throttle.storage.clear();
      throttle.hitExpirations.clear();
    },
    close: () => app.close(),
  };
}

/** Đọc file mẫu trong public/mau như trình duyệt (bước đọc + ánh xạ ở client, D4) */
export function sampleCsv(name: string) {
  const text = readFileSync(new URL(`../../public/mau/${name}`, import.meta.url), "utf8");
  return parseCsvText(text, name);
}

/** Giải mã header chúc mừng X-Celebrations */
export function celebrations(res: { headers: Record<string, string | string[] | undefined> }) {
  const raw = res.headers["x-celebrations"];
  return raw ? (JSON.parse(Buffer.from(String(raw), "base64").toString("utf8")) as { kind: string; title: string; xp?: number; description: string }[]) : [];
}

export async function totalXp(prisma: PrismaService, userId: string) {
  return (await prisma.userLevel.findUnique({ where: { userId } }))?.totalXp ?? 0;
}
