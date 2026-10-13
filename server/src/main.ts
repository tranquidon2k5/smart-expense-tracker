import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import { AppModule } from "./app.module";
import { configureApp } from "./app.setup";
import { AppConfig } from "./common/config";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  configureApp(app);
  app.enableShutdownHooks();
  const port = app.get(AppConfig).get("PORT");
  await app.listen(port, "0.0.0.0");
  Logger.log(`API chạy tại http://localhost:${port}/api — tài liệu: /api/docs`, "Bootstrap");
}

void bootstrap();
