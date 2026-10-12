"use client";

import { ArrowRight, ReceiptText, Sparkles } from "lucide-react";
import Link from "next/link";
import type { TransactionView } from "@/types";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryChip, CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { Money } from "@/components/money";
import { Panel } from "@/components/panel";
import { formatDate, formatPercent } from "@/lib/format";

/** Chip ngắn để không chiếm chỗ mô tả; độ tin cậy AI nằm trong tooltip + nhãn đọc màn hình */
function PendingChip({ confidence }: { confidence: number | null }) {
  const detail = confidence != null ? `AI chưa chắc chắn, độ tin cậy ${formatPercent(confidence * 100)}` : "AI chưa chắc chắn";
  return (
    <span
      title={detail}
      className="inline-flex shrink-0 items-center gap-1 rounded-md bg-accent px-1.5 py-0.5 text-xs font-medium text-info"
    >
      <Sparkles aria-hidden className="size-3" />
      Chờ duyệt
      <span className="sr-only"> — {detail}</span>
    </span>
  );
}

function AiMark({ t }: { t: TransactionView }) {
  if (t.source !== "nlp" || t.status === "pending") return null;
  return (
    <span title="Ghi bằng câu tự nhiên, AI phân loại" className="inline-flex text-muted-foreground">
      <Sparkles aria-label="AI phân loại" className="size-3.5" />
    </span>
  );
}

export function RecentTransactions({
  data,
  loading,
  onAddFirst,
  className,
}: {
  data?: TransactionView[];
  loading: boolean;
  onAddFirst: () => void;
  className?: string;
}) {
  const rows = data ?? [];
  return (
    <Panel
      title="Giao dịch gần đây"
      className={className}
      action={
        rows.length > 0 && (
          <Button variant="ghost" size="sm" asChild className="text-primary">
            <Link href="/giao-dich">
              Xem tất cả <ArrowRight aria-hidden />
            </Link>
          </Button>
        )
      }
    >
      {loading ? (
        <div aria-hidden className="flex flex-col gap-0">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="flex h-11 items-center gap-4 border-b last:border-0">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-4 w-24 max-md:hidden" />
              <Skeleton className="h-4 w-24" />
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          className="min-h-[280px]"
          title="Chưa có giao dịch nào"
          description="Gõ một câu như “ăn phở 45k” vào ô Ghi nhanh, AI sẽ lo phần còn lại."
          action={<Button onClick={onAddFirst}>Ghi giao dịch đầu tiên</Button>}
        />
      ) : (
        <>
          {/* ≥ 768px: bảng */}
          <div className="-mx-4 max-md:hidden md:-mx-5">
            <Table aria-label="Giao dịch gần đây">
              <TableHeader className="bg-surface-subtle">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[112px] pl-5">Ngày</TableHead>
                  <TableHead>Mô tả</TableHead>
                  <TableHead className="w-[132px]">Danh mục</TableHead>
                  <TableHead className="w-[120px] max-lg:hidden">Ví</TableHead>
                  <TableHead className="w-[136px] pr-5 text-right">Số tiền</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="num pl-5 text-muted-foreground">{formatDate(t.date)}</TableCell>
                    <TableCell className="max-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate" title={t.description}>
                          {t.description}
                        </span>
                        <AiMark t={t} />
                        {t.status === "pending" && <PendingChip confidence={t.aiConfidence} />}
                      </span>
                    </TableCell>
                    <TableCell>
                      <CategoryChip name={t.category.name} color={t.category.color} />
                    </TableCell>
                    <TableCell className="text-muted-foreground max-lg:hidden">{t.wallet.name}</TableCell>
                    <TableCell className="pr-5 text-right font-medium">
                      <Money amount={t.amount} type={t.type} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* < 768px: danh sách 2 dòng, không cuộn ngang */}
          <ul className="-mx-4 md:hidden" aria-label="Giao dịch gần đây">
            {rows.map((t) => (
              <li key={t.id} className="flex min-h-14 items-center gap-3 border-b px-4 py-2 last:border-0">
                <CategoryIcon icon={t.category.icon} color={t.category.color} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px]">{t.description}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-muted-foreground">
                    <span className="truncate">{t.category.name}</span>·<span className="num shrink-0">{formatDate(t.date)}</span>
                  </p>
                  {t.status === "pending" && (
                    <div className="mt-1">
                      <PendingChip confidence={t.aiConfidence} />
                    </div>
                  )}
                </div>
                <Money amount={t.amount} type={t.type} className="font-medium" />
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}
