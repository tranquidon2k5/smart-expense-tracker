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
  /** Admin tắt thì nhiệm vụ không giao cho người dùng nữa */
  isActive?: boolean;
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
  /** Dòng tiêu đề ngắn (giao diện); bảng notifications chỉ bắt buộc `content` */
  title?: string;
  content: string;
  /** Trang mở ra khi bấm thông báo */
  link?: string;
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
  /** Đã đủ 10 lần nhận XP ghi giao dịch hôm nay → lần này không cộng XP */
  xpLimitReached: boolean;
  streak: UserStreak;
  message: string;
}

export interface SearchResult {
  transactions: TransactionView[];
}

// ───────────── Trang Giao dịch (F04, F08, Luồng 2) ─────────────

export interface TransactionFilter {
  /** ISO date, bao gồm cả hai đầu; undefined = không giới hạn */
  from?: ISODate;
  to?: ISODate;
  walletIds?: ID[];
  categoryIds?: ID[];
  minAmount?: number;
  maxAmount?: number;
  type?: TransactionType;
  status?: TransactionStatus;
  /** Tìm theo mô tả, danh mục, ví (không phân biệt dấu) */
  query?: string;
}

export interface TransactionPatch {
  amount?: number;
  type?: TransactionType;
  categoryId?: ID;
  walletId?: ID;
  date?: ISODate;
  description?: string;
}

/** Gợi ý tạo luật từ khoá khi người dùng sửa danh mục AI đoán (F08) */
export interface RuleSuggestion {
  transactionId: ID;
  keyword: string;
  categoryId: ID;
  /** Số giao dịch chờ duyệt khác cũng chứa từ khoá này */
  matchingPendingCount: number;
}

export interface DeleteResult {
  removed: number;
  /** XP đã trừ lại vì giao dịch được ghi trong hôm nay (PRD §13.1) */
  xpRemoved: number;
}

export interface UpdateResult {
  transaction: TransactionView;
  ruleSuggestion: RuleSuggestion | null;
}

export interface ReviewResult {
  transaction: TransactionView;
  xpGained: number;
  /** Đã đủ 10 lần nhận XP duyệt giao dịch hôm nay → lần này không cộng XP */
  xpLimitReached: boolean;
  ruleSuggestion: RuleSuggestion | null;
  remainingPending: number;
}

export interface RulePreviewItem {
  transaction: TransactionView;
  /** Đang ở danh mục khác danh mục của luật → sẽ bị đổi danh mục */
  conflict: boolean;
  /** Khác loại thu/chi → luật bỏ qua giao dịch này */
  typeMismatch: boolean;
}

/** Xem trước tác động của luật lên các giao dịch chờ duyệt khác */
export interface RulePreview {
  keyword: string;
  categoryId: ID;
  items: RulePreviewItem[];
  /** Số giao dịch sẽ thực sự được áp dụng (không tính khác loại) */
  applicableCount: number;
  /** Số giao dịch sẽ bị đổi từ danh mục khác sang danh mục của luật */
  conflictCount: number;
}

// ───────────── Ngân sách (F05) ─────────────

export interface BudgetRow extends BudgetProgress {
  /** Chi trung bình 3 tháng trước của danh mục — gợi ý khi đặt hạn mức */
  avgSpendLast3Months: number;
}

export interface BudgetOverview {
  month: string;
  rows: BudgetRow[];
  /** Danh mục chi chưa có hạn mức tháng này, kèm chi trung bình để gợi ý */
  unbudgeted: { category: Category; spent: number; avgSpendLast3Months: number }[];
  totalLimit: number;
  totalSpent: number;
}

// ───────────── Ví (F02) ─────────────

/** Chuyển tiền giữa hai ví — không tính là thu hay chi */
export interface WalletTransfer {
  id: ID;
  userId: ID;
  fromWalletId: ID;
  toWalletId: ID;
  amount: number;
  date: ISODate;
  note: string;
  createdAt: ISODateTime;
}

export interface WalletSummary extends Wallet {
  monthIncome: number;
  monthExpense: number;
  transactionCount: number;
}

export interface TransferInput {
  fromWalletId: ID;
  toWalletId: ID;
  amount: number;
  date: ISODate;
  note: string;
}

