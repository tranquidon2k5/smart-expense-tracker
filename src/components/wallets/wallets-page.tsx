"use client";

import { ArrowDownUp, ArrowRight, Banknote, CircleAlert, Landmark, Loader2, ReceiptText, Smartphone, Wallet as WalletIcon } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { toast } from "sonner";
import type { TransferView, WalletSummary, WalletType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AmountInput } from "@/components/amount-input";
import { CategoryChip } from "@/components/category-icon";
import { DatePicker } from "@/components/date-picker";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { Money } from "@/components/money";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { transactionService, walletService } from "@/services";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_META: Record<WalletType, { label: string; icon: typeof Banknote }> = {
  cash: { label: "Tiền mặt", icon: Banknote },
  bank: { label: "Tài khoản ngân hàng", icon: Landmark },
  ewallet: { label: "Ví điện tử", icon: Smartphone },
};

function WalletCard({ wallet, selected, onSelect }: { wallet: WalletSummary; selected: boolean; onSelect: () => void }) {
  const meta = TYPE_META[wallet.type];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={`${wallet.name}, ${meta.label}, số dư ${formatMoney(wallet.balance)}. Xem giao dịch của ví này`}
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-card p-4 text-left transition-colors duration-150 hover:border-primary/40 md:p-5",
        selected && "border-primary ring-1 ring-primary",
      )}
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span aria-hidden className="inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
            <meta.icon className="size-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-semibold">{wallet.name}</span>
            <span className="block text-xs text-muted-foreground">{meta.label}</span>
          </span>
        </span>
        {selected && <span className="text-xs font-medium text-primary">Đang xem</span>}
      </span>
      <Money amount={wallet.balance} className={cn("mt-3 text-2xl leading-8 font-semibold", wallet.balance < 0 && "text-expense")} />
      <span className="mt-2 flex flex-wrap gap-x-3 text-[13px] text-muted-foreground">
        {wallet.monthIncome || wallet.monthExpense ? (
          <>
            <span>Tháng này:</span>
            {wallet.monthIncome > 0 && <Money amount={wallet.monthIncome} type="income" />}
            {wallet.monthExpense > 0 && <Money amount={wallet.monthExpense} type="expense" />}
          </>
        ) : (
          <span>Chưa có thu chi tháng này</span>
        )}
      </span>
    </button>
  );
}

