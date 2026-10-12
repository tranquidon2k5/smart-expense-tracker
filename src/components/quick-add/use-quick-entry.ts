"use client";

import * as React from "react";
import { toast } from "sonner";
import type { QuickEntryPreview } from "@/types";
import { transactionService } from "@/services";
import { formatMoney } from "@/lib/format";

type Status = "idle" | "parsing" | "preview" | "saving";

/** Luồng 1 PRD: gõ câu → AI trích xuất → xem trước → Lưu */
export function useQuickEntry(onSaved?: () => void) {
  const [text, setText] = React.useState("");
  const [status, setStatus] = React.useState<Status>("idle");
  const [preview, setPreview] = React.useState<QuickEntryPreview | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const parse = React.useCallback(async () => {
    const value = text.trim();
    if (!value) {
      setError("Gõ một câu, ví dụ: hôm qua ăn phở 45k với Nam");
      return;
    }
    setError(null);
    setStatus("parsing");
    try {
      const result = await transactionService.parseQuickEntry(value);
      setPreview(result);
      setStatus("preview");
    } catch {
      // PRD §8: AI lỗi vẫn cho nhập tay — mở preview trống để người dùng tự điền
      setStatus("idle");
      setError("Chưa phân tích được câu này. Bạn thử ghi rõ số tiền, ví dụ 45k.");
    }
  }, [text]);

  const save = React.useCallback(async () => {
    if (!preview) return;
    if (!preview.amount || preview.amount <= 0) {
      setError("Nhập số tiền lớn hơn 0đ");
      return;
    }
    setError(null);
    setStatus("saving");
    try {
      const result = await transactionService.createFromQuickEntry(preview);
      toast.success(`Đã lưu ${formatMoney(result.transaction.amount)} · +${result.xpGained} XP`, {
        description: result.message,
      });
      setText("");
      setPreview(null);
      setStatus("idle");
      onSaved?.();
    } catch (e) {
      setStatus("preview");
      setError(e instanceof Error ? e.message : "Lưu chưa thành công, bạn thử lại nhé.");
    }
  }, [preview, onSaved]);

  const cancel = React.useCallback(() => {
    setPreview(null);
    setStatus("idle");
    setError(null);
  }, []);

  return { text, setText, status, preview, setPreview, error, parse, save, cancel };
}
