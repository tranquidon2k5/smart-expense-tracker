/** npx prisma db seed — SEED_TODAY=yyyy-MM-dd để cố định ngày neo (mặc định: hôm nay giờ Việt Nam) */
import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { todayIn } from "@shared/dates";
import { PrismaClient } from "../generated/prisma/client";
import { seedDatabase } from "./seed-data";

async function main() {
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
  const anchor = process.env.SEED_TODAY || todayIn("Asia/Ho_Chi_Minh");
  const started = Date.now();
  try {
    const result = await seedDatabase(prisma, { anchor, bcryptCost: Number(process.env.BCRYPT_COST) || 10 });
    console.log(`Đã seed xong trong ${((Date.now() - started) / 1000).toFixed(1)}s:`, result);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
