import { type INestApplication, ValidationPipe } from "@nestjs/common";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import cookieParser from "cookie-parser";
import { json } from "express";
import { AppConfig } from "./common/config";
import { AllExceptionsFilter } from "./common/errors";
import { CELEBRATIONS_HEADER, CelebrationsInterceptor } from "./common/request-context";

/** Cấu hình dùng chung cho main.ts và test e2e */
export function configureApp(app: INestApplication): void {
  const config = app.get(AppConfig);
  const express = app as NestExpressApplication;
  // Đứng sau Next rewrite / reverse proxy: lấy IP thật từ X-Forwarded-For (giới hạn đăng nhập theo IP)
  express.set("trust proxy", "loopback, linklocal, uniquelocal");
  app.use(json({ limit: "5mb" }));
  app.use(cookieParser());
  app.setGlobalPrefix("api");
  app.enableCors({
    origin: config.get("WEB_ORIGIN").split(",").map((s) => s.trim()),
    credentials: true,
    exposedHeaders: [CELEBRATIONS_HEADER, "X-Total-Count", "X-Next-Cursor"],
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, transformOptions: { enableImplicitConversion: false } }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new CelebrationsInterceptor());

  const doc = new DocumentBuilder()
    .setTitle("Sổ Tiền API")
    .setDescription("REST backend cho Sổ Tiền — đăng nhập bằng cookie httpOnly (POST /api/auth/login)")
    .setVersion("0.1.0")
    .addCookieAuth("st_access")
    .build();
  SwaggerModule.setup("api/docs", app, SwaggerModule.createDocument(app, doc));
}
