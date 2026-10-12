/**
 * Logic thuần cho luật phân loại theo từ khoá (F08) — không phụ thuộc mock db,
 * dùng chung cho service và test.
 */
import type { TransactionStatus, TransactionType } from "@/types";
import { normalize } from "@/lib/text";

const STOP_WORDS = new Set([
  "ck", "chuyen", "tien", "thanh", "toan", "qr", "tt", "vnpay", "momo", "zalopay", "shopeepay",
  "pos", "the", "atm", "ref", "ft", "ibft", "den", "tu", "cho", "nap", "dt", "hcm", "hn",
  "rut", "giao", "dich", "gd", "cf",
]);

/** Cổng thanh toán đứng trước dấu "*": bản thân không nói lên giao dịch là gì (VNPAY*BHX → BHX) */
const PAYMENT_GATEWAYS = new Set(["vnpay", "momo", "zalopay", "shopeepay", "payoo", "viettelpay", "vnptpay"]);

const isWord = (t: string) => !/\d/.test(t) && !STOP_WORDS.has(t);

/**
 * Đoán từ khoá đủ cụ thể để tạo luật từ nội dung sao kê:
 * - "GRAB*RIDE 8812 HCM"          → "GRAB*RIDE" (giữ phần dịch vụ để tách GRAB*RIDE với GRAB*FOOD)
 * - "VNPAY*BHX 0021 Q3"           → "BHX"       (bỏ tiền tố cổng thanh toán)
 * - "HIGHLANDS CF NGUYEN HUE"     → "HIGHLANDS"
 * - "CK NGUYEN VAN A chuyen tien" → "NGUYEN VAN A"
 * Trả "" nếu không có từ nào đủ đặc trưng (vd. "THANH TOAN QR 0912XXX").
 */
export function extractKeyword(description: string): string {
  const norm = normalize(description).trim();

  // Chuyển khoản cho người: lấy họ tên (tối đa 3 từ)
  if (/^(ck|chuyen tien|chuyen khoan)\b/.test(norm)) {
    return norm
      .split(/[^a-z0-9]+/)
      .filter((t) => t && isWord(t))
      .slice(0, 3)
      .join(" ")
      .toUpperCase();
  }

  // Dạng MERCHANT*DỊCH_VỤ của sao kê thẻ / ví
  const star = norm.match(/^([a-z0-9]+)\*([a-z0-9]+)/);
  if (star) {
    const [, merchant, service] = star;
    if (PAYMENT_GATEWAYS.has(merchant)) {
      if (isWord(service) && service.length >= 2) return service.toUpperCase();
    } else if (isWord(service)) {
      return `${merchant}*${service}`.toUpperCase();
    } else if (isWord(merchant)) {
      return merchant.toUpperCase(); // "GRAB*8812" → "GRAB"
    }
  }

  const word = norm.split(/[^a-z0-9]+/).find((t) => t.length >= 2 && isWord(t));
  return word ? word.toUpperCase() : "";
}

/** Từ khoá khớp nội dung: không phân biệt hoa thường / dấu, khớp chuỗi con */
export function matchesKeyword(description: string, keyword: string): boolean {
  const k = normalize(keyword.trim());
  return k.length > 0 && normalize(description).includes(k);
}

interface RuleCandidate {
  id: string;
  description: string;
  categoryId: string;
  type: TransactionType;
  status: TransactionStatus;
}

export interface RulePlanItem<T extends RuleCandidate> {
  transaction: T;
  /** Đang ở danh mục khác với danh mục của luật → sẽ bị đổi (cần cảnh báo) */
  conflict: boolean;
  /** Khác loại thu/chi với danh mục của luật → luật KHÔNG áp dụng */
  typeMismatch: boolean;
}

/**
 * Các giao dịch chờ duyệt mà luật (keyword → category) sẽ chạm tới.
 * Dùng cho cả bản xem trước lẫn lúc áp dụng thật, nên hai bên luôn khớp nhau.
 */
export function planRuleApplication<T extends RuleCandidate>(
  transactions: readonly T[],
  keyword: string,
  category: { id: string; type: TransactionType },
  excludeId?: string,
): RulePlanItem<T>[] {
  return transactions
    .filter((t) => t.status === "pending" && t.id !== excludeId && matchesKeyword(t.description, keyword))
    .map((t) => {
      const typeMismatch = t.type !== category.type;
      return { transaction: t, typeMismatch, conflict: !typeMismatch && t.categoryId !== category.id };
    });
}