export interface TransferView extends WalletTransfer {
  fromWallet: Wallet;
  toWallet: Wallet;
}

// ───────────── Danh mục (F03) ─────────────

export interface CategoryUsage {
  category: Category;
  /** Danh mục mặc định của hệ thống — không sửa/xoá được */
  isDefault: boolean;
  transactionCount: number;
  monthAmount: number;
  hasBudget: boolean;
}

export interface CategoryInput {
  name: string;
  type: TransactionType;
  icon: string;
  color: string;
}

// ───────────── Trợ lý AI (F10, Luồng 3) ─────────────

/** Một lần "LLM" gọi công cụ truy vấn dữ liệu (function calling) */
export interface ChatToolCall {
  name: string;
  args: Record<string, string | number | null>;
}

export interface ChatMessageView {
  id: ID;
  role: "user" | "assistant";
  content: string;
  /** Công cụ đã gọi để lấy số liệu — rỗng với câu hỏi người dùng / câu từ chối */
  toolCalls: ChatToolCall[];
  /** Giao dịch nguồn làm căn cứ cho câu trả lời */
  sourceIds: ID[];
  /** Câu hỏi ngoài phạm vi → trợ lý từ chối nhẹ nhàng */
  refused: boolean;
  createdAt: ISODateTime;
}

export interface Conversation {
  id: ID;
  title: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  messages: ChatMessageView[];
}

export interface ConversationSummary {
  id: ID;
  title: string;
  updatedAt: ISODateTime;
  questionCount: number;
}

export interface AskResult {
  conversation: Conversation;
  userMessage: ChatMessageView;
  assistantMessage: ChatMessageView;
}

// ───────────── Thành tích (F11–F14) ─────────────

export interface ActivityDay {
  date: ISODate;
  /** Số lần ghi chép / duyệt trong ngày */
  count: number;
  /** Ngày dùng thẻ đóng băng */
  frozen: boolean;
}

export interface BadgeView {
  badge: Badge;
  unlockedAt: ISODateTime | null;
  /** null khi huy hiệu không đo được tiến độ giữa chừng */
  progress: { current: number; target: number } | null;
}

export interface AchievementsOverview {
  status: GamificationStatus;
  /** Mốc chuỗi kế tiếp và số ngày còn thiếu */
  nextMilestone: { days: number; xp: number; remaining: number } | null;
  /** Danh hiệu ở cấp kế tiếp */
  nextLevelTitle: string;
  totalXp: number;
  days: ActivityDay[];
  dailyMissions: MissionProgress[];
  weeklyMissions: MissionProgress[];
  badges: BadgeView[];
}

export interface CreateRuleResult {
  rule: ClassificationRule;
  /** Số giao dịch chờ duyệt đã được phân loại lại theo luật mới */
  appliedCount: number;
}

// ───────────── Nhập sao kê CSV (F09) ─────────────

export type ImportField = "date" | "amount" | "description";

/** Cách hiểu dấu của cột số tiền */
export type AmountMode =
  /** Số âm là chi, số dương là thu (sao kê ngân hàng thường gặp) */
  | "signed"
  /** Mọi dòng đều là khoản chi (sao kê thẻ tín dụng, ví chỉ ghi số dương) */
  | "all_expense";

/** Chỉ số cột (bắt đầu từ 0) cho từng trường; null = chưa chọn */
export type CsvColumnMapping = Record<ImportField, number | null>;

export interface ParsedCsv {
  fileName: string;
  delimiter: string;
  hasHeader: boolean;
  /** Tên cột (lấy từ dòng tiêu đề, không có thì "Cột 1", "Cột 2"…) */
  headers: string[];
  /** Các dòng dữ liệu, đã bỏ dòng trống, mỗi dòng đủ số cột */
  rows: string[][];
  /** Số dòng thật trong file của từng phần tử `rows` (để báo lỗi đúng dòng) */
  lineNumbers: number[];
}

export interface ImportRowError {
  line: number;
  field: ImportField;
  /** Giá trị gốc trong file */
  value: string;
  message: string;
}

export interface ImportCandidate {
  line: number;
  date: ISODate;
  amount: number;
  type: TransactionType;
  description: string;
}

