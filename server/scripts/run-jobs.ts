/** Chạy job định kỳ một lần với thời điểm giả: npm run jobs:run -- 2026-10-13T20:00:00+07:00 (cần build vì Nest dùng decorator metadata) */
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "../src/app.module";
import { JobsService } from "../src/notifications/jobs.service";
async function main() {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error"] });
  const at = process.argv[2];
  console.log(at, JSON.stringify(await app.get(JobsService).runAll(new Date(at))));
  await app.close();
}
main();
