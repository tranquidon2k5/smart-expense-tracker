"use client";

import { CalendarRange, ChevronDown, Loader2, Plus, ReceiptText, SearchX, Trash2, Wallet as WalletIcon, X, Shapes } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { Category, Wallet } from "@/types";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { useQuickAdd } from "@/components/quick-add/quick-add-provider";
import { useServiceQuery } from "@/hooks/use-service-query";
import { dashboardService, transactionService } from "@/services";
import { cn } from "@/lib/utils";
import { FilterBar } from "./filter-bar";
import { PendingReview } from "./pending-review";
import { TransactionSheet } from "./transaction-sheet";
import { TransactionsTable } from "./transactions-table";
import { activeFilterCount, useTransactionFilters } from "./use-transaction-filters";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { transactionsMessages } from "@/i18n/messages/transactions";
import { te } from "@/i18n/errors";

const msg = () => getMessages(transactionsMessages);

type TabKey = "tat-ca" | "cho-duyet";
const EMPTY_CATEGORIES: Category[] = [];
const EMPTY_WALLETS: Wallet[] = [];

function TableSkeleton() {
  return (
    <div aria-hidden>
      <div className="flex h-10 items-center gap-4 border-b bg-surface-subtle px-5">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-24" />
      </div>
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="flex h-11 items-center gap-4 border-b px-5">
          <Skeleton className="size-4 rounded" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-24 max-md:hidden" />
          <Skeleton className="h-4 w-24 max-lg:hidden" />
          <Skeleton className="h-4 w-24" />
        </div>
      ))}
    </div>
  );
}

