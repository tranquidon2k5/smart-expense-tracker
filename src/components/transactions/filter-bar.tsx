"use client";

import { ArrowDownLeft, ArrowUpRight, CalendarDays, ChevronDown, Coins, FilterX, Search, Shapes, Wallet as WalletIcon, X } from "lucide-react";
import * as React from "react";
import type { Category, TransactionType, Wallet } from "@/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RangeCalendar } from "@/components/date-picker";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getActiveLocale, INTL_LOCALE } from "@/i18n/core";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { transactionsMessages } from "@/i18n/messages/transactions";

const msg = () => getMessages(transactionsMessages);
import {
  activeFilterCount,
  type FilterState,
  PERIOD_KEYS,
  periodName,
  periodLabel,
} from "./use-transaction-filters";

/** Dấu phân cách nghìn theo ngôn ngữ giao diện */
const vnd = { format: (n: number) => new Intl.NumberFormat(INTL_LOCALE[getActiveLocale()]).format(n) };

/** Nút bộ lọc: viền đậm + nền accent khi đang lọc */
function FilterButton({
  active,
  icon: Icon,
  children,
  ...props
}: React.ComponentProps<typeof Button> & { active?: boolean; icon: typeof Search }) {
  return (
    <Button
      variant="outline"
      className={cn(
        "h-9 gap-1.5 px-3 font-normal max-md:h-11",
        active && "border-primary/50 bg-accent text-accent-foreground hover:bg-accent",
      )}
      {...props}
    >
      <Icon aria-hidden className="text-muted-foreground" />
      {children}
      <ChevronDown aria-hidden className="text-muted-foreground" />
    </Button>
  );
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
}

function MoneyInput({ id, label, value, onChange }: { id: string; label: string; value?: number; onChange: (v?: number) => void }) {
  return (
    <div className="flex-1">
      <label htmlFor={id} className="mb-1 block text-[13px] font-medium">
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          value={value != null ? vnd.format(value) : ""}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits ? Number(digits) : undefined);
          }}
          className="num pr-7 text-right"
        />
        <span aria-hidden className="num pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-muted-foreground">
          {getMessages(commonMessages).currencySuffix}
        </span>
      </div>
    </div>
  );
}

