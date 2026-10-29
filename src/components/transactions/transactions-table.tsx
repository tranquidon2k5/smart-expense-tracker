"use client";

import {
  createColumnHelper,
  createPaginatedRowModel,
  createSortedRowModel,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
  type PaginationState,
  type RowSelectionState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  MoreHorizontal,
  PencilLine,
  Rows3,
  Sparkles,
  Trash2,
} from "lucide-react";
import * as React from "react";
import type { TransactionView } from "@/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryChip, CategoryIcon } from "@/components/category-icon";
import { Money } from "@/components/money";
import { formatDate, formatMoney, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { transactionsMessages } from "@/i18n/messages/transactions";

const msg = () => getMessages(transactionsMessages);

const features = tableFeatures({
  rowSortingFeature,
  sortedRowModel: createSortedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  rowSelectionFeature,
  rowPaginationFeature,
  paginatedRowModel: createPaginatedRowModel(),
});

const helper = createColumnHelper<typeof features, TransactionView>();

/** Chip ngắn; độ tin cậy nằm trong tooltip + nhãn đọc màn hình */
export function PendingChip({ confidence }: { confidence: number | null }) {
  const detail = confidence != null ? msg().aiUnsureConfidence(formatPercent(confidence * 100)) : msg().aiUnsure;
  return (
    <span title={detail} className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-info">
      <Sparkles aria-hidden className="size-3" />
      {msg().pending}
      <span className="sr-only"> — {detail}</span>
    </span>
  );
}

interface TableProps {
  data: TransactionView[];
  dense: boolean;
  onDenseChange: (dense: boolean) => void;
  onOpen: (id: string) => void;
  onDelete: (ids: string[]) => void;
  /** Thanh thao tác hàng loạt, nhận các id đang chọn */
  renderBulkBar: (selectedIds: string[], clear: () => void) => React.ReactNode;
  activeId: string | null;
}

export function TransactionsTable({ data, dense, onDenseChange, onOpen, onDelete, renderBulkBar, activeId }: TableProps) {
  const [sorting, setSorting] = React.useState<SortingState>([{ id: "date", desc: true }]);
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [pagination, setPagination] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 25 });

  // Bỏ các id đã chọn nhưng không còn trong dữ liệu (đổi bộ lọc, vừa xoá)
  const visibleSelection = React.useMemo(() => {
    const ids = new Set(data.map((t) => t.id));
    return Object.fromEntries(Object.entries(rowSelection).filter(([id, v]) => v && ids.has(id)));
  }, [data, rowSelection]);

  const columns = React.useMemo(
    () =>
      helper.columns([
        helper.display({
          id: "select",
          header: ({ table }) => (
            <Checkbox
              aria-label={msg().table.selectAll}
              checked={
                table.getIsAllPageRowsSelected() ? true : table.getIsSomePageRowsSelected() ? "indeterminate" : false
              }
              onCheckedChange={(v) => table.toggleAllPageRowsSelected(v === true)}
            />
          ),
          cell: ({ row }) => (
            <Checkbox
              aria-label={msg().table.select(row.original.description)}
              checked={row.getIsSelected()}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // Radix Checkbox là <button>: truyền giá trị mới + phím Shift để chọn theo dải
                row.getToggleSelectedHandler()({ target: { checked: !row.getIsSelected() }, shiftKey: e.shiftKey });
              }}
            />
          ),
        }),
        helper.accessor("date", { id: "date", header: () => msg().table.date, sortFn: "text" }),
        helper.accessor("description", { id: "description", header: () => msg().table.description, enableSorting: false }),
        helper.accessor((t) => t.category.name, { id: "category", header: () => msg().table.category, sortFn: "text" }),
        helper.accessor((t) => t.wallet.name, { id: "wallet", header: () => msg().table.wallet, sortFn: "text" }),
        // Sắp theo độ lớn (không theo dấu) để "giảm dần" = khoản lớn nhất trước, dù thu hay chi
        helper.accessor("amount", { id: "amount", header: () => msg().table.amount, sortFn: "basic" }),
        helper.display({ id: "actions", header: () => <span className="sr-only">{getMessages(commonMessages).actions}</span> }),
      ]),
    [],
  );

  const table = useTable({
    features,
    columns,
    data,
    getRowId: (t) => t.id,
    state: { sorting, rowSelection: visibleSelection, pagination },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    enableSortingRemoval: false,
    isRowRangeSelectionEvent: (e) => !!(e as { shiftKey?: boolean }).shiftKey,
  });

  const selectedIds = Object.keys(visibleSelection);
  const clearSelection = () => setRowSelection({});
  const rows = table.getRowModel().rows;
  const totalRows = data.length;
  const { pageIndex, pageSize } = table.state.pagination;
  const start = totalRows === 0 ? 0 : pageIndex * pageSize + 1;
  const end = Math.min(totalRows, (pageIndex + 1) * pageSize);

  const totals = React.useMemo(
    () =>
      data.reduce(
        (acc, t) => {
          acc[t.type] += t.amount;
          return acc;
        },
        { income: 0, expense: 0 },
      ),
    [data],
  );

  const sortHeader = (id: string, label: string, align: "left" | "right" = "left") => {
    const column = table.getColumn(id);
    const sorted = column?.getIsSorted();
    const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
    return (
      <button
        type="button"
        onClick={column?.getToggleSortingHandler()}
        className={cn(
          "-mx-1.5 inline-flex h-8 items-center gap-1 rounded-md px-1.5 transition-colors duration-150 hover:bg-row-hover hover:text-foreground",
          sorted && "text-foreground",
          align === "right" && "flex-row-reverse",
        )}
      >
        {label}
        <Icon aria-hidden className={cn("size-3.5", !sorted && "opacity-50")} />
      </button>
    );
  };
  const ariaSort = (id: string) => {
    const s = table.getColumn(id)?.getIsSorted();
    return s === "asc" ? "ascending" : s === "desc" ? "descending" : "none";
  };

  const cellPad = dense ? "h-9 py-1" : "h-11 py-2";

  return (
    <div className="flex flex-col">
      {selectedIds.length > 0 && renderBulkBar(selectedIds, clearSelection)}

      {/* ≥ 768px: bảng */}
      <div className="max-md:hidden">
        <Table aria-label={msg().table.label} containerClassName="overflow-visible">
          <TableHeader className="sticky top-16 z-10 bg-surface-subtle shadow-[0_1px_0_var(--border)]">
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pr-0 pl-5">
                <table.FlexRender header={table.getHeaderGroups()[0].headers[0]} />
              </TableHead>
              <TableHead className="w-[112px]" aria-sort={ariaSort("date")}>
                {sortHeader("date", msg().table.date)}
              </TableHead>
              <TableHead>{msg().table.description}</TableHead>
              <TableHead className="w-[150px]" aria-sort={ariaSort("category")}>
                {sortHeader("category", msg().table.category)}
              </TableHead>
              <TableHead className="w-[130px] max-lg:hidden" aria-sort={ariaSort("wallet")}>
                {sortHeader("wallet", msg().table.wallet)}
              </TableHead>
              <TableHead className="w-[140px] text-right" aria-sort={ariaSort("amount")}>
                {sortHeader("amount", msg().table.amount, "right")}
              </TableHead>
              <TableHead className="w-12 pr-3" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const t = row.original;
              const selected = row.getIsSelected();
              return (
                <TableRow
                  key={row.id}
                  data-state={selected ? "selected" : undefined}
                  aria-selected={selected}
                  onClick={() => onOpen(t.id)}
                  className={cn("group cursor-pointer", activeId === t.id && "bg-accent")}
                >
                  <TableCell className={cn(cellPad, "pr-0 pl-5")}>
                    <table.FlexRender cell={row.getAllCells()[0]} />
                  </TableCell>
                  <TableCell className={cn(cellPad, "num text-muted-foreground")}>{formatDate(t.date)}</TableCell>
                  <TableCell className={cn(cellPad, "max-w-0")}>
                    <span className="flex min-w-0 items-center gap-2">
                      {/* Nút để mở bằng bàn phím; cả dòng bấm được bằng chuột */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(t.id);
                        }}
                        title={t.description}
                        className="truncate rounded-sm text-left hover:underline hover:underline-offset-4"
                      >
                        {t.description}
                      </button>
                      {t.source === "nlp" && t.status !== "pending" && (
                        <Sparkles aria-label={msg().aiCategorized} className="size-3.5 shrink-0 text-muted-foreground" />
                      )}
                      {t.status === "pending" && <PendingChip confidence={t.aiConfidence} />}
                    </span>
                  </TableCell>
                  <TableCell className={cellPad}>
                    <CategoryChip name={t.category.name} color={t.category.color} />
                  </TableCell>
                  <TableCell className={cn(cellPad, "text-muted-foreground max-lg:hidden")}>{t.wallet.name}</TableCell>
                  <TableCell className={cn(cellPad, "text-right font-medium")}>
                    <Money amount={t.amount} type={t.type} />
                  </TableCell>
                  <TableCell className={cn(cellPad, "py-0 pr-3")} onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={msg().table.actionsFor(t.description)}
                          className="opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100 [@media(hover:none)]:opacity-100"
                        >
                          <MoreHorizontal aria-hidden />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => onOpen(t.id)}>
                          <PencilLine aria-hidden /> {msg().table.viewEdit}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onSelect={() => onDelete([t.id])}>
                          <Trash2 aria-hidden /> {getMessages(commonMessages).delete}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
          <TableFooter className="bg-surface-subtle">
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={2} className="pl-5 text-[13px] font-medium text-muted-foreground">
                {msg().table.total} <span className="num">{totalRows}</span> {msg().table.totalFiltered}
              </TableCell>
              <TableCell colSpan={4} className="text-right max-lg:hidden">
                <span className="inline-flex items-center gap-4 text-[13px]">
                  <span>
                    {getMessages(commonMessages).income} <Money amount={totals.income} type="income" className="font-semibold" />
                  </span>
                  <span>
                    {getMessages(commonMessages).expense} <Money amount={totals.expense} type="expense" className="font-semibold" />
                  </span>
                </span>
              </TableCell>
              <TableCell colSpan={4} className="text-right lg:hidden">
                <span className="inline-flex flex-wrap justify-end gap-x-4 text-[13px]">
                  <Money amount={totals.income} type="income" className="font-semibold" />
                  <Money amount={totals.expense} type="expense" className="font-semibold" />
                </span>
              </TableCell>
              <TableCell className="max-lg:hidden" />
            </TableRow>
          </TableFooter>
        </Table>
      </div>

      {/* < 768px: danh sách 2 dòng, không cuộn ngang */}
      <ul className="md:hidden" aria-label={msg().table.label}>
        {rows.map(({ original: t }) => (
          <li key={t.id} className="border-b last:border-0">
            <button
              type="button"
              onClick={() => onOpen(t.id)}
              className="flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left transition-colors duration-150 hover:bg-row-hover"
            >
              <CategoryIcon icon={t.category.icon} color={t.category.color} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px]">{t.description}</span>
                <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                  <span className="truncate">{t.category.name}</span>·<span className="num shrink-0">{formatDate(t.date)}</span>
                </span>
                {t.status === "pending" && (
                  <span className="mt-1 block">
                    <PendingChip confidence={t.aiConfidence} />
                  </span>
                )}
              </span>
              <Money amount={t.amount} type={t.type} className="font-medium" />
            </button>
          </li>
        ))}
      </ul>

      {/* Phân trang */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-[13px] text-muted-foreground md:px-5">
        <p aria-live="polite">
          <span className="num">
            {start}–{end}
          </span>{" "}
          {msg().table.of} <span className="num">{totalRows}</span> {msg().table.transactions}
          <span className="max-md:hidden">
            {" "}
            · {getMessages(commonMessages).income} <span className="num">{formatMoney(totals.income)}</span> · {getMessages(commonMessages).expense}{" "}
            <span className="num">{formatMoney(totals.expense)}</span>
          </span>
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={dense}
            onClick={() => onDenseChange(!dense)}
            className="text-muted-foreground max-md:hidden"
            title={msg().table.denseTitle}
          >
            <Rows3 aria-hidden /> {msg().table.dense}
          </Button>
          <label className="flex items-center gap-2">
            <span className="max-sm:sr-only">{msg().table.perPage}</span>
            <Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
              <SelectTrigger className="num w-20" aria-label={msg().table.rowsPerPage}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)} className="num">
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          <span className="num px-1">
            {table.getPageCount() ? pageIndex + 1 : 0}/{table.getPageCount()}
          </span>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            aria-label={msg().table.prevPage}
            className="max-md:size-11"
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            aria-label={msg().table.nextPage}
            className="max-md:size-11"
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
