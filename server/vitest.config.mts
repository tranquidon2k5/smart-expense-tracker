import { defineConfig, mergeConfig } from "vitest/config";
import shared from "./vitest.shared.mts";

/** Unit test: logic thuần + service chạy trên DB test (không qua HTTP) */
export default mergeConfig(shared, defineConfig({ test: { include: ["src/**/*.spec.ts"], globalSetup: ["./test/global-setup.ts"] } }));
