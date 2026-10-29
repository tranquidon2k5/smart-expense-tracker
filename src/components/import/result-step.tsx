"use client";

import { CircleCheck, CopyX, FileUp, Hourglass, ListChecks, ReceiptText, Sparkles, TriangleAlert } from "lucide-react";
import Link from "next/link";
import type { ImportResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CategoryChip } from "@/components/category-icon";
import { Money } from "@/components/money";
import { Panel } from "@/components/panel";
import { formatDate, formatPercent } from "@/lib/format";
import { getMessages } from "@/i18n/core";
import { importMessages } from "@/i18n/messages/import";

const msg = () => getMessages(importMessages);
import { cn } from "@/lib/utils";
import { ErrorList } from "./mapping-step";

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof CircleCheck;
  label: string;
  value: number;
  hint: string;
  tone: string;
}) {
  return (
    <div className="flex items-start gap-3 px-1 py-3 md:px-5 md:py-1 md:first:pl-0">
      <span aria-hidden className={cn("mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg", tone)}>
        <Icon className="size-[18px]" />
      </span>
      <div>
        <dt className="text-[13px] text-muted-foreground">{label}</dt>
        <dd className="num text-2xl leading-8 font-semibold">{value}</dd>
        <dd className="text-xs text-muted-foreground">{hint}</dd>
      </div>
    </div>
  );
}

/** Bước 3: kết quả nhập — số giao dịch mới, số trùng bị loại (liệt kê), số vào Chờ duyệt */
export function ResultStep({ result, onRestart }: { result: ImportResult; onRestart: () => void }) {
  const { created, duplicates, errors } = result;

  return (
    <div className="flex flex-col gap-4 md:gap-5 xl:gap-6">
      <Panel
        title={
          created.length ? (
            <span>
              {msg().result.imported} <span className="num">{created.length}</span> {msg().result.into(result.wallet.name)}
            </span>
          ) : (
            msg().result.none
          )
        }
        icon={<CircleCheck aria-hidden className="size-5 text-success" />}
        description={
          created.length
            ? msg().result.fromFile(result.fileName)
            : msg().result.allDup(result.fileName)
        }
      >
        <dl className="grid grid-cols-1 divide-y sm:grid-cols-2 sm:divide-y-0 md:grid-cols-4 md:divide-x" role="group" aria-label={msg().result.summary}>
          <Stat icon={ReceiptText} label={msg().result.newTx} value={created.length} hint={msg().result.added} tone="bg-accent text-primary" />
          <Stat
            icon={CircleCheck}
            label={msg().result.direct}
            value={result.confirmedCount}
            hint={msg().result.directHint}
            tone="bg-income-soft text-success"
          />
          <Stat icon={Hourglass} label={msg().result.toReview} value={result.pendingCount} hint={msg().result.toReviewHint} tone="bg-info-soft text-info" />
          <Stat icon={CopyX} label={msg().result.dup} value={duplicates.length} hint={msg().result.dupHint} tone="bg-muted text-muted-foreground" />
        </dl>

        <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
          {result.pendingCount > 0 && (
            <Button asChild>
              <Link href="/giao-dich?trang-thai=cho-duyet">
                <ListChecks aria-hidden /> {msg().result.review(result.pendingCount)}
              </Link>
            </Button>
          )}
          <Button variant={result.pendingCount > 0 ? "outline" : "default"} asChild>
            <Link href={`/giao-dich?vi=${result.wallet.id}`}>{msg().result.viewWallet(result.wallet.name)}</Link>
          </Button>
          <Button variant="ghost" onClick={onRestart} className="sm:ml-auto">
            <FileUp aria-hidden /> {msg().result.another}
          </Button>
        </div>
      </Panel>

      {duplicates.length > 0 && (
        <Panel
          title={msg().result.dupTitle(duplicates.length)}
          icon={<CopyX aria-hidden className="size-5 text-muted-foreground" />}
          description={msg().result.dupText}
        >
          <Table aria-label={msg().result.dupLabel} containerClassName="max-h-[400px] overflow-y-auto rounded-lg border">
            <TableHeader className="sticky top-0 z-10">
              <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
                <TableHead className="w-16 px-3 text-right">{msg().row}</TableHead>
                <TableHead className="w-28 px-3">{msg().result.date}</TableHead>
                <TableHead className="px-3">{msg().result.fileContent}</TableHead>
                <TableHead className="px-3">{msg().result.matches}</TableHead>
                <TableHead className="w-36 px-3 text-right">{msg().result.amount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {duplicates.map((d) => (
                <TableRow key={d.line}>
                  <TableCell className="num px-3 text-right text-muted-foreground">{d.line}</TableCell>
                  <TableCell className="num px-3">{formatDate(d.date)}</TableCell>
                  <TableCell className="max-w-[280px] truncate px-3" title={d.description}>
                    {d.description}
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate px-3">
                    {d.reason === "existing" ? (
                      <Link
                        href={`/giao-dich?id=${d.matchId}`}
                        className="text-primary underline-offset-4 hover:underline"
                        title={msg().result.existing(d.matchDescription ?? "")}
                      >
                        {d.matchDescription}
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">
                        <span className="num">{msg().result.lineInFile(d.matchLine ?? 0)}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-right">
                    <Money amount={d.amount} type={d.type} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {created.length > 0 && (
        <Panel
          title={msg().result.newTx}
          icon={<Sparkles aria-hidden className="size-5 text-info" />}
          description={msg().result.newText}
        >
          <Table aria-label={msg().result.newLabel} containerClassName="rounded-lg border">
            <TableHeader>
              <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
                <TableHead className="w-28 px-3">{msg().result.date}</TableHead>
                <TableHead className="px-3">{msg().result.content}</TableHead>
                <TableHead className="px-3">{msg().result.category}</TableHead>
                <TableHead className="px-3">{msg().result.status}</TableHead>
                <TableHead className="w-36 px-3 text-right">{msg().result.amount}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {created.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="num px-3">{formatDate(t.date)}</TableCell>
                  <TableCell className="max-w-[300px] truncate px-3" title={t.description}>
                    {t.description}
                  </TableCell>
                  <TableCell className="px-3">
                    <CategoryChip name={t.category.name} color={t.category.color} />
                  </TableCell>
                  <TableCell className="px-3">
                    {t.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 rounded-md bg-info-soft px-1.5 py-0.5 text-xs font-medium text-info">
                        <Hourglass aria-hidden className="size-3.5" /> {msg().result.pending} ·{" "}
                        <span className="num">{formatPercent((t.aiConfidence ?? 0) * 100)}</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <CircleCheck aria-hidden className="size-3.5 text-success" /> {msg().result.logged} ·{" "}
                        <span className="num">{formatPercent((t.aiConfidence ?? 0) * 100)}</span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-3 text-right">
                    <Money amount={t.amount} type={t.type} withIcon />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Panel>
      )}

      {errors.length > 0 && (
        <Panel
          title={msg().result.errTitle(errors.length)}
          icon={<TriangleAlert aria-hidden className="size-5 text-warning" />}
          description={msg().result.errText}
        >
          <ErrorList errors={errors} />
        </Panel>
      )}
    </div>
  );
}
