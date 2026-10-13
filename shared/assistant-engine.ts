/**
 * Giả lập trợ lý AI theo Luồng 3 PRD: "LLM" chỉ hiểu câu hỏi và chọn công cụ;
 * mọi con số do các hàm công cụ tính trực tiếp từ dữ liệu giao dịch (không bịa).
 * Hàm thuần — nhận dữ liệu qua tham số để test được và dễ thay bằng LLM thật.
 */
import type { Budget, Category, ChatToolCall, Transaction } from "./types";
import { formatDate, formatMoney, formatMonthLong, formatPercent } from "./format";
import { normalize } from "./text";

export interface EngineContext {
  transactions: readonly Transaction[];
  categories: readonly Category[];
  budgets: readonly Budget[];
  /** "2026-10-12" */
  today: string;
}

export interface EngineAnswer {
  content: string;
  toolCalls: ChatToolCall[];
  sourceIds: string[];
  refused: boolean;
}

// ───────────── Hiểu câu hỏi ─────────────

/** Từ đồng nghĩa (không dấu) → id danh mục */
const CATEGORY_SYNONYMS: [string[], string][] = [
  [["an uong", "an ", "do an", "com", "pho", "cafe", "ca phe", "tra sua", "an sang", "an trua", "an toi"], "c-food"],
  [["di chuyen", "di lai", "grab", "xang", "taxi", "xe "], "c-move"],
  [["hoc tap", "hoc phi", "sach", "khoa hoc", "ielts"], "c-study"],
  [["giai tri", "xem phim", "karaoke", "netflix", "game"], "c-fun"],
  [["mua sam", "shopee", "tiki", "quan ao"], "c-shop"],
  [["hoa don", "tien nha", "dien nuoc", "tien dien", "internet"], "c-bill"],
  [["suc khoe", "thuoc", "kham benh", "gym"], "c-health"],
  [["luong"], "c-salary"],
  [["thuong"], "c-bonus"],
];

/**
 * Chủ đề ngoài phạm vi. Dùng cụm từ cụ thể (so khớp trên câu đã chuẩn hoá, có khoảng trắng hai đầu)
 * để không bắt nhầm: "giao dịch" ≠ "dịch", "như vậy" ≠ "vay", "vàng" chỉ khi nói về giá/mua vàng.
 */
const OUT_OF_SCOPE = [
  "dau tu", "co phieu", "chung khoan", "crypto", "bitcoin", " coin ", "vay tien", "vay no", "di vay", "vay mua",
  "khoan vay", "lai suat", "gia vang", "mua vang", "vang mieng",
  "thoi tiet", "nau an", "cong thuc", "bong da", "bai hat", "dich sang", "dich giup", "dich cau", "phien dich",
  "viet code", "lap trinh",
];

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

/** Các tháng được nhắc tới, theo thứ tự xuất hiện */
export function parseMonths(q: string, today: string): string[] {
  const current = today.slice(0, 7);
  const year = Number(today.slice(0, 4));
  const found: { index: number; month: string }[] = [];
  const re = /thang\s*(nay|truoc|(\d{1,2})(?:\s*[/-]\s*(\d{4}))?)/g;
  for (let m = re.exec(q); m; m = re.exec(q)) {
    let month: string;
    if (m[1] === "nay") month = current;
    else if (m[1] === "truoc") month = shiftMonth(current, -1);
    else {
      const mm = Number(m[2]);
      if (mm < 1 || mm > 12) continue;
      // "tháng 11" khi đang tháng 10 → hiểu là năm trước
      const y = m[3] ? Number(m[3]) : `${year}-${String(mm).padStart(2, "0")}` > current ? year - 1 : year;
      month = `${y}-${String(mm).padStart(2, "0")}`;
    }
    found.push({ index: m.index, month });
  }
  return found.sort((a, b) => a.index - b.index).map((f) => f.month);
}

