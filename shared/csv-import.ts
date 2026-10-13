/**
 * Logic thuần cho nhập sao kê CSV (F09): đọc CSV, đoán cột, đọc ngày/số tiền kiểu Việt Nam,
 * kiểm tra từng dòng và tìm giao dịch trùng. Không phụ thuộc mock db → dùng chung cho
 * service, giao diện (xem trước khi ánh xạ cột) và test.
 */
import type {
  AmountMode,
  CsvColumnMapping,
  ImportCandidate,
  ImportDuplicate,
  ImportField,
  ImportRowError,
  ParsedCsv,
  TransactionType,
} from "./types";
import { normalize } from "./text";

export const CSV_MAX_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_ROWS = 5000;
export const IMPORT_FIELDS: ImportField[] = ["date", "amount", "description"];
export const FIELD_LABEL: Record<ImportField, string> = { date: "Ngày", amount: "Số tiền", description: "Nội dung" };

/** Lỗi định dạng file: thông báo đọc được cho người dùng */
export class CsvFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvFormatError";
  }
}

// ───────────── Đọc CSV ─────────────

const DELIMITERS = [",", ";", "\t", "|"] as const;

/** Tách CSV theo RFC 4180: hỗ trợ ô trong ngoặc kép, "" là dấu nháy, xuống dòng trong ô */
export function splitCsv(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell.trim() === "") {
      quoted = true;
      cell = "";
    } else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim()));
}

/** Chọn dấu phân cách cho số cột nhiều nhất và đều nhất trên các dòng đầu */
export function detectDelimiter(text: string): string {
  const sample = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 10).join("\n");
  let best: string = ",";
  let bestScore = 0;
  for (const d of DELIMITERS) {
    const rows = splitCsv(sample, d);
    const counts = rows.map((r) => r.length);
    const cols = Math.min(...counts);
    if (cols < 2) continue;
    const consistent = counts.filter((c) => c === counts[0]).length / counts.length;
    const score = cols * consistent;
    if (score > bestScore) {
      best = d;
      bestScore = score;
    }
  }
  return best;
}

/** Dòng đầu là tiêu đề nếu không ô nào đọc được thành ngày hoặc số tiền */
function looksLikeHeader(row: string[]): boolean {
  return row.every((c) => parseVnDate(c) === null && parseVnAmount(c) === null);
}

/**
 * Đọc nội dung CSV đã giải mã. Ném CsvFormatError khi file không phải bảng CSV dùng được:
 * rỗng, nhị phân, ít hơn 3 cột, không có dòng dữ liệu, quá nhiều dòng.
 */
export function parseCsvText(raw: string, fileName: string): ParsedCsv {
  const text = raw.replace(/^﻿/, "");
  if (!text.trim()) throw new CsvFormatError("File trống, không có dữ liệu để nhập.");
  if (/[\u0000-\u0008\u000E-\u001F]/.test(text.slice(0, 4096))) {
    throw new CsvFormatError("File không phải dạng văn bản CSV. Nếu bạn có file Excel (.xlsx), hãy mở và lưu lại dưới dạng CSV.");
  }
  const delimiter = detectDelimiter(text);
  const all = splitCsv(text, delimiter);
  // Giữ số dòng thật trong file để báo lỗi chính xác; bỏ dòng trống
  const lines = all.map((cells, i) => ({ cells, line: i + 1 })).filter((r) => r.cells.some((c) => c !== ""));
  const width = Math.max(...lines.map((r) => r.cells.length));
  if (width < 3) {
    throw new CsvFormatError(
      "File cần ít nhất 3 cột: ngày, số tiền và nội dung. Hãy kiểm tra file có đúng là sao kê và dùng dấu phẩy hoặc chấm phẩy để ngăn cột.",
    );
  }
  const hasHeader = looksLikeHeader(lines[0].cells);
  const headerCells = hasHeader ? lines[0].cells : [];
  const headers = Array.from({ length: width }, (_, i) => headerCells[i]?.trim() || `Cột ${i + 1}`);
  const body = hasHeader ? lines.slice(1) : lines;
  if (body.length === 0) throw new CsvFormatError("File chỉ có dòng tiêu đề, chưa có giao dịch nào.");
  if (body.length > CSV_MAX_ROWS) {
    throw new CsvFormatError(`File có ${body.length} dòng, vượt giới hạn ${CSV_MAX_ROWS} dòng mỗi lần nhập. Hãy chia nhỏ file theo tháng.`);
  }
  return {
    fileName,
    delimiter,
    hasHeader,
    headers,
    rows: body.map((r) => Array.from({ length: width }, (_, i) => r.cells[i] ?? "")),
    lineNumbers: body.map((r) => r.line),
  };
}

