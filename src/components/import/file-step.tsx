"use client";

import { CircleAlert, CircleCheck, Download, FileSpreadsheet, FileUp, Loader2, Play } from "lucide-react";
import * as React from "react";
import type { ParsedCsv } from "@/types";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/panel";
import { importService } from "@/services";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { importMessages } from "@/i18n/messages/import";
import { te } from "@/i18n/errors";

const msg = () => getMessages(importMessages);
import { CsvPreviewTable } from "./csv-preview-table";


/**
 * Bước 1: kéo thả hoặc chọn file CSV → đọc thật nội dung file → xem trước vài dòng đầu.
 * Lỗi định dạng hiện ngay dưới vùng thả file (role="alert").
 */
export function FileStep({
  parsed,
  onParsed,
  onNext,
}: {
  parsed: ParsedCsv | null;
  onParsed: (p: ParsedCsv | null) => void;
  onNext: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);
  const [reading, setReading] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const readSeq = React.useRef(0);

  const read = async (name: string, job: () => Promise<ParsedCsv>) => {
    const seq = ++readSeq.current;
    setReading(name);
    setError(null);
    onParsed(null);
    try {
      const result = await job();
      if (seq === readSeq.current) onParsed(result);
    } catch (e) {
      if (seq === readSeq.current) setError(e instanceof Error ? te(e.message) : msg().file.readFailed);
    } finally {
      if (seq === readSeq.current) setReading(null);
    }
  };

  const readFile = (file: File | undefined) => {
    if (file) void read(file.name, () => importService.readCsvFile(file));
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 md:gap-5 xl:grid-cols-12 xl:gap-6">
      <div className="flex flex-col gap-4 md:gap-5 xl:col-span-8 xl:gap-6">
        <Panel title={msg().file.pickTitle} description={msg().file.pickText}>
          <div
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragging(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              readFile(e.dataTransfer.files[0]);
            }}
            className={cn(
              "flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors duration-150",
              dragging ? "border-primary bg-accent" : error ? "border-danger/60" : "border-border bg-surface-subtle",
            )}
          >
            <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-accent text-primary">
              {reading ? <Loader2 className="size-6 motion-safe:animate-spin" /> : <FileUp className="size-6" />}
            </span>
            {reading ? (
              <p role="status" className="text-[15px] font-medium">
                {msg().file.reading(reading)}
              </p>
            ) : (
              <>
                <p className="text-[15px] font-medium">{dragging ? msg().file.drop : msg().file.drag}</p>
                <p className="text-sm text-muted-foreground">
                  {msg().file.or}
                </p>
                <Button onClick={() => inputRef.current?.click()} className="max-md:h-11">
                  <FileSpreadsheet aria-hidden /> {msg().file.choose}
                </Button>
                <p className="text-xs text-muted-foreground">{msg().file.limits}</p>
              </>
            )}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              tabIndex={-1}
              aria-label={msg().file.choose}
              onChange={(e) => {
                readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>

          {error && (
            <div role="alert" className="mt-3 flex items-start gap-2 rounded-lg bg-expense-soft px-3 py-2.5 text-sm text-foreground">
              <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
              <div>
                <p className="font-medium">{msg().file.cantImport}</p>
                <p className="mt-0.5">{error}</p>
              </div>
            </div>
          )}
        </Panel>

        {parsed && (
          <Panel
            title={
              <span className="flex min-w-0 items-center gap-2">
                <CircleCheck aria-hidden className="size-5 shrink-0 text-success" />
                <span className="truncate">{parsed.fileName}</span>
              </span>
            }
            description={
              <>
                <span className="num">{parsed.rows.length}</span> {msg().file.rows} · <span className="num">{parsed.headers.length}</span> {msg().file.columns} ·{" "}
                {msg().file.separatedBy(msg().file.delimiters[parsed.delimiter] ?? parsed.delimiter)}
                {parsed.hasHeader ? "" : msg().file.noHeader}
                {msg().file.firstRows}
              </>
            }
          >
            <CsvPreviewTable parsed={parsed} limit={5} />
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => inputRef.current?.click()}>
                {msg().file.another}
              </Button>
              <Button onClick={onNext}>{msg().file.next}</Button>
            </div>
          </Panel>
        )}
      </div>

      <Panel title={msg().file.needsTitle} className="xl:col-span-4">
        <ul className="flex flex-col gap-2 text-sm">
          {msg().file.needs.map((t) => (
            <li key={t} className="flex items-start gap-2">
              <CircleCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
              {t}
            </li>
          ))}
        </ul>

        <h3 className="mt-5 mb-2 text-sm font-semibold">{msg().file.samplesTitle}</h3>
        <ul className="flex flex-col divide-y">
          {importService.SAMPLE_FILES.map((s) => (
            <li key={s.href} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0">
              <div>
                <p className="text-sm font-medium break-all">{s.name}</p>
                <p className="text-[13px] text-muted-foreground">{s.description}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!!reading}
                  onClick={() => void read(s.name, () => importService.readSampleFile(s.href))}
                  className="max-md:h-11"
                >
                  <Play aria-hidden /> {msg().file.useSample}
                </Button>
                <Button size="sm" variant="ghost" asChild className="text-muted-foreground max-md:h-11">
                  <a href={s.href} download>
                    <Download aria-hidden /> {msg().file.download}
                  </a>
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
