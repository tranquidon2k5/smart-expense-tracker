import {
  ChartColumn,
  FileUp,
  LayoutDashboard,
  MessageCircle,
  PiggyBank,
  ReceiptText,
  Settings,
  Shapes,
  Trophy,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { getMessages } from "@/i18n/core";
import { shellMessages } from "@/i18n/messages/shell";

export interface NavItem {
  href: string;
  /** Tên trang theo ngôn ngữ đang dùng (getter, đọc lại mỗi lần render) */
  readonly label: string;
  icon: LucideIcon;
  /** Từ khoá thêm cho ô tìm kiếm (không dấu) */
  keywords?: string;
}

type NavHref = keyof typeof shellMessages.vi.nav;

function item(href: NavHref, icon: LucideIcon, keywords: string): NavItem {
  return {
    href,
    icon,
    keywords,
    get label() {
      return getMessages(shellMessages).nav[href];
    },
  };
}

/** Tên tiếng Việt và tiếng Anh của một trang, để ô tìm kiếm khớp ở cả hai ngôn ngữ */
export function navSearchText(n: NavItem): string {
  const href = n.href as NavHref;
  return `${shellMessages.vi.nav[href]} ${shellMessages.en.nav[href]} ${n.keywords ?? ""}`;
}

export const NAV_MAIN: NavItem[] = [
  item("/", LayoutDashboard, "dashboard trang chu"),
  item("/giao-dich", ReceiptText, "thu chi lich su"),
  item("/thong-ke", ChartColumn, "bieu do bao cao xu huong so sanh thang"),
  item("/nhap-sao-ke", FileUp, "import csv ngan hang file excel"),
  item("/ngan-sach", PiggyBank, "han muc budget"),
  item("/vi", Wallet, "tai khoan ngan hang momo tien mat chuyen tien"),
  item("/danh-muc", Shapes, "phan loai thu chi icon mau"),
  item("/tro-ly-ai", MessageCircle, "chatbot hoi dap"),
  item("/thanh-tich", Trophy, "chuoi huy hieu xp cap do"),
];

export const NAV_SECONDARY: NavItem[] = [
  item("/cai-dat", Settings, "tai khoan nhac nho"),
];

/** Bottom nav < 768px: 4 mục + nút Ghi nhanh ở giữa (MASTER.md › Responsive) */
export const NAV_MOBILE: NavItem[] = ["/", "/giao-dich", "/danh-muc", "/tro-ly-ai"].map(
  (href) => NAV_MAIN.find((n) => n.href === href)!,
);
