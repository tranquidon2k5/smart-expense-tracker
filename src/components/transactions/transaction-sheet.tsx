"use client";

import { ArrowDownLeft, ArrowUpRight, Check, CircleAlert, Loader2, Sparkles, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Category, RuleSuggestion, TransactionPatch, TransactionType, TransactionView, Wallet } from "@/types";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { CategoryChip } from "@/components/category-icon";
import { DatePicker } from "@/components/date-picker";
import { ErrorState } from "@/components/error-state";
import { Money } from "@/components/money";
import { useMediaQuery } from "@/hooks/use-media-query";
import { useServiceQuery } from "@/hooks/use-service-query";
import { transactionService } from "@/services";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { XP_LIMIT_NOTE, xpSuffix } from "@/lib/xp";
import { RuleSuggestionPrompt } from "./rule-suggestion";
import { getActiveLocale, INTL_LOCALE } from "@/i18n/core";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { transactionsMessages } from "@/i18n/messages/transactions";
import { te } from "@/i18n/errors";

const msg = () => getMessages(transactionsMessages);

/** Dấu phân cách nghìn theo ngôn ngữ giao diện */
const vnd = { format: (n: number) => new Intl.NumberFormat(INTL_LOCALE[getActiveLocale()]).format(n) };

type Draft = Required<TransactionPatch>;

function toDraft(t: TransactionView): Draft {
  return {
    amount: t.amount,
    type: t.type,
    categoryId: t.categoryId,
    walletId: t.walletId,
    date: t.date,
    description: t.description,
  };
}

