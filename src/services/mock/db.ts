/**
 * "Cơ sở dữ liệu" giả lập trong bộ nhớ — CHỈ được import từ src/services.
 * Persona: Lan, 25 tuổi, nhân viên văn phòng, lương 15 triệu (PRD §3.1).
 * Dữ liệu sinh tất định (seed cố định) để mỗi lần tải trang giống nhau.
 */
import type {
  Badge,
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
  // Hai giao dịch AI chưa chắc chắn → hàng chờ duyệt
  ["2026-10-11", "c-food", 120_000, "THANH TOAN QR 0912XXX", "w-momo", { source: "csv", aiConfidence: 0.62, status: "pending" }],
  ["2026-10-11", "c-other", 500_000, "CK NGUYEN VAN A chuyen tien", "w-vcb", { source: "csv", aiConfidence: 0.55, status: "pending" }],
];
for (const [date, cat, amount, desc, wallet, extra] of october) add(date, cat, amount, desc, wallet, extra);

export const transactions: Transaction[] = generated;

export const budgets: Budget[] = [
  { id: "b-food", userId: USER_ID, categoryId: "c-food", month: "2026-10", limitAmount: 3_000_000 },
  { id: "b-move", userId: USER_ID, categoryId: "c-move", month: "2026-10", limitAmount: 800_000 },
  { id: "b-shop", userId: USER_ID, categoryId: "c-shop", month: "2026-10", limitAmount: 1_100_000 },
  { id: "b-fun", userId: USER_ID, categoryId: "c-fun", month: "2026-10", limitAmount: 600_000 },
  { id: "b-bill", userId: USER_ID, categoryId: "c-bill", month: "2026-10", limitAmount: 5_500_000 },
];

// ───────────── Gamification ─────────────

export const streak: UserStreak = {
  userId: USER_ID,
  currentStreak: 12,
  longestStreak: 15,
  lastActiveDate: "2026-10-11",
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

export const missions: Mission[] = [
  { id: "m-d-3tx", code: "DAILY_3_TX", title: "Ghi ít nhất 3 giao dịch", period: "daily", target: 3, xp: 20 },
  { id: "m-d-chat", code: "DAILY_ASK_CHAT", title: "Hỏi trợ lý AI 1 câu", period: "daily", target: 1, xp: 20 },
  { id: "m-d-review", code: "DAILY_REVIEW_ALL", title: "Duyệt hết giao dịch chờ", period: "daily", target: 2, xp: 20 },
  { id: "m-w-5days", code: "WEEKLY_5_DAYS", title: "Ghi chép đủ 5/7 ngày", period: "weekly", target: 5, xp: 100 },
];

export const userMissions: UserMission[] = [
  { userId: USER_ID, missionId: "m-d-3tx", periodKey: MOCK_TODAY, progress: 0, completedAt: null },
  { userId: USER_ID, missionId: "m-d-chat", periodKey: MOCK_TODAY, progress: 1, completedAt: "2026-10-12T07:42:00+07:00" },
  { userId: USER_ID, missionId: "m-d-review", periodKey: MOCK_TODAY, progress: 0, completedAt: null },
  { userId: USER_ID, missionId: "m-w-5days", periodKey: "2026-W42", progress: 0, completedAt: null },
];

export const badges: Badge[] = [
  { id: "bd-first", code: "FIRST_STEP", name: "Bước đầu tiên", icon: "Footprints", condition: "Ghi giao dịch đầu tiên" },
  { id: "bd-fire7", code: "FIRE_7", name: "Lửa nhỏ", icon: "Flame", condition: "Chuỗi 7 ngày" },
  { id: "bd-fire30", code: "FIRE_30", name: "Lửa bền", icon: "Flame", condition: "Chuỗi 30 ngày" },
  { id: "bd-planner", code: "PLANNER", name: "Người lập kế hoạch", icon: "PiggyBank", condition: "Đặt ngân sách đủ 3 danh mục" },
];

export const userBadges: UserBadge[] = [
  { userId: USER_ID, badgeId: "bd-first", unlockedAt: "2026-04-28T21:20:00+07:00" },
  { userId: USER_ID, badgeId: "bd-fire7", unlockedAt: "2026-10-07T20:05:00+07:00" },
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
};
