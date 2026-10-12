/**
 * Kiểu dữ liệu theo mục 10 PRD (17 bảng PostgreSQL).
 * Tên trường dùng camelCase phía frontend; tầng services chịu trách nhiệm
 * ánh xạ từ snake_case của API khi có backend thật.
 *
 * Quy ước: ngày dạng ISO "yyyy-MM-dd", thời điểm dạng ISO 8601 đầy đủ,
 * số tiền là số nguyên đồng (VND), luôn dương — dấu do `type` quyết định.
 */

export type ID = string;
export type ISODate = string; // "2026-10-12"
export type ISODateTime = string; // "2026-10-12T08:30:00+07:00"

// ───────────── Tài khoản & dữ liệu tài chính ─────────────

export type UserRole = "user" | "admin";

export interface User {
  id: ID;
  email: string;
  fullName: string;
  currency: "VND";
  timezone: string; // "Asia/Ho_Chi_Minh"
  role: UserRole;
  isLocked: boolean;
  createdAt: ISODateTime;
}

export type WalletType = "cash" | "bank" | "ewallet";

export interface Wallet {
  id: ID;
  userId: ID;
  name: string;
  type: WalletType;
  balance: number;
}

export type TransactionType = "income" | "expense";

export interface Category {
  id: ID;
  /** null = danh mục mặc định của hệ thống */
  userId: ID | null;
  name: string;
  type: TransactionType;
  /** Tên icon Lucide, ví dụ "Utensils" */
  icon: string;
  color: string;
}

export type TransactionSource = "form" | "nlp" | "csv";
export type TransactionStatus = "confirmed" | "pending";

export interface Transaction {
  id: ID;
  userId: ID;
  walletId: ID;
  categoryId: ID;
  amount: number;
  type: TransactionType;
  date: ISODate;
  description: string;
  source: TransactionSource;
  /** 0–1, null khi nhập bằng form */
  aiConfidence: number | null;
  status: TransactionStatus;
}

export interface Budget {
  id: ID;
  userId: ID;
  categoryId: ID;
  /** "2026-10" */
  month: string;
  limitAmount: number;
}

export type RuleOrigin = "user" | "correction";

export interface ClassificationRule {
  id: ID;
  userId: ID;
  keyword: string;
  categoryId: ID;
  createdFrom: RuleOrigin;
}

// ───────────── AI ─────────────

export type ChatRole = "user" | "assistant" | "tool";

export interface ChatMessage {
  id: ID;
  userId: ID;
  role: ChatRole;
  content: string;
  toolCalls: unknown[] | null;
  createdAt: ISODateTime;
}

export type AiFeature = "extract" | "classify" | "chat" | "motivation";

export interface AiLog {
  id: ID;
  userId: ID;
  feature: AiFeature;
  tokens: number;
  latencyMs: number;
  success: boolean;
  createdAt: ISODateTime;
}

// ───────────── Gamification ─────────────

export type ActivityType =
  | "add_transaction"
  | "review_transaction"
  | "no_spend_day"
  | "login";

export interface ActivityLog {
  id: ID;
  userId: ID;
  date: ISODate;
  actionType: ActivityType;
}

export interface UserStreak {
  userId: ID;
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: ISODate | null;
  freezeCount: number;
}

export interface UserLevel {
  userId: ID;
  totalXp: number;
  level: number;
}

export type MissionPeriod = "daily" | "weekly";

export interface Mission {
  id: ID;
  code: string;
  title: string;
  period: MissionPeriod;
  target: number;
  xp: number;
}

export interface UserMission {
  userId: ID;
  missionId: ID;
  /** "2026-10-12" cho nhiệm vụ ngày, "2026-W42" cho nhiệm vụ tuần */
  periodKey: string;
  progress: number;
  completedAt: ISODateTime | null;
}

export interface Badge {
  id: ID;
  code: string;
  name: string;
  icon: string;
  condition: string;
}

export interface UserBadge {
  userId: ID;
  badgeId: ID;
  unlockedAt: ISODateTime;
}

export type MotivationContext =
  | "morning"
  | "after_transaction"
  | "streak_at_risk"
  | "streak_milestone"
  | "streak_lost"
  | "welcome_back"
  | "first_day"
  | "budget_good";

export interface MotivationMessage {
  id: ID;
  context: MotivationContext;
  /** Có thể chứa biến {name}, {streak}, {amount} */
  template: string;
  isActive: boolean;
}

export type NotificationType = "reminder" | "celebration" | "budget_alert";

export interface AppNotification {
  id: ID;
  userId: ID;
  type: NotificationType;
  content: string;
  isRead: boolean;
  createdAt: ISODateTime;
}

// ───────────── View models (do services tính, UI chỉ hiển thị) ─────────────

export interface MonthTotals {
  income: number;
  expense: number;
}

export interface DashboardSummary {
  /** "2026-10" */
  month: string;
  /** Tổng số dư mọi ví */
  balance: number;
  current: MonthTotals;
  /** Cùng kỳ tháng trước (ngày 1 → cùng ngày hôm nay) */
  previousSamePeriod: MonthTotals;
  budgetTotal: number;
  budgetSpent: number;
}

export interface MonthlyTrendPoint {
  month: string; // "2026-10"
  income: number;
  expense: number;
}

export interface CategorySlice {
  /** null cho nhóm "Khác" gộp */
  categoryId: ID | null;
  name: string;
  color: string;
  amount: number;
  /** 0–100 */
  percent: number;
}

export interface CategoryBreakdown {
  month: string;
  total: number;
  slices: CategorySlice[];
}

export interface TransactionView extends Transaction {
  category: Category;
  wallet: Wallet;
}

export interface BudgetProgress {
  budget: Budget;
  category: Category;
  spent: number;
  /** 0–∞, 1 = 100% */
  ratio: number;
}

export interface MissionProgress {
  mission: Mission;
  progress: number;
  completed: boolean;
}

export interface GamificationStatus {
  streak: UserStreak;
  /** Hôm nay đã có hành động hợp lệ cho chuỗi chưa */
  activeToday: boolean;
  level: number;
  levelTitle: string;
  /** XP đã có trong cấp hiện tại */
  xpInLevel: number;
  /** XP cần để lên cấp kế tiếp (100 × cấp kế tiếp) */
  xpForNextLevel: number;
}

export interface QuickEntryPreview {
  rawText: string;
  amount: number | null;
  type: TransactionType;
  date: ISODate;
  description: string;
  categoryId: ID | null;
  /** 0–1 */
  confidence: number;
  walletId: ID;
}

export interface QuickEntryResult {
  transaction: TransactionView;
  xpGained: number;
  streak: UserStreak;
  message: string;
}

export interface SearchResult {
  transactions: TransactionView[];
}