// ───────────── Ngày & số tiền kiểu Việt Nam ─────────────

function validIso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1900 || y > 2100) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null; // 31/09, 29/02 năm thường
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/**
 * Ngày trong sao kê → "yyyy-MM-dd". Nhận dd/MM/yyyy, d/M/yy, dd-MM-yyyy, dd.MM.yyyy,
 * yyyy-MM-dd, có thể kèm giờ phía sau. Ngày kiểu Việt Nam (ngày trước tháng).
 * Trả null nếu không đọc được hoặc ngày không có thật.
 */
export function parseVnDate(value: string): string | null {
  const s = value.trim().split(/[ T]/)[0];
  let m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (m) return validIso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})$/);
  if (m) return validIso(+m[3], +m[2], +m[1]);
  return null;
}

/**
 * Số tiền trong sao kê → số nguyên đồng, có dấu. Nhận "-45.000", "45,000", "1.250.000đ",
 * "+15.000.000 VND", "(45.000)" (âm kiểu kế toán), "45000.00". Trả null nếu không phải số.
 */
export function parseVnAmount(value: string): number | null {
  let s = value.trim().replace(/\s/g, "").replace(/−/g, "-");
  if (!s) return null;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  s = s.replace(/(vnd|vnđ|đ|d)$/i, "");
  if (s.startsWith("-")) {
    negative = true;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);
  if (!/^\d[\d.,]*$/.test(s)) return null;

  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  let normalized: string;
  if (lastDot >= 0 && lastComma >= 0) {
    // Dấu xuất hiện sau cùng là dấu thập phân
    const dec = lastDot > lastComma ? "." : ",";
    const thousands = dec === "." ? "," : ".";
    normalized = s.split(thousands).join("").replace(dec, ".");
  } else {
    const sep = lastDot >= 0 ? "." : lastComma >= 0 ? "," : "";
    if (!sep) normalized = s;
    else {
      const parts = s.split(sep);
      // 45.000 / 1.250.000 → dấu nghìn; 45000.5 / 12,5 → dấu thập phân
      const grouped = parts.length > 1 && parts.slice(1).every((p) => p.length === 3) && parts[0].length <= 3;
      normalized = grouped ? parts.join("") : parts.length === 2 ? `${parts[0]}.${parts[1]}` : "";
    }
  }
  const n = Number(normalized);
  if (!normalized || !Number.isFinite(n)) return null;
  return Math.round(negative ? -n : n);
}

// ───────────── Đoán cột ─────────────

const HEADER_HINTS: Record<ImportField, string[]> = {
  date: ["ngay giao dich", "ngay gd", "ngay hach toan", "ngay", "date", "thoi gian", "time"],
  amount: ["so tien", "amount", "gia tri", "phat sinh", "money", "ps no", "ghi no"],
  description: ["noi dung", "mo ta", "dien giai", "description", "chi tiet", "ghi chu", "memo", "details"],
};
/** Cột số nhưng KHÔNG phải số tiền giao dịch */
const NOT_AMOUNT = ["so du", "balance", "so tham chieu", "ma gd", "ref", "stt"];

function headerScore(header: string, field: ImportField): number {
  const h = normalize(header);
  if (field === "amount" && NOT_AMOUNT.some((k) => h.includes(k))) return 0;
  const hints = HEADER_HINTS[field];
  const i = hints.findIndex((k) => h.includes(k));
  return i < 0 ? 0 : 100 - i;
}

