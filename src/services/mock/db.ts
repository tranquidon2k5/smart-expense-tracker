/**
 * "Cơ sở dữ liệu" giả lập trong bộ nhớ — CHỈ được import từ src/services.
 * Persona: Lan, 25 tuổi, nhân viên văn phòng, lương 15 triệu (PRD §3.1).
 * Dữ liệu sinh tất định (seed cố định) để mỗi lần tải trang giống nhau.
 */
import type {
  ActivityLog,
  Badge,
  ClassificationRule,
  WalletTransfer,
  Budget,
  Category,
  Mission,
  MotivationMessage,
  Transaction,
  User,
  UserBadge,
  UserLevel,
  UserMission,
  UserStreak,
  Wallet,
} from "@/types";

/** Ngày "hôm nay" của bộ dữ liệu demo */
export const MOCK_TODAY = "2026-10-12";
export const USER_ID = "u-lan";

export const user: User = {
  id: USER_ID,
  email: "lan.nguyen@example.com",
  fullName: "Nguyễn Thị Lan",
  currency: "VND",
  timezone: "Asia/Ho_Chi_Minh",
  role: "user",
  isLocked: false,
  createdAt: "2026-04-28T21:14:00+07:00",
};

export const wallets: Wallet[] = [
  { id: "w-cash", userId: USER_ID, name: "Tiền mặt", type: "cash", balance: 1_250_000 },
  { id: "w-vcb", userId: USER_ID, name: "Vietcombank", type: "bank", balance: 18_640_000 },
  { id: "w-tcb", userId: USER_ID, name: "Techcombank", type: "bank", balance: 5_200_000 },
  { id: "w-momo", userId: USER_ID, name: "MoMo", type: "ewallet", balance: 845_000 },
];

// Màu danh mục cố định theo MASTER.md › Màu danh mục
export const categories: Category[] = [
  { id: "c-food", userId: null, name: "Ăn uống", type: "expense", icon: "Utensils", color: "#2563EB" },
  { id: "c-move", userId: null, name: "Di chuyển", type: "expense", icon: "Bike", color: "#7C3AED" },
  { id: "c-study", userId: null, name: "Học tập", type: "expense", icon: "GraduationCap", color: "#4D7C0F" },
  { id: "c-fun", userId: null, name: "Giải trí", type: "expense", icon: "Clapperboard", color: "#DB2777" },
  { id: "c-shop", userId: null, name: "Mua sắm", type: "expense", icon: "ShoppingBag", color: "#A16207" },
  { id: "c-bill", userId: null, name: "Hoá đơn", type: "expense", icon: "Zap", color: "#0E7490" },
  { id: "c-health", userId: null, name: "Sức khoẻ", type: "expense", icon: "HeartPulse", color: "#86198F" },
  { id: "c-other", userId: null, name: "Khác", type: "expense", icon: "Shapes", color: "#64748B" },
  { id: "c-salary", userId: null, name: "Lương", type: "income", icon: "Briefcase", color: "#15803D" },
  { id: "c-bonus", userId: null, name: "Thưởng", type: "income", icon: "Gift", color: "#15803D" },
  { id: "c-income-other", userId: null, name: "Thu khác", type: "income", icon: "Coins", color: "#15803D" },
  // Danh mục người dùng tự tạo (F03) — sửa/xoá được
  { id: "c-u-pet", userId: USER_ID, name: "Thú cưng", type: "expense", icon: "PawPrint", color: "#A16207" },
];

// ───────────── Sinh giao dịch tháng 5 → tháng 9 ─────────────

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20261012);
const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number, step = 1000) =>
  Math.round((min + rand() * (max - min)) / step) * step;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const daysIn = (y: number, m: number) => new Date(y, m, 0).getDate();