function diff(t: TransactionView, d: Draft): TransactionPatch {
  const patch: TransactionPatch = {};
  (Object.keys(d) as (keyof Draft)[]).forEach((k) => {
    if (d[k] !== t[k]) (patch as Record<string, unknown>)[k] = d[k];
  });
  return patch;
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-medium">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Nội dung panel cho một giao dịch đã tải; `key` theo id để khởi tạo lại bản nháp */
function TransactionEditor({
  tx,
  categories,
  wallets,
  today,
  onDeleted,
}: {
  tx: TransactionView;
  categories: Category[];
  wallets: Wallet[];
  today: string;
  onDeleted: () => void;
}) {
  const ids = React.useId();
  const [draft, setDraft] = React.useState<Draft>(() => toDraft(tx));
  const [saving, setSaving] = React.useState<"save" | "review" | "delete" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [suggestion, setSuggestion] = React.useState<RuleSuggestion | null>(null);

  const patch = diff(tx, draft);
  const dirty = Object.keys(patch).length > 0;
  const pending = tx.status === "pending";
  const typeCategories = categories.filter((c) => c.type === draft.type);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const setType = (type: TransactionType) => {
    if (type === draft.type) return;
    setDraft((d) => ({ ...d, type, categoryId: type === "income" ? "c-income-other" : "c-other" }));
  };

  const validate = () => {
    if (!draft.amount || draft.amount <= 0) return msg().sheet.amountRequired(formatMoney(0));
    if (!draft.description.trim()) return msg().sheet.descriptionRequired;
    return null;
  };

  const save = async () => {
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setSaving("save");
    try {
      const result = await transactionService.updateTransaction(tx.id, patch);
      toast.success(msg().sheet.saved);
      setSuggestion(result.ruleSuggestion);
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : msg().sheet.saveFailed);
    } finally {
      setSaving(null);
    }
  };

  /** Duyệt: lưu các thay đổi khác (nếu có) rồi xác nhận, kèm danh mục người dùng chọn */
  const review = async () => {
    const v = validate();
    if (v) return setError(v);
    setError(null);
    setSaving("review");
    try {
      const { categoryId, ...rest } = patch;
      if (Object.keys(rest).length) await transactionService.updateTransaction(tx.id, rest);
      const result = await transactionService.reviewTransaction(tx.id, categoryId);
      toast.success(`${msg().sheet.reviewed}${xpSuffix(result)}`, {
        description: result.xpLimitReached
          ? XP_LIMIT_NOTE.review
          : result.remainingPending
            ? msg().sheet.remaining(result.remainingPending)
            : msg().sheet.allReviewed,
      });
      setSuggestion(result.ruleSuggestion);
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : msg().sheet.reviewFailed);
    } finally {
      setSaving(null);
    }
  };

  const remove = async () => {
    setSaving("delete");
    try {
      const { xpRemoved } = await transactionService.deleteTransactions([tx.id]);
      toast.success(msg().sheet.deleted, {
        description: `${tx.description} · ${formatMoney(tx.amount)}${xpRemoved ? msg().sheet.xpRemoved(xpRemoved) : ""}`,
      });
      setConfirmDelete(false);
      onDeleted();
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : msg().sheet.deleteFailed);
      setSaving(null);
    }
  };

  return (
    <>
      <SheetHeader className="gap-1 border-b px-5 pt-5 pb-4">
        <SheetTitle className="pr-8 text-lg leading-6">{tx.description}</SheetTitle>
        <SheetDescription asChild>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
            <Money amount={tx.amount} type={tx.type} withIcon className="text-[15px] font-semibold" />
            <span aria-hidden>·</span>
            <span className="num">{formatDate(tx.date)}</span>
            <span aria-hidden>·</span>
            <span>{tx.wallet.name}</span>
          </div>
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {pending && (
          <div className="mb-4 flex items-start gap-3 rounded-xl bg-accent p-3.5 text-sm">
            <Sparkles aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
            <p>
              {msg().sheet.aiNoteBefore} <strong className="font-semibold">{tx.category.name}</strong> {msg().sheet.aiNoteMiddle}
              <span className="num">{formatPercent((tx.aiConfidence ?? 0) * 100)}</span>
              {msg().sheet.aiNoteAfter} <strong>{msg().sheet.approve}</strong>.
            </p>
          </div>
        )}

        {suggestion && (
          <RuleSuggestionPrompt
            className="mb-4"
            suggestion={suggestion}
            categories={categories}
            onDone={() => setSuggestion(null)}
          />
        )}

        <form
          id={`${ids}-form`}
          onSubmit={(e) => {
            e.preventDefault();
            if (dirty) save();
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex items-end gap-3">
            <div className="min-w-0 flex-1">
              <Field label={msg().sheet.amount} htmlFor={`${ids}-amount`}>
                <div className="relative">
                  <Input
                    id={`${ids}-amount`}
                    inputMode="numeric"
                    autoComplete="off"
                    value={draft.amount ? vnd.format(draft.amount) : ""}
                    onChange={(e) => {
                      const digits = e.target.value.replace(/\D/g, "");
                      set("amount", digits ? Number(digits) : 0);
                    }}
                    aria-invalid={!draft.amount || undefined}
                    className={cn(
                      "num pr-8 text-right text-lg font-semibold md:text-lg",
                      draft.type === "income" ? "text-income" : "text-expense",
                    )}
                  />
                  <span aria-hidden className="num pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
                    {getMessages(commonMessages).currencySuffix}
                  </span>
                </div>
              </Field>
            </div>
            <div role="radiogroup" aria-label={msg().sheet.type} className="flex shrink-0 rounded-lg border p-0.5">
              {(["expense", "income"] as const).map((t) => {
                const active = draft.type === t;
                const Icon = t === "income" ? ArrowDownLeft : ArrowUpRight;
                return (
                  <button
                    key={t}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setType(t)}
                    className={cn(
                      "inline-flex h-9 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors duration-150 max-md:h-10",
                      active
                        ? t === "income"
                          ? "bg-income-soft text-income"
                          : "bg-expense-soft text-expense"
                        : "text-muted-foreground hover:bg-row-hover",
                    )}
                  >
                    <Icon aria-hidden className="size-4" />
                    {t === "income" ? getMessages(commonMessages).income : getMessages(commonMessages).expense}
                  </button>
                );
              })}
            </div>
          </div>

          <Field label={msg().sheet.category} htmlFor={`${ids}-cat`}>
            <Select value={draft.categoryId} onValueChange={(v) => set("categoryId", v)}>
              <SelectTrigger id={`${ids}-cat`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {typeCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    <CategoryChip name={c.name} color={c.color} className="text-sm" />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label={msg().sheet.date} htmlFor={`${ids}-date`}>
              <DatePicker id={`${ids}-date`} value={draft.date} onChange={(v) => set("date", v)} max={today} />
            </Field>
            <Field label={msg().sheet.wallet} htmlFor={`${ids}-wallet`}>
              <Select value={draft.walletId} onValueChange={(v) => set("walletId", v)}>
                <SelectTrigger id={`${ids}-wallet`} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {wallets.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label={msg().sheet.description} htmlFor={`${ids}-desc`}>
            <Input
              id={`${ids}-desc`}
              value={draft.description}
              onChange={(e) => set("description", e.target.value)}
              aria-invalid={!draft.description.trim() || undefined}
            />
          </Field>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {error}
            </p>
          )}
        </form>

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t pt-4 text-[13px]">
          <dt className="text-muted-foreground">{msg().sheet.source}</dt>
          <dd>{msg().sheet.sources[tx.source]}</dd>
          {tx.aiConfidence != null && (
            <>
              <dt className="text-muted-foreground">{msg().sheet.confidence}</dt>
              <dd className="num">{formatPercent(tx.aiConfidence * 100)}</dd>
            </>
          )}
          <dt className="text-muted-foreground">{msg().sheet.status}</dt>
          <dd>{pending ? msg().sheet.pending : msg().sheet.confirmed}</dd>
        </dl>
      </div>

      <div className="flex items-center gap-2 border-t bg-card px-5 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setConfirmDelete(true)}
          disabled={!!saving}
          className="text-danger hover:bg-expense-soft hover:text-danger max-md:h-11"
        >
          <Trash2 aria-hidden /> {msg().sheet.delete}
        </Button>
        <div className="ml-auto flex gap-2">
          {dirty && (
            <Button type="button" variant="ghost" onClick={() => setDraft(toDraft(tx))} disabled={!!saving} className="max-md:h-11">
              {msg().sheet.undo}
            </Button>
          )}
          {pending ? (
            <Button type="button" onClick={review} disabled={!!saving} aria-busy={saving === "review"} className="max-md:h-11">
              {saving === "review" ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
              {msg().sheet.approve}
            </Button>
          ) : (
            <Button
              type="submit"
              form={`${ids}-form`}
              disabled={!dirty || !!saving}
              aria-busy={saving === "save"}
              className="max-md:h-11"
            >
              {saving === "save" && <Loader2 aria-hidden className="animate-spin" />}
              {msg().sheet.saveChanges}
            </Button>
          )}
        </div>
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={(o) => saving !== "delete" && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{msg().sheet.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {msg().sheet.confirmText(tx.description, formatMoney(tx.amount), formatDate(tx.date), tx.wallet.name)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving === "delete"}>{msg().keep}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={(e) => {
                e.preventDefault();
                remove();
              }}
              disabled={saving === "delete"}
            >
              {saving === "delete" && <Loader2 aria-hidden className="animate-spin" />}
              {msg().sheet.confirmDelete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Panel trượt: phải 420px trên desktop, bottom sheet trên mobile (MASTER.md › Dialog/Sheet) */
export function TransactionSheet({
  transactionId,
  onClose,
  categories,
  wallets,
  today,
}: {
  transactionId: string | null;
  onClose: () => void;
  categories: Category[];
  wallets: Wallet[];
  today: string;
}) {
  const isDesktop = useMediaQuery("(min-width: 768px)", true);
  const query = useServiceQuery(
    () => (transactionId ? transactionService.getTransaction(transactionId) : Promise.resolve(null)),
    transactionId ?? "",
  );
  const tx = query.data && query.data.id === transactionId ? query.data : undefined;

  return (
    <Sheet open={!!transactionId} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side={isDesktop ? "right" : "bottom"}
        className={cn(
          "gap-0 p-0",
          isDesktop ? "w-full data-[side=right]:sm:max-w-[420px]" : "max-h-[92svh] rounded-t-2xl",
        )}
      >
        {tx ? (
          <TransactionEditor
            key={tx.id}
            tx={tx}
            categories={categories}
            wallets={wallets}
            today={today}
            onDeleted={onClose}
          />
        ) : query.error ? (
          <>
            <SheetHeader className="sr-only">
              <SheetTitle>{msg().sheet.loadFailed}</SheetTitle>
              <SheetDescription>{msg().sheet.loadFailedText}</SheetDescription>
            </SheetHeader>
            <ErrorState title={msg().sheet.loadFailed} error={query.error} onRetry={query.refetch} />
          </>
        ) : query.data === null && !query.fetching ? (
          <>
            <SheetHeader className="px-5 pt-5">
              <SheetTitle>{msg().sheet.notFound}</SheetTitle>
              <SheetDescription>{msg().sheet.notFoundText}</SheetDescription>
            </SheetHeader>
          </>
        ) : (
          <div aria-hidden className="flex flex-col gap-4 p-5">
            <SheetHeader className="sr-only">
              <SheetTitle>{msg().sheet.loading}</SheetTitle>
              <SheetDescription>{msg().sheet.wait}</SheetDescription>
            </SheetHeader>
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="mt-4 h-11 w-full" />
            <Skeleton className="h-9 w-full" />
            <div className="grid grid-cols-2 gap-3">
              <Skeleton className="h-9" />
              <Skeleton className="h-9" />
            </div>
            <Skeleton className="h-9 w-full" />
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
