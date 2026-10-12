import type { AuthSession, RegisterInput, User } from "@/types";
import * as db from "./mock/db";
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  DEMO_PASSWORD,
  DEMO_RESET_CODE,
  accounts,
  findAccount,
  findAccountByEmail,
  passwordMatches,
  persistAccount,
  sha256,
} from "./mock/accounts";
import { loadDatasetFor } from "./mock/dataset";
import { simulateLatency } from "./mock/scenario";
import { getStoredSession, setStoredSession, subscribeSession } from "./mock/session-store";
import { emitDataChanged } from "./events";

export { DEMO_RESET_CODE };

/** Tài khoản demo hiển thị ở trang Đăng nhập */
export const DEMO_ACCOUNTS = [
  { label: "Người dùng (Lan)", email: db.user.email, password: DEMO_PASSWORD },
  { label: "Quản trị viên", email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
] as const;

export const PASSWORD_MIN = 8;

/** Lỗi có thể chỉ ra ô nhập gây lỗi để giao diện đặt thông báo ngay dưới ô đó */
export class AuthError extends Error {
  constructor(
    message: string,
    public field?: "email" | "password" | "currentPassword" | "code" | "fullName",
  ) {
    super(message);
    this.name = "AuthError";
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return "Nhập email của bạn";
  if (!EMAIL_RE.test(email.trim())) return "Email chưa đúng định dạng, ví dụ ten@example.com";
  return null;
}

/** Quy tắc mật khẩu: ≥ 8 ký tự, có cả chữ và số. Trả từng điều kiện để giao diện hiện danh sách kiểm tra. */
export function passwordChecks(password: string) {
  return [
    { label: `Ít nhất ${PASSWORD_MIN} ký tự`, ok: password.length >= PASSWORD_MIN },
    { label: "Có chữ cái", ok: /\p{L}/u.test(password) },
    { label: "Có chữ số", ok: /\d/.test(password) },
  ];
}

export function validatePassword(password: string): string | null {
  if (!password) return "Nhập mật khẩu";
  const failed = passwordChecks(password).find((c) => !c.ok);
  return failed ? `Mật khẩu cần: ${failed.label.toLowerCase()}` : null;
}

function toSession(user: User): AuthSession {
  return { userId: user.id, role: user.role, email: user.email, fullName: user.fullName };
}

function signIn(user: User): AuthSession {
  const session = toSession(user);
  loadDatasetFor(user);
  setStoredSession(session);
  emitDataChanged();
  return session;
}

// ───────────── Phiên ─────────────

export function getSession(): AuthSession | null {
  return getStoredSession();
}

export const onSessionChanged = subscribeSession;

export function homeFor(session: AuthSession): string {
  return session.role === "admin" ? "/quan-tri" : "/";
}

/** Chỉ cho phép quay lại đường dẫn nội bộ (chống open redirect qua ?tiep=) */
export function safeNext(next: string | null, session: AuthSession): string {
  if (next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/dang-")) {
    if (next.startsWith("/quan-tri") && session.role !== "admin") return homeFor(session);
    return next;
  }
  return homeFor(session);
}

// ───────────── Đăng nhập / đăng ký / đăng xuất ─────────────

export async function login(email: string, password: string): Promise<AuthSession> {
  await simulateLatency(600);
  const account = findAccountByEmail(email);
  // Không nói rõ sai email hay sai mật khẩu để không lộ email nào đã đăng ký
  if (!account || !(await passwordMatches(account, password))) {
    throw new AuthError("Email hoặc mật khẩu chưa đúng. Kiểm tra lại giúp mình nhé.");
  }
  if (account.user.isLocked) {
    throw new AuthError("Tài khoản này đang bị khoá. Liên hệ quản trị viên qua hotro@sotien.vn để được mở lại.");
  }
  return signIn(account.user);
}

export async function register(input: RegisterInput): Promise<AuthSession> {
  await simulateLatency(700);
  const fullName = input.fullName.trim().replace(/\s+/g, " ");
  if (fullName.length < 2) throw new AuthError("Nhập họ tên của bạn", "fullName");
  const emailError = validateEmail(input.email);
  if (emailError) throw new AuthError(emailError, "email");
  const passwordError = validatePassword(input.password);
  if (passwordError) throw new AuthError(passwordError, "password");
  if (findAccountByEmail(input.email)) {
    throw new AuthError("Email này đã có tài khoản. Bạn đăng nhập hoặc lấy lại mật khẩu nhé.", "email");
  }
  const user: User = {
    id: `u-new-${Date.now().toString(36)}`,
    email: input.email.trim().toLowerCase(),
    fullName,
    currency: "VND",
    timezone: "Asia/Ho_Chi_Minh",
    role: "user",
    isLocked: false,
    createdAt: new Date().toISOString(),
  };
  const account = {
    user,
    passwordHash: await sha256(input.password),
    stats: { lastActiveDate: db.MOCK_TODAY, transactionCount: 0, currentStreak: 0, aiCalls: 0 },
  };
  accounts.push(account);
  persistAccount(account);
  return signIn(user);
}

export async function logout(): Promise<void> {
  setStoredSession(null);
}

// ───────────── Quên / đổi mật khẩu ─────────────

/** Bước 1: gửi mã đặt lại. Luôn báo thành công dù email có tồn tại hay không (không lộ tài khoản). */
export async function requestPasswordReset(email: string): Promise<void> {
  await simulateLatency(700);
  const emailError = validateEmail(email);
  if (emailError) throw new AuthError(emailError, "email");
}

/** Bước 2: nhập mã + mật khẩu mới */
export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  await simulateLatency(700);
  const account = findAccountByEmail(email);
  if (!/^\d{6}$/.test(code.trim())) throw new AuthError("Mã gồm 6 chữ số", "code");
  if (!account || code.trim() !== DEMO_RESET_CODE) {
    throw new AuthError("Mã chưa đúng hoặc đã hết hạn. Kiểm tra email mới nhất hoặc gửi lại mã.", "code");
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new AuthError(passwordError, "password");
  account.passwordHash = await sha256(newPassword);
  account.seedPassword = undefined;
  persistAccount(account);
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await simulateLatency(600);
  const session = getStoredSession();
  const account = session ? findAccount(session.userId) : undefined;
  if (!account) throw new AuthError("Phiên đăng nhập đã hết. Đăng nhập lại nhé.");
  if (!(await passwordMatches(account, currentPassword))) {
    throw new AuthError("Mật khẩu hiện tại chưa đúng", "currentPassword");
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) throw new AuthError(passwordError, "password");
  if (currentPassword === newPassword) throw new AuthError("Mật khẩu mới cần khác mật khẩu hiện tại", "password");
  account.passwordHash = await sha256(newPassword);
  account.seedPassword = undefined;
  persistAccount(account);
}

/** Cập nhật hồ sơ trong bảng users + phiên hiện tại (gọi từ settings.service) */
export function syncAccountProfile(patch: Partial<Pick<User, "fullName" | "email" | "currency" | "timezone">>): void {
  const session = getStoredSession();
  const account = session ? findAccount(session.userId) : undefined;
  if (!account || !session) return;
  Object.assign(account.user, patch);
  persistAccount(account);
  setStoredSession(toSession(account.user));
}
