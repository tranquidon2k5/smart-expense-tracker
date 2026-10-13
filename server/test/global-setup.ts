import { execSync } from "node:child_process";

/** Áp migration lên DB test một lần trước toàn bộ test */
export default function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://sotien:sotien@localhost:5434/sotien_test";
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } });
}
