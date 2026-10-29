import type { Metadata } from "next";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/i18n/provider";
import "./globals.css";

// Chữ: Be Vietnam Pro (dấu tiếng Việt cân đối)
const beVietnam = Be_Vietnam_Pro({
  variable: "--font-be-vietnam",
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// Số: Inter — có OpenType tnum thật (đã kiểm tra file font, xem MASTER.md)
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Sổ Tiền",
    template: "%s · Sổ Tiền",
  },
  description: "Ghi chép và hiểu chi tiêu cá nhân với ít thao tác nhất.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className={`${beVietnam.variable} ${inter.variable}`}>
      <body className="min-h-svh">
        <I18nProvider>
          <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
          <Toaster theme="light" position="bottom-right" />
        </I18nProvider>
      </body>
    </html>
  );
}
