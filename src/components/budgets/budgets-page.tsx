"use client";

import { Check, CircleAlert, CircleCheck, Loader2, PencilLine, PiggyBank, Plus, Trash2, TriangleAlert, X } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { BudgetOverview, BudgetRow } from "@/types";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { AmountInput } from "@/components/amount-input";
import { CategoryChip, CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Money } from "@/components/money";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { budgetService, transactionService } from "@/services";
import { budgetStatus } from "@/lib/budget-status";
import { formatDate, formatMoney, formatMonthLong, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { budgetsMessages } from "@/i18n/messages/budgets";
import { te } from "@/i18n/errors";

const msg = () => getMessages(budgetsMessages);

/** Thanh tiến độ + chữ, có role progressbar */
function BudgetBar({ row }: { row: BudgetRow }) {
  const status = budgetStatus(row.ratio);
  const pct = row.ratio * 100;
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={msg().usage(row.category.name)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
        aria-valuetext={msg().valueText(formatMoney(row.spent), formatMoney(row.budget.limitAmount), formatPercent(pct))}
        className="relative h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-300", status.barClass)} style={{ width: `${Math.min(100, pct)}%` }} />
        {/* Vạch mốc 80% */}
        <span aria-hidden className="absolute inset-y-0 left-[80%] w-px bg-card" />
      </div>
      <p className="num text-xs text-muted-foreground">
        {formatMoney(row.spent)} / {formatMoney(row.budget.limitAmount)}
      </p>
    </div>
  );
}

function StatusCell({ row }: { row: BudgetRow }) {
  const status = budgetStatus(row.ratio);
  const remaining = row.budget.limitAmount - row.spent;
  return (
    <div className={cn("flex items-start gap-1.5 text-[13px]", status.textClass)}>
      <status.icon aria-hidden className="mt-px size-4 shrink-0" />
      <span className="flex flex-col">
        <span className="font-medium">
          {status.label} · <span className="num">{formatPercent(row.ratio * 100)}</span>
        </span>
        <span className="num text-xs text-muted-foreground">
          {remaining >= 0 ? msg().left(formatMoney(remaining)) : msg().over(formatMoney(-remaining))}
        </span>
      </span>
    </div>
  );
}

