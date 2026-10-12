import type { ImportRequest, ImportResult, ParsedCsv, Transaction } from "@/types";
import * as db from "./mock/db";
import { failIfErrorScenario, simulateLatency } from "./mock/scenario";
import { applyToWallet, evaluateBadges, recordActivity, scopedTransactions, scopedWallets, toView } from "./mock/queries";
import { emitDataChanged } from "./events";
import { CSV_MAX_BYTES, CsvFormatError, checkRows, mappingErrors, parseCsvText, splitDuplicates } from "./csv-import";
import { CONFIDENCE_THRESHOLD, classifyDescription } from "./transaction.service";

export { CsvFormatError, checkRows, guessMapping, mappingErrors, FIELD_LABEL, IMPORT_FIELDS } from "./csv-import";

/** File mẫu kèm trong repo (public/mau) để demo */
export const SAMPLE_FILES = [
  {
    href: "/mau/sao-ke-techcombank-10-2026.csv",
    name: "sao-ke-techcombank-10-2026.csv",
    description: "Sao kê Techcombank 01–12/10/2026: có giao dịch trùng và giao dịch AI chưa chắc chắn",
  },
  {
    href: "/mau/sao-ke-co-loi.csv",
    name: "sao-ke-co-loi.csv",
    description: "File có vài dòng ngày/số tiền sai để xem cách báo lỗi",
  },
] as const;

/** Giải mã nội dung file: UTF-8 (có/không BOM), UTF-16 có BOM, hoặc Windows-1258 (Excel tiếng Việt cũ) */
function decode(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes);
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder("windows-1258").decode(bytes);
  }
}

/**
 * Bước 1: đọc file người dùng chọn (đọc thật nội dung file trên trình duyệt).
 * Ném CsvFormatError khi sai định dạng: không phải .csv, quá lớn, nhị phân, thiếu cột…
 */
export async function readCsvFile(file: Pick<File, "name" | "size" | "arrayBuffer">): Promise<ParsedCsv> {
  if (!/\.(csv|txt)$/i.test(file.name)) {
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toUpperCase() : "không rõ";
    throw new CsvFormatError(`File “${file.name}” có định dạng ${ext}. Sổ Tiền chỉ đọc được file CSV (.csv).`);
  }
  if (file.size > CSV_MAX_BYTES) {
    throw new CsvFormatError(`File nặng ${(file.size / 1024 / 1024).toFixed(1)} MB, vượt giới hạn 2 MB. Hãy chia nhỏ theo tháng.`);
  }
  await simulateLatency(300);
  return parseCsvText(decode(await file.arrayBuffer()), file.name);
}

/** Tải một file mẫu trong repo và đọc như file người dùng chọn */
export async function readSampleFile(href: string): Promise<ParsedCsv> {
  const res = await fetch(href);
  if (!res.ok) throw new Error("Không tải được file mẫu. Thử lại nhé.");
  const blob = await res.blob();
  return readCsvFile({ name: href.split("/").pop()!, size: blob.size, arrayBuffer: () => blob.arrayBuffer() });
}

/**
 * Bước 3 (Luồng 2): kiểm tra từng dòng → loại trùng → phân loại hàng loạt → lưu.
 * Độ tin cậy ≥ 0,7 ghi thẳng, thấp hơn vào hàng chờ duyệt. Dòng lỗi được bỏ qua và trả về để hiển thị.
 */
export async function importTransactions(req: ImportRequest): Promise<ImportResult> {
  await simulateLatency(900);
  failIfErrorScenario();
  const missing = Object.values(mappingErrors(req.mapping));
  if (missing.length) throw new Error(`Chưa ánh xạ đủ cột: ${missing.join("; ")}.`);
  const wallet = scopedWallets().find((w) => w.id === req.walletId);
  if (!wallet) throw new Error("Ví đích không tồn tại.");

  const { candidates, errors } = checkRows(req.file, req.mapping, req.amountMode, db.MOCK_TODAY);
  const existing = scopedTransactions().filter((t) => t.walletId === wallet.id);
  const { fresh, duplicates } = splitDuplicates(candidates, existing);

  const stamp = Date.now();
  const created: Transaction[] = fresh.map((c, i) => {
    const guess = classifyDescription(c.description, c.type);
    const categoryId = guess.category?.id ?? (c.type === "income" ? "c-income-other" : "c-other");
    return {
      id: `t-csv-${stamp}-${i}`,
      userId: db.USER_ID,
      walletId: wallet.id,
      categoryId,
      amount: c.amount,
      type: c.type,
      date: c.date,
      description: c.description,
      source: "csv",
      aiConfidence: guess.confidence,
      status: guess.confidence >= CONFIDENCE_THRESHOLD ? "confirmed" : "pending",
    };
  });

  if (created.length) {
    for (const t of created) {
      db.transactions.push(t);
      applyToWallet(t, 1);
    }
    // Nhập sao kê giữ chuỗi ngày nhưng không cộng XP theo từng dòng (tránh dồn XP hàng loạt)
    recordActivity("add_transaction");
    evaluateBadges();
    emitDataChanged();
  }

  return {
    fileName: req.file.fileName,
    wallet,
    created: created.map(toView),
    confirmedCount: created.filter((t) => t.status === "confirmed").length,
    pendingCount: created.filter((t) => t.status === "pending").length,
    duplicates,
    errors,
  };
}
