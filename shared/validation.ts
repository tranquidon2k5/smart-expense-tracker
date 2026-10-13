/** Kiểm tra dữ liệu tài khoản (F01) — giao diện và backend dùng cùng quy tắc */
import { normalize } from "./text";

export const PASSWORD_MIN = 8;
/** bcrypt chỉ dùng 72 byte đầu */
export const PASSWORD_MAX = 72;

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
  if (password.length > PASSWORD_MAX) return `Mật khẩu tối đa ${PASSWORD_MAX} ký tự`;
  const failed = passwordChecks(password).find((c) => !c.ok);
  return failed ? `Mật khẩu cần: ${failed.label.toLowerCase()}` : null;
}

/** Họ tên đã gộp khoảng trắng, hoặc null nếu chưa hợp lệ */
export function cleanFullName(fullName: string): string | null {
  const name = fullName.trim().replace(/\s+/g, " ");
  return name.length >= 2 && name.length <= 80 ? name : null;
}

/** Cụm từ người dùng phải gõ để xác nhận xoá toàn bộ dữ liệu */
export const DELETE_PHRASE = "XOÁ DỮ LIỆU";

/** Chấp nhận cả "XOÁ" lẫn "XÓA", có/không dấu */
export function isDeleteConfirmation(value: string): boolean {
  return normalize(value).replace(/\s+/g, " ").trim() === "xoa du lieu";
}

export const REMINDER_TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Múi giờ dùng để tính "một ngày" cho chuỗi ghi chép (PRD §6.2) */
export const TIMEZONES = [
  { id: "Asia/Ho_Chi_Minh", label: "Việt Nam (UTC+7)" },
  { id: "Asia/Bangkok", label: "Bangkok (UTC+7)" },
  { id: "Asia/Singapore", label: "Singapore (UTC+8)" },
  { id: "Asia/Tokyo", label: "Tokyo (UTC+9)" },
  { id: "Asia/Seoul", label: "Seoul (UTC+9)" },
  { id: "Australia/Sydney", label: "Sydney (UTC+10/+11)" },
  { id: "Europe/London", label: "London (UTC+0/+1)" },
  { id: "Europe/Berlin", label: "Berlin (UTC+1/+2)" },
  { id: "America/New_York", label: "New York (UTC−5/−4)" },
  { id: "America/Los_Angeles", label: "Los Angeles (UTC−8/−7)" },
] as const;

/** Đơn vị tiền tệ (F01). Mới hỗ trợ VND; các loại khác hiện "sắp có". */
export const CURRENCIES = [
  { code: "VND", label: "Việt Nam đồng (đ)", available: true },
  { code: "USD", label: "Đô la Mỹ ($)", available: false },
  { code: "EUR", label: "Euro (€)", available: false },
] as const;
