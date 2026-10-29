"use client";

import { ArrowRight, Loader2, TriangleAlert, WandSparkles } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Category, RulePreviewItem, RuleSuggestion } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { CategoryChip } from "@/components/category-icon";
import { Money } from "@/components/money";
import { useServiceQuery } from "@/hooks/use-service-query";
import { transactionService } from "@/services";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { transactionsMessages } from "@/i18n/messages/transactions";
import { te } from "@/i18n/errors";

const msg = () => getMessages(transactionsMessages);

function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = React.useState(value);
  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

function PreviewRow({ item, target }: { item: RulePreviewItem; target?: Category }) {
  const t = item.transaction;
  return (
    <li className={cn("flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[13px]", item.conflict && "bg-muted/60")}>
      <span className="min-w-0 flex-1">
        <span className="num block truncate font-medium" title={t.description}>
          {t.description}
        </span>
        <span className="text-muted-foreground">
          <span className="num">{formatDate(t.date)}</span> · <Money amount={t.amount} type={t.type} />
        </span>
      </span>
      {item.typeMismatch ? (
        <span className="text-muted-foreground">{msg().rule.skipped}</span>
      ) : item.conflict ? (
        <span className="flex items-center gap-1.5">
          <TriangleAlert aria-hidden className="size-3.5 shrink-0 text-warning" />
          <span className="sr-only">{msg().rule.conflictSr}</span>
          <CategoryChip name={t.category.name} color={t.category.color} />
          <ArrowRight aria-label={msg().rule.to} className="size-3.5 text-muted-foreground" />
          {target && <CategoryChip name={target.name} color={target.color} className="font-medium" />}
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          {target && <CategoryChip name={target.name} color={target.color} />} · {msg().rule.keep}
        </span>
      )}
    </li>
  );
}

/**
 * Hỏi "Tạo luật mới cho từ khoá này?" sau khi người dùng sửa danh mục AI đoán (F08, Luồng 2).
 * - Mặc định chỉ tạo luật cho lần sau, KHÔNG đổi giao dịch chờ duyệt khác.
 * - Khi tick "áp dụng", hiện xem trước đúng các giao dịch sẽ bị đổi và cảnh báo giao dịch
 *   đang thuộc danh mục khác (vd. từ khoá "GRAB" kéo cả GRAB*FOOD vào luật Di chuyển).
 * - Nút "Tạo luật" nhận focus ngay: Enter = tạo, Esc = bỏ qua.
 */
