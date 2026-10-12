"use client";

import { CircleAlert, Loader2, Pencil, Plus } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { Mission, MissionPeriod } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ErrorState } from "@/components/error-state";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { adminService } from "@/services";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./admin-shell";

const PERIOD_LABEL: Record<MissionPeriod, string> = { daily: "Ngày", weekly: "Tuần" };

function MissionDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Mission | null }) {
  const [form, setForm] = React.useState({ title: "", period: "daily" as MissionPeriod, target: "3", xp: "20", isActive: true });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [lastKey, setLastKey] = React.useState<string | null>(null);
  const key = open ? (editing?.id ?? "new") : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (key) {
      setForm(
        editing
          ? { title: editing.title, period: editing.period, target: String(editing.target), xp: String(editing.xp), isActive: editing.isActive ?? true }
          : { title: "", period: "daily", target: "3", xp: "20", isActive: true },
      );
      setError(null);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminService.saveMission({
        id: editing?.id,
        title: form.title,
        period: form.period,
        target: Number(form.target),
        xp: Number(form.xp),
        isActive: form.isActive,
      });
      toast.success(editing ? "Đã lưu nhiệm vụ" : "Đã thêm nhiệm vụ");
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "Sửa nhiệm vụ" : "Thêm nhiệm vụ"}</DialogTitle>
          <DialogDescription>Nhiệm vụ thưởng hành vi ghi chép đều, không thưởng việc tiêu tiền (PRD §6.1). Ngày ~20 XP, tuần ~100 XP.</DialogDescription>
        </DialogHeader>
        <form id="mission-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ms-title" className="text-[13px]">
              Tên nhiệm vụ
            </Label>
            <Input id="ms-title" autoFocus value={form.title} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Vd. Ghi ít nhất 3 giao dịch" />
          </div>
          <fieldset disabled={!!editing} className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">Chu kỳ</legend>
            <div className="inline-flex w-fit rounded-lg border p-0.5" role="radiogroup" aria-label="Chu kỳ">
              {(["daily", "weekly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  role="radio"
                  aria-checked={form.period === p}
                  onClick={() => setForm((f) => ({ ...f, period: p, xp: p === "daily" ? "20" : "100" }))}
                  className={cn(
                    "h-8 rounded-md px-3 text-sm font-medium transition-colors duration-150 disabled:cursor-not-allowed",
                    form.period === p ? "bg-accent text-primary" : "text-muted-foreground hover:bg-row-hover",
                  )}
                >
                  {PERIOD_LABEL[p]}
                </button>
              ))}
            </div>
            {editing && <p className="text-xs text-muted-foreground">Không đổi chu kỳ của nhiệm vụ đang chạy; tạo nhiệm vụ mới nếu cần.</p>}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-target" className="text-[13px]">
                Mục tiêu (lần)
              </Label>
              <Input id="ms-target" inputMode="numeric" className="num" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value.replace(/\D/g, "") }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-xp" className="text-[13px]">
                XP thưởng
              </Label>
              <Input id="ms-xp" inputMode="numeric" className="num" value={form.xp} onChange={(e) => setForm((f) => ({ ...f, xp: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ms-active" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
            <Label htmlFor="ms-active" className="text-sm font-normal">
              Đang giao cho người dùng
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
          <Button type="submit" form="mission-form" disabled={saving}>
            {saving && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
            {editing ? "Lưu" : "Thêm nhiệm vụ"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MissionsPage() {
  const list = useServiceQuery(() => adminService.listMissions());
  const [dialog, setDialog] = React.useState<{ open: boolean; editing: Mission | null }>({ open: false, editing: null });

  const toggle = async (m: Mission, isActive: boolean) => {
    try {
      await adminService.saveMission({ ...m, isActive });
      toast.success(isActive ? `Đã bật “${m.title}”` : `Đã tắt “${m.title}”`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được");
    }
  };

  return (
    <>
      <AdminHeader
        title="Nhiệm vụ"
        description="Nhiệm vụ ngày làm mới lúc 00:00, nhiệm vụ tuần làm mới thứ Hai. Tắt nhiệm vụ thì người dùng không thấy nữa."
        actions={
          <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
            <Plus aria-hidden /> Thêm nhiệm vụ
          </Button>
        }
      />
      <Panel className="p-0 md:p-0">
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <Table aria-label="Danh sách nhiệm vụ">
            <TableHeader className="bg-surface-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead>Mã</TableHead>
                <TableHead>Nhiệm vụ</TableHead>
                <TableHead>Chu kỳ</TableHead>
                <TableHead className="text-right">Mục tiêu</TableHead>
                <TableHead className="text-right">XP</TableHead>
                <TableHead>Đang giao</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">Thao tác</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.loading
                ? Array.from({ length: 5 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={7}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : (list.data ?? []).map((m) => (
                    <TableRow key={m.id} className={cn(m.isActive === false && "text-muted-foreground")}>
                      <TableCell className="font-mono text-xs">{m.code}</TableCell>
                      <TableCell className="font-medium">{m.title}</TableCell>
                      <TableCell>{PERIOD_LABEL[m.period]}</TableCell>
                      <TableCell className="num text-right">{m.target}</TableCell>
                      <TableCell className="num text-right text-xp-text">+{m.xp}</TableCell>
                      <TableCell>
                        <Switch checked={m.isActive !== false} onCheckedChange={(v) => void toggle(m, v)} aria-label={`Giao nhiệm vụ ${m.title}`} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon-xs" variant="ghost" aria-label={`Sửa ${m.title}`} title="Sửa" onClick={() => setDialog({ open: true, editing: m })} className="max-md:size-9">
                          <Pencil aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <MissionDialog open={dialog.open} editing={dialog.editing} onOpenChange={(o) => setDialog((d) => ({ ...d, open: o }))} />
    </>
  );
}
