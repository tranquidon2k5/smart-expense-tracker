import type { Prisma } from "../../generated/prisma/client";

/** Client dùng được cả ngoài lẫn trong `prisma.$transaction(async (tx) => …)` */
export type Db = Prisma.TransactionClient;

/** Lỗi vi phạm ràng buộc unique của Postgres (Prisma P2002) */
export function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
