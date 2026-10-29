"use client";

import { ArrowDownLeft, ArrowUpRight, Check, CircleAlert, Loader2, Shapes } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Category, CategoryInput, TransactionType } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CATEGORY_ICONS, CategoryChip } from "@/components/category-icon";
import { categoryService } from "@/services";
import { CATEGORY_COLORS, CATEGORY_ICON_OPTIONS, CATEGORY_NAME_MAX } from "@/lib/category-style";
import { cn } from "@/lib/utils";
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { categoriesMessages } from "@/i18n/messages/categories";
import { te } from "@/i18n/errors";

const msg = () => getMessages(categoriesMessages);

/**
 * Nhóm radio dạng lưới: Tab vào/ra một lần, mũi tên di chuyển + chọn (WAI-ARIA radiogroup).
 * `columns` để ↑/↓ nhảy theo hàng.
 */
function useRadioGrid<T>(items: readonly T[], selectedIndex: number, onSelect: (i: number) => void, columns: number) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);
  const onKeyDown = (e: React.KeyboardEvent, i: number) => {
    const map: Record<string, number> = {
      ArrowRight: 1,
      ArrowLeft: -1,
      ArrowDown: columns,
      ArrowUp: -columns,
    };
    let next: number | null = null;
    if (e.key in map) next = (i + map[e.key] + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    onSelect(next);
    refs.current[next]?.focus();
  };
  const itemProps = (i: number) => ({
    ref: (el: HTMLButtonElement | null) => {
      refs.current[i] = el;
    },
    role: "radio" as const,
    "aria-checked": i === selectedIndex,
    tabIndex: i === Math.max(0, selectedIndex) ? 0 : -1,
    onKeyDown: (e: React.KeyboardEvent) => onKeyDown(e, i),
    onClick: () => onSelect(i),
  });
  return itemProps;
}

