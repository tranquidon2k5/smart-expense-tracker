/**
 * Ghi nhanh bằng câu tự nhiên (F07) + phân loại bằng luật (F08) — logic thuần, dùng chung
 * cho bản mock ở frontend và bộ tiền xử lý / dự phòng của backend (khi LLM lỗi hoặc quá giờ).
 */
import type { TransactionType } from "./types";
import { addDays } from "./dates";
import { matchesKeyword } from "./rules";
import { normalize } from "./text";

/** Ngưỡng độ tin cậy: thấp hơn → hàng chờ duyệt (PRD §9.1) */
export const CONFIDENCE_THRESHOLD = 0.7;

/** Luật từ khoá mặc định của hệ thống (id danh mục mặc định) */
export const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  { keywords: ["luong"], categoryId: "c-salary" },
  { keywords: ["thuong"], categoryId: "c-bonus" },
  { keywords: ["hoan tien", "ban do", "duoc cho", "me cho", "bo cho"], categoryId: "c-income-other" },
  // Từ khoá ngắn có khoảng trắng hai bên để không khớp nhầm ("pho" ≠ "phong", "an" ≠ "Lan")
  { keywords: [" pho ", " bun ", " com ", " an ", " banh mi", "ca phe", "cafe", " cf ", "tra sua", " lau ", " nuong", " xoi ", "highlands", "tra da"], categoryId: "c-food" },
  { keywords: ["grab", "be bike", " xang", "taxi", "xe buyt", "gui xe", "ve tau", "xanh sm"], categoryId: "c-move" },
  { keywords: [" sach", " hoc ", "khoa hoc", "ielts", "toeic", "giao trinh"], categoryId: "c-study" },
  { keywords: [" phim", "cgv", "karaoke", " game", "netflix", "spotify", "ca nhac", "du lich"], categoryId: "c-fun" },
  { keywords: ["shopee", "tiki", "lazada", " ao ", " quan ", " giay", "my pham", "uniqlo"], categoryId: "c-shop" },
  { keywords: ["tien dien", "tien nuoc", "internet", "wifi", "tien nha", "tien phong", "cuoc dien thoai", " 4g"], categoryId: "c-bill" },
  { keywords: ["thuoc", "kham", "gym", "nha khoa", "bao hiem", "pharmacity"], categoryId: "c-health" },
];

/** Gợi ý của "LLM" giả lập (chỉ dùng ở chế độ mock / khi không có LLM): đoán được nhưng chưa chắc */
export const LLM_GUESSES: { keywords: string[]; categoryId: string; confidence: number }[] = [
  { keywords: ["winmart", "bach hoa", "bhx", "coopmart", "co op", "circle k", "familymart", "gs25"], categoryId: "c-food", confidence: 0.62 },
  { keywords: ["guardian", "long chau", "an khang", "benh vien"], categoryId: "c-health", confidence: 0.64 },
  { keywords: ["vexere", "vietjet", "vietnam airlines", "agoda", "traveloka", "booking"], categoryId: "c-fun", confidence: 0.58 },
  { keywords: ["dien may", "the gioi di dong", "fpt shop", "cellphones"], categoryId: "c-shop", confidence: 0.6 },
];

export const INCOME_HINTS = ["luong", "thuong", "nhan ", "duoc cho", "hoan tien", "ban do", "thu "];

/** Văn bản chuẩn hoá có khoảng trắng hai đầu để khớp từ khoá theo từ */
export function paddedNormalize(text: string): string {
  return ` ${normalize(text).replace(/[^a-z0-9]+/g, " ")} `;
}

export interface ClassifierCategory {
  id: string;
  type: TransactionType;
}

export interface ClassifierRule {
  keyword: string;
  categoryId: string;
}

export interface RuleClassification<C extends ClassifierCategory> {
  category: C | null;
  confidence: number;
  /** rule: luật người dùng/mặc định khớp; llm: đoán theo từ khoá gợi ý; none: không đoán được */
  source: "rule" | "llm" | "none";
}

/**
 * Phân loại bằng luật: luật người dùng → luật mặc định → (tuỳ chọn) gợi ý từ khoá kiểu LLM.
 * `type` (nếu biết, vd. từ dấu số tiền trong sao kê) loại bỏ danh mục khác loại thu/chi.
 */
