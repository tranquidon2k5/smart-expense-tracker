"use client";

import { ListOrdered, Table2 } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import type { TransactionView } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryChip } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Panel } from "@/components/panel";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { getMessages } from "@/i18n/core";
import { statsMessages } from "@/i18n/messages/stats";

const msg = () => getMessages(statsMessages);

/**
 * Top 5 khoản chi lớn nhất: thanh ngang xếp hạng (độ dài theo số tiền, màu theo danh mục,
 * kèm tên danh mục bằng chữ). Bấm một dòng mở giao dịch ở trang Giao dịch.
 */
export function TopExpenses({
  data,
  totalExpense,
  loading,
  className,
}: {
  data?: TransactionView[];
  totalExpense: number;
  loading: boolean;
  className?: string;
}) {
  const [asTable, setAsTable] = React.useState(false);
  const items = data ?? [];
  const max = items[0]?.amount ?? 1;
  const sum = items.reduce((s, t) => s + t.amount, 0);

  return (
    <Panel
      title={msg().top.title}
      description={
        items.length && totalExpense
          ? msg().top.share(formatPercent((sum / totalExpense) * 100))
          : msg().top.fallback
      }
      className={className}
      action={
        items.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => setAsTable((v) => !v)} aria-pressed={asTable} className="text-muted-foreground max-md:h-11">
            {asTable ? <ListOrdered aria-hidden /> : <Table2 aria-hidden />}
            {asTable ? msg().showChart : msg().showTable}
          </Button>
        )
      }
    >
      {loading ? (
        <div aria-hidden className="flex flex-col gap-4">
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex flex-col gap-1.5">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-2 w-full" />
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState icon={ListOrdered} className="min-h-[240px]" title={msg().top.emptyTitle} description={msg().top.emptyText} />
      ) : asTable ? (
        <Table aria-label={msg().top.title}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 px-2 text-right">#</TableHead>
              <TableHead className="px-2">{msg().top.description}</TableHead>
              <TableHead className="px-2">{msg().category}</TableHead>
              <TableHead className="w-28 px-2">{msg().top.date}</TableHead>
              <TableHead className="px-2 text-right">{msg().top.amount}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((t, i) => (
              <TableRow key={t.id}>
                <TableCell className="num px-2 text-right text-muted-foreground">{i + 1}</TableCell>
                <TableCell className="max-w-[220px] truncate px-2" title={t.description}>
                  {t.description}
                </TableCell>
                <TableCell className="px-2">
                  <CategoryChip name={t.category.name} color={t.category.color} />
                </TableCell>
                <TableCell className="num px-2">{formatDate(t.date)}</TableCell>
                <TableCell className="px-2 text-right">
                  <Money amount={t.amount} type="expense" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <ol className="flex flex-col gap-1" aria-label={msg().top.listLabel}>
          {items.map((t, i) => (
            <li key={t.id}>
              <Link
                href={`/giao-dich?id=${t.id}`}
                aria-label={msg().top.itemLabel(i + 1, t.description, t.category.name, formatDate(t.date), formatMoney(t.amount))}
                className="-mx-2 flex flex-col gap-1.5 rounded-lg px-2 py-2 transition-colors duration-150 hover:bg-row-hover"
              >
                <span className="flex items-baseline gap-2 text-sm">
                  <span className="num w-4 shrink-0 text-right text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{t.description}</span>
                  <Money amount={t.amount} type="expense" className="font-medium" />
                </span>
                <span className="flex items-center gap-2 pl-6">
                  <span aria-hidden className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <span className="block h-full rounded-full" style={{ width: `${(t.amount / max) * 100}%`, backgroundColor: t.category.color }} />
                  </span>
                </span>
                <span className="flex items-center gap-2 pl-6 text-xs text-muted-foreground">
                  <CategoryChip name={t.category.name} color={t.category.color} className="text-xs" />·
                  <span className="num">{formatDate(t.date)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