function ratio(parsed: ParsedCsv, col: number, test: (v: string) => boolean): number {
  const sample = parsed.rows.slice(0, 50).map((r) => r[col] ?? "").filter((v) => v !== "");
  return sample.length ? sample.filter(test).length / sample.length : 0;
}

/**
 * Đoán cột Ngày / Số tiền / Nội dung: ưu tiên tên tiêu đề, không có thì dựa vào nội dung
 * (cột đọc được thành ngày, cột số, cột chữ dài nhất). Đồng thời đoán cách đọc số tiền:
 * có số âm → "âm là chi, dương là thu"; toàn số dương → "tất cả là khoản chi".
 */
export function guessMapping(parsed: ParsedCsv): { mapping: CsvColumnMapping; amountMode: AmountMode } {
  const cols = parsed.headers.map((_, i) => i);
  const used = new Set<number>();
  const pick = (field: ImportField, contentScore: (c: number) => number): number | null => {
    let best: number | null = null;
    let bestScore = 0;
    for (const c of cols) {
      if (used.has(c)) continue;
      const score = (parsed.hasHeader ? headerScore(parsed.headers[c], field) : 0) + contentScore(c);
      if (score > bestScore) {
        best = c;
        bestScore = score;
      }
    }
    if (best !== null) used.add(best);
    return best;
  };

  const isDate = (v: string) => parseVnDate(v) !== null;
  const isAmount = (v: string) => parseVnAmount(v) !== null && parseVnDate(v) === null;
  const date = pick("date", (c) => (ratio(parsed, c, isDate) >= 0.8 ? 50 : 0));
  const amount = pick("amount", (c) => {
    if (parsed.hasHeader && NOT_AMOUNT.some((k) => normalize(parsed.headers[c]).includes(k))) return 0;
    return ratio(parsed, c, isAmount) >= 0.8 ? 40 : 0;
  });
  const description = pick("description", (c) => {
    const sample = parsed.rows.slice(0, 50).map((r) => r[c] ?? "");
    const textual = ratio(parsed, c, (v) => /[a-zA-ZÀ-ỹ]/.test(v));
    const avgLen = sample.reduce((s, v) => s + v.length, 0) / Math.max(1, sample.length);
    return textual >= 0.6 ? 20 + Math.min(20, avgLen / 2) : 0;
  });

  const anyNegative =
    amount !== null && parsed.rows.some((r) => (parseVnAmount(r[amount] ?? "") ?? 0) < 0);
  return { mapping: { date, amount, description }, amountMode: anyNegative ? "signed" : "all_expense" };
}

/** Lỗi ánh xạ: thiếu cột bắt buộc hoặc một cột dùng cho hai trường */
export function mappingErrors(mapping: CsvColumnMapping): Partial<Record<ImportField, string>> {
  const errors: Partial<Record<ImportField, string>> = {};
  for (const f of IMPORT_FIELDS) {
    if (mapping[f] === null) errors[f] = `Chọn cột chứa ${FIELD_LABEL[f].toLowerCase()}`;
  }
  for (const f of IMPORT_FIELDS) {
    const other = IMPORT_FIELDS.find((g) => g !== f && mapping[g] !== null && mapping[g] === mapping[f]);
    if (other && !errors[f]) errors[f] = `Cột này đang dùng cho ${FIELD_LABEL[other].toLowerCase()}`;
  }
  return errors;
}

// ───────────── Kiểm tra từng dòng ─────────────

export interface RowsCheck {
  candidates: ImportCandidate[];
  errors: ImportRowError[];
}

