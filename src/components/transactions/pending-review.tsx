"use client";

import { Check, CheckCheck, Loader2, PencilLine, Sparkles } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Category, RuleSuggestion, TransactionView } from "@/types";
import { Button } from "@/components/ui/button";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Money } from "@/components/money";
import { useServiceQuery } from "@/hooks/use-service-query";
import { transactionService } from "@/services";
import { formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { XP_LIMIT_NOTE, xpSuffix } from "@/lib/xp";
import { CategoryCommand } from "./category-command";
import { RuleSuggestionPrompt } from "./rule-suggestion";

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="num inline-flex min-w-5 justify-center rounded border bg-card px-1 text-[11px] font-medium">{children}</kbd>;
}

/**
 * Hàng chờ duyệt (F08, Luồng 2): giao dịch AI phân loại với độ tin cậy < 0,7.
 * Bàn phím: ↑/↓ (J/K) chọn · Enter duyệt theo gợi ý AI · E đổi danh mục rồi duyệt · Mở chi tiết bằng O.
 */
export function PendingReview({
  categories,
  onOpen,
}: {
  categories: Category[];
  onOpen: (id: string) => void;
}) {
  const query = useServiceQuery(() => transactionService.listPendingTransactions());
  const items = React.useMemo(() => query.data ?? [], [query.data]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [pickerFor, setPickerFor] = React.useState<string | null>(null);
  const [suggestion, setSuggestion] = React.useState<RuleSuggestion | null>(null);
  const [reviewedCount, setReviewedCount] = React.useState(0);
  const itemRefs = React.useRef(new Map<string, HTMLLIElement>());
  const listRef = React.useRef<HTMLUListElement>(null);

  const index = Math.min(activeIndex, Math.max(0, items.length - 1));
  const active = items[index];

  const focusItem = (i: number) => {
    const t = items[i];
    if (t) itemRefs.current.get(t.id)?.focus();
  };

  // Sau khi một mục biến mất (đã duyệt), giữ focus ở vị trí cũ trong danh sách
  const restoreFocus = React.useRef(false);
  React.useEffect(() => {
    if (!restoreFocus.current || suggestion) return;
    restoreFocus.current = false;
    const t = items[Math.min(activeIndex, items.length - 1)];
    if (t) itemRefs.current.get(t.id)?.focus();
  }, [items, activeIndex, suggestion]);

  const approve = async (t: TransactionView, categoryId?: string) => {
    if (busyId) return;
    setBusyId(t.id);
    try {
      const result = await transactionService.reviewTransaction(t.id, categoryId);
      setReviewedCount((n) => n + 1);
      toast.success(`Đã duyệt “${t.description}”${xpSuffix(result)}`, {
        description: result.xpLimitReached ? XP_LIMIT_NOTE.review : undefined,
      });
      restoreFocus.current = true;
      if (result.ruleSuggestion) setSuggestion(result.ruleSuggestion);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Duyệt chưa thành công, bạn thử lại nhé.");
    } finally {
      setBusyId(null);
    }
  };

  const onListKeyDown = (e: React.KeyboardEvent<HTMLUListElement>) => {
    // Chỉ xử lý khi focus đang ở chính một mục (không phải nút bên trong)
    if (!(e.target instanceof HTMLLIElement) || e.altKey || e.ctrlKey || e.metaKey) return;
    const key = e.key.toLowerCase();
    if (key === "arrowdown" || key === "j") {
      e.preventDefault();
      const next = Math.min(items.length - 1, index + 1);
      setActiveIndex(next);
      focusItem(next);
    } else if (key === "arrowup" || key === "k") {
      e.preventDefault();
      const prev = Math.max(0, index - 1);
      setActiveIndex(prev);
      focusItem(prev);
    } else if (key === "home") {
      e.preventDefault();
      setActiveIndex(0);
      focusItem(0);
    } else if (key === "end") {
      e.preventDefault();
      setActiveIndex(items.length - 1);
      focusItem(items.length - 1);
    } else if (key === "enter" && active) {
      e.preventDefault();
      approve(active);
    } else if (key === "e" && active) {
      e.preventDefault();
      setPickerFor(active.id);
    } else if (key === "o" && active) {
      e.preventDefault();
      onOpen(active.id);
    }
  };

  if (query.error && !query.data) {
    return <ErrorState title="Không tải được hàng chờ duyệt" error={query.error} onRetry={query.refetch} className="min-h-[360px]" />;
  }

  if (query.loading) {
    return (
      <div aria-hidden className="flex flex-col">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-5 py-4 last:border-0">
            <Skeleton className="size-8 rounded-full" />
            <div className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-9 w-40" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:px-5">
        <p className="text-sm text-muted-foreground">
          AI chưa chắc chắn về các giao dịch dưới đây (độ tin cậy dưới <span className="num">70%</span>). Mỗi lần duyệt được{" "}
          <span className="num font-medium text-xp-text">+5 XP</span>.
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground max-md:hidden" aria-label="Phím tắt">
          <span>
            <Kbd>↑</Kbd> <Kbd>↓</Kbd> chọn
          </span>
          <span>
            <Kbd>Enter</Kbd> duyệt
          </span>
          <span>
            <Kbd>E</Kbd> đổi danh mục
          </span>
          <span>
            <Kbd>O</Kbd> xem chi tiết
          </span>
        </p>
      </div>

      {suggestion && (
        <div className="border-b p-4 md:px-5" aria-live="polite">
          <RuleSuggestionPrompt
            suggestion={suggestion}
            categories={categories}
            onDone={() => {
              setSuggestion(null);
              restoreFocus.current = true;
            }}
          />
        </div>
      )}

      {items.length === 0 ? (
        <EmptyState
          icon={CheckCheck}
          className="min-h-[320px]"
          title={reviewedCount ? "Duyệt xong hết rồi, giỏi lắm!" : "Không có giao dịch nào chờ duyệt"}
          description={
            reviewedCount
              ? `Bạn vừa duyệt ${reviewedCount} giao dịch. AI sẽ phân loại chính xác hơn nhờ các luật bạn tạo.`
              : "Khi AI chưa chắc chắn về danh mục của một giao dịch, nó sẽ xuất hiện ở đây để bạn kiểm tra."
          }
        />
      ) : (
        <ul
          ref={listRef}
          aria-label={`${items.length} giao dịch chờ duyệt. Dùng mũi tên để chọn, Enter để duyệt, E để đổi danh mục`}
          onKeyDown={onListKeyDown}
          className={cn("flex flex-col", query.fetching && "opacity-80 transition-opacity")}
        >
          {items.map((t, i) => {
            const isActive = i === index;
            const busy = busyId === t.id;
            return (
              <li
                key={t.id}
                ref={(el) => {
                  if (el) itemRefs.current.set(t.id, el);
                  else itemRefs.current.delete(t.id);
                }}
                tabIndex={isActive ? 0 : -1}
                aria-current={isActive || undefined}
                aria-label={`${t.description}, ${t.type === "income" ? "thu" : "chi"} ${t.amount} đồng, ngày ${formatDate(t.date)}, AI đoán ${t.category.name} ${formatPercent((t.aiConfidence ?? 0) * 100)}`}
                onFocus={() => setActiveIndex(i)}
                onClick={() => setActiveIndex(i)}
                className={cn(
                  "group relative flex flex-wrap items-center gap-x-4 gap-y-3 border-b px-4 py-3.5 transition-colors duration-150 last:border-0 md:flex-nowrap md:px-5",
                  "outline-none focus-visible:z-10 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                  isActive ? "bg-row-hover" : "hover:bg-row-hover",
                  busy && "opacity-60",
                )}
              >
                {isActive && <span aria-hidden className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-primary" />}
                <CategoryIcon icon={t.category.icon} color={t.category.color} />
                <div className="min-w-0 flex-1">
                  <p className="num truncate text-[15px] font-medium" title={t.description}>
                    {t.description}
                  </p>
                  <p className="mt-0.5 text-[13px] text-muted-foreground">
                    <span className="num">{formatDate(t.date)}</span> · {t.wallet.name} · {t.source === "csv" ? "Sao kê CSV" : "Câu tự nhiên"}
                  </p>
                </div>
                <Money amount={t.amount} type={t.type} className="w-28 font-medium md:text-right" />
                <div className="flex items-center gap-2 max-md:w-full">
                  <span className="inline-flex min-w-0 items-center gap-1.5 rounded-md bg-card px-2 py-1 text-[13px] ring-1 ring-border max-md:flex-1 md:w-52">
                    <Sparkles aria-hidden className="size-3.5 shrink-0 text-info" />
                    <span className="min-w-0 flex-1 truncate">
                      AI đoán: <span className="font-medium">{t.category.name}</span>
                    </span>
                    <span className="num shrink-0 text-warning">{formatPercent((t.aiConfidence ?? 0) * 100)}</span>
                  </span>
                  <Popover open={pickerFor === t.id} onOpenChange={(o) => setPickerFor(o ? t.id : null)}>
                    <PopoverAnchor asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        tabIndex={isActive ? 0 : -1}
                        onClick={() => setPickerFor(t.id)}
                        disabled={busy}
                        aria-label={`Đổi danh mục cho ${t.description} (phím E)`}
                        title="Đổi danh mục (E)"
                        className="max-md:size-11"
                      >
                        <PencilLine aria-hidden />
                      </Button>
                    </PopoverAnchor>
                    <PopoverContent
                      align="end"
                      className="w-72 rounded-xl p-0"
                      onCloseAutoFocus={(e) => {
                        e.preventDefault();
                        if (!suggestion) itemRefs.current.get(t.id)?.focus();
                      }}
                    >
                      <CategoryCommand
                        categories={categories}
                        value={t.categoryId}
                        placeholder="Chọn danh mục đúng…"
                        onSelect={(c) => {
                          setPickerFor(null);
                          approve(t, c.id);
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                  <Button
                    tabIndex={isActive ? 0 : -1}
                    onClick={() => approve(t)}
                    disabled={busy}
                    aria-busy={busy}
                    aria-label={`Duyệt ${t.description} với danh mục ${t.category.name} (Enter)`}
                    className="max-md:h-11"
                  >
                    {busy ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
                    Duyệt
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