export function RuleSuggestionPrompt({
  suggestion,
  categories,
  onDone,
  className,
}: {
  suggestion: RuleSuggestion;
  categories: Category[];
  /** Gọi khi tạo xong hoặc bỏ qua — nơi gọi trả focus về chỗ cũ */
  onDone: () => void;
  className?: string;
}) {
  const ids = React.useId();
  const [keyword, setKeyword] = React.useState(suggestion.keyword);
  const [applyToPending, setApplyToPending] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const category = categories.find((c) => c.id === suggestion.categoryId);

  // Xem trước theo từ khoá đang gõ (debounce) — cùng logic với lúc áp dụng thật
  const debouncedKeyword = useDebounced(keyword.trim(), 250);
  const preview = useServiceQuery(
    () => transactionService.previewRule(debouncedKeyword, suggestion.categoryId, suggestion.transactionId),
    debouncedKeyword,
  );
  const previewFresh =
    !!preview.data && !preview.fetching && preview.data.keyword === debouncedKeyword.toUpperCase() && debouncedKeyword === keyword.trim();
  const applicable = preview.data?.applicableCount ?? suggestion.matchingPendingCount;
  const conflicts = preview.data?.conflictCount ?? 0;
  const items = preview.data?.items ?? [];
  // Khi áp dụng, chỉ cho bấm khi bản xem trước đúng với từ khoá sắp gửi
  const waitingPreview = applyToPending && !previewFresh;
  const willApply = applyToPending && applicable > 0;

  const create = async () => {
    if (waitingPreview) return;
    setSaving(true);
    setError(null);
    try {
      const { rule, appliedCount } = await transactionService.createRule(keyword, suggestion.categoryId, willApply);
      toast.success(msg().rule.created(rule.keyword, category?.name ?? ""), {
        description: appliedCount
          ? msg().rule.applied(appliedCount)
          : msg().rule.future,
      });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : msg().rule.failed);
      setSaving(false);
    }
  };

  return (
    <section
      aria-labelledby={`${ids}-title`}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
      className={cn("rounded-xl border border-primary/30 bg-accent p-4", className)}
    >
      <div className="flex items-start gap-3">
        <WandSparkles aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
        <div className="min-w-0 flex-1">
          <h3 id={`${ids}-title`} className="text-[15px] font-semibold">
            {msg().rule.title}
          </h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {msg().rule.introBefore}{" "}
            {category && <CategoryChip name={category.name} color={category.color} className="align-middle text-sm text-foreground" />}
            {msg().rule.introAfter}
          </p>

          <form
            className="mt-3 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
          >
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-40 flex-1">
                <label htmlFor={`${ids}-kw`} className="mb-1 block text-[13px] font-medium">
                  {msg().rule.keyword}
                </label>
                <Input
                  id={`${ids}-kw`}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="num bg-card uppercase"
                  aria-invalid={!keyword.trim() || undefined}
                  aria-describedby={`${ids}-kw-hint`}
                />
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onDone} disabled={saving} className="max-md:h-11">
                  {msg().rule.skip} <kbd className="num ml-1 hidden rounded border px-1 text-[11px] md:inline">Esc</kbd>
                </Button>
                <Button
                  type="submit"
                  autoFocus
                  disabled={saving || !keyword.trim() || waitingPreview}
                  aria-busy={saving || waitingPreview}
                  className="max-md:h-11"
                >
                  {saving || waitingPreview ? <Loader2 aria-hidden className="animate-spin" /> : null}
                  {willApply ? (
                    <>
                      {msg().rule.createApply} <span className="num">{applicable}</span>
                    </>
                  ) : (
                    msg().rule.create
                  )}
                </Button>
              </div>
            </div>
            <p id={`${ids}-kw-hint`} className="-mt-1 text-xs text-muted-foreground">
              {msg().rule.hint}
            </p>

            {applicable > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={applyToPending} onCheckedChange={(v) => setApplyToPending(v === true)} />
                <span>
                  {msg().rule.applyBefore} <span className="num font-medium">{applicable}</span> {msg().rule.applyAfter}
                </span>
              </label>
            )}

            {applyToPending && (
              <div aria-live="polite" className="flex flex-col gap-2">
                {conflicts > 0 && previewFresh && (
                  <p role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-card px-3 py-2 text-sm">
                    <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warning" />
                    <span>
                      {msg().rule.conflicts(conflicts, category?.name ?? "")}
                    </span>
                  </p>
                )}
                <div className="overflow-hidden rounded-lg border bg-card">
                  <p className="flex items-center justify-between border-b bg-surface-subtle px-3 py-1.5 text-xs font-medium text-muted-foreground">
                    <span>{msg().rule.previewTitle}</span>
                    {preview.fetching && <Loader2 aria-label={msg().rule.previewUpdating} className="size-3.5 animate-spin" />}
                  </p>
                  {items.length === 0 ? (
                    <p className="px-3 py-3 text-[13px] text-muted-foreground">
                      {msg().rule.previewEmpty(keyword.trim().toUpperCase())}
                    </p>
                  ) : (
                    <ul aria-label={msg().rule.affected} className="max-h-56 divide-y overflow-y-auto">
                      {items.map((item) => (
                        <PreviewRow key={item.transaction.id} item={item} target={category} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
          </form>
        </div>
      </div>
    </section>
  );
}
