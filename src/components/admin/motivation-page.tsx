"use client";

import { CircleAlert, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { MotivationContext, MotivationMessage } from "@/types";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState } from "@/components/error-state";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { adminService } from "@/services";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./admin-shell";

const MAX = 200;
const contextLabel = (c: MotivationContext) => adminService.MOTIVATION_CONTEXTS.find((x) => x.value === c)?.label ?? c;

/** Tô biến {name}, {streak}… để admin thấy chỗ sẽ được thay */
function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^}]*\})/g).map((part, i) =>
        /^\{[^}]*\}$/.test(part) ? (
          <code key={i} className="rounded bg-accent px-1 font-mono text-xs text-primary">
            {part}
          </code>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        ),
      )}
    </>
  );
}

function MessageDialog({
  open,
  onOpenChange,
  editing,
  defaultContext,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: MotivationMessage | null;
  defaultContext: MotivationContext;
}) {
  const [context, setContext] = React.useState<MotivationContext>(defaultContext);
  const [template, setTemplate] = React.useState("");
  const [isActive, setIsActive] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const textRef = React.useRef<HTMLTextAreaElement>(null);

  const [lastKey, setLastKey] = React.useState<string | null>(null);
  const key = open ? (editing?.id ?? `new-${defaultContext}`) : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setContext(editing?.context ?? defaultContext);
      setTemplate(editing?.template ?? "");
      setIsActive(editing?.isActive ?? true);
      setError(null);
    }
  }

  const bad = adminService.unknownVariables(template);

  const insert = (v: string) => {
    const el = textRef.current;
    const start = el?.selectionStart ?? template.length;
    const end = el?.selectionEnd ?? template.length;
    const next = template.slice(0, start) + v + template.slice(end);
    setTemplate(next.slice(0, MAX));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + v.length, start + v.length);
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminService.saveMotivationMessage({ id: editing?.id, context, template, isActive });
      toast.success(editing ? "Đã lưu câu khích lệ" : "Đã thêm câu khích lệ");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa câu khích lệ" : "Thêm câu khích lệ"}</DialogTitle>
          <DialogDescription>Giọng tích cực, không trách móc (PRD §6.1). Hệ thống ưu tiên câu chưa hiện trong 7 ngày để tránh lặp.</DialogDescription>
        </DialogHeader>
        <form id="motivation-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mm-context" className="text-[13px]">
              Ngữ cảnh
            </Label>
            <Select value={context} onValueChange={(v) => setContext(v as MotivationContext)}>
              <SelectTrigger id="mm-context" className="w-full" aria-describedby="mm-context-help">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {adminService.MOTIVATION_CONTEXTS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p id="mm-context-help" className="text-xs text-muted-foreground">
              Hiện khi: {adminService.MOTIVATION_CONTEXTS.find((c) => c.value === context)?.when}
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="mm-template" className="text-[13px]">
                Nội dung
              </Label>
              <span className={cn("num text-xs", template.length >= MAX ? "text-danger" : "text-muted-foreground")} aria-live="polite">
                {template.length}/{MAX}
              </span>
            </div>
            <Textarea
              id="mm-template"
              ref={textRef}
              rows={3}
              maxLength={MAX}
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              aria-invalid={bad.length > 0 || !!error}
              aria-describedby="mm-vars"
              placeholder="Vd. Chào {name}! Chuỗi của bạn đang là {streak} ngày, giữ lửa nhé."
            />
            <div id="mm-vars" className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              Chèn biến:
              {adminService.MOTIVATION_VARIABLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => insert(v.key)}
                  className="rounded-md border px-1.5 py-0.5 font-mono text-xs text-primary transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  title={v.label}
                >
                  {v.key}
                </button>
              ))}
            </div>
            {bad.length > 0 && (
              <p className="flex items-center gap-1 text-xs text-danger">
                <CircleAlert aria-hidden className="size-3.5" /> Biến không hỗ trợ: {bad.join(", ")}
              </p>
            )}
          </div>

          <div className="rounded-lg bg-accent px-3 py-2.5">
            <p className="text-xs font-medium text-muted-foreground">Xem trước (dữ liệu mẫu)</p>
            <p className="mt-1 text-sm">{template.trim() ? adminService.previewTemplate(template) : "—"}</p>
          </div>

          <div className="flex items-center gap-2">
            <Switch id="mm-active" checked={isActive} onCheckedChange={setIsActive} />
            <Label htmlFor="mm-active" className="text-sm font-normal">
              Đang dùng
            </Label>
          </div>

          {error && (
            <p role="alert" className="flex items-center gap-1.5 text-sm text-danger">
              <CircleAlert aria-hidden className="size-4 shrink-0" />
              {error}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Huỷ
          </Button>
          <Button type="submit" form="motivation-form" disabled={saving || bad.length > 0}>
            {saving && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
            {editing ? "Lưu" : "Thêm câu"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MotivationPage() {
  const list = useServiceQuery(() => adminService.listMotivationMessages());
  const [contextFilter, setContextFilter] = React.useState<MotivationContext | "all">("all");
  const [dialog, setDialog] = React.useState<{ open: boolean; editing: MotivationMessage | null }>({ open: false, editing: null });
  const [deleting, setDeleting] = React.useState<MotivationMessage | null>(null);
  const [busy, setBusy] = React.useState(false);

  const rows = (list.data ?? [])
    .filter((m) => contextFilter === "all" || m.context === contextFilter)
    .sort(
      (a, b) =>
        adminService.MOTIVATION_CONTEXTS.findIndex((c) => c.value === a.context) - adminService.MOTIVATION_CONTEXTS.findIndex((c) => c.value === b.context),
    );

  const toggle = async (m: MotivationMessage, isActive: boolean) => {
    try {
      await adminService.setMotivationActive(m.id, isActive);
      toast.success(isActive ? "Đã bật câu" : "Đã tắt câu");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được");
    }
  };

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await adminService.deleteMotivationMessage(deleting.id);
      toast.success("Đã xoá câu khích lệ");
      setDeleting(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xoá được");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <AdminHeader
        title="Câu khích lệ"
        description={list.data ? `${list.data.length} câu · ${list.data.filter((m) => m.isActive).length} đang dùng · mỗi ngữ cảnh cần ít nhất 1 câu đang bật` : "Ngân hàng câu theo ngữ cảnh (PRD §6.3)"}
        actions={
          <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
            <Plus aria-hidden /> Thêm câu
          </Button>
        }
      />
      <Panel className="p-0 md:p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Label htmlFor="mm-filter" className="text-[13px] text-muted-foreground">
            Ngữ cảnh
          </Label>
          <Select value={contextFilter} onValueChange={(v) => setContextFilter(v as MotivationContext | "all")}>
            <SelectTrigger id="mm-filter" size="sm" className="w-60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tất cả ngữ cảnh</SelectItem>
              {adminService.MOTIVATION_CONTEXTS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <Table aria-label="Ngân hàng câu khích lệ">
            <TableHeader className="bg-surface-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-48">Ngữ cảnh</TableHead>
                <TableHead>Nội dung</TableHead>
                <TableHead className="w-24">Đang dùng</TableHead>
                <TableHead className="w-24 text-right">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.loading
                ? Array.from({ length: 6 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : rows.map((m) => (
                    <TableRow key={m.id} className={cn(!m.isActive && "text-muted-foreground")}>
                      <TableCell className="align-top">{contextLabel(m.context)}</TableCell>
                      <TableCell className="py-2 whitespace-normal">
                        <Highlighted text={m.template} />
                      </TableCell>
                      <TableCell>
                        <Switch checked={m.isActive} onCheckedChange={(v) => void toggle(m, v)} aria-label={`Dùng câu: ${m.template}`} />
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="inline-flex gap-0.5">
                          <Button size="icon-xs" variant="ghost" aria-label="Sửa câu" title="Sửa" onClick={() => setDialog({ open: true, editing: m })} className="max-md:size-9">
                            <Pencil aria-hidden />
                          </Button>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label="Xoá câu"
                            title="Xoá"
                            onClick={() => setDeleting(m)}
                            className="text-danger hover:bg-expense-soft hover:text-danger max-md:size-9"
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      <MessageDialog
        open={dialog.open}
        editing={dialog.editing}
        defaultContext={contextFilter === "all" ? "morning" : contextFilter}
        onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && !busy && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá câu khích lệ này?</AlertDialogTitle>
            <AlertDialogDescription>“{deleting?.template}”</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Giữ lại</AlertDialogCancel>
            <Button disabled={busy} onClick={() => void remove()} className="bg-danger text-white hover:bg-danger/90">
              {busy && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
              Xoá câu
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
