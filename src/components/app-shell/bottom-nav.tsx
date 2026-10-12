"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { NAV_MOBILE } from "@/lib/nav";
import { cn } from "@/lib/utils";

/** Bottom nav < 768px: 4 mục + nút Ghi nhanh ở giữa, có nhãn chữ, tôn trọng safe-area */
function BottomNavItems({ pathname }: { pathname: string | null }) {
  const { openQuickAdd } = useQuickAdd();
  const [first, second, third, fourth] = NAV_MOBILE;

  const item = (n: (typeof NAV_MOBILE)[number]) => {
    const active = pathname !== null && (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href));
    return (
      <Link
        key={n.href}
        href={n.href}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 rounded-lg text-[11px] font-medium transition-colors duration-150",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        <n.icon aria-hidden className="size-6" strokeWidth={active ? 2.25 : 2} />
        {n.label}
      </Link>
    );
  };

  return (
    <div className="mx-auto flex max-w-lg items-center gap-1 px-2">
      {item(first)}
      {item(second)}
      <div className="flex flex-1 justify-center">
        <button
          type="button"
          onClick={openQuickAdd}
          aria-label="Ghi nhanh giao dịch"
          className="-mt-5 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_12px_rgb(19_42_38/0.16)] transition-colors duration-150 hover:bg-primary-hover"
        >
          <Plus aria-hidden className="size-6" />
        </button>
      </div>
      {item(third)}
      {item(fourth)}
    </div>
  );
}

function ActiveBottomNavItems() {
  return <BottomNavItems pathname={usePathname()} />;
}

export function BottomNav() {
  return (
    <nav
      aria-label="Điều hướng nhanh"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-1px_2px_rgb(19_42_38/0.06)] md:hidden"
    >
      {/* usePathname cần Suspense khi có Cache Components */}
      <React.Suspense fallback={<BottomNavItems pathname={null} />}>
        <ActiveBottomNavItems />
      </React.Suspense>
    </nav>
  );
}