export function parseCategory(q: string, categories: readonly Category[]): Category | null {
  const padded = ` ${q} `;
  // Ưu tiên tên danh mục người dùng tự đặt / mặc định khớp nguyên văn
  const byName = [...categories]
    .sort((a, b) => b.name.length - a.name.length)
    .find((c) => padded.includes(` ${normalize(c.name)} `));
  if (byName) return byName;
  for (const [words, id] of CATEGORY_SYNONYMS) {
    if (words.some((w) => padded.includes(w.endsWith(" ") ? ` ${w}` : w))) {
      return categories.find((c) => c.id === id) ?? null;
    }
  }
  return null;
}

// ───────────── Công cụ (chạy "phía backend", tính từ dữ liệu) ─────────────

const confirmed = (ctx: EngineContext) => ctx.transactions.filter((t) => t.status === "confirmed");
const inMonth = (list: readonly Transaction[], month: string) => list.filter((t) => t.date.startsWith(month));
const sum = (list: readonly Transaction[]) => list.reduce((s, t) => s + t.amount, 0);
const newestFirst = (a: Transaction, b: Transaction) => b.date.localeCompare(a.date) || b.amount - a.amount;

function monthLabel(month: string, today: string) {
  const label = formatMonthLong(month).toLowerCase();
  return month === today.slice(0, 7) ? `${label} (tính đến ${formatDate(today)})` : label;
}

function hasAnyData(ctx: EngineContext, month: string) {
  return ctx.transactions.some((t) => t.date.startsWith(month));
}

function noData(month: string, call: ChatToolCall): EngineAnswer {
  return {
    content: `Mình chưa có giao dịch nào trong ${formatMonthLong(month).toLowerCase()} nên chưa tính được. Bạn thử hỏi về một tháng khác nhé.`,
    toolCalls: [call],
    sourceIds: [],
    refused: false,
  };
}

function pendingNote(ctx: EngineContext, month: string, categoryId?: string) {
  const n = ctx.transactions.filter(
    (t) => t.status === "pending" && t.date.startsWith(month) && (!categoryId || t.categoryId === categoryId),
  ).length;
  return n ? ` (Chưa tính ${n} giao dịch đang chờ duyệt.)` : "";
}

function tongTheoDanhMuc(ctx: EngineContext, category: Category, month: string): EngineAnswer {
  const call: ChatToolCall = { name: "tong_theo_danh_muc", args: { danh_muc: category.name, thang: month } };
  if (!hasAnyData(ctx, month)) return noData(month, call);
  const list = inMonth(confirmed(ctx), month).filter((t) => t.categoryId === category.id);
  const total = sum(list);
  const verb = category.type === "income" ? "nhận" : "chi";
  const content = list.length
    ? `${capitalize(monthLabel(month, ctx.today))} bạn ${verb} ${formatMoney(total)} cho ${category.name}, qua ${list.length} giao dịch` +
      (category.type === "expense" ? `, trung bình ${formatMoney(Math.round(total / list.length))} mỗi lần.` : ".") +
      pendingNote(ctx, month, category.id)
    : `${capitalize(monthLabel(month, ctx.today))} chưa có giao dịch ${category.name} nào.` + pendingNote(ctx, month, category.id);
  return { content, toolCalls: [call], sourceIds: [...list].sort(newestFirst).map((t) => t.id), refused: false };
}

function soSanhHaiThang(ctx: EngineContext, a: string, b: string, category: Category | null): EngineAnswer {
  const call: ChatToolCall = {
    name: "so_sanh_hai_thang",
    args: { danh_muc: category?.name ?? null, thang_a: a, thang_b: b },
  };
  for (const m of [a, b]) if (!hasAnyData(ctx, m)) return noData(m, call);
  const type = category?.type ?? "expense";
  const pick = (m: string) =>
    inMonth(confirmed(ctx), m).filter((t) => (category ? t.categoryId === category.id : t.type === type));
  const la = pick(a);
  const lb = pick(b);
  const ta = sum(la);
  const tb = sum(lb);
  const what = category ? `${type === "income" ? "khoản" : "tiền"} ${category.name}` : "tổng chi";
  let compare: string;
  if (tb === 0) compare = `${capitalize(formatMonthLong(b).toLowerCase())} không có khoản nào để so sánh.`;
  else {
    const diff = ta - tb;
    const pct = Math.abs(diff / tb) * 100;
    compare =
      Math.abs(diff) < 1000
        ? "Hai tháng gần như bằng nhau."
        : `${capitalize(formatMonthLong(a).toLowerCase())} ${diff > 0 ? "nhiều hơn" : "ít hơn"} ${formatMoney(Math.abs(diff))} (${diff > 0 ? "+" : "−"}${formatPercent(pct)}).`;
  }
  const partial = a === ctx.today.slice(0, 7) || b === ctx.today.slice(0, 7) ? " Lưu ý tháng hiện tại mới tính đến hôm nay." : "";
  return {
    content: `So sánh ${what}: ${formatMonthLong(a).toLowerCase()} là ${formatMoney(ta)} (${la.length} giao dịch), ${formatMonthLong(b).toLowerCase()} là ${formatMoney(tb)} (${lb.length} giao dịch). ${compare}${partial}`,
    toolCalls: [call],
    sourceIds: [...la, ...lb].sort(newestFirst).map((t) => t.id),
    refused: false,
  };
}