/** Đọc từng dòng theo ánh xạ; dòng lỗi ghi rõ số dòng trong file, cột và giá trị gốc */
export function checkRows(parsed: ParsedCsv, mapping: CsvColumnMapping, amountMode: AmountMode, today: string): RowsCheck {
  const candidates: ImportCandidate[] = [];
  const errors: ImportRowError[] = [];
  if (Object.keys(mappingErrors(mapping)).length) return { candidates, errors };
  const { date: dc, amount: ac, description: tc } = mapping as Record<ImportField, number>;

  parsed.rows.forEach((row, i) => {
    const line = parsed.lineNumbers[i];
    const rawDate = row[dc] ?? "";
    const rawAmount = row[ac] ?? "";
    const description = (row[tc] ?? "").replace(/\s+/g, " ").trim();
    const fail = (field: ImportField, value: string, message: string) => errors.push({ line, field, value, message });

    const date = parseVnDate(rawDate);
    if (!rawDate) return fail("date", rawDate, "Thiếu ngày");
    if (!date) {
      const shaped = /^\d{1,4}[-/.]\d{1,2}[-/.]\d{2,4}/.test(rawDate.trim());
      return fail("date", rawDate, shaped ? "Ngày không có trên lịch (sai ngày hoặc tháng)" : "Ngày không đọc được (cần dạng dd/MM/yyyy)");
    }
    if (date > today) return fail("date", rawDate, "Ngày ở tương lai");

    const amount = parseVnAmount(rawAmount);
    if (!rawAmount) return fail("amount", rawAmount, "Thiếu số tiền");
    if (amount === null) return fail("amount", rawAmount, "Số tiền không đọc được");
    if (amount === 0) return fail("amount", rawAmount, "Số tiền bằng 0");

    if (!description) return fail("description", "", "Thiếu nội dung giao dịch");

    const type: TransactionType = amountMode === "all_expense" ? "expense" : amount < 0 ? "expense" : "income";
    candidates.push({ line, date, amount: Math.abs(amount), type, description: description.slice(0, 200) });
  });
  return { candidates, errors };
}

// ───────────── Trùng lặp ─────────────

export interface ExistingTransaction {
  id: string;
  date: string;
  amount: number;
  type: TransactionType;
  description: string;
}

const descKey = (s: string) => normalize(s).replace(/[^a-z0-9]+/g, " ").trim();

/**
 * Tách giao dịch trùng:
 * - Trùng giao dịch đã có trong ví đích: cùng ngày, cùng số tiền, cùng loại thu/chi.
 *   Mỗi giao dịch đã có chỉ khớp tối đa một dòng (hai ly cà phê 30k cùng ngày vẫn giữ được một).
 *   Nội dung có thể khác (sao kê "NETFLIX.COM" và bạn ghi "Netflix Premium").
 * - Trùng trong chính file: dòng giống hệt một dòng phía trên (ngày, số tiền, loại, nội dung).
 */
export function splitDuplicates(
  candidates: ImportCandidate[],
  existing: ExistingTransaction[],
): { fresh: ImportCandidate[]; duplicates: ImportDuplicate[] } {
  const pool = new Map<string, ExistingTransaction[]>();
  for (const t of existing) {
    const k = `${t.date}|${t.amount}|${t.type}`;
    pool.set(k, [...(pool.get(k) ?? []), t]);
  }
  // Ưu tiên khớp giao dịch cùng nội dung trước, rồi mới tới giao dịch khác nội dung
  const fresh: ImportCandidate[] = [];
  const duplicates: ImportDuplicate[] = [];
  const seenInFile = new Map<string, number>();
  for (const c of candidates) {
    const fileKey = `${c.date}|${c.amount}|${c.type}|${descKey(c.description)}`;
    const firstLine = seenInFile.get(fileKey);
    if (firstLine !== undefined) {
      duplicates.push({ ...c, reason: "in_file", matchLine: firstLine });
      continue;
    }
    seenInFile.set(fileKey, c.line);

    const list = pool.get(`${c.date}|${c.amount}|${c.type}`);
    if (list?.length) {
      const idx = Math.max(0, list.findIndex((t) => descKey(t.description) === descKey(c.description)));
      const [match] = list.splice(idx, 1);
      duplicates.push({ ...c, reason: "existing", matchId: match.id, matchDescription: match.description });
      continue;
    }
    fresh.push(c);
  }
  return { fresh, duplicates };
}
