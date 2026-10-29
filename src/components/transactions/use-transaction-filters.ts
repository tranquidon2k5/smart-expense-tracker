"use client";

import * as React from "react";
import type { TransactionFilter, TransactionType } from "@/types";
import { addDaysIso, formatDate } from "@/lib/format";
import { getMessages } from "@/i18n/core";
import { transactionsMessages } from "@/i18n/messages/transactions";

const msg = () => getMessages(transactionsMessages);

export type PeriodKey = "thang-nay" | "thang-truoc" | "7-ngay" | "30-ngay" | "3-thang" | "tat-ca" | "tuy-chon";

export const PERIOD_KEYS: PeriodKey[] = ["thang-nay", "thang-truoc", "7-ngay", "30-ngay", "3-thang", "tat-ca", "tuy-chon"];

export function periodName(key: PeriodKey): string {
  return msg().filters.periods[key];
}

export interface FilterState {
  period: PeriodKey;
  /** Chỉ dùng khi period = "tuy-chon" */
  range: { from?: string; to?: string };
  walletIds: string[];
  categoryIds: string[];
  minAmount?: number;
  maxAmount?: number;
  type?: TransactionType;
  query: string;
}

export function defaultFilters(categoryId?: string | null, walletId?: string | null): FilterState {
  return {
    period: "thang-nay",
    range: {},
    walletIds: walletId ? [walletId] : [],
    categoryIds: categoryId ? [categoryId] : [],
    query: "",
  };
}

export function periodRange(state: FilterState, today: string): { from?: string; to?: string } {
  const month = today.slice(0, 7);
  switch (state.period) {
    case "thang-nay":
      return { from: `${month}-01`, to: today };
    case "thang-truoc": {
      const firstThis = `${month}-01`;
      const lastPrev = addDaysIso(firstThis, -1);
      return { from: `${lastPrev.slice(0, 7)}-01`, to: lastPrev };
    }
    case "7-ngay":
      return { from: addDaysIso(today, -6), to: today };
    case "30-ngay":
      return { from: addDaysIso(today, -29), to: today };
    case "3-thang":
      return { from: addDaysIso(today, -89), to: today };
    case "tuy-chon":
      return { from: state.range.from, to: state.range.to ?? state.range.from };
    default:
      return {};
  }
}

export function periodLabel(state: FilterState): string {
  if (state.period === "tuy-chon" && state.range.from) {
    const to = state.range.to ?? state.range.from;
    return to === state.range.from
      ? formatDate(state.range.from)
      : `${formatDate(state.range.from)} – ${formatDate(to)}`;
  }
  return periodName(state.period);
}

/** Bộ lọc đang khác mặc định (để hiện nút "Xoá bộ lọc") */
export function activeFilterCount(state: FilterState): number {
  return (
    (state.period !== "thang-nay" ? 1 : 0) +
    (state.walletIds.length ? 1 : 0) +
    (state.categoryIds.length ? 1 : 0) +
    (state.minAmount != null || state.maxAmount != null ? 1 : 0) +
    (state.type ? 1 : 0) +
    (state.query.trim() ? 1 : 0)
  );
}

/** Trạng thái lọc + chuỗi tìm kiếm đã debounce → TransactionFilter cho service */
export function useTransactionFilters(today: string, initialCategoryId?: string | null, initialWalletId?: string | null) {
  const [state, setState] = React.useState<FilterState>(() => defaultFilters(initialCategoryId, initialWalletId));
  const [debouncedQuery, setDebouncedQuery] = React.useState(state.query);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(state.query), 250);
    return () => clearTimeout(t);
  }, [state.query]);

  const filter: TransactionFilter = React.useMemo(
    () => ({
      ...periodRange(state, today),
      walletIds: state.walletIds,
      categoryIds: state.categoryIds,
      minAmount: state.minAmount,
      maxAmount: state.maxAmount,
      type: state.type,
      query: debouncedQuery,
    }),
    [state, today, debouncedQuery],
  );

  const update = React.useCallback((patch: Partial<FilterState>) => setState((s) => ({ ...s, ...patch })), []);
  const reset = React.useCallback(() => setState(defaultFilters()), []);

  return { state, update, reset, filter, filterKey: JSON.stringify(filter) };
}
