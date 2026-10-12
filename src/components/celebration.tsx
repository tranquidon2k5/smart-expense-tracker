"use client";

import { Trophy, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import { onCelebrate, type Celebration } from "@/services";
import { cn } from "@/lib/utils";
import { AchievementIcon } from "./achievement-icon";

const CONFETTI_COLORS = ["var(--streak)", "var(--xp)", "var(--primary)", "#DB2777", "#2563EB"];
const AUTO_HIDE_MS = 7000;

/**
 * Chúc mừng khi đạt mốc chuỗi, mở huy hiệu, lên cấp (PRD §6.2, F14).
 * - Thẻ nổi góc màn hình, KHÔNG cướp focus (role="status"), tự ẩn sau 7 giây, rê chuột/focus thì giữ.
 * - Hoa giấy chỉ chạy khi người dùng không bật giảm chuyển động (motion-safe).
 * - Hoàn thành nhiệm vụ chỉ hiện toast nhẹ.
 */
export function CelebrationHost() {
  const [queue, setQueue] = React.useState<Celebration[]>([]);
  const [paused, setPaused] = React.useState(false);
  const current = queue[0];

  React.useEffect(
    () =>
      onCelebrate((c) => {
        if (c.kind === "mission") {
          toast.success(`${c.title}: ${c.description}`, { description: c.xp ? `+${c.xp} XP` : undefined });
          return;
        }
        setQueue((q) => [...q, c]);
      }),
    [],
  );

  const dismiss = React.useCallback(() => setQueue((q) => q.slice(1)), []);

  React.useEffect(() => {
    if (!current || paused) return;
    const t = setTimeout(dismiss, AUTO_HIDE_MS);
    return () => clearTimeout(t);
  }, [current, paused, dismiss]);

  return (
    <div aria-live="polite" role="status" className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex justify-center md:inset-x-auto md:right-6 md:bottom-6">
      {current && <CelebrationCard key={`${current.kind}-${current.title}-${queue.length}`} c={current} onClose={dismiss} onPause={setPaused} />}
    </div>
  );
}

function CelebrationCard({ c, onClose, onPause }: { c: Celebration; onClose: () => void; onPause: (p: boolean) => void }) {
  return (
    <div
      onMouseEnter={() => onPause(true)}
      onMouseLeave={() => onPause(false)}
      onFocus={() => onPause(true)}
      onBlur={() => onPause(false)}
      className="pointer-events-auto relative w-full max-w-sm overflow-hidden rounded-2xl border border-xp/40 bg-card p-4 shadow-[0_8px_24px_rgb(19_42_38/0.16)] motion-safe:animate-[celebrate-in_320ms_cubic-bezier(0.2,0,0,1)]"
    >
      {/* Hoa giấy: trang trí, ẩn với trình đọc màn hình và khi giảm chuyển động */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden motion-reduce:hidden">
        {Array.from({ length: 14 }, (_, i) => (
          <span
            key={i}
            className="absolute top-0 block h-2.5 w-1.5 rounded-[1px] opacity-0 animate-[confetti-fall_1400ms_ease-out_forwards]"
            style={{
              left: `${6 + ((i * 37) % 88)}%`,
              backgroundColor: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
              animationDelay: `${(i % 7) * 70}ms`,
              ["--confetti-x" as string]: `${((i % 5) - 2) * 18}px`,
              ["--confetti-r" as string]: `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
            }}
          />
        ))}
      </div>

      <div className="relative flex items-start gap-3">
        <span
          aria-hidden
          className={cn(
            "inline-flex size-12 shrink-0 items-center justify-center rounded-full",
            c.kind === "streak" ? "bg-streak-soft text-streak" : "bg-xp-soft text-xp-text",
          )}
        >
          <AchievementIcon
            name={c.icon}
            className={cn("size-6", c.kind === "streak" && "fill-streak/25", "motion-safe:animate-[pop_600ms_ease-out_1]")}
          />
        </span>
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-[15px] font-semibold">{c.title}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{c.description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {c.xp ? (
              <span className="num rounded-md bg-xp-soft px-1.5 py-0.5 text-xs font-semibold text-xp-text">+{c.xp} XP</span>
            ) : null}
            <Link href="/thanh-tich" onClick={onClose} className="inline-flex items-center gap-1 text-sm font-medium text-primary underline-offset-4 hover:underline">
              <Trophy aria-hidden className="size-4" /> Xem thành tích
            </Link>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Đóng thông báo chúc mừng"
          className="absolute -top-1 -right-1 inline-flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-row-hover hover:text-foreground"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
}
