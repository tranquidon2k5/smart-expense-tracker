import { Controller, Get, Global, MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { APP_GUARD } from "@nestjs/core";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerModule } from "@nestjs/throttler";
import { AdminController } from "./admin/admin.controller";
import { AdminService } from "./admin/admin.service";
import { AiController, ChatController, ImportController } from "./ai/ai.controller";
import { AiService } from "./ai/ai.service";
import { LLM_PROVIDER, OpenAiProvider, RuleOnlyProvider } from "./ai/llm.provider";
import { AuthController } from "./auth/auth.controller";
import { AuthService } from "./auth/auth.service";
import { BudgetsController } from "./budgets/budgets.controller";
import { BudgetsService } from "./budgets/budgets.service";
import { CategoriesController } from "./categories/categories.controller";
import { CategoriesService } from "./categories/categories.service";
import { ChatService } from "./chat/chat.service";
import { JwtAuthGuard, Public, RolesGuard } from "./common/auth";
import { ClockService } from "./common/clock.service";
import { AppConfig, validateEnv } from "./common/config";
import { MailService } from "./common/mail.service";
import { PrismaService } from "./common/prisma.service";
import { RequestContextMiddleware } from "./common/request-context";
import { GamificationService } from "./gamification/gamification.service";
import { ImportService } from "./import/import.service";
import { JobsService } from "./notifications/jobs.service";
import { NotificationsService } from "./notifications/notifications.service";
import { DashboardController, StatsController } from "./stats/stats.controller";
import { StatsService } from "./stats/stats.service";
import { RulesController, TransactionsController } from "./transactions/transactions.controller";
import { TransactionsService } from "./transactions/transactions.service";
import { GamificationController, NotificationsController, UsersController } from "./users/users.controller";
import { UsersService } from "./users/users.service";
import { WalletsController } from "./wallets/wallets.controller";
import { WalletsService } from "./wallets/wallets.service";

@Controller("health")
class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  async health() {
    await this.prisma.$queryRaw`SELECT 1`;
    return { status: "ok", db: "ok" };
  }
}

/** Hạ tầng dùng chung: cấu hình, DB, đồng hồ, email, JWT */
@Global()
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, envFilePath: [".env"] }),
    JwtModule.registerAsync({
      global: true,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        secret: config.get("JWT_SECRET"),
        signOptions: { expiresIn: `${config.get("ACCESS_TOKEN_TTL_MIN")}m` },
      }),
    }),
  ],
  providers: [AppConfig, PrismaService, ClockService, MailService],
  exports: [AppConfig, PrismaService, ClockService, MailService],
})
class CoreModule {}

/** Gamification: chuỗi, XP, nhiệm vụ, huy hiệu, thông báo, job định kỳ */
@Module({
  controllers: [GamificationController, NotificationsController],
  providers: [GamificationService, NotificationsService, JobsService],
  exports: [GamificationService, NotificationsService, JobsService],
})
export class GamificationModule {}

/** Tài chính: ví, danh mục, giao dịch, luật, ngân sách, thống kê */
@Module({
  imports: [GamificationModule],
  controllers: [WalletsController, CategoriesController, TransactionsController, RulesController, BudgetsController, DashboardController, StatsController],
  providers: [TransactionsService, WalletsService, CategoriesService, BudgetsService, StatsService],
  exports: [TransactionsService],
})
export class FinanceModule {}

/** AI: ghi nhanh, phân loại hybrid, nhập sao kê, trợ lý */
@Module({
  imports: [GamificationModule, FinanceModule],
  controllers: [AiController, ImportController, ChatController],
  providers: [
    {
      provide: LLM_PROVIDER,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => {
        const key = config.get("OPENAI_API_KEY");
        return key ? new OpenAiProvider(key, config.get("OPENAI_MODEL"), config.get("OPENAI_BASE_URL")) : new RuleOnlyProvider();
      },
    },
    AiService,
    ImportService,
    ChatService,
  ],
})
export class AiModule {}

/** Tài khoản: đăng nhập, hồ sơ, quản trị */
@Module({
  imports: [
    GamificationModule,
    ThrottlerModule.forRootAsync({
      inject: [AppConfig],
      useFactory: (config: AppConfig) => ({
        throttlers: [
          {
            name: "auth",
            ttl: config.get("LOGIN_RATE_WINDOW_MIN") * 60_000,
            limit: config.get("LOGIN_RATE_LIMIT"),
            // Theo IP + email: thử sai một tài khoản không chặn người khác cùng mạng
            getTracker: (req: Record<string, any>) => `${req.ip}|${String(req.body?.email ?? "").trim().toLowerCase()}`,
          },
        ],
      }),
    }),
  ],
  controllers: [AuthController, UsersController, AdminController],
  providers: [AuthService, UsersService, AdminService],
})
export class AccountModule {}

@Module({
  imports: [CoreModule, ScheduleModule.forRoot(), AccountModule, FinanceModule, AiModule, GamificationModule],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes("*path");
  }
}
