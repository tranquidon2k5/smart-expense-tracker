/**
 * Giả lập trợ lý AI theo Luồng 3 PRD: "LLM" chỉ hiểu câu hỏi và chọn công cụ;
 * mọi con số do các hàm công cụ tính trực tiếp từ dữ liệu giao dịch (không bịa).
 * Hàm thuần — nhận dữ liệu qua tham số để test được và dễ thay bằng LLM thật.
 */
import type { Budget, Category, ChatToolCall, Transaction } from "@/types";
import { formatDate, formatMoney, formatMonthLong, formatPercent } from "@/lib/format";
import { normalize } from "@/lib/text";

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

const OUT_OF_SCOPE = [
  "dau tu", "co phieu", "chung khoan", "crypto", "bitcoin", "coin", "vay ", "khoan vay", "lai suat", "vang",
  "thoi tiet", "nau an", "cong thuc", "bong da", "bai hat", "dich ", "viet code", "lap trinh",
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

export function answerQuestion(question: string, ctx: EngineContext): EngineAnswer {
  const q = ` ${normalize(question).replace(/[?!.,;:"“”]/g, " ").replace(/\s+/g, " ").trim()} `;
  if (OUT_OF_SCOPE.some((w) => q.includes(w))) return refuse("invest");

  const months = parseMonths(q, ctx.today);
  const category = parseCategory(q, ctx.categories);
  const current = ctx.today.slice(0, 7);
  const month = months[0] ?? current;
  const has = (...words: string[]) => words.some((w) => q.includes(w));

  if (has("so sanh", " so voi ")) {
    const a = months[0] ?? current;
    const b = months[1] ?? shiftMonth(a, -1);
    return soSanhHaiThang(ctx, a, b, category);
  }
  if (has("ngan sach", "han muc", " vuot ")) return tinhTrangNganSach(ctx, month);
  if (has("lon nhat", "dat nhat", "nhieu tien nhat", " top ") && has("khoan", "giao dich", " top ")) {
    const n = Number(q.match(/(\d+)\s*(?:khoan|giao dich)/)?.[1] ?? 5);
    return topKhoanChi(ctx, month, Math.min(Math.max(n, 1), 20));
  }
  if (has("vao dau", "vao gi", "danh muc nao", "nhieu nhat")) return chiTheoDanhMuc(ctx, month);
  if (category && has("tieu", " chi ", "het", "bao nhieu", "tong", "nhan", "duoc")) return tongTheoDanhMuc(ctx, category, month);
  if (category && months.length) return tongTheoDanhMuc(ctx, category, month);
  if (has("thu", "tieu", " chi ", "tiet kiem", "con lai", " du ", "tong")) return tongThuChiThang(ctx, month);
  // Không nhận ra ý định: lịch sự từ chối, gợi ý câu hỏi mẫu
  return refuse("other");
}
