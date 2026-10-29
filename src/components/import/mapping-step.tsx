"use client";

import { ArrowLeft, CircleAlert, CircleCheck, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import * as React from "react";
import type { AmountMode, CsvColumnMapping, ImportField, ImportRowError, ParsedCsv, Wallet } from "@/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Panel } from "@/components/panel";
import { importService, transactionService } from "@/services";
import { cn } from "@/lib/utils";
import { CsvPreviewTable } from "./csv-preview-table";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { importMessages } from "@/i18n/messages/import";
import { te } from "@/i18n/errors";

const msg = () => getMessages(importMessages);

const fieldHelp = (f: ImportField) => msg().mapping.help[f];

const amountModes = (): { value: AmountMode; label: string; help: string }[] =>
  (["signed", "all_expense"] as const).map((value) => ({ value, ...msg().mapping.modes[value] }));

export function ErrorList({ errors, limit }: { errors: ImportRowError[]; limit?: number }) {
  const shown = limit ? errors.slice(0, limit) : errors;
  return (
    <Table aria-label={msg().mapping.errorsLabel} containerClassName="max-h-[320px] overflow-y-auto rounded-lg border">
      <TableHeader className="sticky top-0 z-10">
        <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
          <TableHead className="w-16 px-3 text-right">{msg().row}</TableHead>
          <TableHead className="w-24 px-3">{msg().mapping.column}</TableHead>
          <TableHead className="px-3">{msg().mapping.value}</TableHead>
          <TableHead className="px-3">{msg().mapping.problem}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((e) => (
          <TableRow key={`${e.line}-${e.field}`}>
            <TableCell className="num px-3 text-right font-medium">{e.line}</TableCell>
            <TableCell className="px-3">{msg().fields[e.field]}</TableCell>
            <TableCell className="num max-w-[200px] truncate px-3" title={e.value}>
              {e.value ? `“${e.value}”` : <span className="text-muted-foreground">{msg().empty}</span>}
            </TableCell>
            <TableCell className="px-3">
              <span className="flex items-center gap-1.5 text-danger">
                <CircleAlert aria-hidden className="size-4 shrink-0" />
                <span className="text-foreground">{te(e.message)}</span>
              </span>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/**
 * Bước 2: ánh xạ cột (đã tự đoán), chọn ví đích và cách đọc số tiền.
 * Mọi thay đổi được đọc thử ngay trên toàn bộ file để báo dòng lỗi trước khi nhập.
 */
export function MappingStep({
  parsed,
  mapping,
  guessed,
  amountMode,
  walletId,
  wallets,
  walletsLoading,
  importing,
  error,
  onChange,
  onBack,
  onImport,
}: {
  parsed: ParsedCsv;
  mapping: CsvColumnMapping;
  guessed: CsvColumnMapping;
  amountMode: AmountMode;
  walletId: string | null;
  wallets?: Wallet[];
  walletsLoading: boolean;
  importing: boolean;
  /** Lỗi khi gửi nhập (mạng, máy chủ): hiện ngay trên nút Nhập, bấm lại để thử lại */
  error?: Error | null;
  onChange: (patch: { mapping?: CsvColumnMapping; amountMode?: AmountMode; walletId?: string }) => void;
  onBack: () => void;
  onImport: () => void;
}) {
  const [submitted, setSubmitted] = React.useState(false);
  const fieldErrors = importService.mappingErrors(mapping);
  const mappingOk = Object.keys(fieldErrors).length === 0;
  const check = React.useMemo(
    () => importService.checkRows(parsed, mapping, amountMode, transactionService.getToday()),
    [parsed, mapping, amountMode],
  );
  const errorLines = React.useMemo(() => new Set(check.errors.map((e) => e.line)), [check.errors]);
  const canImport = mappingOk && !!walletId && check.candidates.length > 0;

  const submit = () => {
    setSubmitted(true);
    if (canImport) onImport();
  };

  const income = check.candidates.filter((c) => c.type === "income").length;

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
      <Panel title={msg().mapping.title} description={msg().mapping.intro} className="xl:col-span-4">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-4"
        >
          {importService.IMPORT_FIELDS.map((f) => {
            const id = `map-${f}`;
            const err = fieldErrors[f];
            const auto = guessed[f] !== null && guessed[f] === mapping[f];
            return (
              <div key={f} className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor={id}>
                    {msg().mapping.columnOf(msg().fields[f])} <span className="text-danger" aria-hidden>*</span>
                  </Label>
                  {auto && (
                    <span className="flex items-center gap-1 text-xs text-info">
                      <Sparkles aria-hidden className="size-3.5" /> {msg().mapping.auto}
                    </span>
                  )}
                </div>
                <Select
                  value={mapping[f] === null ? "" : String(mapping[f])}
                  onValueChange={(v) => onChange({ mapping: { ...mapping, [f]: Number(v) } })}
                >
                  <SelectTrigger
                    id={id}
                    className="w-full"
                    aria-invalid={!!err}
                    aria-describedby={`${id}-help`}
                  >
                    <SelectValue placeholder={msg().mapping.pickColumn} />
                  </SelectTrigger>
                  <SelectContent>
                    {parsed.headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h}
                        <span className="text-muted-foreground"> · {parsed.rows[0]?.[i] || msg().empty}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id={`${id}-help`} className={cn("flex items-center gap-1 text-xs", err ? "text-danger" : "text-muted-foreground")}>
                  {err && <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
                  {te(err) ?? fieldHelp(f)}
                </p>
              </div>
            );
          })}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">{msg().mapping.amountMode}</legend>
            {amountModes().map((m) => (
              <label
                key={m.value}
                className={cn(
                  "flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 transition-colors duration-150 hover:bg-row-hover has-focus-visible:ring-2 has-focus-visible:ring-ring",
                  amountMode === m.value && "border-primary bg-accent hover:bg-accent",
                )}
              >
                <input
                  type="radio"
                  name="amount-mode"
                  value={m.value}
                  checked={amountMode === m.value}
                  onChange={() => onChange({ amountMode: m.value })}
                  className="mt-0.5 size-4 accent-primary outline-none"
                />
                <span className="flex flex-col">
                  <span className="text-sm font-medium">{m.label}</span>
                  <span className="text-xs text-muted-foreground">{m.help}</span>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="map-wallet">
              {msg().mapping.wallet} <span className="text-danger" aria-hidden>*</span>
            </Label>
            {walletsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={walletId ?? ""} onValueChange={(v) => onChange({ walletId: v })}>
                <SelectTrigger id="map-wallet" className="w-full" aria-invalid={submitted && !walletId} aria-describedby="map-wallet-help">
                  <SelectValue placeholder={msg().mapping.pickWallet} />
                </SelectTrigger>
                <SelectContent>
                  {wallets?.map((w) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p
              id="map-wallet-help"
              className={cn("flex items-center gap-1 text-xs", submitted && !walletId ? "text-danger" : "text-muted-foreground")}
            >
              {submitted && !walletId && <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
              {submitted && !walletId ? msg().mapping.walletRequired : msg().mapping.walletHelp}
            </p>
          </div>

          {error && !importing && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-expense-soft px-3 py-2.5 text-sm">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <p className="font-medium">{msg().mapping.failed}</p>
                <p className="mt-0.5">{te(error.message)} {msg().mapping.unchanged}</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={onBack} disabled={importing}>
              <ArrowLeft aria-hidden /> {getMessages(commonMessages).back}
            </Button>
            <Button type="submit" disabled={importing || (mappingOk && check.candidates.length === 0)}>
              {importing && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
              {importing ? (
                msg().mapping.importing
              ) : (
                <span>
                  {error ? msg().mapping.retryImport : msg().mapping.import}
                  <span className="num">{check.candidates.length}</span> {msg().mapping.rows}
                </span>
              )}
            </Button>
          </div>
        </form>
      </Panel>

      <div className="flex min-w-0 flex-col gap-4 md:gap-5 xl:col-span-8 xl:gap-6">
        <Panel
          title={msg().mapping.previewTitle}
          description={msg().mapping.previewText(parsed.rows.length, parsed.fileName)}
        >
          <div role="status" aria-live="polite" className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {mappingOk ? (
              <>
                <span className="flex items-center gap-1.5">
                  <CircleCheck aria-hidden className="size-4 text-success" />
                  <span>
                    <span className="num font-semibold">{check.candidates.length}</span> {msg().mapping.readable}
                    <span className="text-muted-foreground">
                      {" "}
                      (<span className="num">{check.candidates.length - income}</span> {msg().mapping.expense}, <span className="num">{income}</span> {msg().mapping.income})
                    </span>
                  </span>
                </span>
                {check.errors.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <TriangleAlert aria-hidden className="size-4 text-warning" />
                    <span>
                      <span className="num font-semibold">{check.errors.length}</span> {msg().mapping.badRows}
                    </span>
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-danger">
                <CircleAlert aria-hidden className="size-4" />
                <span className="text-foreground">{msg().mapping.pickThree}</span>
              </span>
            )}
          </div>
          <CsvPreviewTable parsed={parsed} limit={8} mapping={mapping} errorLines={errorLines} />
          {parsed.rows.length > 8 && (
            <p className="mt-2 text-xs text-muted-foreground">
              <span className="num">{msg().mapping.showing(parsed.rows.length)}</span>
            </p>
          )}
        </Panel>

        {mappingOk && check.errors.length > 0 && (
          <Panel
            title={msg().mapping.unreadable(check.errors.length)}
            icon={<TriangleAlert aria-hidden className="size-5 text-warning" />}
            description={msg().mapping.unreadableHelp}
          >
            <ErrorList errors={check.errors} />
          </Panel>
        )}
      </div>
    </div>
  );
}