export function classifyByRules<C extends ClassifierCategory>(
  text: string,
  ctx: { categories: readonly C[]; userRules: readonly ClassifierRule[] },
  options: { type?: TransactionType; includeGuesses?: boolean } = {},
): RuleClassification<C> {
  const norm = paddedNormalize(text);
  const fits = (categoryId: string) => {
    const c = ctx.categories.find((x) => x.id === categoryId);
    return c && (!options.type || c.type === options.type) ? c : null;
  };
  const userRule = ctx.userRules.find((r) => matchesKeyword(text, r.keyword) && fits(r.categoryId));
  if (userRule) return { category: fits(userRule.categoryId), confidence: 0.97, source: "rule" };
  for (const r of KEYWORD_RULES) {
    const c = fits(r.categoryId);
    if (c && r.keywords.some((k) => norm.includes(k))) return { category: c, confidence: 0.95, source: "rule" };
  }
  if (options.includeGuesses) {
    for (const g of LLM_GUESSES) {
      const c = fits(g.categoryId);
      if (c && g.keywords.some((k) => norm.includes(k))) return { category: c, confidence: g.confidence, source: "llm" };
    }
  }
  return { category: null, confidence: 0.45, source: "none" };
}

export function parseAmount(text: string): { amount: number | null; match: string | null } {
  // "1tr2", "1,5tr", "45k", "45 nghìn", "200.000đ", "300000"
  const patterns: [RegExp, (m: RegExpMatchArray) => number][] = [
    [/(\d+)\s*(?:tr|triệu|củ)\s*(\d)(?!\d)/i, (m) => Number(m[1]) * 1e6 + Number(m[2]) * 1e5],
    [/(\d+(?:[.,]\d+)?)\s*(?:tr|triệu|củ)\b/i, (m) => Number(m[1].replace(",", ".")) * 1e6],
    [/(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|ngàn|ng)\b/i, (m) => Number(m[1].replace(",", ".")) * 1e3],
    [/(\d{1,3}(?:\.\d{3})+)\s*(?:đ|d|vnd)?/i, (m) => Number(m[1].replace(/\./g, ""))],
    [/(\d{4,})\s*(?:đ|d|vnd)?/i, (m) => Number(m[1])],
  ];
  for (const [re, toNumber] of patterns) {
    const m = text.match(re);
    if (m) return { amount: Math.round(toNumber(m)), match: m[0] };
  }
  return { amount: null, match: null };
}

export function parseDate(text: string, today: string): { date: string; match: string | null } {
  const lower = text.toLowerCase();
  const relative: [string, number][] = [
    ["hôm kia", -2],
    ["hôm qua", -1],
    ["hôm nay", 0],
  ];
  for (const [phrase, delta] of relative) {
    if (lower.includes(phrase)) return { date: addDays(today, delta), match: phrase };
  }
  const m = text.match(/(?:ngày\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) {
    const year = m[3] ?? today.slice(0, 4);
    return { date: `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, match: m[0] };
  }
  return { date: today, match: null };
}

export function cleanDescription(text: string, remove: (string | null)[]): string {
  let out = text;
  for (const r of remove) if (r) out = out.replace(new RegExp(r.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "i"), " ");
  out = out.replace(/\s+/g, " ").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}

export function inferIncome(text: string): boolean {
  const norm = paddedNormalize(text);
  return INCOME_HINTS.some((k) => norm.includes(k));
}

interface WalletLike {
  id: string;
  name: string;
  type: "cash" | "bank" | "ewallet";
}

const WALLET_ALIASES: Record<string, string[]> = {
  vietcombank: ["vcb"],
  techcombank: ["tcb"],
  momo: ["vi momo"],
};

/** Đoán ví từ câu: tên ví (hoặc viết tắt) có trong câu; không có thì thu → ngân hàng, chi → tiền mặt */
export function guessWallet<W extends WalletLike>(text: string, wallets: readonly W[], type: TransactionType): W | null {
  const norm = paddedNormalize(text);
  for (const w of wallets) {
    const name = normalize(w.name).replace(/[^a-z0-9]+/g, " ").trim();
    const names = [name, ...(WALLET_ALIASES[name.replace(/\s+/g, "")] ?? [])];
    if (names.some((n) => n && norm.includes(` ${n} `))) return w;
  }
  const preferred = type === "income" ? "bank" : "cash";
  return wallets.find((w) => w.type === preferred) ?? wallets[0] ?? null;
}

export interface RuleQuickEntry {
  amount: number | null;
  type: TransactionType;
  date: string;
  description: string;
  amountMatch: string | null;
  dateMatch: string | null;
}

/** Bộ parser luật: số tiền, ngày, mô tả, loại thu/chi (chưa phân loại danh mục) */
export function parseQuickEntryText(text: string, today: string): RuleQuickEntry {
  const { amount, match: amountMatch } = parseAmount(text);
  const { date, match: dateMatch } = parseDate(text, today);
  return {
    amount,
    type: inferIncome(text) ? "income" : "expense",
    date,
    description: cleanDescription(text, [amountMatch, dateMatch]) || text,
    amountMatch,
    dateMatch,
  };
}
