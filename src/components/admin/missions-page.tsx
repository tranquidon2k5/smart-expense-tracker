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
import { getMessages } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { adminMessages } from "@/i18n/messages/admin";
import { te } from "@/i18n/errors";

const msg = () => getMessages(adminMessages);

const periodLabel = (p: MissionPeriod) => msg().missions.periods[p];

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
      toast.success(editing ? msg().missions.saved : msg().missions.added);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? te(err.message) : msg().saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !saving && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? msg().missions.editTitle : msg().missions.addTitle}</DialogTitle>
          <DialogDescription>{msg().missions.dialogText}</DialogDescription>
        </DialogHeader>
        <form id="mission-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ms-title" className="text-[13px]">
              {msg().missions.name}
            </Label>
            <Input id="ms-title" autoFocus value={form.title} maxLength={60} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder={msg().missions.placeholder} />
          </div>
          <fieldset disabled={!!editing} className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">{msg().missions.period}</legend>
            <div className="inline-flex w-fit rounded-lg border p-0.5" role="radiogroup" aria-label={msg().missions.period}>
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
                  {periodLabel(p)}
                </button>
              ))}
            </div>
            {editing && <p className="text-xs text-muted-foreground">{msg().missions.periodLocked}</p>}
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-target" className="text-[13px]">
                {msg().missions.target}
              </Label>
              <Input id="ms-target" inputMode="numeric" className="num" value={form.target} onChange={(e) => setForm((f) => ({ ...f, target: e.target.value.replace(/\D/g, "") }))} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ms-xp" className="text-[13px]">
                {msg().missions.xp}
              </Label>
              <Input id="ms-xp" inputMode="numeric" className="num" value={form.xp} onChange={(e) => setForm((f) => ({ ...f, xp: e.target.value.replace(/\D/g, "") }))} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ms-active" checked={form.isActive} onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))} />
            <Label htmlFor="ms-active" className="text-sm font-normal">
              {msg().missions.assigned}
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
            {getMessages(commonMessages).cancel}
          </Button>
          <Button type="submit" form="mission-form" disabled={saving}>
            {saving && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
            {editing ? msg().save : msg().missions.add}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function MissionsPage() {
  const list = useServiceQuery(() => adminService.listMissions(), "", { raw: true });
  const [dialog, setDialog] = React.useState<{ open: boolean; editing: Mission | null }>({ open: false, editing: null });

  const toggle = async (m: Mission, isActive: boolean) => {
    try {
      await adminService.saveMission({ ...m, isActive });
      toast.success(isActive ? msg().missions.on(m.title) : msg().missions.off(m.title));
    } catch (e) {
      toast.error(e instanceof Error ? te(e.message) : msg().updateFailed);
    }
  };

  return (
    <>
      <AdminHeader
        title={msg().missions.title}
        description={msg().missions.intro}
        actions={
          <Button size="sm" onClick={() => setDialog({ open: true, editing: null })}>
            <Plus aria-hidden /> {msg().missions.add}
          </Button>
        }
      />
      <Panel className="p-0 md:p-0">
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <Table aria-label={msg().missions.tableLabel}>
            <TableHeader className="bg-surface-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead>{msg().code}</TableHead>
                <TableHead>{msg().missions.mission}</TableHead>
                <TableHead>{msg().missions.period}</TableHead>
                <TableHead className="text-right">{msg().missions.targetShort}</TableHead>
                <TableHead className="text-right">XP</TableHead>
                <TableHead>{msg().missions.assignedShort}</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">{getMessages(commonMessages).actions}</span>
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
                      <TableCell>{periodLabel(m.period)}</TableCell>
                      <TableCell className="num text-right">{m.target}</TableCell>
                      <TableCell className="num text-right text-xp-text">+{m.xp}</TableCell>
                      <TableCell>
                        <Switch checked={m.isActive !== false} onCheckedChange={(v) => void toggle(m, v)} aria-label={msg().missions.assignLabel(m.title)} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon-xs" variant="ghost" aria-label={msg().editItem(m.title)} title={msg().edit} onClick={() => setDialog({ open: true, editing: m })} className="max-md:size-9">
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
