import type { CsvColumnMapping, ImportField, ParsedCsv } from "@/types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { importService } from "@/services";
import { cn } from "@/lib/utils";

/**
 * Bảng xem trước dữ liệu thô của file, kèm số dòng trong file.
 * Khi có `mapping`, cột đã chọn được đánh dấu bằng nhãn "Ngày / Số tiền / Nội dung" (không chỉ bằng màu).
 */
export function CsvPreviewTable({
  parsed,
  limit,
  mapping,
  errorLines,
}: {
  parsed: ParsedCsv;
  limit: number;
  mapping?: CsvColumnMapping;
  /** Dòng có lỗi → tô nền + biểu tượng chữ "Lỗi" */
  errorLines?: Set<number>;
}) {
  const fieldOf = (col: number): ImportField | undefined =>
    mapping ? importService.IMPORT_FIELDS.find((f) => mapping[f] === col) : undefined;

  return (
    <Table aria-label={`${limit} dòng đầu của file ${parsed.fileName}`} containerClassName="rounded-lg border">
      <TableHeader>
        <TableRow className="bg-surface-subtle hover:bg-surface-subtle">
          <TableHead className="w-16 px-3 text-right">Dòng</TableHead>
          {parsed.headers.map((h, i) => {
            const field = fieldOf(i);
            return (
              <TableHead key={i} className={cn("px-3 whitespace-nowrap", field && "text-foreground")}>
                <span className="flex flex-col gap-0.5 py-1">
                  {field && (
                    <span className="w-fit rounded-md bg-accent px-1.5 text-[11px] leading-[18px] font-semibold text-primary">
                      {importService.FIELD_LABEL[field]}
                    </span>
                  )}
                  {h}
                </span>
              </TableHead>
            );
          })}
        </TableRow>
      </TableHeader>
      <TableBody>
        {parsed.rows.slice(0, limit).map((row, r) => {
          const line = parsed.lineNumbers[r];
          const bad = errorLines?.has(line);
          return (
            <TableRow key={line} className={cn(bad && "bg-expense-soft/60 hover:bg-expense-soft/60")}>
              <TableCell className="num px-3 text-right text-muted-foreground">
                {bad && <span className="mr-1 text-[11px] font-semibold text-danger">Lỗi</span>}
                {line}
              </TableCell>
              {row.map((cell, c) => (
                <TableCell
                  key={c}
                  title={cell}
                  className={cn("max-w-[260px] truncate px-3", fieldOf(c) && "font-medium", /^[-+(]?\d/.test(cell) && "num")}
                >
                  {cell || <span className="text-muted-foreground">(trống)</span>}
                </TableCell>
              ))}
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
