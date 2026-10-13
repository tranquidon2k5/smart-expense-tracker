import { fileURLToPath } from "node:url";
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

/** SWC giữ decorator metadata cho DI của NestJS (esbuild mặc định của vitest không có) */
export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("../shared", import.meta.url)),
      "@": fileURLToPath(new URL("../src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    setupFiles: ["./test/setup-env.ts"],
    // Các file test dùng chung một database → chạy tuần tự
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
