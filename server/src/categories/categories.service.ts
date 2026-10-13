import { Injectable } from "@nestjs/common";
import { CATEGORY_COLORS, CATEGORY_ICON_OPTIONS, CATEGORY_NAME_MAX } from "@shared/category-style";
import { normalize } from "@shared/text";
import type { Category, CategoryInput, CategoryUsage, TransactionType } from "@shared/types";
import type { AuthUser } from "../common/auth";
import { ClockService } from "../common/clock.service";
import { badRequest, notFound } from "../common/errors";
import { dbDate, money, toCategory } from "../common/mappers";
import { PrismaService } from "../common/prisma.service";
import { nextMonthStart } from "../transactions/transactions.service";

@Injectable()
export class CategoriesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: ClockService,
  ) {}

  /** Danh mục mặc định trước, rồi tới danh mục riêng của người dùng */
  async list(userId: string, type?: TransactionType): Promise<Category[]> {
    const rows = await this.prisma.category.findMany({
      where: { OR: [{ userId: null }, { userId }], ...(type ? { type } : {}) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    return rows.map(toCategory).sort((a, b) => Number(a.userId !== null) - Number(b.userId !== null));
  }

  /** Danh mục kèm số giao dịch, số tiền tháng này, có ngân sách hay không (F03) */
  async usage(user: AuthUser): Promise<CategoryUsage[]> {
    const month = this.clock.today(user.timezone).slice(0, 7);
    const [categories, counts, monthly, budgets] = await Promise.all([
      this.list(user.id),
      this.prisma.transaction.groupBy({ by: ["categoryId"], where: { userId: user.id }, _count: { _all: true } }),
      this.prisma.transaction.groupBy({
        by: ["categoryId"],
        where: { userId: user.id, status: "confirmed", date: { gte: dbDate(`${month}-01`), lt: dbDate(nextMonthStart(month)) } },
        _sum: { amount: true },
      }),
      this.prisma.budget.findMany({ where: { userId: user.id }, select: { categoryId: true }, distinct: ["categoryId"] }),
    ]);
    return categories.map((category) => ({
      category,
      isDefault: category.userId === null,
      transactionCount: counts.find((c) => c.categoryId === category.id)?._count._all ?? 0,
      monthAmount: money(monthly.find((m) => m.categoryId === category.id)?._sum.amount),
      hasBudget: budgets.some((b) => b.categoryId === category.id),
    }));
  }

  private async validate(userId: string, input: CategoryInput, ignoreId?: string): Promise<string> {
    const name = (input.name ?? "").trim().replace(/\s+/g, " ");
    if (!name) throw badRequest("Nhập tên danh mục.", "name");
    if (name.length > CATEGORY_NAME_MAX) throw badRequest(`Tên tối đa ${CATEGORY_NAME_MAX} ký tự.`, "name");
    const sameType = await this.list(userId, input.type);
    const duplicate = sameType.find((c) => c.id !== ignoreId && normalize(c.name) === normalize(name));
    if (duplicate) throw badRequest(`Đã có danh mục ${input.type === "income" ? "thu" : "chi"} “${duplicate.name}”.`, "name");
    if (!CATEGORY_ICON_OPTIONS.some((o) => o.name === input.icon)) throw badRequest("Chọn một biểu tượng trong danh sách.", "icon");
    if (!CATEGORY_COLORS.some((c) => c.value === input.color)) throw badRequest("Chọn một màu trong bảng màu.", "color");
    return name;
  }

  private async ownOrThrow(userId: string, id: string) {
    const c = await this.prisma.category.findFirst({ where: { id, OR: [{ userId: null }, { userId }] } });
    if (!c) throw notFound("Không tìm thấy danh mục, có thể đã bị xoá.");
    if (c.userId === null) throw badRequest("Danh mục mặc định không sửa hoặc xoá được.");
    return c;
  }

  async create(userId: string, input: CategoryInput): Promise<Category> {
    if (input.type !== "income" && input.type !== "expense") throw badRequest("Chọn loại thu hoặc chi.", "type");
    const name = await this.validate(userId, input);
    const c = await this.prisma.category.create({
      data: { userId, name, type: input.type, icon: input.icon, color: input.color, createdAt: this.clock.now() },
    });
    return toCategory(c);
  }

  /** Sửa tên, biểu tượng, màu. Không đổi loại thu/chi vì giao dịch cũ sẽ sai dấu. */
  async update(userId: string, id: string, input: Omit<CategoryInput, "type">): Promise<Category> {
    const c = await this.ownOrThrow(userId, id);
    const name = await this.validate(userId, { ...input, type: c.type }, id);
    const updated = await this.prisma.category.update({ where: { id }, data: { name, icon: input.icon, color: input.color } });
    return toCategory(updated);
  }

  /**
   * Xoá danh mục riêng. Đang có giao dịch / ngân sách / luật thì phải chọn danh mục cùng loại
   * để chuyển sang (`moveToId`); ngân sách trùng tháng ở danh mục nhận thì giữ hạn mức bên nhận.
   */
  async remove(userId: string, id: string, moveToId?: string): Promise<{ moved: number }> {
    const category = await this.ownOrThrow(userId, id);
    return this.prisma.$transaction(async (db) => {
      const [tx, budgets, rules] = await Promise.all([
        db.transaction.count({ where: { categoryId: id } }),
        db.budget.findMany({ where: { categoryId: id } }),
        db.classificationRule.count({ where: { categoryId: id } }),
      ]);
      let moved = 0;
      if (tx || budgets.length || rules) {
        const target = moveToId
          ? await db.category.findFirst({ where: { id: moveToId, OR: [{ userId: null }, { userId }] } })
          : null;
        if (!target || target.id === id) throw badRequest("Chọn danh mục để chuyển các giao dịch đang dùng danh mục này.", "moveTo");
        if (target.type !== category.type) throw badRequest("Danh mục nhận phải cùng loại thu/chi.", "moveTo");
        moved = (await db.transaction.updateMany({ where: { categoryId: id }, data: { categoryId: target.id } })).count;
        await db.classificationRule.updateMany({ where: { categoryId: id }, data: { categoryId: target.id } });
        for (const b of budgets) {
          const clash = await db.budget.findUnique({
            where: { userId_categoryId_month: { userId: b.userId, categoryId: target.id, month: b.month } },
          });
          if (clash) await db.budget.delete({ where: { id: b.id } });
          else await db.budget.update({ where: { id: b.id }, data: { categoryId: target.id } });
        }
      }
      await db.category.delete({ where: { id } });
      return { moved };
    });
  }
}