const MEALS = [
  ["Phở bò tái", 45_000, 60_000],
  ["Bún chả Hàng Mành", 40_000, 55_000],
  ["Cơm văn phòng", 35_000, 50_000],
  ["Bánh mì pate", 20_000, 30_000],
  ["Cơm tấm sườn bì", 40_000, 55_000],
  ["Bún bò Huế", 45_000, 60_000],
  ["Mì Quảng", 40_000, 50_000],
  ["Xôi gà", 25_000, 35_000],
] as const;
const DRINKS = [
  ["Cà phê sữa đá", 25_000, 35_000],
  ["Trà sữa Phúc Long", 45_000, 65_000],
  ["Highlands Coffee", 45_000, 65_000],
  ["Trà đá vỉa hè", 5_000, 10_000],
] as const;
const RIDES = [
  ["Grab đi làm", 32_000, 58_000],
  ["Grab về nhà", 35_000, 62_000],
  ["Đổ xăng", 70_000, 110_000],
  ["Be bike", 25_000, 45_000],
] as const;
const SHOPPING = [
  ["Shopee - áo sơ mi", 180_000, 320_000],
  ["Tiki - sách kỹ năng", 120_000, 220_000],
  ["Lazada - tai nghe", 350_000, 650_000],
  ["Uniqlo - quần kaki", 450_000, 690_000],
  ["Shopee - đồ gia dụng", 90_000, 250_000],
] as const;
const FUN = [
  ["Xem phim CGV", 110_000, 180_000],
  ["Karaoke với nhóm bạn", 150_000, 250_000],
  ["Steam - game", 120_000, 260_000],
  ["Vé ca nhạc", 350_000, 600_000],
] as const;

const generated: Transaction[] = [];
let seq = 0;

function add(
  date: string,
  categoryId: string,
  amount: number,
  description: string,
  walletId: string,
  extra: Partial<Transaction> = {},
) {
  const cat = categories.find((c) => c.id === categoryId)!;
  generated.push({
    id: `t-${String(++seq).padStart(4, "0")}`,
    userId: USER_ID,
    walletId,
    categoryId,
    amount,
    type: cat.type,
    date,
    description,
    source: "form",
    aiConfidence: null,
    status: "confirmed",
    ...extra,
  });
}

function nlp(confidence: number): Partial<Transaction> {
  return { source: "nlp", aiConfidence: confidence };
}

function pendingCsv(confidence: number): Partial<Transaction> {
  return { source: "csv", aiConfidence: confidence, status: "pending" };
}

for (const month of [5, 6, 7, 8, 9]) {
  const y = 2026;
  const prev = month - 1;
  add(iso(y, month, 1), "c-bill", 4_500_000, `Tiền nhà tháng ${month}`, "w-vcb");
  add(iso(y, month, 3), "c-health", 500_000, "Phí tập gym", "w-tcb");
  add(iso(y, month, 5), "c-bill", between(420_000, 680_000), `Tiền điện tháng ${prev}`, "w-vcb");
  add(iso(y, month, 5), "c-bill", 220_000, "Internet FPT", "w-vcb");
  add(iso(y, month, 7), "c-fun", 260_000, "Netflix Premium", "w-tcb");
  add(iso(y, month, 10), "c-salary", 15_000_000, `Lương tháng ${prev}`, "w-vcb");
  add(iso(y, month, 15), "c-study", 1_200_000, "Khoá IELTS online", "w-tcb");

  for (let d = 1; d <= daysIn(y, month); d++) {
    const date = iso(y, month, d);
    const weekday = new Date(y, month - 1, d).getDay();
    const isWeekend = weekday === 0 || weekday === 6;

    const meals = isWeekend ? 1 : 1 + Math.floor(rand() * 2);
    for (let i = 0; i < meals; i++) {
      const [name, min, max] = pick(MEALS);
      add(date, "c-food", between(min, max), name, rand() < 0.5 ? "w-cash" : "w-momo", rand() < 0.35 ? nlp(0.96) : {});
    }
    if (rand() < 0.65) {
      const [name, min, max] = pick(DRINKS);
      add(date, "c-food", between(min, max), name, "w-momo");
    }
    if (!isWeekend && rand() < 0.7) {
      const [name, min, max] = pick(RIDES);
      add(date, "c-move", between(min, max), name, "w-momo");
    }
    if (isWeekend && rand() < 0.35) {
      const [name, min, max] = pick(FUN);
      add(date, "c-fun", between(min, max), name, "w-tcb");
    }
    if (rand() < 0.1) {
      const [name, min, max] = pick(SHOPPING);
      add(date, "c-shop", between(min, max), name, "w-tcb");
    }
    if (rand() < 0.04) {
      add(date, "c-health", between(60_000, 180_000), "Pharmacity - thuốc cảm", "w-cash");
    }
    if (rand() < 0.03) {
      add(date, "c-other", pick([300_000, 500_000]), pick(["Mừng cưới bạn", "Quà sinh nhật đồng nghiệp"]), "w-cash");
    }
  }
}

