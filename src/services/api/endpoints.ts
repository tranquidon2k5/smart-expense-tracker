/**
 * Bản gọi REST của từng hàm trong src/services/*.service.ts — cùng chữ ký, cùng kiểu trả về.
 * Service chọn bản này khi NEXT_PUBLIC_DATA_SOURCE=api.
 */
import type {
  AchievementsOverview,
  AdminBadgeRow,
  AdminCategoryRow,
  AdminUserRow,
  AppNotification,
  AskResult,
  AuthSession,
  Badge,
  Budget,
  BudgetOverview,
  BudgetProgress,
  Category,
  CategoryBreakdown,
  CategoryInput,
  CategoryUsage,
  Conversation,
  ConversationSummary,
  CreateRuleResult,
  DashboardSummary,
  DataExport,
  DeleteResult,
  GamificationStatus,
  ImportRequest,
  ImportResult,
  Mission,
  MissionProgress,
  MonthComparison,
  MonthlyTrendPoint,
  MotivationMessage,
  NotificationType,
  QuickEntryPreview,
  QuickEntryResult,
  RegisterInput,
  ReminderSettings,
  ReviewResult,
  RulePreview,
  StatsOverview,
  StatsRange,
  SystemStats,
  TransactionFilter,
  TransactionPatch,
  TransactionType,
  TransactionView,
  TransferInput,
  TransferView,
  UpdateResult,
  User,
  UserSettings,
  Wallet,
  WalletSummary,
} from "@/types";
import { http } from "../http";
import { setApiSession } from "./session";

// ───────────── Tài khoản ─────────────

export const auth = {
  async login(email: string, password: string) {
    const s = await http.post<AuthSession>("/auth/login", { email, password }, { noRefresh: true });
    setApiSession(s);
    return s;
  },
  async register(input: RegisterInput) {
    const s = await http.post<AuthSession>("/auth/register", input, { noRefresh: true });
    setApiSession(s);
    return s;
  },
  async logout() {
    try {
      await http.post<void>("/auth/logout", {}, { noRefresh: true, silent: true });
    } finally {
      setApiSession(null);
    }
  },
  requestPasswordReset: (email: string) => http.post<void>("/auth/forgot-password", { email }, { noRefresh: true, silent: true }),
  resetPassword: (email: string, code: string, password: string) =>
    http.post<void>("/auth/reset-password", { email, code, password }, { noRefresh: true, silent: true }),
  async changePassword(currentPassword: string, newPassword: string) {
    setApiSession(await http.patch<AuthSession>("/auth/password", { currentPassword, newPassword }, { silent: true }));
  },
};

export const settings = {
  getSettings: () => http.get<UserSettings>("/me/settings"),
  async updateProfile(input: { fullName: string; email: string }) {
    const user = await http.patch<User>("/me/profile", input);
    const s = await http.get<AuthSession>("/auth/me");
    setApiSession(s);
    return user;
  },
  async updatePreferences(input: { currency: string; timezone: string }) {
    await http.patch<void>("/me/preferences", input);
    setApiSession(await http.get<AuthSession>("/auth/me"));
  },
  updateReminder: (input: ReminderSettings) => http.patch<ReminderSettings>("/me/reminder", input),
  exportAllData: () => http.get<DataExport>("/me/export"),
  deleteAllData: (confirmation: string) => http.delete<void>("/me/data", { confirmation }),
};

// ───────────── Tài chính ─────────────

