/**
 * Nguồn dữ liệu của tầng services (D8):
 * - "mock" (mặc định): dữ liệu giả lập trong bộ nhớ — demo offline, test vitest, kịch bản ?demo=
 * - "api": gọi backend NestJS qua /api (Next rewrite sang API, cùng origin nên cookie httpOnly chạy)
 * Đặt bằng NEXT_PUBLIC_DATA_SOURCE=api khi build/chạy Next.
 */
export const DATA_SOURCE: "mock" | "api" = process.env.NEXT_PUBLIC_DATA_SOURCE === "api" ? "api" : "mock";

export const USE_API = DATA_SOURCE === "api";