// Một vài khoản thu không định kỳ
add("2026-06-21", "c-income-other", 350_000, "Bán đồ cũ trên Chợ Tốt", "w-momo");
add("2026-08-28", "c-bonus", 2_000_000, "Thưởng hoàn thành dự án", "w-vcb");
add("2026-09-02", "c-bonus", 1_000_000, "Thưởng lễ 2/9", "w-vcb");
add("2026-09-18", "c-income-other", 120_000, "Hoàn tiền Shopee", "w-momo");

// ───────────── Tháng 10 (đến 12/10): viết tay để kịch bản demo rõ ràng ─────────────
const october: [string, string, number, string, string, Partial<Transaction>?][] = [
  ["2026-10-01", "c-bill", 4_500_000, "Tiền nhà tháng 10", "w-vcb"],
  ["2026-10-01", "c-food", 52_000, "Bún chả Hàng Mành", "w-cash", nlp(0.97)],
  ["2026-10-01", "c-move", 46_000, "Grab đi làm", "w-momo"],
  ["2026-10-02", "c-food", 45_000, "Cơm văn phòng", "w-momo"],
  ["2026-10-02", "c-food", 55_000, "Trà sữa Phúc Long", "w-momo"],
  ["2026-10-03", "c-health", 500_000, "Phí tập gym", "w-tcb"],
  ["2026-10-03", "c-fun", 160_000, "Xem phim CGV", "w-tcb", nlp(0.94)],
  ["2026-10-04", "c-food", 320_000, "Lẩu nấm với nhóm bạn", "w-tcb"],
  ["2026-10-04", "c-shop", 289_000, "Shopee - áo sơ mi", "w-tcb"],
  ["2026-10-05", "c-bill", 586_000, "Tiền điện tháng 9", "w-vcb"],
  ["2026-10-05", "c-bill", 220_000, "Internet FPT", "w-vcb"],
  ["2026-10-05", "c-food", 30_000, "Cà phê sữa đá", "w-cash"],
  ["2026-10-06", "c-move", 85_000, "Đổ xăng", "w-cash"],
  ["2026-10-06", "c-food", 48_000, "Phở bò tái", "w-cash", nlp(0.98)],
  ["2026-10-07", "c-fun", 260_000, "Netflix Premium", "w-tcb"],
  ["2026-10-07", "c-food", 42_000, "Cơm tấm sườn bì", "w-momo"],
  ["2026-10-07", "c-move", 52_000, "Grab về nhà", "w-momo"],
  ["2026-10-08", "c-shop", 540_000, "Uniqlo - quần kaki", "w-tcb"],
  ["2026-10-08", "c-food", 25_000, "Bánh mì pate", "w-cash"],
  ["2026-10-09", "c-food", 58_000, "Highlands Coffee", "w-momo"],
  ["2026-10-09", "c-study", 189_000, "Tiki - sách IELTS Cambridge 19", "w-tcb", nlp(0.91)],
  ["2026-10-10", "c-salary", 15_000_000, "Lương tháng 9", "w-vcb"],
  ["2026-10-10", "c-food", 650_000, "Ăn tối mừng lương cùng gia đình", "w-vcb"],
  ["2026-10-10", "c-move", 39_000, "Be bike", "w-momo"],
  ["2026-10-11", "c-fun", 220_000, "Karaoke với nhóm bạn", "w-tcb"],
  ["2026-10-11", "c-shop", 129_000, "Shopee - đồ gia dụng", "w-tcb"],
  ["2026-10-11", "c-food", 45_000, "Bún bò Huế", "w-cash", nlp(0.96)],
  // Import sao kê CSV (Luồng 2): AI chưa chắc chắn (< 0,7) → hàng chờ duyệt.
  // categoryId ở đây là danh mục AI đoán.
  ["2026-10-07", "c-food", 52_000, "GRAB*RIDE 1203 HCM", "w-tcb", pendingCsv(0.51)],
  ["2026-10-08", "c-food", 64_000, "GRAB*RIDE 8812 HCM", "w-tcb", pendingCsv(0.52)],
  ["2026-10-09", "c-food", 41_000, "GRAB*FOOD 3021 HCM", "w-tcb", pendingCsv(0.48)],
  ["2026-10-09", "c-shop", 187_000, "VNPAY*BHX 0021 Q3", "w-vcb", pendingCsv(0.58)],
  ["2026-10-10", "c-bill", 100_000, "MOMO*NAP TIEN DT 0903", "w-momo", pendingCsv(0.66)],
  ["2026-10-10", "c-food", 75_000, "HIGHLANDS CF NGUYEN HUE", "w-tcb", pendingCsv(0.69)],
  ["2026-10-11", "c-food", 120_000, "THANH TOAN QR 0912XXX", "w-momo", pendingCsv(0.62)],
  ["2026-10-11", "c-other", 500_000, "CK NGUYEN VAN A chuyen tien", "w-vcb", pendingCsv(0.55)],
];
for (const [date, cat, amount, desc, wallet, extra] of october) add(date, cat, amount, desc, wallet, extra);

