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

const FIELD_HELP: Record<ImportField, string> = {
  date: "Ngày phát sinh giao dịch",
  amount: "Số tiền của từng giao dịch, không phải số dư",
  description: "Nội dung / diễn giải, dùng để AI phân loại",
};

const AMOUNT_MODES: { value: AmountMode; label: string; help: string }[] = [
  { value: "signed", label: "Số âm là chi, số dương là thu", help: "Sao kê tài khoản ngân hàng thường ghi kiểu này" },
  { value: "all_expense", label: "Tất cả là khoản chi", help: "Sao kê thẻ tín dụng, ví chỉ ghi số dương" },
];

export function ErrorList({ errors, limit }: { errors: ImportRowError[]; limit?: number }) {
  const shown = limit ? errors.slice(0, limit) : errors;
  return (
    <Table aria-label="Các dòng không đọc được" containerClassName="max-h-[320px] overflow-y-auto rounded-lg border">
      <TableHeader className="sticky top-0 z-10">
        <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
          <TableHead className="w-16 px-3 text-right">Dòng</TableHead>
          <TableHead className="w-24 px-3">Cột</TableHead>
          <TableHead className="px-3">Giá trị trong file</TableHead>
          <TableHead className="px-3">Vấn đề</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {shown.map((e) => (
          <TableRow key={`${e.line}-${e.field}`}>
            <TableCell className="num px-3 text-right font-medium">{e.line}</TableCell>
            <TableCell className="px-3">{importService.FIELD_LABEL[e.field]}</TableCell>
            <TableCell className="num max-w-[200px] truncate px-3" title={e.value}>
              {e.value ? `“${e.value}”` : <span className="text-muted-foreground">(trống)</span>}
            </TableCell>
            <TableCell className="px-3">
              <span className="flex items-center gap-1.5 text-danger">
                <CircleAlert aria-hidden className="size-4 shrink-0" />
                <span className="text-foreground">{e.message}</span>
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
      <Panel title="Ánh xạ cột" description="Sổ Tiền đã tự nhận diện cột, bạn kiểm tra lại nhé." className="xl:col-span-4">
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
                    Cột {importService.FIELD_LABEL[f].toLowerCase()} <span className="text-danger" aria-hidden>*</span>
                  </Label>
                  {auto && (
                    <span className="flex items-center gap-1 text-xs text-info">
                      <Sparkles aria-hidden className="size-3.5" /> Tự nhận diện
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
                    <SelectValue placeholder="Chọn cột…" />
                  </SelectTrigger>
                  <SelectContent>
                    {parsed.headers.map((h, i) => (
                      <SelectItem key={i} value={String(i)}>
                        {h}
                        <span className="text-muted-foreground"> · {parsed.rows[0]?.[i] || "(trống)"}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p id={`${id}-help`} className={cn("flex items-center gap-1 text-xs", err ? "text-danger" : "text-muted-foreground")}>
                  {err && <CircleAlert aria-hidden className="size-3.5 shrink-0" />}
                  {err ?? FIELD_HELP[f]}
                </p>
              </div>
            );
          })}

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-sm font-medium">Cách đọc số tiền</legend>
            {AMOUNT_MODES.map((m) => (
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
              Nhập vào ví <span className="text-danger" aria-hidden>*</span>
            </Label>
            {walletsLoading ? (
              <Skeleton className="h-9 w-full" />
            ) : (
              <Select value={walletId ?? ""} onValueChange={(v) => onChange({ walletId: v })}>
                <SelectTrigger id="map-wallet" className="w-full" aria-invalid={submitted && !walletId} aria-describedby="map-wallet-help">
                  <SelectValue placeholder="Chọn ví nhận giao dịch…" />
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
              {submitted && !walletId ? "Chọn ví để nhập giao dịch" : "Giao dịch trùng được so với các giao dịch đã có trong ví này"}
            </p>
          </div>

          {error && !importing && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-expense-soft px-3 py-2.5 text-sm">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <p className="font-medium">Chưa nhập được giao dịch</p>
                <p className="mt-0.5">{error.message} Sổ của bạn chưa bị thay đổi.</p>
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-between gap-2 border-t pt-4">
            <Button type="button" variant="ghost" onClick={onBack} disabled={importing}>
              <ArrowLeft aria-hidden /> Quay lại
            </Button>
            <Button type="submit" disabled={importing || (mappingOk && check.candidates.length === 0)}>
              {importing && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
              {importing ? (
                "Đang nhập…"
              ) : (
                <span>
                  {error ? "Thử lại: nhập " : "Nhập "}
                  <span className="num">{check.candidates.length}</span> dòng
                </span>
              )}
            </Button>
          </div>
        </form>
      </Panel>

      <div className="flex min-w-0 flex-col gap-4 md:gap-5 xl:col-span-8 xl:gap-6">
        <Panel
          title="Đọc thử"
          description={`Áp dụng ánh xạ hiện tại lên toàn bộ ${parsed.rows.length} dòng của ${parsed.fileName}`}
        >
          <div role="status" aria-live="polite" className="mb-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            {mappingOk ? (
              <>
                <span className="flex items-center gap-1.5">
                  <CircleCheck aria-hidden className="size-4 text-success" />
                  <span>
                    <span className="num font-semibold">{check.candidates.length}</span> dòng đọc được
                    <span className="text-muted-foreground">
                      {" "}
                      (<span className="num">{check.candidates.length - income}</span> chi, <span className="num">{income}</span> thu)
                    </span>
                  </span>
                </span>
                {check.errors.length > 0 && (
                  <span className="flex items-center gap-1.5">
                    <TriangleAlert aria-hidden className="size-4 text-warning" />
                    <span>
                      <span className="num font-semibold">{check.errors.length}</span> dòng lỗi sẽ được bỏ qua
                    </span>
                  </span>
                )}
              </>
            ) : (
              <span className="flex items-center gap-1.5 text-danger">
                <CircleAlert aria-hidden className="size-4" />
                <span className="text-foreground">Chọn đủ 3 cột khác nhau để đọc thử file.</span>
              </span>
            )}
          </div>
          <CsvPreviewTable parsed={parsed} limit={8} mapping={mapping} errorLines={errorLines} />
          {parsed.rows.length > 8 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Đang hiện 8 trên <span className="num">{parsed.rows.length}</span> dòng.
            </p>
          )}
        </Panel>

        {mappingOk && check.errors.length > 0 && (
          <Panel
            title={`${check.errors.length} dòng không đọc được`}
            icon={<TriangleAlert aria-hidden className="size-5 text-warning" />}
            description="Sửa trong file rồi chọn lại file, hoặc tiếp tục nhập — các dòng này sẽ được bỏ qua."
          >
            <ErrorList errors={check.errors} />
          </Panel>
        )}
      </div>
    </div>
  );
}
