/** Ngày dạng ISO "yyyy-MM-dd" — tính bằng UTC để không lệch múi giờ của máy chạy */

export function addDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

/** 0 = Chủ nhật … 6 = Thứ Bảy */
export function weekday(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Thứ Hai của tuần chứa `iso` (lịch Việt Nam bắt đầu tuần từ thứ Hai) */
export function mondayOf(iso: string): string {
  return addDays(iso, -((weekday(iso) + 6) % 7));
}

/** Số ngày từ `a` tới `b` (b − a) */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Tuần ISO 8601: "2026-10-12" → "2026-W42" */
export function isoWeekKey(iso: string): string {
  const thursday = addDays(iso, 3 - ((weekday(iso) + 6) % 7));
  const year = Number(thursday.slice(0, 4));
  const week1Monday = mondayOf(`${year}-01-04`);
  const week = Math.floor(daysBetween(week1Monday, mondayOf(iso)) / 7) + 1;
  return `${year}-W${String(week).padStart(2, "0")}`;
}

/** Ngày hiện tại theo múi giờ IANA, ví dụ "Asia/Ho_Chi_Minh" */
export function todayIn(timezone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Giờ phút hiện tại theo múi giờ: "20:05" */
export function timeIn(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}

/** "2026-10" → ngày cuối tháng "2026-10-31" */
export function lastDayOfMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
