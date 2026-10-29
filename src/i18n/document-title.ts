/**
 * Tiêu đề tab trình duyệt. Metadata của từng trang là tĩnh (tiếng Việt, để Next prerender được);
 * dịch từng phần của tiêu đề ("Giao dịch · Sổ Tiền") theo ngôn ngữ đang dùng, và dịch lại mỗi lần
 * Next đổi tiêu đề lúc chuyển trang. Đổi về tiếng Việt thì dịch ngược để tiêu đề không kẹt tiếng Anh.
 */
import type { Locale } from "./core";
import { adminMessages } from "./messages/admin";
import { shellMessages } from "./messages/shell";

const EXTRA_EN: Record<string, string> = {
  "Đăng nhập": "Log in",
  "Đăng ký": "Sign up",
  "Quên mật khẩu": "Forgot password",
  "Quản trị": "Admin",
  "Đang xây dựng": "Under construction",
};

/** Cặp [tiếng Việt, tiếng Anh] của mọi phần có thể xuất hiện trong tiêu đề */
function pairs(): [string, string][] {
  const list = Object.entries(EXTRA_EN);
  for (const [href, vi] of Object.entries(shellMessages.vi.nav)) list.push([vi, shellMessages.en.nav[href as keyof typeof shellMessages.en.nav]]);
  for (const [href, vi] of Object.entries(adminMessages.vi.nav)) list.push([vi, adminMessages.en.nav[href]]);
  return list;
}

export function translateTitle(title: string, locale: Locale): string {
  const map = new Map(locale === "en" ? pairs() : pairs().map(([vi, en]) => [en, vi]));
  return title
    .split(" · ")
    .map((part) => map.get(part) ?? part)
    .join(" · ");
}

/** Dịch tiêu đề hiện tại theo ngôn ngữ và theo dõi thay đổi; trả hàm huỷ theo dõi */
export function syncDocumentTitle(locale: Locale): () => void {
  const apply = () => {
    const next = translateTitle(document.title, locale);
    if (next !== document.title) document.title = next;
  };
  apply();
  const observer = new MutationObserver(apply);
  observer.observe(document.head, { subtree: true, childList: true, characterData: true });
  return () => observer.disconnect();
}