export function CategoryFormDialog({
  open,
  onOpenChange,
  editing,
  defaultType,
  save,
  scope = "user",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** null = tạo mới */
  editing: Category | null;
  defaultType: TransactionType;
  /** Lưu theo cách khác (vd. admin lưu danh mục mặc định); bỏ trống = danh mục riêng của người dùng */
  save?: (input: CategoryInput, id?: string) => Promise<void>;
  /** "default": danh mục mặc định cho mọi người dùng (trang quản trị) */
  scope?: "user" | "default";
}) {
  const ids = React.useId();
  const [form, setForm] = React.useState<CategoryInput>(() => initial(editing, defaultType));
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Mở lại dialog → nạp dữ liệu mới (sửa danh mục khác hoặc tạo mới)
  const [lastKey, setLastKey] = React.useState<string | null>(null);
  const key = open ? (editing?.id ?? `new-${defaultType}`) : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setForm(initial(editing, defaultType));
      setError(null);
    }
  }

  const iconIndex = CATEGORY_ICON_OPTIONS.findIndex((o) => o.name === form.icon);
  const colorIndex = CATEGORY_COLORS.findIndex((c) => c.value === form.color);
  const iconProps = useRadioGrid(CATEGORY_ICON_OPTIONS, iconIndex, (i) => setForm((f) => ({ ...f, icon: CATEGORY_ICON_OPTIONS[i].name })), 10);
  const colorProps = useRadioGrid(CATEGORY_COLORS, colorIndex, (i) => setForm((f) => ({ ...f, color: CATEGORY_COLORS[i].value })), 8);

  const submit = async () => {
    const v = save ? (form.name.trim().length < 2 ? msg().form.nameMin : null) : categoryService.validateCategory(form, editing?.id);
    if (v) return setError(v);
    setError(null);
    setSaving(true);
    try {
      if (save) {
        await save(form, editing?.id);
        toast.success(editing ? msg().form.savedName(form.name.trim()) : msg().form.addedDefault(form.name.trim()));
      } else if (editing) {
        await categoryService.updateCategory(editing.id, { name: form.name, icon: form.icon, color: form.color });
        toast.success(msg().form.savedName(form.name.trim()));
      } else {
        await categoryService.createCategory(form);
        toast.success(msg().form.added(form.type === "income", form.name.trim()));
      }
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? te(e.message) : msg().form.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const PreviewIcon = CATEGORY_ICONS[form.icon] ?? Shapes;

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="max-h-[92svh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? msg().form.editTitle : msg().form.addTitle}
            {scope === "default" && msg().form.defaultSuffix}
          </DialogTitle>
          <DialogDescription>
            {editing
              ? msg().form.editText
              : scope === "default"
                ? msg().form.defaultText
                : msg().form.addText}
          </DialogDescription>
        </DialogHeader>

        <form
          id={`${ids}-form`}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="flex flex-col gap-5"
        >
          {/* Xem trước */}
          <div className="flex items-center gap-3 rounded-xl bg-muted px-4 py-3" aria-hidden>
            <span className="inline-flex size-10 items-center justify-center rounded-full" style={{ backgroundColor: `${form.color}1F`, color: form.color }}>
              <PreviewIcon className="size-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-semibold">{form.name.trim() || msg().form.namePreview}</span>
              <CategoryChip name={msg().group(form.type === "income")} color={form.color} className="text-muted-foreground" />
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor={`${ids}-name`} className="text-[13px] font-medium">
                  {msg().form.name}
                </label>
                <span className="num text-xs text-muted-foreground" aria-hidden>
                  {form.name.trim().length}/{CATEGORY_NAME_MAX}
                </span>
              </div>
              <Input
                id={`${ids}-name`}
                autoFocus
                value={form.name}
                maxLength={CATEGORY_NAME_MAX}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder={msg().form.namePlaceholder}
                aria-invalid={!!error || undefined}
              />
            </div>
            {!editing && (
              <div>
                <span id={`${ids}-type`} className="mb-1.5 block text-[13px] font-medium">
                  {msg().form.type}
                </span>
                <div role="radiogroup" aria-labelledby={`${ids}-type`} className="flex rounded-lg border p-0.5">
                  {(["expense", "income"] as const).map((t) => {
                    const active = form.type === t;
                    const Icon = t === "income" ? ArrowDownLeft : ArrowUpRight;
                    return (
                      <button
                        key={t}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setForm((f) => ({ ...f, type: t }))}
                        className={cn(
                          "inline-flex h-8 items-center gap-1 rounded-md px-3 text-sm font-medium transition-colors duration-150 max-md:h-10",
                          active
                            ? t === "income"
                              ? "bg-income-soft text-income"
                              : "bg-expense-soft text-expense"
                            : "text-muted-foreground hover:bg-row-hover",
                        )}
                      >
                        <Icon aria-hidden className="size-4" />
                        {t === "income" ? getMessages(commonMessages).income : getMessages(commonMessages).expense}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <fieldset>
            <legend id={`${ids}-icon`} className="mb-2 text-[13px] font-medium">
              {msg().form.icon}
            </legend>
            <div role="radiogroup" aria-labelledby={`${ids}-icon`} className="grid grid-cols-6 gap-1.5 sm:grid-cols-10">
              {CATEGORY_ICON_OPTIONS.map((opt, i) => {
                const Icon = CATEGORY_ICONS[opt.name];
                const active = i === iconIndex;
                return (
                  <button
                    key={opt.name}
                    type="button"
                    {...iconProps(i)}
                    aria-label={msg().icons[opt.name] ?? opt.label}
                    title={msg().icons[opt.name] ?? opt.label}
                    className={cn(
                      "inline-flex aspect-square min-h-10 items-center justify-center rounded-lg border transition-colors duration-150 hover:bg-row-hover",
                      active ? "border-2 bg-accent" : "border-transparent text-muted-foreground",
                    )}
                    style={active ? { borderColor: form.color, color: form.color } : undefined}
                  >
                    <Icon aria-hidden className="size-5" />
                  </button>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend id={`${ids}-color`} className="mb-2 text-[13px] font-medium">
              {msg().form.color} <span className="font-normal text-muted-foreground">· {msg().colors[CATEGORY_COLORS[colorIndex]?.value ?? ""]}</span>
            </legend>
            <div role="radiogroup" aria-labelledby={`${ids}-color`} className="flex flex-wrap gap-2">
              {CATEGORY_COLORS.map((c, i) => {
                const active = i === colorIndex;
                return (
                  <button
                    key={c.value}
                    type="button"
                    {...colorProps(i)}
                    aria-label={msg().colors[c.value] ?? c.name}
                    title={msg().colors[c.value] ?? c.name}
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-full transition-transform duration-150",
                      active && "ring-2 ring-foreground ring-offset-2 ring-offset-popover",
                    )}
                    style={{ backgroundColor: c.value }}
                  >
                    {active && <Check aria-hidden className="size-5 text-white" />}
                  </button>
                );
              })}
            </div>
          </fieldset>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {error}
            </p>
          )}
        </form>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            {getMessages(commonMessages).cancel}
          </Button>
          <Button type="submit" form={`${ids}-form`} disabled={saving} aria-busy={saving}>
            {saving && <Loader2 aria-hidden className="animate-spin" />}
            {editing ? msg().form.saveChanges : msg().form.addTitle}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function initial(editing: Category | null, type: TransactionType): CategoryInput {
  if (editing) return { name: editing.name, type: editing.type, icon: editing.icon, color: editing.color };
  return { name: "", type, icon: type === "income" ? "Coins" : "Shapes", color: CATEGORY_COLORS[0].value };
}