export interface ImportDuplicate extends ImportCandidate {
  /** existing: trùng giao dịch đã có trong ví; in_file: lặp lại một dòng phía trên trong file */
  reason: "existing" | "in_file";
  matchId?: ID;
  matchDescription?: string;
  matchLine?: number;
}

export interface ImportRequest {
  file: ParsedCsv;
  mapping: CsvColumnMapping;
  amountMode: AmountMode;
  walletId: ID;
}

export interface ImportResult {
  fileName: string;
  wallet: Wallet;
  /** Giao dịch mới đã tạo (gồm cả đã ghi thẳng và chờ duyệt) */
  created: TransactionView[];
  confirmedCount: number;
  pendingCount: number;
  duplicates: ImportDuplicate[];
  errors: ImportRowError[];
}

// ───────────── Thống kê (F06) ─────────────

export interface StatsRange {
  /** "2026-05" */
  from: string;
  /** "2026-10" (tính cả tháng này) */
  to: string;
}

export interface StatsOverview {
  range: StatsRange;
  totals: MonthTotals;
  /** Số tháng trong khoảng */
  monthCount: number;
  transactionCount: number;
  /** Mỗi tháng trong khoảng, kể cả tháng không có giao dịch (thu/chi = 0) */
  trend: MonthlyTrendPoint[];
  breakdown: CategoryBreakdown;
  topExpenses: TransactionView[];
}

export interface CategoryComparisonRow {
  categoryId: ID | null;
  name: string;
  color: string;
  amountA: number;
  amountB: number;
}

export interface MonthComparison {
  monthA: string;
  monthB: string;
  totalsA: MonthTotals;
  totalsB: MonthTotals;
  /** Chi theo danh mục của hai tháng, sắp theo tổng hai tháng giảm dần; tối đa 5 dòng + "Khác" */
  rows: CategoryComparisonRow[];
}

// ───────────── Tài khoản & cài đặt (F01, §6.3) ─────────────

export interface AuthSession {
  userId: ID;
  role: UserRole;
  email: string;
  fullName: string;
}

export interface RegisterInput {
  fullName: string;
  email: string;
  password: string;
}

export interface ReminderSettings {
  /** Tắt = không tạo nhắc nhở nào (PRD §6.1 "không gây áp lực") */
  enabled: boolean;
  /** "HH:mm", mặc định "20:00" */
  time: string;
  /** Kênh tuỳ chọn ngoài thông báo trong app (bắt buộc) */
  email: boolean;
}

export interface UserSettings {
  profile: Pick<User, "fullName" | "email" | "currency" | "timezone" | "createdAt">;
  reminder: ReminderSettings;
}

export interface DataExport {
  exportedAt: ISODateTime;
  user: User;
  wallets: Wallet[];
  categories: Category[];
  transactions: Transaction[];
  budgets: Budget[];
  classificationRules: ClassificationRule[];
  gamification: { streak: UserStreak; level: UserLevel; badges: UserBadge[] };
  notifications: AppNotification[];
}

// ───────────── Quản trị (F15) ─────────────

export interface AdminUserRow {
  id: ID;
  fullName: string;
  email: string;
  role: UserRole;
  isLocked: boolean;
  createdAt: ISODateTime;
  lastActiveDate: ISODate | null;
  transactionCount: number;
  currentStreak: number;
  aiCalls: number;
}

export interface AdminCategoryRow extends Category {
  /** Số giao dịch (mọi người dùng) đang dùng danh mục */
  usage: number;
}

export interface AdminBadgeRow extends Badge {
  unlockedUsers: number;
}

export interface SystemDailyPoint {
  date: ISODate;
  transactions: number;
  aiCalls: number;
  aiFailures: number;
  activeUsers: number;
}

export interface SystemStats {
  totalUsers: number;
  newUsers30d: number;
  activeUsers7d: number;
  lockedUsers: number;
  totalTransactions: number;
  transactions30d: number;
  aiCalls30d: number;
  aiSuccessRate: number;
  aiAvgLatencyMs: number;
  aiByFeature: { feature: AiFeature; label: string; calls: number; failures: number }[];
  /** Người dùng đang có chuỗi ≥ 1 / người dùng hoạt động trong 30 ngày */
  streakRetention: number;
  streakRetentionBase: number;
  daily: SystemDailyPoint[];
}
