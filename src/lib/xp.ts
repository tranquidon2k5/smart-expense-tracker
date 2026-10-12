/** Hậu tố XP cho thông báo: "+10 XP", hoặc rỗng khi đã chạm giới hạn trong ngày */
export function xpSuffix(result: { xpGained: number; xpLimitReached: boolean }): string {
  return result.xpLimitReached || result.xpGained <= 0 ? "" : ` · +${result.xpGained} XP`;
}

/** Câu giải thích tích cực khi đã nhận đủ XP hôm nay (PRD §6.1: không trách móc) */
export const XP_LIMIT_NOTE = {
  add_transaction: "Hôm nay bạn đã nhận đủ XP cho việc ghi giao dịch (10 lần). Cứ ghi tiếp để số liệu luôn chính xác nhé!",
  review: "Hôm nay bạn đã nhận đủ XP cho việc duyệt giao dịch (10 lần). Duyệt tiếp vẫn giúp AI phân loại chuẩn hơn.",
} as const;
