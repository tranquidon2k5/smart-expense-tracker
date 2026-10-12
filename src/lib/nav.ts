import {
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

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Từ khoá thêm cho ô tìm kiếm (không dấu) */
  keywords?: string;
}

export const NAV_MAIN: NavItem[] = [
  { href: "/", label: "Tổng quan", icon: LayoutDashboard, keywords: "dashboard trang chu" },
  { href: "/giao-dich", label: "Giao dịch", icon: ReceiptText, keywords: "thu chi lich su" },
  { href: "/ngan-sach", label: "Ngân sách", icon: PiggyBank, keywords: "han muc budget" },
  { href: "/vi", label: "Ví", icon: Wallet, keywords: "tai khoan ngan hang momo tien mat chuyen tien" },
  { href: "/danh-muc", label: "Danh mục", icon: Shapes, keywords: "phan loai thu chi icon mau" },
  { href: "/tro-ly-ai", label: "Trợ lý AI", icon: MessageCircle, keywords: "chatbot hoi dap" },
  { href: "/thanh-tich", label: "Thành tích", icon: Trophy, keywords: "chuoi huy hieu xp cap do" },
];

export const NAV_SECONDARY: NavItem[] = [
  { href: "/cai-dat", label: "Cài đặt", icon: Settings, keywords: "tai khoan nhac nho" },
];

/** Bottom nav < 768px: 4 mục + nút Ghi nhanh ở giữa (MASTER.md › Responsive) */
export const NAV_MOBILE: NavItem[] = [NAV_MAIN[0], NAV_MAIN[1], NAV_MAIN[4], NAV_MAIN[5]];