/** Sửa hạn mức ngay trên dòng: Enter lưu, Esc huỷ */
function InlineLimit({ row }: { row: BudgetRow }) {
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState<number | undefined>(row.budget.limitAmount);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const editBtn = React.useRef<HTMLButtonElement>(null);
  const errorId = React.useId();

  const close = () => {
    setEditing(false);
    setError(null);
    requestAnimationFrame(() => editBtn.current?.focus());
  };

  const save = async () => {
    if (!value || value <= 0) return setError(msg().limitPositive(formatMoney(0)));
    if (value === row.budget.limitAmount) return close();
    setSaving(true);
    try {
      await budgetService.setBudget(row.category.id, value);
      toast.success(msg().changed(row.category.name, formatMoney(value)));
      close();
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : msg().saveFailed);
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Money amount={row.budget.limitAmount} className="font-medium" />
        <Button
          ref={editBtn}
          variant="ghost"
          size="icon-sm"
          aria-label={msg().editFor(row.category.name)}
          title={msg().edit}
          onClick={() => {
            setValue(row.budget.limitAmount);
            setEditing(true);
          }}
          className="text-muted-foreground max-md:size-11"
        >
          <PencilLine aria-hidden />
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
      className="flex flex-col items-end gap-1"
    >
      <div className="flex items-center gap-1">
        <div className="w-36">
          <AmountInput
            autoFocus
            value={value}
            onChange={setValue}
            aria-label={msg().newLimitFor(row.category.name)}
            aria-invalid={!!error || undefined}
            aria-describedby={error ? errorId : undefined}
            disabled={saving}
          />
        </div>
        <Button type="submit" size="icon-sm" aria-label={msg().saveLimitKey} disabled={saving} className="max-md:size-11">
          {saving ? <Loader2 aria-hidden className="animate-spin" /> : <Check aria-hidden />}
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label={msg().cancelKey} onClick={close} disabled={saving} className="max-md:size-11">
          <X aria-hidden />
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

/** Dòng thêm hạn mức cho danh mục chưa có */
function AddBudgetForm({
  overview,
  categoryId,
  onCategoryChange,
  onDone,
}: {
  overview: BudgetOverview;
  categoryId: string | undefined;
  onCategoryChange: (id: string) => void;
  onDone: () => void;
}) {
  const ids = React.useId();
  const [amount, setAmount] = React.useState<number | undefined>();
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const selected = overview.unbudgeted.find((u) => u.category.id === categoryId);

  const save = async () => {
    if (!categoryId) return setError(msg().pickCategory);
    if (!amount || amount <= 0) return setError(msg().amountPositive(formatMoney(0)));
    setError(null);
    setSaving(true);
    try {
      await budgetService.setBudget(categoryId, amount);
      toast.success(msg().set(selected?.category.name ?? "", formatMoney(amount)));
      setAmount(undefined);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : msg().saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          onDone();
        }
      }}
      className="flex flex-col gap-3 border-t bg-surface-subtle px-4 py-4 md:px-5"
      aria-label={msg().newLimit}
    >
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-56">
          <label htmlFor={`${ids}-cat`} className="mb-1.5 block text-[13px] font-medium">
            {msg().category}
          </label>
          <Select value={categoryId} onValueChange={onCategoryChange}>
            <SelectTrigger id={`${ids}-cat`} className="w-full bg-card">
              <SelectValue placeholder={msg().pickExpenseCategory} />
            </SelectTrigger>
            <SelectContent>
              {overview.unbudgeted.map(({ category }) => (
                <SelectItem key={category.id} value={category.id}>
                  <CategoryChip name={category.name} color={category.color} className="text-sm" />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <label htmlFor={`${ids}-amt`} className="mb-1.5 block text-[13px] font-medium">
            {msg().monthlyLimit}
          </label>
          <AmountInput id={`${ids}-amt`} autoFocus={!!categoryId} value={amount} onChange={setAmount} className="bg-card" />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onDone} disabled={saving} className="max-md:h-11">
            {getMessages(commonMessages).cancel}
          </Button>
          <Button type="submit" disabled={saving} aria-busy={saving} className="max-md:h-11">
            {saving && <Loader2 aria-hidden className="animate-spin" />}
            {msg().saveLimit}
          </Button>
        </div>
      </div>
      {selected && (
        <p className="text-[13px] text-muted-foreground">
          {selected.avgSpendLast3Months > 0 ? (
            <>
              {msg().hintBefore}{" "}
              <button
                type="button"
                className="num font-medium text-primary underline-offset-4 hover:underline"
                onClick={() => setAmount(selected.avgSpendLast3Months)}
              >
                {formatMoney(selected.avgSpendLast3Months)}
              </button>
              {msg().hintFor(selected.category.name)}
              {selected.spent > 0 && (
                <>
                  {msg().hintSpent} <span className="num">{formatMoney(selected.spent)}</span>
                </>
              )}
              .
            </>
          ) : (
            msg().noHistory
          )}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </form>
  );
}

function Summary({ overview, today }: { overview: BudgetOverview; today: string }) {
  const ratio = overview.totalLimit ? overview.totalSpent / overview.totalLimit : 0;
  const status = budgetStatus(ratio);
  const over = overview.rows.filter((r) => r.ratio > 1).length;
  const warn = overview.rows.filter((r) => r.ratio >= 0.8 && r.ratio <= 1).length;
  const remaining = overview.totalLimit - overview.totalSpent;
  return (
    <section aria-label={msg().overviewLabel} className="grid gap-4 rounded-xl border bg-card p-4 md:grid-cols-[repeat(3,minmax(0,1fr))_minmax(0,1.4fr)] md:p-5">
      <div>
        <p className="text-[13px] text-muted-foreground">{msg().totalLimit}</p>
        <Money amount={overview.totalLimit} className="mt-1 block text-2xl leading-8 font-semibold" />
      </div>
      <div>
        <p className="text-[13px] text-muted-foreground">{msg().spent}</p>
        <Money amount={overview.totalSpent} className="mt-1 block text-2xl leading-8 font-semibold" />
        <p className="mt-0.5 text-xs text-muted-foreground">
          {msg().upTo} <span className="num">{formatDate(today)}</span>
        </p>
      </div>
      <div>
        <p className="text-[13px] text-muted-foreground">{remaining >= 0 ? msg().remaining : msg().overTotal}</p>
        <Money amount={Math.abs(remaining)} className={cn("mt-1 block text-2xl leading-8 font-semibold", remaining < 0 && "text-danger")} />
      </div>
      <div className="flex flex-col justify-center gap-2">
        <div
          role="progressbar"
          aria-label={msg().totalUsage}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          className="h-2.5 overflow-hidden rounded-full bg-muted"
        >
          <div className={cn("h-full rounded-full", status.barClass)} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
        <p className="flex flex-wrap gap-x-3 gap-y-1 text-[13px]">
          <span className="text-muted-foreground">
            {msg().used} <span className="num">{formatPercent(ratio * 100)}</span>
          </span>
          {over > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-danger">
              <CircleAlert aria-hidden className="size-4" />
              <span className="num">{over}</span> {msg().overCount}
            </span>
          )}
          {warn > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-warning">
              <TriangleAlert aria-hidden className="size-4" />
              <span className="num">{warn}</span> {msg().nearCount}
            </span>
          )}
          {over === 0 && warn === 0 && overview.rows.length > 0 && (
            <span className="inline-flex items-center gap-1 text-muted-foreground">
              <CircleCheck aria-hidden className="size-4 text-primary" />
              {msg().allOk}
            </span>
          )}
        </p>
      </div>
    </section>
  );
}

export function BudgetsPage() {
  const today = transactionService.getToday();
  const month = budgetService.getBudgetMonth();
  const query = useServiceQuery(() => budgetService.getBudgetOverview());
  const [adding, setAdding] = React.useState(false);
  const [addCategoryId, setAddCategoryId] = React.useState<string>();
  const [deleteRow, setDeleteRow] = React.useState<BudgetRow | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const addButtonRef = React.useRef<HTMLButtonElement>(null);
  const data = query.data;

  const startAdd = (categoryId?: string) => {
    setAddCategoryId(categoryId);
    setAdding(true);
  };
  const stopAdd = () => {
    setAdding(false);
    setAddCategoryId(undefined);
    requestAnimationFrame(() => addButtonRef.current?.focus());
  };

  const confirmDelete = async () => {
    if (!deleteRow) return;
    setDeleting(true);
    try {
      await budgetService.deleteBudget(deleteRow.budget.id);
      toast.success(msg().removed(deleteRow.category.name));
      setDeleteRow(null);
    } catch (e) {
      toast.error(e instanceof Error ? te(e.message) : msg().removeFailed);
    } finally {
      setDeleting(false);
    }
  };

  const canAdd = !!data && data.unbudgeted.length > 0;

  return (
    <PageContainer>
      <PageHeader
        title={msg().title(formatMonthLong(month))}
        description={
          <>
            {msg().introBefore} <span className="num">80%</span> {msg().introMiddle}{" "}
            <span className="num">100%</span>.
          </>
        }
        actions={
          canAdd && (
            <Button ref={addButtonRef} onClick={() => startAdd()} disabled={adding} className="max-md:h-11">
              <Plus aria-hidden /> {msg().add}
            </Button>
          )
        }
      />

      {query.error && !data ? (
        <section className="rounded-xl border bg-card">
          <ErrorState title={msg().loadFailed} error={query.error} onRetry={query.refetch} className="min-h-[360px]" />
        </section>
      ) : query.loading || !data ? (
        <div aria-hidden className="flex flex-col gap-5">
          <Skeleton className="h-[108px] w-full rounded-xl" />
          <div className="rounded-xl border bg-card">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-6 border-b px-5 py-4 last:border-0">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-2 flex-1" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {data.rows.length > 0 && <Summary overview={data} today={today} />}

          <Panel
            title={msg().byCategory}
            description={data.rows.length ? msg().byCategoryHint : undefined}
            className="p-0 md:p-0 [&>header]:px-4 [&>header]:pt-4 md:[&>header]:px-5 md:[&>header]:pt-5"
          >
            {data.rows.length === 0 && !adding ? (
              <EmptyState
                icon={PiggyBank}
                className="min-h-[300px]"
                title={msg().emptyTitle}
                description={msg().emptyText}
                action={
                  canAdd && (
                    <Button onClick={() => startAdd()}>
                      <Plus aria-hidden /> {msg().addFirst}
                    </Button>
                  )
                }
              />
            ) : (
              <>
                {data.rows.length > 0 && (
                  <ul aria-label={msg().byCategory} className={cn("border-t", query.fetching && "opacity-80")}>
                    {data.rows.map((row) => (
                      <li
                        key={row.budget.id}
                        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b px-4 py-3.5 transition-colors duration-150 last:border-0 hover:bg-row-hover md:px-5 xl:grid-cols-[auto_180px_minmax(0,1fr)_220px_200px_auto]"
                      >
                        <CategoryIcon icon={row.category.icon} color={row.category.color} />
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-medium">{row.category.name}</p>
                          {row.avgSpendLast3Months > 0 && (
                            <p className="num text-xs text-muted-foreground">
                              {msg().avg3(formatMoney(row.avgSpendLast3Months))}
                            </p>
                          )}
                        </div>
                        <div className="col-span-3 xl:col-span-1 max-xl:order-last">
                          <BudgetBar row={row} />
                        </div>
                        <div className="max-xl:hidden">
                          <StatusCell row={row} />
                        </div>
                        <InlineLimit row={row} />
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={msg().removeFor(row.category.name)}
                          title={msg().remove}
                          onClick={() => setDeleteRow(row)}
                          className="text-muted-foreground hover:bg-expense-soft hover:text-danger max-md:size-11"
                        >
                          <Trash2 aria-hidden />
                        </Button>
                        <div className="col-span-3 -mt-1 xl:hidden">
                          <StatusCell row={row} />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {adding && (
                  <AddBudgetForm overview={data} categoryId={addCategoryId} onCategoryChange={setAddCategoryId} onDone={stopAdd} />
                )}
              </>
            )}
          </Panel>

          {data.unbudgeted.length > 0 && (
            <Panel title={msg().unbudgeted} description={msg().unbudgetedHint}>
              <ul className="flex flex-wrap gap-2">
                {data.unbudgeted.map((u) => (
                  <li key={u.category.id}>
                    <button
                      type="button"
                      onClick={() => startAdd(u.category.id)}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3 text-sm transition-colors duration-150 hover:border-primary/40 hover:bg-accent max-md:h-11"
                    >
                      <CategoryIcon icon={u.category.icon} color={u.category.color} size="sm" />
                      <span>{u.category.name}</span>
                      {u.spent > 0 && (
                        <span className="num text-xs text-muted-foreground">{msg().spentSoFar(formatMoney(u.spent))}</span>
                      )}
                      <Plus aria-label={msg().add} className="size-4 text-primary" />
                    </button>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </>
      )}

      <AlertDialog open={!!deleteRow} onOpenChange={(o) => !o && !deleting && setDeleteRow(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{msg().confirmTitle(deleteRow?.category.name ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>
              {msg().confirmText}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{msg().keep}</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={(e) => {
                e.preventDefault();
                confirmDelete();
              }}
            >
              {deleting && <Loader2 aria-hidden className="animate-spin" />}
              {msg().remove}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageContainer>
  );
}