export const transactions = {
  listCategories: (type?: TransactionType) => http.get<Category[]>("/categories", { type }),
  listWallets: () => http.get<Wallet[]>("/wallets"),
  getRecentTransactions: (limit = 8) => http.get<TransactionView[]>("/transactions/recent", { limit }),
  searchTransactions: (q: string, limit = 8) => http.get<TransactionView[]>("/transactions/search", { q, limit }),
  listTransactions: (f: TransactionFilter = {}) =>
    http.get<TransactionView[]>("/transactions", {
      from: f.from,
      to: f.to,
      walletIds: f.walletIds,
      categoryIds: f.categoryIds,
      minAmount: f.minAmount,
      maxAmount: f.maxAmount,
      type: f.type,
      status: f.status,
      query: f.query,
    }),
  async getTransaction(id: string) {
    try {
      return await http.get<TransactionView>(`/transactions/${encodeURIComponent(id)}`);
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  },
  listPendingTransactions: () => http.get<TransactionView[]>("/transactions/pending"),
  previewRule: (keyword: string, categoryId: string, excludeId?: string) => http.post<RulePreview>("/rules/preview", { keyword, categoryId, excludeId }, { silent: true }),
  createRule: (keyword: string, categoryId: string, applyToPending = false) => http.post<CreateRuleResult>("/rules", { keyword, categoryId, applyToPending }),
  updateTransaction: (id: string, patch: TransactionPatch) => http.patch<UpdateResult>(`/transactions/${encodeURIComponent(id)}`, patch),
  deleteTransactions: (ids: string[]) => http.post<DeleteResult>("/transactions/bulk-delete", { ids }),
  bulkUpdateTransactions: (ids: string[], patch: Pick<TransactionPatch, "categoryId" | "walletId">) =>
    http.post<{ updated: number; skipped: number }>("/transactions/bulk-update", { ids, patch }),
  reviewTransaction: (id: string, categoryId?: string) => http.post<ReviewResult>(`/transactions/${encodeURIComponent(id)}/review`, { categoryId }),
  parseQuickEntry: (text: string) => http.post<QuickEntryPreview>("/ai/quick-entry/parse", { text }, { silent: true }),
  createFromQuickEntry: (preview: QuickEntryPreview) => http.post<QuickEntryResult>("/ai/quick-entry", preview),
};

export const wallets = {
  listWalletSummaries: () => http.get<WalletSummary[]>("/wallets/summary"),
  listTransfers: (walletId?: string, limit = 20) => http.get<TransferView[]>("/transfers", { walletId, limit }),
  transfer: (input: TransferInput) => http.post<TransferView>("/transfers", input),
};

export const categories = {
  listCategoryUsage: () => http.get<CategoryUsage[]>("/categories/usage"),
  createCategory: (input: CategoryInput) => http.post<Category>("/categories", input),
  updateCategory: (id: string, input: Omit<CategoryInput, "type">) => http.patch<Category>(`/categories/${encodeURIComponent(id)}`, input),
  deleteCategory: (id: string, moveToId?: string) =>
    http.delete<{ moved: number }>(`/categories/${encodeURIComponent(id)}${moveToId ? `?moveTo=${encodeURIComponent(moveToId)}` : ""}`),
};

export const budgets = {
  getBudgetOverview: (month?: string) => http.get<BudgetOverview>("/budgets", { month }),
  setBudget: (categoryId: string, limitAmount: number, month?: string) =>
    http.put<Budget>(`/budgets/${encodeURIComponent(categoryId)}${month ? `?month=${month}` : ""}`, { limitAmount }),
  deleteBudget: (id: string) => http.delete<void>(`/budgets/${encodeURIComponent(id)}`),
};

export const dashboard = {
  getDashboardSummary: () => http.get<DashboardSummary>("/dashboard/summary"),
  getMonthlyTrend: (months = 6) => http.get<MonthlyTrendPoint[]>("/dashboard/trend", { months }),
  getCategoryBreakdown: (maxSlices = 5) => http.get<CategoryBreakdown>("/dashboard/breakdown", { maxSlices }),
  getBudgetWatchlist: (limit = 4) => http.get<BudgetProgress[]>("/dashboard/budget-watchlist", { limit }),
  getPendingCount: async () => (await http.get<{ count: number }>("/transactions/pending/count")).count,
};

export const stats = {
  getAvailableMonths: () => http.get<string[]>("/stats/months"),
  getStatistics: (range: StatsRange) => http.get<StatsOverview>("/stats", { from: range.from, to: range.to }),
  compareMonths: (a: string, b: string) => http.get<MonthComparison>("/stats/compare", { a, b }),
};

export const importer = {
  importTransactions: (req: ImportRequest) => http.post<ImportResult>("/import/csv", req),
};

// ───────────── AI ─────────────

export const chat = {
  listConversations: () => http.get<ConversationSummary[]>("/chat/conversations"),
  async getConversation(id: string) {
    try {
      return await http.get<Conversation>(`/chat/conversations/${encodeURIComponent(id)}`);
    } catch (error) {
      if ((error as { status?: number }).status === 404) return null;
      throw error;
    }
  },
  getSources: (ids: string[]) => (ids.length ? http.post<TransactionView[]>("/chat/sources", { ids }, { silent: true }) : Promise.resolve([])),
  ask: (conversationId: string | null, question: string) => http.post<AskResult>("/chat/ask", { conversationId, question }),
  deleteConversation: (id: string) => http.delete<void>(`/chat/conversations/${encodeURIComponent(id)}`),
};

// ───────────── Gamification & thông báo ─────────────

export const gamification = {
  getCurrentUser: () => http.get<User>("/me"),
  getGamificationStatus: () => http.get<GamificationStatus>("/gamification/status"),
  getTodayMissions: () => http.get<MissionProgress[]>("/gamification/missions", { period: "daily" }),
  getAchievements: () => http.get<AchievementsOverview>("/gamification/achievements"),
  getMotivation: async () => (await http.get<{ message: string }>("/gamification/motivation")).message,
};

export const notifications = {
  listNotifications: (type?: NotificationType) => http.get<AppNotification[]>("/notifications", { type }),
  getUnreadCount: async () => (await http.get<{ count: number }>("/notifications/unread-count")).count,
  markRead: (id: string) => http.patch<void>(`/notifications/${encodeURIComponent(id)}`, { isRead: true }),
  markAllRead: async () => (await http.post<{ count: number }>("/notifications/read-all")).count,
  sendTestReminder: () => http.post<AppNotification>("/notifications/test-reminder"),
};

// ───────────── Quản trị ─────────────

export const admin = {
  getSystemStats: () => http.get<SystemStats>("/admin/stats"),
  listUsers: () => http.get<AdminUserRow[]>("/admin/users"),
  setUserLocked: (userId: string, locked: boolean) => http.patch<AdminUserRow>(`/admin/users/${encodeURIComponent(userId)}`, { isLocked: locked }),
  listDefaultCategories: () => http.get<AdminCategoryRow[]>("/admin/categories"),
  saveDefaultCategory: ({ id, ...input }: Omit<Category, "id" | "userId"> & { id?: string }) =>
    id ? http.patch<Category>(`/admin/categories/${encodeURIComponent(id)}`, input) : http.post<Category>("/admin/categories", input),
  deleteDefaultCategory: (id: string) => http.delete<void>(`/admin/categories/${encodeURIComponent(id)}`),
  listMotivationMessages: () => http.get<MotivationMessage[]>("/admin/motivation"),
  saveMotivationMessage: ({ id, ...input }: Omit<MotivationMessage, "id"> & { id?: string }) =>
    id ? http.patch<MotivationMessage>(`/admin/motivation/${encodeURIComponent(id)}`, input) : http.post<MotivationMessage>("/admin/motivation", input),
  setMotivationActive: (id: string, isActive: boolean) => http.patch<void>(`/admin/motivation/${encodeURIComponent(id)}/active`, { isActive }),
  deleteMotivationMessage: (id: string) => http.delete<void>(`/admin/motivation/${encodeURIComponent(id)}`),
  listMissions: () => http.get<Mission[]>("/admin/missions"),
  saveMission: ({ id, ...input }: Omit<Mission, "id" | "code"> & { id?: string; code?: string }) =>
    id ? http.patch<Mission>(`/admin/missions/${encodeURIComponent(id)}`, input) : http.post<Mission>("/admin/missions", input),
  listBadges: () => http.get<AdminBadgeRow[]>("/admin/badges"),
  saveBadge: ({ id, ...input }: Pick<Badge, "id" | "name" | "condition" | "icon">) => http.patch<Badge>(`/admin/badges/${encodeURIComponent(id)}`, input),
};
