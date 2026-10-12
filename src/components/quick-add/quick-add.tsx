"use client";

import { CircleAlert, Loader2, Sparkles } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useQuickAdd } from "./quick-add-provider";
import { QuickEntryPreviewForm } from "./quick-entry-preview";
import { useQuickEntry } from "./use-quick-entry";

const PLACEHOLDER = "Ghi nhanh: hôm qua ăn phở 45k với Nam";

/** Ô Ghi nhanh trên thanh trên (≥ 768px). Phím tắt N. Kết quả AI hiện trong popover. */
export function QuickAddBar({ className }: { className?: string }) {
  const { inputRef } = useQuickAdd();
  const entry = useQuickEntry();
  const errorId = React.useId();
  const open = entry.status === "preview" || entry.status === "saving";

  return (
    <Popover open={open} onOpenChange={(o) => !o && entry.status !== "saving" && entry.cancel()}>
      <PopoverAnchor asChild>
        <form
          role="search"
          aria-label="Ghi nhanh giao dịch"
          onSubmit={(e) => {
            e.preventDefault();
            entry.parse();
          }}
          className={cn("relative w-full max-w-[480px]", className)}
        >
          <Sparkles aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
          <Input
            ref={inputRef}
            value={entry.text}
            onChange={(e) => entry.setText(e.target.value)}
            placeholder={PLACEHOLDER}
            aria-label="Ghi nhanh bằng câu tự nhiên, nhấn Enter để phân tích"
            aria-describedby={entry.error && !open ? errorId : undefined}
            aria-invalid={(entry.error && !open) || undefined}
            disabled={entry.status === "parsing"}
            className="h-10 bg-background pr-28 pl-9 md:h-10"
            autoComplete="off"
          />
          <span className="pointer-events-none absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1.5 text-xs text-muted-foreground">
            {entry.status === "parsing" ? (
              <span role="status" aria-live="polite" className="inline-flex items-center gap-1.5">
                <Loader2 aria-hidden className="size-3.5 animate-spin" /> Đang phân tích…
              </span>
            ) : (
              <kbd aria-hidden className="num rounded border bg-card px-1.5 py-0.5 text-[11px] font-medium">
                N
              </kbd>
            )}
          </span>
          {entry.error && !open && (
            <p id={errorId} role="alert" className="absolute top-full left-0 z-10 mt-1.5 flex items-center gap-1.5 rounded-lg border bg-popover px-2.5 py-1.5 text-xs text-danger shadow-md">
              <CircleAlert aria-hidden className="size-3.5 shrink-0" />
              {entry.error}
            </p>
          )}
        </form>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[min(480px,calc(100vw-32px))] rounded-xl p-4"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          inputRef.current?.focus();
        }}
      >
        <div className="mb-4">
          <p className="text-[15px] font-semibold">Xem trước giao dịch</p>
          <p className="mt-0.5 truncate text-[13px] text-muted-foreground">“{entry.preview?.rawText}”</p>
        </div>
        {entry.preview && (
          <QuickEntryPreviewForm
            preview={entry.preview}
            onChange={entry.setPreview}
            onSave={entry.save}
            onCancel={entry.cancel}
            saving={entry.status === "saving"}
            error={entry.error}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

/** Hộp thoại Ghi nhanh cho màn hình nhỏ (mở từ nút + ở bottom nav / thanh trên) */
export function QuickAddDialog() {
  const { dialogOpen, setDialogOpen } = useQuickAdd();
  const entry = useQuickEntry(() => setDialogOpen(false));
  const inputId = React.useId();

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(o) => {
        setDialogOpen(o);
        if (!o) entry.cancel();
      }}
    >
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-md max-sm:top-auto max-sm:bottom-0 max-sm:max-w-full max-sm:translate-y-0 max-sm:rounded-b-none max-sm:pb-[calc(16px+env(safe-area-inset-bottom))]">
        <DialogHeader>
          <DialogTitle>Ghi nhanh</DialogTitle>
          <DialogDescription>Gõ một câu, AI sẽ tách số tiền, ngày và danh mục giúp bạn.</DialogDescription>
        </DialogHeader>
        {entry.preview ? (
          <QuickEntryPreviewForm
            preview={entry.preview}
            onChange={entry.setPreview}
            onSave={entry.save}
            onCancel={entry.cancel}
            saving={entry.status === "saving"}
            error={entry.error}
          />
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              entry.parse();
            }}
            className="flex flex-col gap-3"
          >
            <label htmlFor={inputId} className="sr-only">
              Câu mô tả giao dịch
            </label>
            <Input
              id={inputId}
              autoFocus
              value={entry.text}
              onChange={(e) => entry.setText(e.target.value)}
              placeholder={PLACEHOLDER}
              autoComplete="off"
              aria-invalid={!!entry.error || undefined}
            />
            {entry.error && (
              <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
                <CircleAlert aria-hidden className="size-4 shrink-0" />
                {entry.error}
              </p>
            )}
            <Button type="submit" className="h-11" disabled={entry.status === "parsing"} aria-busy={entry.status === "parsing"}>
              {entry.status === "parsing" ? (
                <>
                  <Loader2 aria-hidden className="animate-spin" /> Đang phân tích…
                </>
              ) : (
                <>
                  <Sparkles aria-hidden /> Phân tích
                </>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