function tongThuChiThang(ctx: EngineContext, month: string): EngineAnswer {
  const call: ChatToolCall = { name: "tong_thu_chi_thang", args: { thang: month } };
  if (!hasAnyData(ctx, month)) return noData(month, call);
  const list = inMonth(confirmed(ctx), month);
  const income = sum(list.filter((t) => t.type === "income"));
  const expense = sum(list.filter((t) => t.type === "expense"));
  const net = income - expense;
  return {
    content:
      `${capitalize(monthLabel(month, ctx.today))}: tổng thu ${formatMoney(income)}, tổng chi ${formatMoney(expense)}, ` +
      (net >= 0 ? `còn dư ${formatMoney(net)}.` : `chi nhiều hơn thu ${formatMoney(-net)}.`) +
      pendingNote(ctx, month),
    toolCalls: [call],
    sourceIds: [...list].sort(newestFirst).map((t) => t.id),
    refused: false,
  };
}

function chiTheoDanhMuc(ctx: EngineContext, month: string): EngineAnswer {
  const call: ChatToolCall = { name: "chi_theo_danh_muc", args: { thang: month } };
  if (!hasAnyData(ctx, month)) return noData(month, call);
  const list = inMonth(confirmed(ctx), month).filter((t) => t.type === "expense");
  const total = sum(list);
  const byCat = new Map<string, number>();
  for (const t of list) byCat.set(t.categoryId, (byCat.get(t.categoryId) ?? 0) + t.amount);
  const ranked = [...byCat.entries()].sort((x, y) => y[1] - x[1]).slice(0, 3);
  const name = (id: string) => ctx.categories.find((c) => c.id === id)?.name ?? "Khác";
  const lines = ranked.map(([id, v], i) => `${i + 1}. ${name(id)}: ${formatMoney(v)} (${formatPercent((v / total) * 100)})`);
  const topId = ranked[0]?.[0];
  return {
    content: total
      ? `${capitalize(monthLabel(month, ctx.today))} bạn chi nhiều nhất cho ${name(topId!)}. Ba danh mục lớn nhất trên tổng ${formatMoney(total)}:\n${lines.join("\n")}`
      : `${capitalize(monthLabel(month, ctx.today))} chưa có khoản chi nào.`,
    toolCalls: [call],
    sourceIds: list.filter((t) => t.categoryId === topId).sort(newestFirst).map((t) => t.id),
    refused: false,
  };
}

function topKhoanChi(ctx: EngineContext, month: string, n: number): EngineAnswer {
  const call: ChatToolCall = { name: "top_khoan_chi", args: { thang: month, so_luong: n } };
  if (!hasAnyData(ctx, month)) return noData(month, call);
  const list = inMonth(confirmed(ctx), month)
    .filter((t) => t.type === "expense")
    .sort((a, b) => b.amount - a.amount)
    .slice(0, n);
  const lines = list.map((t, i) => `${i + 1}. ${t.description}: ${formatMoney(t.amount)} (${formatDate(t.date)})`);
  return {
    content: list.length
      ? `${list.length} khoản chi lớn nhất ${monthLabel(month, ctx.today)}:\n${lines.join("\n")}`
      : `${capitalize(monthLabel(month, ctx.today))} chưa có khoản chi nào.`,
    toolCalls: [call],
    sourceIds: list.map((t) => t.id),
    refused: false,
  };
}

