"use client";

import { ArrowDownLeft, ArrowUpRight, CircleAlert, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import * as React from "react";
import type { Category, QuickEntryPreview, TransactionType, Wallet } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryChip } from "@/components/category-icon";
import { useServiceQuery } from "@/hooks/use-service-query";
import { transactionService } from "@/services";
import { formatDate, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

const vnd = new Intl.NumberFormat("vi-VN");

function addDays(iso: string, delta: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

interface Props {
  preview: QuickEntryPreview;
  onChange: (next: QuickEntryPreview) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}

/** Bản xem trước kết quả AI; mọi trường sửa được trước khi lưu (≤ 3 lần bấm, PRD §8) */
export function QuickEntryPreviewForm({ preview, onChange, onSave, onCancel, saving, error }: Props) {
  const ids = React.useId();
  const { data: categories } = useServiceQuery(() => transactionService.listCategories());
  const { data: wallets } = useServiceQuery(() => transactionService.listWallets());
  const today = transactionService.getToday();

  const set = <K extends keyof QuickEntryPreview>(key: K, value: QuickEntryPreview[K]) =>
    onChange({ ...preview, [key]: value });

  const setType = (type: TransactionType) => {
    if (type === preview.type) return;
    // Đổi loại → danh mục mặc định của loại đó, AI coi như chưa chắc
    onChange({ ...preview, type, categoryId: type === "income" ? "c-income-other" : "c-other", confidence: 0.5 });
  };

  const typeCategories = (categories ?? []).filter((c: Category) => c.type === preview.type);
  const confident = preview.confidence >= 0.7;
  const dateOptions = Array.from({ length: 7 }, (_, i) => addDays(today, -i));
  if (!dateOptions.includes(preview.date)) dateOptions.push(preview.date);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="flex flex-col gap-4"
      aria-label="Xem trước giao dịch"
    >
      {/* Số tiền + loại */}
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${ids}-amount`} className="mb-1.5 block text-[13px] font-medium">
            Số tiền
          </label>
          <div className="relative">
            <Input
              id={`${ids}-amount`}
              inputMode="numeric"
              autoComplete="off"
              value={preview.amount ? vnd.format(preview.amount) : ""}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, "");
                set("amount", digits ? Number(digits) : null);
              }}
              aria-invalid={!preview.amount || undefined}
              className={cn(
                "num pr-8 text-right text-xl font-semibold md:h-11 md:text-xl",
                preview.type === "income" ? "text-income" : "text-expense",
              )}
            />
            <span aria-hidden className="num pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground">
              đ
            </span>
          </div>
        </div>
        <div role="group" aria-label="Loại giao dịch" className="flex shrink-0 rounded-lg border p-0.5">
          {(["expense", "income"] as const).map((t) => {
            const active = preview.type === t;
            const Icon = t === "income" ? ArrowDownLeft : ArrowUpRight;
            return (
              <button
                key={t}
                type="button"
                aria-pressed={active}
                onClick={() => setType(t)}
                className={cn(
                  "inline-flex h-10 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors duration-150",
                  active
                    ? t === "income"
                      ? "bg-income-soft text-income"
                      : "bg-expense-soft text-expense"
                    : "text-muted-foreground hover:bg-row-hover",
                )}
              >
                <Icon aria-hidden className="size-4" />
                {t === "income" ? "Thu" : "Chi"}
              </button>
            );
          })}
        </div>
      </div>

      {/* Danh mục + độ tin cậy AI */}
      <div>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <label htmlFor={`${ids}-cat`} className="text-[13px] font-medium">
            Danh mục
          </label>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium",
              confident ? "bg-accent text-info" : "bg-muted text-warning",
            )}
          >
            {confident ? <Sparkles aria-hidden className="size-3" /> : <TriangleAlert aria-hidden className="size-3" />}
            {confident ? "AI gợi ý" : "Cần bạn kiểm tra"} · <span className="num">{formatPercent(preview.confidence * 100)}</span>
          </span>
        </div>
        <Select value={preview.categoryId ?? undefined} onValueChange={(v) => onChange({ ...preview, categoryId: v, confidence: 1 })}>
          <SelectTrigger id={`${ids}-cat`} className="w-full">
            <SelectValue placeholder="Chọn danh mục" />
          </SelectTrigger>
          <SelectContent>
            {typeCategories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <CategoryChip name={c.name} color={c.color} className="text-sm" />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor={`${ids}-date`} className="mb-1.5 block text-[13px] font-medium">
            Ngày
          </label>
          <Select value={preview.date} onValueChange={(v) => set("date", v)}>
            <SelectTrigger id={`${ids}-date`} className="num w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {dateOptions.map((d, i) => (
                <SelectItem key={d} value={d}>
                  <span className="num">{formatDate(d)}</span>
                  {i === 0 && d === today && <span className="text-muted-foreground"> · Hôm nay</span>}
                  {i === 1 && <span className="text-muted-foreground"> · Hôm qua</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <label htmlFor={`${ids}-wallet`} className="mb-1.5 block text-[13px] font-medium">
            Ví
          </label>
          <Select value={preview.walletId} onValueChange={(v) => set("walletId", v)}>
            <SelectTrigger id={`${ids}-wallet`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(wallets ?? []).map((w: Wallet) => (
                <SelectItem key={w.id} value={w.id}>
                  {w.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <label htmlFor={`${ids}-desc`} className="mb-1.5 block text-[13px] font-medium">
          Mô tả
        </label>
        <Input id={`${ids}-desc`} value={preview.description} onChange={(e) => set("description", e.target.value)} />
      </div>

      {error && (
        <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {error}
        </p>
      )}

      <div className="flex items-center justify-between gap-3 border-t pt-4">
        <p className="hidden text-xs text-muted-foreground md:block">
          <kbd className="num rounded border px-1">Enter</kbd> lưu · <kbd className="num rounded border px-1">Esc</kbd> huỷ
        </p>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={onCancel} disabled={saving} className="max-md:h-11">
            Huỷ
          </Button>
          <Button type="submit" disabled={saving} aria-busy={saving} className="min-w-24 max-md:h-11">
            {saving ? (
              <>
                <Loader2 aria-hidden className="animate-spin" /> Đang lưu…
              </>
            ) : (
              "Lưu"
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