function BulkBar({
  ids,
  clear,
  categories,
  wallets,
  onDelete,
}: {
  ids: string[];
  clear: () => void;
  categories: Category[];
  wallets: Wallet[];
  onDelete: (ids: string[]) => void;
}) {
  const [busy, setBusy] = React.useState(false);

  const apply = async (patch: { categoryId?: string; walletId?: string }, label: string) => {
    setBusy(true);
    try {
      const { updated, skipped } = await transactionService.bulkUpdateTransactions(ids, patch);
      toast.success(msg().bulk.done(label, updated), {
        description: skipped ? msg().bulk.skipped(skipped) : undefined,
      });
      clear();
    } catch (e) {
      toast.error(e instanceof Error ? te(e.message) : msg().bulk.failed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="region"
      aria-label={msg().bulk.region}
      className="flex flex-wrap items-center gap-2 border-b bg-accent px-4 py-2 md:px-5"
    >
      <p className="mr-2 text-sm font-medium text-accent-foreground" aria-live="polite">
        {msg().bulk.selected} <span className="num">{ids.length}</span> {msg().bulk.transactions}
      </p>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy} className="bg-card">
            <Shapes aria-hidden /> {msg().bulk.changeCategory} <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[min(420px,70svh)] w-56 overflow-y-auto">
          {(["expense", "income"] as const).map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{t === "expense" ? msg().expenseGroup : msg().incomeGroup}</DropdownMenuLabel>
              {categories
                .filter((c) => c.type === t)
                .map((c) => (
                  <DropdownMenuItem key={c.id} onSelect={() => apply({ categoryId: c.id }, msg().bulk.movedTo(c.name))}>
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </DropdownMenuItem>
                ))}
            </React.Fragment>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" disabled={busy} className="bg-card">
            <WalletIcon aria-hidden /> {msg().bulk.changeWallet} <ChevronDown aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {wallets.map((w) => (
            <DropdownMenuItem key={w.id} onSelect={() => apply({ walletId: w.id }, msg().bulk.movedToWallet(w.name))}>
              {w.name}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() => onDelete(ids)}
        className="bg-card text-danger hover:bg-expense-soft hover:text-danger"
      >
        <Trash2 aria-hidden /> {msg().bulk.delete}
      </Button>
      {busy && <Loader2 aria-label={msg().bulk.updating} className="size-4 animate-spin text-muted-foreground" />}
      <Button variant="ghost" size="sm" onClick={clear} disabled={busy} className="ml-auto text-muted-foreground">
        <X aria-hidden /> {msg().bulk.clear}
      </Button>
    </div>
  );
}

export function TransactionsPage() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { openQuickAdd } = useQuickAdd();
  const today = transactionService.getToday();

  const tab: TabKey = searchParams.get("trang-thai") === "cho-duyet" ? "cho-duyet" : "tat-ca";
  const openId = searchParams.get("id");
  const [dense, setDense] = React.useState(false);
  const [deleteIds, setDeleteIds] = React.useState<string[] | null>(null);
  const [deleting, setDeleting] = React.useState(false);

  const { state, update, reset, filter, filterKey } = useTransactionFilters(
    today,
    searchParams.get("danh-muc"),
    searchParams.get("vi"),
  );
  const list = useServiceQuery(() => transactionService.listTransactions(filter), filterKey);
  const categories = useServiceQuery(() => transactionService.listCategories()).data ?? EMPTY_CATEGORIES;
  const wallets = useServiceQuery(() => transactionService.listWallets()).data ?? EMPTY_WALLETS;
  const pendingCount = useServiceQuery(() => dashboardService.getPendingCount()).data;

  /** Đồng bộ tab / giao dịch đang mở lên URL (giữ được khi tải lại, chia sẻ link, nút Back) */
  const setParams = React.useCallback(
    (patch: Record<string, string | null>, mode: "push" | "replace" = "replace") => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([k, v]) => (v === null ? params.delete(k) : params.set(k, v)));
      const qs = params.toString();
      router[mode](`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const openTransaction = React.useCallback((id: string) => setParams({ id }, "push"), [setParams]);
  const closeTransaction = React.useCallback(() => setParams({ id: null }), [setParams]);

  const confirmDelete = async () => {
    if (!deleteIds) return;
    setDeleting(true);
    try {
      const { removed, xpRemoved } = await transactionService.deleteTransactions(deleteIds);
      toast.success(msg().bulk.deleted(removed), {
        description: xpRemoved ? msg().bulk.xpRemoved(xpRemoved) : undefined,
      });
      if (openId && deleteIds.includes(openId)) closeTransaction();
      setDeleteIds(null);
    } catch (e) {
      toast.error(e instanceof Error ? te(e.message) : msg().bulk.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  const data = list.data ?? [];
  const filtersActive = activeFilterCount(state) > 0;

  let body: React.ReactNode;
  if (list.error && !list.data) {
    body = <ErrorState title={msg().loadFailed} error={list.error} onRetry={list.refetch} className="min-h-[420px]" />;
  } else if (list.loading) {
    body = <TableSkeleton />;
  } else if (data.length === 0) {
    body = filtersActive ? (
      <EmptyState
        icon={SearchX}
        className="min-h-[420px]"
        title={msg().emptyFilteredTitle}
        description={msg().emptyFilteredText}
        action={
          <Button variant="outline" onClick={reset}>
            {msg().filters.reset}
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={ReceiptText}
        className="min-h-[420px]"
        title={msg().emptyTitle}
        description={msg().emptyText}
        action={
          <div className="flex flex-wrap justify-center gap-2">
            <Button onClick={openQuickAdd}>
              <Plus aria-hidden /> {msg().add}
            </Button>
            <Button variant="outline" onClick={() => update({ period: "tat-ca" })}>
              <CalendarRange aria-hidden /> {msg().viewAllTime}
            </Button>
          </div>
        }
      />
    );
  } else {
    body = (
      <TransactionsTable
        data={data}
        dense={dense}
        onDenseChange={setDense}
        onOpen={openTransaction}
        onDelete={setDeleteIds}
        activeId={openId}
        renderBulkBar={(ids, clear) => (
          <BulkBar
            ids={ids}
            clear={clear}
            categories={categories}
            wallets={wallets}
            onDelete={(x) => {
              setDeleteIds(x);
              clear();
            }}
          />
        )}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-[1600px] flex-col gap-5 px-4 py-6 md:px-6 xl:px-8 xl:py-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl leading-8 font-bold">{msg().title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{msg().subtitle}</p>
        </div>
        <Button onClick={openQuickAdd} className="max-md:h-11">
          <Plus aria-hidden /> {msg().add}
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setParams({ "trang-thai": v === "cho-duyet" ? "cho-duyet" : null })}>
        <TabsList variant="line" className="h-10 gap-4 border-b p-0 w-full justify-start rounded-none">
          <TabsTrigger
            value="tat-ca"
            className="flex-none px-1 text-muted-foreground after:bg-primary data-active:text-primary"
          >
            {msg().tabAll}
          </TabsTrigger>
          <TabsTrigger
            value="cho-duyet"
            className="flex-none gap-2 px-1 text-muted-foreground after:bg-primary data-active:text-primary"
          >
            {msg().tabPending}
            {!!pendingCount && (
              <span className="num inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-info px-1.5 text-xs font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tat-ca" className="mt-4 flex flex-col gap-4">
          <FilterBar
            state={state}
            update={update}
            reset={reset}
            wallets={wallets}
            categories={categories}
            today={today}
          />
          {list.error && list.data && (
            <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-danger/30 bg-expense-soft px-4 py-2.5 text-sm">
              <span>{msg().refreshFailed} {te(list.error.message)}</span>
              <Button variant="outline" size="sm" onClick={list.refetch} className="bg-card">
                {getMessages(commonMessages).retry}
              </Button>
            </div>
          )}
          <section
            aria-label={msg().tableRegion}
            aria-busy={list.fetching}
            className="relative overflow-clip rounded-xl border bg-card"
          >
            {/* Vạch tiến trình mảnh khi đang lọc lại — giữ dữ liệu cũ, không nháy skeleton */}
            <div
              aria-hidden
              className={cn(
                "absolute inset-x-0 top-0 z-20 h-0.5 origin-left bg-primary transition-opacity duration-200",
                list.fetching && list.data ? "animate-pulse opacity-100" : "opacity-0",
              )}
            />
            {body}
          </section>
        </TabsContent>

        <TabsContent value="cho-duyet" className="mt-4">
          <section aria-label={msg().pendingRegion} className="overflow-clip rounded-xl border bg-card">
            <PendingReview categories={categories} onOpen={openTransaction} />
          </section>
        </TabsContent>
      </Tabs>

      <TransactionSheet
        transactionId={openId}
        onClose={closeTransaction}
        categories={categories}
        wallets={wallets}
        today={today}
      />

      <AlertDialog open={!!deleteIds} onOpenChange={(o) => !o && !deleting && setDeleteIds(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <span className="num">{msg().bulk.confirmTitle(deleteIds?.length ?? 0)}</span>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {msg().bulk.confirmText}
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
              {msg().bulk.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
