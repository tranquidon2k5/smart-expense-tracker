import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";

/** Hậu tố XP cho thông báo: "+10 XP", hoặc rỗng khi đã chạm giới hạn trong ngày */
export function xpSuffix(result: { xpGained: number; xpLimitReached: boolean }): string {
  return result.xpLimitReached || result.xpGained <= 0 ? "" : ` · +${result.xpGained} XP`;
}

/** Câu giải thích tích cực khi đã nhận đủ XP hôm nay (PRD §6.1: không trách móc) — theo ngôn ngữ giao diện */
export const XP_LIMIT_NOTE = {
  get add_transaction() {
    return getMessages(commonMessages).xpLimit.add_transaction;
  },
  get review() {
    return getMessages(commonMessages).xpLimit.review;
  },
};