export function FilterBar({
  state,
  update,
  reset,
  wallets,
  categories,
  today,
}: {
  state: FilterState;
  update: (patch: Partial<FilterState>) => void;
  reset: () => void;
  wallets: Wallet[];
  categories: Category[];
  today: string;
}) {
  const ids = React.useId();
  const searchRef = React.useRef<HTMLInputElement>(null);
  const [periodOpen, setPeriodOpen] = React.useState(false);
  const [amountOpen, setAmountOpen] = React.useState(false);
  const [draftAmount, setDraftAmount] = React.useState<{ min?: number; max?: number }>({});
  const count = activeFilterCount(state);

  const selectedCategoryNames = categories.filter((c) => state.categoryIds.includes(c.id)).map((c) => c.name);
  const selectedWalletNames = wallets.filter((w) => state.walletIds.includes(w.id)).map((w) => w.name);
  const summarize = (names: string[], fallback: string) =>
    names.length === 0 ? fallback : names.length === 1 ? names[0] : `${fallback} · ${names.length}`;

  const amountLabel =
    state.minAmount != null && state.maxAmount != null
      ? `${formatMoney(state.minAmount)} – ${formatMoney(state.maxAmount)}`
      : state.minAmount != null
        ? msg().filters.amountFrom(formatMoney(state.minAmount))
        : state.maxAmount != null
          ? msg().filters.amountTo(formatMoney(state.maxAmount))
          : msg().filters.amount;
  const amountInvalid = draftAmount.min != null && draftAmount.max != null && draftAmount.min > draftAmount.max;

  return (
    <div role="search" aria-label={msg().filters.region} className="flex flex-wrap items-center gap-2">
      {/* Tìm kiếm */}
      <div className="relative w-full md:w-64">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          type="search"
          value={state.query}
          onChange={(e) => update({ query: e.target.value })}
          placeholder={msg().filters.searchPlaceholder}
          aria-label={msg().filters.searchLabel}
          className="bg-card pr-9 pl-9 [&::-webkit-search-cancel-button]:hidden"
        />
        {state.query && (
          <button
            type="button"
            onClick={() => {
              update({ query: "" });
              searchRef.current?.focus();
            }}
            aria-label={msg().filters.clearSearch}
            className="absolute top-1/2 right-1.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-row-hover hover:text-foreground"
          >
            <X aria-hidden className="size-4" />
          </button>
        )}
      </div>

      {/* Thời gian: mốc nhanh + lịch khoảng ngày */}
      <Popover open={periodOpen} onOpenChange={setPeriodOpen}>
        <PopoverTrigger asChild>
          <FilterButton icon={CalendarDays} active={state.period !== "thang-nay"} aria-label={msg().filters.period(periodLabel(state))}>
            <span className={cn(state.period === "tuy-chon" && "num")}>{periodLabel(state)}</span>
          </FilterButton>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto rounded-xl p-0">
          <div className="flex max-md:flex-col">
            <div role="radiogroup" aria-label={msg().filters.periodGroup} className="flex flex-col gap-0.5 border-r p-2 max-md:border-r-0 max-md:border-b md:w-40">
              {PERIOD_KEYS
                .filter((k) => k !== "tuy-chon")
                .map((key) => (
                  <button
                    key={key}
                    type="button"
                    role="radio"
                    aria-checked={state.period === key}
                    onClick={() => {
                      update({ period: key, range: {} });
                      setPeriodOpen(false);
                    }}
                    className={cn(
                      "h-9 rounded-lg px-2.5 text-left text-sm transition-colors duration-150 hover:bg-row-hover",
                      state.period === key && "bg-accent font-medium text-accent-foreground hover:bg-accent",
                    )}
                  >
                    {periodName(key)}
                  </button>
                ))}
            </div>
            <div className="p-2">
              <p className="px-2 pt-1 text-[13px] font-medium text-muted-foreground">{msg().filters.orRange}</p>
              <RangeCalendar
                value={state.period === "tuy-chon" ? state.range : {}}
                max={today}
                onChange={(range) => update({ period: range.from ? "tuy-chon" : "thang-nay", range })}
              />
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Ví */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterButton icon={WalletIcon} active={state.walletIds.length > 0}>
            {summarize(selectedWalletNames, msg().filters.wallet)}
          </FilterButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-52">
          <DropdownMenuLabel>{msg().filters.byWallet}</DropdownMenuLabel>
          {wallets.map((w) => (
            <DropdownMenuCheckboxItem
              key={w.id}
              checked={state.walletIds.includes(w.id)}
              onCheckedChange={() => update({ walletIds: toggleId(state.walletIds, w.id) })}
              onSelect={(e) => e.preventDefault()}
            >
              {w.name}
            </DropdownMenuCheckboxItem>
          ))}
          {state.walletIds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => update({ walletIds: [] })}>{msg().filters.clearAll}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Danh mục */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <FilterButton icon={Shapes} active={state.categoryIds.length > 0}>
            {summarize(selectedCategoryNames, msg().filters.category)}
          </FilterButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-[min(420px,70svh)] w-56 overflow-y-auto">
          {(["expense", "income"] as const).map((t, i) => (
            <React.Fragment key={t}>
              {i > 0 && <DropdownMenuSeparator />}
              <DropdownMenuLabel>{t === "expense" ? msg().expenseGroup : msg().incomeGroup}</DropdownMenuLabel>
              {categories
                .filter((c) => c.type === t)
                .map((c) => (
                  <DropdownMenuCheckboxItem
                    key={c.id}
                    checked={state.categoryIds.includes(c.id)}
                    onCheckedChange={() => update({ categoryIds: toggleId(state.categoryIds, c.id) })}
                    onSelect={(e) => e.preventDefault()}
                  >
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                    {c.name}
                  </DropdownMenuCheckboxItem>
                ))}
            </React.Fragment>
          ))}
          {state.categoryIds.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => update({ categoryIds: [] })}>{msg().filters.clearAll}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Khoảng số tiền */}
      <Popover
        open={amountOpen}
        onOpenChange={(o) => {
          setAmountOpen(o);
          if (o) setDraftAmount({ min: state.minAmount, max: state.maxAmount });
        }}
      >
        <PopoverTrigger asChild>
          <FilterButton icon={Coins} active={state.minAmount != null || state.maxAmount != null}>
            <span className="num">{amountLabel}</span>
          </FilterButton>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-80 rounded-xl p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (amountInvalid) return;
              update({ minAmount: draftAmount.min, maxAmount: draftAmount.max });
              setAmountOpen(false);
            }}
            className="flex flex-col gap-3"
          >
            <p className="text-sm font-semibold">{msg().filters.amountRange}</p>
            <div className="flex items-end gap-2">
              <MoneyInput id={`${ids}-min`} label={msg().filters.from} value={draftAmount.min} onChange={(min) => setDraftAmount((d) => ({ ...d, min }))} />
              <span aria-hidden className="pb-2 text-muted-foreground">–</span>
              <MoneyInput id={`${ids}-max`} label={msg().filters.to} value={draftAmount.max} onChange={(max) => setDraftAmount((d) => ({ ...d, max }))} />
            </div>
            {amountInvalid && (
              <p role="alert" className="text-xs text-danger">
                {msg().filters.amountInvalid}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  update({ minAmount: undefined, maxAmount: undefined });
                  setAmountOpen(false);
                }}
              >
                {msg().filters.removeFilter}
              </Button>
              <Button type="submit" disabled={amountInvalid}>
                {msg().filters.apply}
              </Button>
            </div>
          </form>
        </PopoverContent>
      </Popover>

      {/* Loại */}
      <div role="radiogroup" aria-label={msg().filters.typeGroup} className="flex h-9 items-center rounded-lg border bg-card p-0.5 max-md:h-11">
        {([undefined, "expense", "income"] as (TransactionType | undefined)[]).map((t) => {
          const active = state.type === t;
          const Icon = t === "income" ? ArrowDownLeft : t === "expense" ? ArrowUpRight : null;
          return (
            <button
              key={t ?? "all"}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => update({ type: t })}
              className={cn(
                "inline-flex h-full items-center gap-1 rounded-md px-2.5 text-sm transition-colors duration-150",
                active
                  ? t === "income"
                    ? "bg-income-soft font-medium text-income"
                    : t === "expense"
                      ? "bg-expense-soft font-medium text-expense"
                      : "bg-accent font-medium text-accent-foreground"
                  : "text-muted-foreground hover:bg-row-hover hover:text-foreground",
              )}
            >
              {Icon && <Icon aria-hidden className="size-3.5" />}
              {t === "income" ? getMessages(commonMessages).income : t === "expense" ? getMessages(commonMessages).expense : getMessages(commonMessages).all}
            </button>
          );
        })}
      </div>

      {count > 0 && (
        <Button variant="ghost" onClick={reset} className="h-9 text-muted-foreground max-md:h-11">
          <FilterX aria-hidden /> {msg().filters.reset}
        </Button>
      )}
    </div>
  );
}
