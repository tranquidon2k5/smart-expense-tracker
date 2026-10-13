import type { Category, CategoryInput, CategoryUsage } from "@/types";
import * as db from "./mock/db";
import { normalize, scopedTransactions } from "./mock/queries";
import { failIfErrorScenario, getScenario, simulateLatency } from "./mock/scenario";
import { emitDataChanged } from "./events";
import { CATEGORY_COLORS, CATEGORY_ICON_OPTIONS, CATEGORY_NAME_MAX } from "@/lib/category-style";
import { USE_API } from "./data-source";
import * as api from "./api/endpoints";

const CURRENT_MONTH = db.MOCK_TODAY.slice(0, 7);

function scopedCategories(): Category[] {
  // Tài khoản mới chỉ có danh mục mặc định
  return getScenario() === "empty" ? db.categories.filter((c) => c.userId === null) : db.categories;
}

/** Danh mục kèm số giao dịch, số tiền tháng này, có ngân sách hay không (F03) */
export async function listCategoryUsage(): Promise<CategoryUsage[]> {
  if (USE_API) return api.categories.listCategoryUsage();
  await simulateLatency(400);
  failIfErrorScenario();
  const txs = scopedTransactions();
  return scopedCategories().map((category) => {
    const mine = txs.filter((t) => t.categoryId === category.id);
    return {
      category,
      isDefault: category.userId === null,
      transactionCount: mine.length,
      monthAmount: mine
        .filter((t) => t.status === "confirmed" && t.date.startsWith(CURRENT_MONTH))
        .reduce((s, t) => s + t.amount, 0),
      hasBudget: getScenario() !== "empty" && db.budgets.some((b) => b.categoryId === category.id),
    };
  });
}

/** Kiểm tra dữ liệu danh mục; trả về câu lỗi tiếng Việt hoặc null */
export function validateCategory(input: CategoryInput, ignoreId?: string): string | null {
  const name = input.name.trim();
  if (!name) return "Nhập tên danh mục.";
  if (name.length > CATEGORY_NAME_MAX) return `Tên tối đa ${CATEGORY_NAME_MAX} ký tự.`;
  // Bản api: trùng tên do server kiểm (biết đủ danh mục của người dùng)
  const duplicate = USE_API ? undefined : db.categories.find(
    (c) => c.id !== ignoreId && c.type === input.type && normalize(c.name) === normalize(name),
  );
  if (duplicate) return `Đã có danh mục ${input.type === "income" ? "thu" : "chi"} “${duplicate.name}”.`;
  if (!CATEGORY_ICON_OPTIONS.some((o) => o.name === input.icon)) return "Chọn một biểu tượng trong danh sách.";
  if (!CATEGORY_COLORS.some((c) => c.value === input.color)) return "Chọn một màu trong bảng màu.";
  return null;
}

function ownOrThrow(id: string): Category {
  const category = db.categories.find((c) => c.id === id);
  if (!category) throw new Error("Không tìm thấy danh mục, có thể đã bị xoá.");
  if (category.userId === null) throw new Error("Danh mục mặc định không sửa hoặc xoá được.");
  return category;
}

export async function createCategory(input: CategoryInput): Promise<Category> {
  if (USE_API) return api.categories.createCategory(input);
  await simulateLatency(350);
  const error = validateCategory(input);
  if (error) throw new Error(error);
  const category: Category = {
    id: `c-u-${Date.now()}`,
    userId: db.USER_ID,
    name: input.name.trim(),
    type: input.type,
    icon: input.icon,
    color: input.color,
  };
  db.categories.push(category);
  emitDataChanged();
  return category;
}

/** Sửa tên, biểu tượng, màu. Không đổi loại thu/chi vì giao dịch cũ sẽ sai dấu. */
export async function updateCategory(id: string, input: Omit<CategoryInput, "type">): Promise<Category> {
  if (USE_API) return api.categories.updateCategory(id, input);
  await simulateLatency(350);
  const category = ownOrThrow(id);
  const error = validateCategory({ ...input, type: category.type }, id);
  if (error) throw new Error(error);
  Object.assign(category, { name: input.name.trim(), icon: input.icon, color: input.color });
  emitDataChanged();
  return category;
}

/**
 * Xoá danh mục riêng. Nếu đang có giao dịch / ngân sách / luật, phải chọn danh mục
 * cùng loại để chuyển chúng sang (`moveToId`).
 */
export async function deleteCategory(id: string, moveToId?: string): Promise<{ moved: number }> {
  if (USE_API) return api.categories.deleteCategory(id, moveToId);
  await simulateLatency(400);
  const category = ownOrThrow(id);
  const used =
    db.transactions.some((t) => t.categoryId === id) ||
    db.budgets.some((b) => b.categoryId === id) ||
    db.classificationRules.some((r) => r.categoryId === id);

  let moved = 0;
  if (used) {
    const target = db.categories.find((c) => c.id === moveToId);
    if (!target || target.id === id) throw new Error("Chọn danh mục để chuyển các giao dịch đang dùng danh mục này.");
    if (target.type !== category.type) throw new Error("Danh mục nhận phải cùng loại thu/chi.");
    for (const t of db.transactions) {
      if (t.categoryId === id) {
        t.categoryId = target.id;
        moved += 1;
      }
    }
    for (const r of db.classificationRules) if (r.categoryId === id) r.categoryId = target.id;
    // Ngân sách: nếu danh mục nhận đã có hạn mức cùng tháng thì giữ hạn mức đó
    for (let i = db.budgets.length - 1; i >= 0; i--) {
      const b = db.budgets[i];
      if (b.categoryId !== id) continue;
      if (db.budgets.some((x) => x.categoryId === target.id && x.month === b.month)) db.budgets.splice(i, 1);
      else b.categoryId = target.id;
    }
  }
  db.categories.splice(db.categories.indexOf(category), 1);
  emitDataChanged();
  return { moved };
}