export const transactions: Transaction[] = generated;

// Chuyển tiền giữa ví (F02) — không phải thu/chi nên lưu riêng
export const transfers: WalletTransfer[] = [
  { id: "tf-1", userId: USER_ID, fromWalletId: "w-vcb", toWalletId: "w-momo", amount: 1_000_000, date: "2026-10-10", note: "Nạp MoMo sau khi nhận lương", createdAt: "2026-10-10T19:02:00+07:00" },
  { id: "tf-2", userId: USER_ID, fromWalletId: "w-vcb", toWalletId: "w-cash", amount: 1_500_000, date: "2026-10-02", note: "Rút tiền mặt ATM", createdAt: "2026-10-02T12:15:00+07:00" },
  { id: "tf-3", userId: USER_ID, fromWalletId: "w-vcb", toWalletId: "w-tcb", amount: 3_000_000, date: "2026-09-11", note: "Chuyển sang tài khoản chi tiêu", createdAt: "2026-09-11T08:40:00+07:00" },
];

// Luật từ khoá (F08): luật mặc định + luật người dùng tạo khi sửa phân loại
export const classificationRules: ClassificationRule[] = [
  { id: "r-1", userId: USER_ID, keyword: "SHOPEE", categoryId: "c-shop", createdFrom: "user" },
  { id: "r-2", userId: USER_ID, keyword: "NETFLIX", categoryId: "c-fun", createdFrom: "user" },
  { id: "r-3", userId: USER_ID, keyword: "PHUC LONG", categoryId: "c-food", createdFrom: "correction" },
];

