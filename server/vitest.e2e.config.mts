import { defineConfig, mergeConfig } from "vitest/config";
import shared from "./vitest.shared.mts";

/** E2E: gọi HTTP thật (supertest) vào app NestJS, DB test riêng */
export default mergeConfig(shared, defineConfig({ test: { include: ["test/**/*.e2e-spec.ts"], globalSetup: ["./test/global-setup.ts"] } }));