function TransferForm({ wallets, today }: { wallets: WalletSummary[]; today: string }) {
  const ids = React.useId();
  const [fromId, setFromId] = React.useState(wallets.find((w) => w.type === "bank")?.id ?? wallets[0]?.id);
  const [toId, setToId] = React.useState(wallets.find((w) => w.type === "ewallet")?.id ?? wallets[1]?.id);
  const [amount, setAmount] = React.useState<number>();
  const [date, setDate] = React.useState(today);
  const [note, setNote] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const from = wallets.find((w) => w.id === fromId);
  const to = wallets.find((w) => w.id === toId);
  const overBalance = !!from && !!amount && amount > from.balance;

  const swap = () => {
    setFromId(toId);
    setToId(fromId);
  };

  const submit = async () => {
    if (!fromId || !toId) return setError("Chọn ví chuyển và ví nhận.");
    if (fromId === toId) return setError("Ví chuyển và ví nhận phải khác nhau.");
    if (!amount) return setError("Nhập số tiền cần chuyển.");
    setError(null);
    setSaving(true);
    try {
      const t = await walletService.transfer({ fromWalletId: fromId, toWalletId: toId, amount, date, note });
      toast.success(`Đã chuyển ${formatMoney(t.amount)}`, { description: `${t.fromWallet.name} → ${t.toWallet.name}` });
      setAmount(undefined);
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Chưa chuyển được, bạn thử lại nhé.");
    } finally {
      setSaving(false);
    }
  };

  const walletOptions = (exclude?: string) =>
    wallets
      .filter((w) => w.id !== exclude)
      .map((w) => (
        <SelectItem key={w.id} value={w.id}>
          <span className="flex w-full items-center justify-between gap-3">
            {w.name}
            <span className="num text-xs text-muted-foreground">{formatMoney(w.balance)}</span>
          </span>
        </SelectItem>
      ));

  return (
    <Panel title="Chuyển tiền giữa các ví" description="Không tính là khoản thu hay chi.">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        <div className="flex items-end gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div>
              <label htmlFor={`${ids}-from`} className="mb-1.5 block text-[13px] font-medium">
                Từ ví
              </label>
              <Select
                value={fromId}
                onValueChange={(v) => {
                  setFromId(v);
                  if (v === toId) setToId(fromId);
                }}
              >
                <SelectTrigger id={`${ids}-from`} className="w-full">
                  <SelectValue placeholder="Chọn ví" />
                </SelectTrigger>
                <SelectContent>{walletOptions()}</SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor={`${ids}-to`} className="mb-1.5 block text-[13px] font-medium">
                Đến ví
              </label>
              <Select value={toId} onValueChange={setToId}>
                <SelectTrigger id={`${ids}-to`} className="w-full">
                  <SelectValue placeholder="Chọn ví" />
                </SelectTrigger>
                <SelectContent>{walletOptions(fromId)}</SelectContent>
              </Select>
            </div>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={swap}
            aria-label="Đổi chiều chuyển"
            title="Đổi chiều chuyển"
            className="mb-[18px] max-md:size-11"
          >
            <ArrowDownUp aria-hidden />
          </Button>
        </div>

        <div>
          <label htmlFor={`${ids}-amount`} className="mb-1.5 block text-[13px] font-medium">
            Số tiền
          </label>
          <AmountInput
            id={`${ids}-amount`}
            value={amount}
            onChange={setAmount}
            aria-invalid={overBalance || undefined}
            aria-describedby={`${ids}-balance`}
          />
          <p id={`${ids}-balance`} className={cn("mt-1 text-xs", overBalance ? "text-danger" : "text-muted-foreground")}>
            {overBalance && <CircleAlert aria-hidden className="mr-1 inline size-3.5 align-[-2px]" />}
            Số dư {from?.name ?? ""}: <span className="num">{formatMoney(from?.balance ?? 0)}</span>
            {overBalance && " — không đủ để chuyển"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Chọn nhanh số tiền">
            {[200_000, 500_000, 1_000_000, 2_000_000].map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setAmount(v)}
                className="num h-8 rounded-md border px-2.5 text-xs transition-colors duration-150 hover:bg-row-hover max-md:h-10"
              >
                {formatMoney(v)}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={`${ids}-date`} className="mb-1.5 block text-[13px] font-medium">
              Ngày
            </label>
            <DatePicker id={`${ids}-date`} value={date} onChange={setDate} max={today} />
          </div>
          <div>
            <label htmlFor={`${ids}-note`} className="mb-1.5 block text-[13px] font-medium">
              Ghi chú
            </label>
            <Input id={`${ids}-note`} value={note} maxLength={100} onChange={(e) => setNote(e.target.value)} placeholder="Không bắt buộc" />
          </div>
        </div>

        {error && (
          <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
            <CircleAlert aria-hidden className="size-4 shrink-0" />
            {error}
          </p>
        )}

        <Button type="submit" disabled={saving || overBalance} aria-busy={saving} className="max-md:h-11">
          {saving && <Loader2 aria-hidden className="animate-spin" />}
          Chuyển {amount ? <span className="num">{formatMoney(amount)}</span> : "tiền"}
          {from && to && (
            <span className="font-normal opacity-90">
              {" "}
              · {from.name} → {to.name}
            </span>
          )}
        </Button>
      </form>
    </Panel>
  );
}

function TransferHistory({ items }: { items: TransferView[] }) {
  return (
    <Panel title="Lịch sử chuyển tiền">
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa có lần chuyển tiền nào.</p>
      ) : (
        <ul className="-mx-4 flex flex-col md:-mx-5">
          {items.map((t) => (
            <li key={t.id} className="flex items-center gap-3 border-b px-4 py-2.5 last:border-0 md:px-5">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  {t.fromWallet.name}
                  <ArrowRight aria-label="sang" className="size-3.5 text-muted-foreground" />
                  {t.toWallet.name}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  <span className="num">{formatDate(t.date)}</span>
                  {t.note && ` · ${t.note}`}
                </p>
              </div>
              <Money amount={t.amount} className="text-sm font-medium" />
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

function WalletTransactions({ wallet }: { wallet: WalletSummary }) {
  const query = useServiceQuery(
    () => transactionService.listTransactions({ walletIds: [wallet.id] }),
    wallet.id,
  );
  const rows = (query.data ?? []).slice(0, 10);
  return (
    <Panel
      title={`Giao dịch của ví ${wallet.name}`}
      description={
        <>
          <span className="num">{wallet.transactionCount}</span> giao dịch · 10 giao dịch gần nhất
        </>
      }
      action={
        <Button variant="ghost" size="sm" asChild className="text-primary">
          <Link href={`/giao-dich?vi=${wallet.id}`}>
            Xem tất cả <ArrowRight aria-hidden />
          </Link>
        </Button>
      }
    >
      {query.error && !query.data ? (
        <ErrorState title="Không tải được giao dịch của ví" error={query.error} onRetry={query.refetch} />
      ) : query.loading ? (
        <div aria-hidden className="flex flex-col">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="my-2.5 h-5 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={ReceiptText} title="Ví này chưa có giao dịch" description="Giao dịch ghi vào ví này sẽ hiện ở đây." />
      ) : (
        <div className="-mx-4 md:-mx-5">
          <Table aria-label={`Giao dịch của ví ${wallet.name}`}>
            <TableHeader className="bg-surface-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-[112px] pl-5">Ngày</TableHead>
                <TableHead>Mô tả</TableHead>
                <TableHead className="w-[140px] max-md:hidden">Danh mục</TableHead>
                <TableHead className="w-[130px] pr-5 text-right">Số tiền</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="num pl-5 text-muted-foreground">{formatDate(t.date)}</TableCell>
                  <TableCell className="max-w-0">
                    <Link href={`/giao-dich?id=${t.id}`} className="block truncate hover:underline hover:underline-offset-4" title={t.description}>
                      {t.description}
                    </Link>
                  </TableCell>
                  <TableCell className="max-md:hidden">
                    <CategoryChip name={t.category.name} color={t.category.color} />
                  </TableCell>
                  <TableCell className="pr-5 text-right font-medium">
                    <Money amount={t.amount} type={t.type} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Panel>
  );
}

export function WalletsPage() {
  const today = transactionService.getToday();
  const wallets = useServiceQuery(() => walletService.listWalletSummaries());
  const transfers = useServiceQuery(() => walletService.listTransfers(undefined, 8));
  const [selectedId, setSelectedId] = React.useState<string>();
  const list = wallets.data ?? [];
  const selected = list.find((w) => w.id === selectedId) ?? list[0];
  const total = list.reduce((s, w) => s + w.balance, 0);

  return (
    <PageContainer>
      <PageHeader
        title="Ví"
        description={
          list.length ? (
            <>
              Tổng số dư <Money amount={total} className="font-semibold text-foreground" /> trên{" "}
              <span className="num">{list.length}</span> ví
            </>
          ) : (
            "Theo dõi số dư từng ví và chuyển tiền qua lại."
          )
        }
      />

      {wallets.error && !wallets.data ? (
        <section className="rounded-xl border bg-card">
          <ErrorState title="Không tải được danh sách ví" error={wallets.error} onRetry={wallets.refetch} className="min-h-[360px]" />
        </section>
      ) : wallets.loading ? (
        <div aria-hidden className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[148px] rounded-xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <section className="rounded-xl border bg-card">
          <EmptyState icon={WalletIcon} className="min-h-[320px]" title="Chưa có ví nào" description="Tạo ví tiền mặt, tài khoản ngân hàng hoặc ví điện tử để bắt đầu." />
        </section>
      ) : (
        <>
          <div role="group" aria-label="Các ví" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-6">
            {list.map((w) => (
              <WalletCard key={w.id} wallet={w} selected={w.id === selected?.id} onSelect={() => setSelectedId(w.id)} />
            ))}
          </div>

          <div className="grid grid-cols-1 items-start gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
            <div className="xl:col-span-8">{selected && <WalletTransactions key={selected.id} wallet={selected} />}</div>
            <div className="flex flex-col gap-4 md:gap-5 xl:col-span-4 xl:gap-6">
              {list.length >= 2 ? (
                <TransferForm wallets={list} today={today} />
              ) : (
                <Panel title="Chuyển tiền giữa các ví">
                  <p className="text-sm text-muted-foreground">Cần ít nhất 2 ví để chuyển tiền.</p>
                </Panel>
              )}
              {transfers.data && <TransferHistory items={transfers.data} />}
            </div>
          </div>
        </>
      )}
    </PageContainer>
  );
}