export const budgets: Budget[] = [
  { id: "b-food", userId: USER_ID, categoryId: "c-food", month: "2026-10", limitAmount: 3_000_000 },
  { id: "b-move", userId: USER_ID, categoryId: "c-move", month: "2026-10", limitAmount: 800_000 },
  { id: "b-shop", userId: USER_ID, categoryId: "c-shop", month: "2026-10", limitAmount: 1_100_000 },
  { id: "b-fun", userId: USER_ID, categoryId: "c-fun", month: "2026-10", limitAmount: 600_000 },
  { id: "b-bill", userId: USER_ID, categoryId: "c-bill", month: "2026-10", limitAmount: 5_500_000 },
];

// ───────────── Gamification ─────────────

function addDaysIso(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** Ngày bắt đầu dùng app */
export const FIRST_DAY = "2026-04-28";

/**
 * Nhật ký hoạt động (activity_logs) — nguồn tính chuỗi ngày và lịch nhiệt.
 * Kịch bản demo (tất định):
 * - 03/08 → 17/08: chuỗi 15 ngày (kỷ lục)
 * - 28/09 → 11/10: chuỗi đang chạy 13 ngày, có 04/10 dùng thẻ đóng băng
 *   → hôm nay (12/10) ghi chép là chạm mốc 14 ngày
 * - Còn lại: khoảng 3/4 số ngày có ghi chép, không chuỗi nào dài quá 9 ngày
 */
function buildActivity() {
  const r = mulberry32(4242);
  const logs: ActivityLog[] = [];
  const frozen: string[] = ["2026-10-04"];
  const forcedOn = (d: string) => (d >= "2026-08-03" && d <= "2026-08-17") || (d >= "2026-09-28" && d <= "2026-10-11");
  const forcedOff = new Set(["2026-08-02", "2026-08-18", "2026-09-27"]);
  let run = 0;
  let seq = 0;
  for (let d = FIRST_DAY; d < MOCK_TODAY; d = addDaysIso(d, 1)) {
    let active: boolean;
    if (frozen.includes(d)) active = false;
    else if (forcedOn(d)) active = true;
    else if (forcedOff.has(d) || run >= 9) active = false;
    else active = d === FIRST_DAY || r() < 0.78;
    run = active || frozen.includes(d) ? run + (active ? 1 : 0) : 0;
    if (forcedOn(d) && !active) continue;
    if (!active) continue;
    const actions = 1 + Math.floor(r() * 6);
    for (let i = 0; i < actions; i++) {
      logs.push({
        id: `al-${++seq}`,
        userId: USER_ID,
        date: d,
        actionType: r() < 0.85 ? "add_transaction" : "review_transaction",
      });
    }
  }
  return { logs, frozen };
}

const activity = buildActivity();
export const activityLogs: ActivityLog[] = activity.logs;
/** Ngày đã dùng thẻ đóng băng (giữ chuỗi, không tính là ngày ghi chép) */
export const freezeDays: string[] = activity.frozen;

/**
 * Tính chuỗi hiện tại và kỷ lục từ nhật ký: ngày có hoạt động +1, ngày đóng băng giữ nguyên,
 * ngày trống làm chuỗi về 0. Chuỗi hiện tại tính đến `until` (hôm qua nếu hôm nay chưa ghi).
 */
export function computeStreaks(activeDates: Set<string>, frozenDates: Set<string>, from: string, until: string) {
  let current = 0;
  let longest = 0;
  for (let d = from; d <= until; d = addDaysIso(d, 1)) {
    if (activeDates.has(d)) current += 1;
    else if (!frozenDates.has(d)) current = 0;
    longest = Math.max(longest, current);
  }
  return { current, longest };
}

const initialStreaks = computeStreaks(
  new Set(activityLogs.map((l) => l.date)),
  new Set(freezeDays),
  FIRST_DAY,
  addDaysIso(MOCK_TODAY, -1),
);

export const streak: UserStreak = {
  userId: USER_ID,
  currentStreak: initialStreaks.current,
  longestStreak: initialStreaks.longest,
  lastActiveDate: addDaysIso(MOCK_TODAY, -1),
  freezeCount: 1,
};

/** Cấp 5 = 1.400 XP tích luỹ; +120 XP trong cấp hiện tại */
export const level: UserLevel = { userId: USER_ID, totalXp: 1_520, level: 5 };

export const LEVEL_TITLES: Record<number, string> = {
  1: "Người mới ghi sổ",
  2: "Người ghi chép",
  3: "Người tập tiết kiệm",
  4: "Người giữ nhịp",
  5: "Thủ quỹ chăm chỉ",
  6: "Thủ quỹ đáng tin",
  7: "Người lập kế hoạch",
  8: "Chuyên gia ngân sách",
  9: "Nhà quản lý tài chính",
  10: "Bậc thầy chi tiêu",
};

/** Mốc chuỗi → XP thưởng (PRD §6.2, §6.4) */
export const STREAK_MILESTONES: Record<number, number> = { 3: 50, 7: 100, 14: 150, 30: 300, 60: 400, 100: 500 };

export const missions: Mission[] = [
  { id: "m-d-3tx", code: "DAILY_3_TX", title: "Ghi ít nhất 3 giao dịch", period: "daily", target: 3, xp: 20 },
  { id: "m-d-chat", code: "DAILY_ASK_CHAT", title: "Hỏi trợ lý AI 1 câu", period: "daily", target: 1, xp: 20 },
  { id: "m-d-review", code: "DAILY_REVIEW_ALL", title: "Duyệt hết giao dịch chờ", period: "daily", target: 8, xp: 20 },
  { id: "m-w-5days", code: "WEEKLY_5_DAYS", title: "Ghi chép đủ 5/7 ngày", period: "weekly", target: 5, xp: 100 },
  { id: "m-w-review10", code: "WEEKLY_REVIEW_10", title: "Duyệt 10 giao dịch AI chờ xác nhận", period: "weekly", target: 10, xp: 100 },
];

/** Tuần ISO chứa ngày demo (12/10/2026 là thứ Hai → tuần mới bắt đầu hôm nay) */
export const CURRENT_WEEK = "2026-W42";

export const userMissions: UserMission[] = [
  { userId: USER_ID, missionId: "m-d-3tx", periodKey: MOCK_TODAY, progress: 0, completedAt: null },
  { userId: USER_ID, missionId: "m-d-chat", periodKey: MOCK_TODAY, progress: 0, completedAt: null },
  { userId: USER_ID, missionId: "m-d-review", periodKey: MOCK_TODAY, progress: 0, completedAt: null },
  { userId: USER_ID, missionId: "m-w-5days", periodKey: CURRENT_WEEK, progress: 0, completedAt: null },
  { userId: USER_ID, missionId: "m-w-review10", periodKey: CURRENT_WEEK, progress: 0, completedAt: null },
];

// Huy hiệu (PRD §6.5)
export const badges: Badge[] = [
  { id: "bd-first", code: "FIRST_STEP", name: "Bước đầu tiên", icon: "Footprints", condition: "Ghi giao dịch đầu tiên" },
  { id: "bd-fire7", code: "FIRE_7", name: "Lửa nhỏ", icon: "Flame", condition: "Giữ chuỗi 7 ngày liên tiếp" },
  { id: "bd-fire30", code: "FIRE_30", name: "Lửa bền", icon: "Flame", condition: "Giữ chuỗi 30 ngày liên tiếp" },
  { id: "bd-fire100", code: "FIRE_100", name: "Lửa bất diệt", icon: "Flame", condition: "Giữ chuỗi 100 ngày liên tiếp" },
  { id: "bd-chat10", code: "CHAT_10", name: "Trò chuyện cùng AI", icon: "MessageCircle", condition: "Hỏi trợ lý AI 10 câu" },
  { id: "bd-planner", code: "PLANNER", name: "Người lập kế hoạch", icon: "PiggyBank", condition: "Đặt ngân sách đủ 3 danh mục" },
  { id: "bd-promise", code: "KEEP_PROMISE", name: "Giữ đúng lời hứa", icon: "ShieldCheck", condition: "Cả tháng không danh mục nào vượt ngân sách" },
  { id: "bd-collector", code: "COLLECTOR", name: "Nhà sưu tầm", icon: "Archive", condition: "Ghi đủ 100 giao dịch" },
  { id: "bd-teacher", code: "AI_TEACHER", name: "Thầy giáo của AI", icon: "GraduationCap", condition: "Sửa phân loại của AI 20 lần" },
];

export const userBadges: UserBadge[] = [
  { userId: USER_ID, badgeId: "bd-first", unlockedAt: "2026-04-28T21:20:00+07:00" },
  { userId: USER_ID, badgeId: "bd-fire7", unlockedAt: "2026-05-06T21:05:00+07:00" },
  { userId: USER_ID, badgeId: "bd-collector", unlockedAt: "2026-05-24T22:10:00+07:00" },
  { userId: USER_ID, badgeId: "bd-planner", unlockedAt: "2026-10-01T09:12:00+07:00" },
];

// Ngân hàng câu khích lệ (PRD §6.3)
export const motivationMessages: MotivationMessage[] = [
  { id: "mm-1", context: "morning", template: "Chào {name}! Chuỗi của bạn đang là {streak} ngày, giữ lửa thêm hôm nay nhé.", isActive: true },
  { id: "mm-2", context: "after_transaction", template: "Ghi xong rồi! Bạn đang hiểu túi tiền của mình hơn mỗi ngày.", isActive: true },
  { id: "mm-3", context: "streak_at_risk", template: "Còn vài tiếng nữa là hết ngày. Ghi 1 khoản chi để giữ chuỗi {streak} ngày nhé!", isActive: true },
  { id: "mm-4", context: "streak_milestone", template: "Tuyệt vời! {streak} ngày liên tiếp, bạn đã có thói quen thật sự rồi.", isActive: true },
  { id: "mm-5", context: "streak_lost", template: "Không sao cả, ai cũng có ngày bận. Kỷ lục {longest} ngày vẫn ở đây, bắt đầu lại thôi!", isActive: true },
  { id: "mm-6", context: "welcome_back", template: "Mừng bạn trở lại! Dán sao kê hoặc gõ nhanh vài khoản để cập nhật nhé.", isActive: true },
  { id: "mm-8", context: "first_day", template: "Chào mừng bạn đến với Sổ Tiền! Gõ thử một câu như “ăn phở 45k” vào ô Ghi nhanh để bắt đầu nhé.", isActive: true },
  { id: "mm-7", context: "budget_good", template: "Tuần này bạn chi đúng kế hoạch, giỏi lắm!", isActive: true },
];

/** Trạng thái phiên demo — thay đổi khi người dùng ghi giao dịch */
export const session = {
  activeToday: false,
  /** Tổng số câu đã hỏi trợ lý AI (huy hiệu "Trò chuyện cùng AI") */
  chatQuestions: 9,
  /** Số lần người dùng sửa danh mục AI đoán (huy hiệu "Thầy giáo của AI") */
  corrections: 14,
  /**
   * XP đã cộng cho từng giao dịch ghi mới, kèm ngày cộng — để xoá trong ngày thì
   * trừ lại đúng số đó (PRD §13.1).
   */
  xpAwards: {} as Record<string, { xp: number; date: string }>,
  /** Số lần đã nhận XP trong ngày theo từng loại hành động (giới hạn PRD §6.4) */
  xpCounts: { date: MOCK_TODAY, add_transaction: 0, review: 0 } as {
    date: string;
    add_transaction: number;
    review: number;
  },
};