function tinhTrangNganSach(ctx: EngineContext, month: string): EngineAnswer {
  const call: ChatToolCall = { name: "tinh_trang_ngan_sach", args: { thang: month } };
  const budgets = ctx.budgets.filter((b) => b.month === month);
  if (!budgets.length) {
    return {
      content: `Bạn chưa đặt ngân sách cho ${formatMonthLong(month).toLowerCase()}. Vào trang Ngân sách để đặt hạn mức cho vài danh mục chi lớn nhé.`,
      toolCalls: [call],
      sourceIds: [],
      refused: false,
    };
  }
  const list = inMonth(confirmed(ctx), month);
  const rows = budgets
    .map((b) => {
      const spent = sum(list.filter((t) => t.categoryId === b.categoryId));
      return { b, spent, ratio: spent / b.limitAmount, name: ctx.categories.find((c) => c.id === b.categoryId)?.name ?? "" };
    })
    .sort((x, y) => y.ratio - x.ratio);
  const over = rows.filter((r) => r.ratio > 1);
  const warn = rows.filter((r) => r.ratio >= 0.8 && r.ratio <= 1);
  const parts: string[] = [];
  if (over.length) parts.push(`Vượt hạn mức: ${over.map((r) => `${r.name} (${formatPercent(r.ratio * 100)})`).join(", ")}.`);
  if (warn.length) parts.push(`Sắp chạm hạn mức: ${warn.map((r) => `${r.name} (${formatPercent(r.ratio * 100)})`).join(", ")}.`);
  if (!over.length && !warn.length) parts.push("Mọi danh mục đều đang trong hạn mức, giỏi lắm!");
  const totalLimit = rows.reduce((s, r) => s + r.b.limitAmount, 0);
  const totalSpent = rows.reduce((s, r) => s + r.spent, 0);
  const watched = new Set([...over, ...warn].map((r) => r.b.categoryId));
  return {
    content: `${capitalize(monthLabel(month, ctx.today))} bạn đã dùng ${formatMoney(totalSpent)} trên tổng hạn mức ${formatMoney(totalLimit)} (${formatPercent((totalSpent / totalLimit) * 100)}). ${parts.join(" ")}`,
    toolCalls: [call],
    sourceIds: list.filter((t) => watched.has(t.categoryId)).sort(newestFirst).map((t) => t.id),
    refused: false,
  };
}

// ───────────── Điều phối ─────────────

export const SUGGESTED_QUESTIONS = [
  "Tháng này tiêu ăn uống bao nhiêu?",
  "So sánh tháng 9 với tháng 8",
  "Tháng này mình chi nhiều nhất vào đâu?",
  "5 khoản chi lớn nhất tháng này",
  "Ngân sách tháng này thế nào?",
];

