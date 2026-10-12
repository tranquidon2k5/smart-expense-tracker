import type {
  Category,
  QuickEntryPreview,
  QuickEntryResult,
  Transaction,
  TransactionType,
  TransactionView,
  Wallet,
} from "@/types";
import * as db from "./mock/db";
import { simulateLatency } from "./mock/scenario";
import { normalize, scopedTransactions, scopedWallets, toView } from "./mock/queries";
import { emitDataChanged } from "./events";

function byNewest(a: Transaction, b: Transaction) {
  return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
}

// ───────────── API công khai ─────────────

/** Ngày "hôm nay" theo múi giờ người dùng (bản demo cố định 12/10/2026) */
export function getToday(): string {
  return db.MOCK_TODAY;
}

export async function listCategories(type?: TransactionType): Promise<Category[]> {
  await simulateLatency(150);
  return db.categories.filter((c) => !type || c.type === type);
}

export async function listWallets(): Promise<Wallet[]> {
  await simulateLatency(150);
  return scopedWallets();
}

export async function getRecentTransactions(limit = 8): Promise<TransactionView[]> {
  await simulateLatency();
  return [...scopedTransactions()].sort(byNewest).slice(0, limit).map(toView);
}

export async function searchTransactions(query: string, limit = 8): Promise<TransactionView[]> {
  await simulateLatency(200);
  const q = normalize(query.trim());
  if (!q) return [];
  return [...scopedTransactions()]
    .sort(byNewest)
    .map(toView)
    .filter((t) => normalize(`${t.description} ${t.category.name} ${t.wallet.name}`).includes(q))
    .slice(0, limit);
}

// ───────────── Ghi nhanh bằng câu tự nhiên (giả lập F07 + F08) ─────────────

const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
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

const INCOME_HINTS = ["luong", "thuong", "nhan ", "duoc cho", "hoan tien", "ban do", "thu "];

function addDays(isoDate: string, delta: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return dt.toISOString().slice(0, 10);
}

function parseAmount(text: string): { amount: number | null; match: string | null } {
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

function parseDate(text: string): { date: string; match: string | null } {
  const lower = text.toLowerCase();
  const relative: [string, number][] = [
    ["hôm kia", -2],
    ["hôm qua", -1],
    ["hôm nay", 0],
  ];
  for (const [phrase, delta] of relative) {
    if (lower.includes(phrase)) return { date: addDays(db.MOCK_TODAY, delta), match: phrase };
  }
  const m = text.match(/(?:ngày\s*)?(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (m) {
    const year = m[3] ?? db.MOCK_TODAY.slice(0, 4);
    return { date: `${year}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`, match: m[0] };
  }
  return { date: db.MOCK_TODAY, match: null };
}

function cleanDescription(text: string, remove: (string | null)[]): string {
  let out = text;
  for (const r of remove) if (r) out = out.replace(new RegExp(r.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"), "i"), " ");
  out = out.replace(/\s+/g, " ").trim();
  return out ? out.charAt(0).toUpperCase() + out.slice(1) : "";
}

export async function parseQuickEntry(text: string): Promise<QuickEntryPreview> {
  await simulateLatency(700);
  const { amount, match: amountMatch } = parseAmount(text);
  const { date, match: dateMatch } = parseDate(text);
  const norm = ` ${normalize(text).replace(/[^a-z0-9]+/g, " ")} `;

  const rule = KEYWORD_RULES.find((r) => r.keywords.some((k) => norm.includes(k)));
  const inferredIncome = INCOME_HINTS.some((k) => norm.includes(k));
  const category = rule ? db.categories.find((c) => c.id === rule.categoryId)! : null;
  const type: TransactionType = category?.type ?? (inferredIncome ? "income" : "expense");

  const walletId = norm.includes("momo")
    ? "w-momo"
    : norm.includes("vietcombank") || norm.includes("vcb")
      ? "w-vcb"
      : norm.includes("techcombank") || norm.includes("tcb")
        ? "w-tcb"
        : type === "income"
          ? "w-vcb"
          : "w-cash";

  return {
    rawText: text,
    amount,
    type,
    date,
    description: cleanDescription(text, [amountMatch, dateMatch]) || text,
    categoryId: category?.id ?? (type === "income" ? "c-income-other" : "c-other"),
    // Khớp luật từ khoá → tin cậy cao; không khớp → "LLM" đoán với độ tin cậy thấp
    confidence: rule ? 0.95 : 0.55,
    walletId,
  };
}

export async function createFromQuickEntry(preview: QuickEntryPreview): Promise<QuickEntryResult> {
  await simulateLatency(400);
  if (!preview.amount || preview.amount <= 0) throw new Error("Số tiền chưa hợp lệ");
  const category = db.categories.find((c) => c.id === preview.categoryId)!;

  const transaction: Transaction = {
    id: `t-new-${Date.now()}`,
    userId: db.USER_ID,
    walletId: preview.walletId,
    categoryId: category.id,
    amount: preview.amount,
    type: category.type,
    date: preview.date,
    description: preview.description,
    source: "nlp",
    aiConfidence: preview.confidence,
    status: preview.confidence >= 0.7 ? "confirmed" : "pending",
  };
  db.transactions.push(transaction);

  const wallet = db.wallets.find((w) => w.id === transaction.walletId)!;
  wallet.balance += transaction.type === "income" ? transaction.amount : -transaction.amount;

  // Gamification: +10 XP, cập nhật chuỗi ngày và nhiệm vụ "Ghi 3 giao dịch"
  const xpGained = 10;
  db.level.totalXp += xpGained;
  let message = db.motivationMessages.find((m) => m.context === "after_transaction")!.template;
  if (!db.session.activeToday) {
    db.session.activeToday = true;
    db.streak.currentStreak += 1;
    db.streak.lastActiveDate = db.MOCK_TODAY;
    db.streak.longestStreak = Math.max(db.streak.longestStreak, db.streak.currentStreak);
    message = `Chuỗi ${db.streak.currentStreak} ngày rồi! ${message}`;
  }
  const daily = db.userMissions.find((m) => m.missionId === "m-d-3tx")!;
  if (daily.progress < 3) {
    daily.progress += 1;
    if (daily.progress === 3) daily.completedAt = new Date().toISOString();
  }

  emitDataChanged();
  return { transaction: toView(transaction), xpGained, streak: { ...db.streak }, message };
}
