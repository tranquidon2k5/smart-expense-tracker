/**
 * i18n gọn nhẹ, không phụ thuộc thư viện: mỗi tính năng khai báo câu chữ vi + en cạnh nhau bằng
 * `defineMessages`, TypeScript bắt bản tiếng Anh phải đủ khoá và đúng chữ ký hàm như bản tiếng Việt.
 *
 * Ngôn ngữ lưu ở localStorage (chỉ là tuỳ chọn hiển thị của trình duyệt). Server luôn render tiếng Việt
 * để Next prerender được trang; client đổi sang ngôn ngữ đã lưu ngay sau khi hydrate (xem I18nProvider).
 */

export const LOCALES = ["vi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "vi";

/** Tên ngôn ngữ luôn viết bằng chính ngôn ngữ đó để người dùng nhận ra */
export const LOCALE_NAMES: Record<Locale, string> = { vi: "Tiếng Việt", en: "English" };

/** Mã BCP 47 cho Intl (số, ngày) */
export const INTL_LOCALE: Record<Locale, string> = { vi: "vi-VN", en: "en-US" };

const STORAGE_KEY = "so-tien:locale";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    return isLocale(v) ? v : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

// ───────────── Ngôn ngữ đang dùng (store dùng chung cho React và code ngoài React) ─────────────

type Listener = () => void;
const listeners = new Set<Listener>();
let stored: Locale | undefined;

/** Ngôn ngữ người dùng đã chọn (client). Server/prerender luôn là tiếng Việt. */
export function getStoredLocale(): Locale {
  if (stored === undefined) stored = readStoredLocale();
  return stored;
}

export function setStoredLocale(locale: Locale): void {
  stored = locale;
  try {
    window.localStorage.setItem(STORAGE_KEY, locale);
  } catch {
    // Chế độ riêng tư chặn localStorage: ngôn ngữ chỉ giữ trong tab này
  }
  listeners.forEach((l) => l());
}

export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Ngôn ngữ mà cây React đang render. I18nProvider đặt giá trị này trong lúc render (trước khi các con
 * render) nên các hàm định dạng và service gọi ngoài React (`getMessages`, `formatMoney`…) luôn khớp
 * với giao diện, kể cả lúc hydrate (khi đó vẫn là tiếng Việt như bản server).
 */
let active: Locale = DEFAULT_LOCALE;

export function getActiveLocale(): Locale {
  return active;
}

export function setActiveLocale(locale: Locale): void {
  active = locale;
}

// ───────────── Khai báo câu chữ ─────────────

type MessageValue = string | ((...args: never[]) => string) | readonly MessageValue[] | { [key: string]: MessageValue };
export type MessageTree = { [key: string]: MessageValue };

/** Kiểu của bản tiếng Việt, nới chuỗi cụ thể thành `string` để bản tiếng Anh gán được */
type Widen<T> = T extends string
  ? string
  : T extends (...args: infer A) => string
    ? (...args: A) => string
    : T extends readonly (infer E)[]
      ? readonly Widen<E>[]
      : { [K in keyof T]: Widen<T[K]> };

export type Messages<T extends MessageTree> = { vi: Widen<T>; en: Widen<T> };

/** Khai báo câu chữ của một tính năng: tiếng Việt là bản gốc, tiếng Anh phải đủ khoá như vậy */
export function defineMessages<T extends MessageTree>(messages: { vi: T; en: Widen<NoInfer<T>> }): Messages<T> {
  return messages as unknown as Messages<T>;
}

/** Lấy câu chữ theo ngôn ngữ đang render — dùng ở code ngoài React (service, hàm định dạng) */
export function getMessages<T extends MessageTree>(messages: Messages<T>, locale: Locale = active): Widen<T> {
  return messages[locale];
}