function refuse(reason: "invest" | "other"): EngineAnswer {
  return {
    content:
      reason === "invest"
        ? "Câu này nằm ngoài phạm vi của mình rồi. Sổ Tiền không tư vấn đầu tư hay vay mượn, mình chỉ giúp bạn hiểu số liệu thu chi và ngân sách của chính bạn thôi. Bạn thử hỏi “Tháng này mình chi nhiều nhất vào đâu?” nhé."
        : "Mình chỉ trả lời được các câu hỏi về thu chi, giao dịch và ngân sách trong Sổ Tiền thôi, nên chưa giúp được câu này. Bạn thử hỏi “Tháng này tiêu ăn uống bao nhiêu?” hoặc “So sánh tháng 9 với tháng 8” nhé.",
    toolCalls: [],
    sourceIds: [],
    refused: true,
  };
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Chuẩn hoá câu hỏi để so khớp: bỏ dấu, bỏ dấu câu, có khoảng trắng hai đầu */
function normalizeQuestion(question: string): string {
  return ` ${normalize(question).replace(/[?!.,;:"“”]/g, " ").replace(/\s+/g, " ").trim()} `;
}

/** Câu hỏi về đầu tư, vay, chủ đề ngoài tài chính cá nhân → từ chối trước khi gọi LLM */
export function isOutOfScope(question: string): boolean {
  const q = normalizeQuestion(question);
  return OUT_OF_SCOPE.some((w) => q.includes(w));
}

export function refuseAnswer(reason: "invest" | "other"): EngineAnswer {
  return refuse(reason);
}

export type ToolName =
  | "tong_theo_danh_muc"
  | "so_sanh_hai_thang"
  | "tong_thu_chi_thang"
  | "chi_theo_danh_muc"
  | "top_khoan_chi"
  | "tinh_trang_ngan_sach";

export type QuestionPlan = { refused: "invest" | "other" } | { call: ChatToolCall };

/**
 * Bước "hiểu câu hỏi" bằng luật: chọn công cụ + tham số. Bản có LLM thay bước này bằng
 * function calling; bước tính số liệu (runTool) dùng chung.
 */
export function planQuestion(question: string, ctx: Pick<EngineContext, "categories" | "today">): QuestionPlan {
  const q = normalizeQuestion(question);
  if (OUT_OF_SCOPE.some((w) => q.includes(w))) return { refused: "invest" };

  const months = parseMonths(q, ctx.today);
  const category = parseCategory(q, ctx.categories);
  const current = ctx.today.slice(0, 7);
  const month = months[0] ?? current;
  const has = (...words: string[]) => words.some((w) => q.includes(w));
  const call = (name: ToolName, args: ChatToolCall["args"]): QuestionPlan => ({ call: { name, args } });

  if (has("so sanh", " so voi ")) {
    const a = months[0] ?? current;
    const b = months[1] ?? shiftMonth(a, -1);
    return call("so_sanh_hai_thang", { danh_muc: category?.name ?? null, thang_a: a, thang_b: b });
  }
  if (has("ngan sach", "han muc", " vuot ")) return call("tinh_trang_ngan_sach", { thang: month });
  if (has("lon nhat", "dat nhat", "nhieu tien nhat", " top ") && has("khoan", "giao dich", " top ")) {
    const n = Number(q.match(/(\d+)\s*(?:khoan|giao dich)/)?.[1] ?? q.match(/ top (\d+)/)?.[1] ?? 5);
    return call("top_khoan_chi", { thang: month, so_luong: Math.min(Math.max(n, 1), 20) });
  }
  if (has("vao dau", "vao gi", "danh muc nao", "nhieu nhat")) return call("chi_theo_danh_muc", { thang: month });
  if (category && has("tieu", " chi ", "het", "bao nhieu", "tong", "nhan", "duoc")) {
    return call("tong_theo_danh_muc", { danh_muc: category.name, thang: month });
  }
  if (category && months.length) return call("tong_theo_danh_muc", { danh_muc: category.name, thang: month });
  if (has("thu", "tieu", " chi ", "tiet kiem", "con lai", " du ", "tong")) return call("tong_thu_chi_thang", { thang: month });
  // Không nhận ra ý định: lịch sự từ chối, gợi ý câu hỏi mẫu
  return { refused: "other" };
}

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Các tháng công cụ cần dữ liệu (để backend chỉ truy vấn đúng khoảng đó) */
export function monthsOfCall(call: ChatToolCall, today: string): string[] {
  const m = (v: unknown) => (typeof v === "string" && MONTH_RE.test(v) ? v : today.slice(0, 7));
  return call.name === "so_sanh_hai_thang" ? [m(call.args.thang_a), m(call.args.thang_b)] : [m(call.args.thang)];
}

function findCategory(name: unknown, categories: readonly Category[]): Category | null {
  if (typeof name !== "string" || !name.trim()) return null;
  const n = normalize(name.trim());
  return categories.find((c) => normalize(c.name) === n) ?? parseCategory(` ${n} `, categories);
}

/** Chạy công cụ: mọi con số tính từ `ctx` (dữ liệu thật), không phụ thuộc LLM */
export function runTool(call: ChatToolCall, ctx: EngineContext): EngineAnswer {
  const [month, monthB] = monthsOfCall(call, ctx.today);
  switch (call.name as ToolName) {
    case "tong_theo_danh_muc": {
      const category = findCategory(call.args.danh_muc, ctx.categories);
      return category ? tongTheoDanhMuc(ctx, category, month) : tongThuChiThang(ctx, month);
    }
    case "so_sanh_hai_thang":
      return soSanhHaiThang(ctx, month, monthB, findCategory(call.args.danh_muc, ctx.categories));
    case "tong_thu_chi_thang":
      return tongThuChiThang(ctx, month);
    case "chi_theo_danh_muc":
      return chiTheoDanhMuc(ctx, month);
    case "top_khoan_chi": {
      const n = Number(call.args.so_luong ?? 5);
      return topKhoanChi(ctx, month, Math.min(Math.max(Number.isFinite(n) ? Math.round(n) : 5, 1), 20));
    }
    case "tinh_trang_ngan_sach":
      return tinhTrangNganSach(ctx, month);
    default:
      return refuse("other");
  }
}

/** Mô tả công cụ cho LLM (function calling) — tên/tham số khớp runTool */
export const TOOL_DEFINITIONS: { name: ToolName; description: string; parameters: Record<string, unknown> }[] = [
  {
    name: "tong_theo_danh_muc",
    description: "Tổng tiền thu hoặc chi của MỘT danh mục trong một tháng",
    parameters: {
      type: "object",
      properties: {
        danh_muc: { type: "string", description: "Tên danh mục, đúng một tên trong danh sách được cung cấp" },
        thang: { type: "string", description: "Tháng dạng yyyy-MM" },
      },
      required: ["danh_muc", "thang"],
      additionalProperties: false,
    },
  },
  {
    name: "so_sanh_hai_thang",
    description:
      "So sánh tổng chi (hoặc một danh mục) giữa hai tháng. Giữ đúng thứ tự trong câu hỏi: " +
      "“So sánh tháng 9 với tháng 8” → thang_a = tháng 9, thang_b = tháng 8; " +
      "“Tháng này chi nhiều hơn tháng trước không?” → thang_a = tháng này, thang_b = tháng trước.",
    parameters: {
      type: "object",
      properties: {
        danh_muc: { type: ["string", "null"], description: "Tên danh mục, null = tổng chi" },
        thang_a: { type: "string", description: "Tháng được nhắc TRƯỚC trong câu hỏi, dạng yyyy-MM (tháng đem ra so)" },
        thang_b: { type: "string", description: "Tháng được nhắc SAU trong câu hỏi, dạng yyyy-MM (tháng làm mốc so sánh)" },
      },
      required: ["danh_muc", "thang_a", "thang_b"],
      additionalProperties: false,
    },
  },
  {
    name: "tong_thu_chi_thang",
    description: "Tổng thu, tổng chi và số dư còn lại của một tháng",
    parameters: {
      type: "object",
      properties: { thang: { type: "string", description: "Tháng dạng yyyy-MM" } },
      required: ["thang"],
      additionalProperties: false,
    },
  },
  {
    name: "chi_theo_danh_muc",
    description: "Danh mục chi nhiều nhất trong tháng (top 3 và tỉ lệ)",
    parameters: {
      type: "object",
      properties: { thang: { type: "string", description: "Tháng dạng yyyy-MM" } },
      required: ["thang"],
      additionalProperties: false,
    },
  },
  {
    name: "top_khoan_chi",
    description: "Các khoản chi lớn nhất trong tháng",
    parameters: {
      type: "object",
      properties: {
        thang: { type: "string", description: "Tháng dạng yyyy-MM" },
        so_luong: { type: "integer", description: "Số khoản, 1–20, mặc định 5" },
      },
      required: ["thang", "so_luong"],
      additionalProperties: false,
    },
  },
  {
    name: "tinh_trang_ngan_sach",
    description: "Tình trạng ngân sách tháng: danh mục vượt / sắp chạm hạn mức",
    parameters: {
      type: "object",
      properties: { thang: { type: "string", description: "Tháng dạng yyyy-MM" } },
      required: ["thang"],
      additionalProperties: false,
    },
  },
];

export function answerQuestion(question: string, ctx: EngineContext): EngineAnswer {
  const plan = planQuestion(question, ctx);
  return "refused" in plan ? refuse(plan.refused) : runTool(plan.call, ctx);
}
