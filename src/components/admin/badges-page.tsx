"use client";

import { CircleAlert, Loader2, Pencil } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { AdminBadgeRow } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AchievementIcon, ACHIEVEMENT_ICON_NAMES } from "@/components/achievement-icon";
import { ErrorState } from "@/components/error-state";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { adminService } from "@/services";
import { cn } from "@/lib/utils";
import { AdminHeader } from "./admin-shell";
import { getActiveLocale, getMessages, INTL_LOCALE } from "@/i18n/core";
import { commonMessages } from "@/i18n/messages/common";
import { adminMessages } from "@/i18n/messages/admin";
import { te } from "@/i18n/errors";

const msg = () => getMessages(adminMessages);

const nf = { format: (v: number) => new Intl.NumberFormat(INTL_LOCALE[getActiveLocale()]).format(v) };

function BadgeDialog({ badge, onClose }: { badge: AdminBadgeRow | null; onClose: () => void }) {
  const [form, setForm] = React.useState({ name: "", condition: "", icon: "Award" });
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const [lastId, setLastId] = React.useState<string | null>(null);
  if ((badge?.id ?? null) !== lastId) {
    setLastId(badge?.id ?? null);
    if (badge) {
      setForm({ name: badge.name, condition: badge.condition, icon: badge.icon });
      setError(null);
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!badge) return;
    setSaving(true);
    setError(null);
    try {
      await adminService.saveBadge({ id: badge.id, ...form });
      toast.success(msg().badges.saved(form.name.trim()));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? te(err.message) : msg().saveFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!badge} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{msg().badges.editTitle}</DialogTitle>
          <DialogDescription>
            {msg().badges.dialogBefore} <code className="font-mono text-xs">{badge?.code}</code> {msg().badges.dialogAfter}
          </DialogDescription>
        </DialogHeader>
        <form id="badge-form" noValidate onSubmit={submit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bd-name" className="text-[13px]">
              {msg().badges.name}
            </Label>
            <Input id="bd-name" autoFocus maxLength={40} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bd-cond" className="text-[13px]">
              {msg().badges.condition}
            </Label>
            <Input id="bd-cond" maxLength={80} value={form.condition} onChange={(e) => setForm((f) => ({ ...f, condition: e.target.value }))} />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium">{msg().badges.icon}</legend>
            <div role="radiogroup" aria-label={msg().badges.icon} className="flex flex-wrap gap-1.5">
              {ACHIEVEMENT_ICON_NAMES.map((name) => {
                const active = form.icon === name;
                return (
                  <button
                    key={name}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    aria-label={name}
                    title={name}
                    onClick={() => setForm((f) => ({ ...f, icon: name }))}
                    className={cn(
                      "inline-flex size-10 items-center justify-center rounded-lg border transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                      active ? "border-2 border-xp bg-xp-soft text-xp-text" : "border-transparent text-muted-foreground hover:bg-row-hover",
                    )}
                  >
                    <AchievementIcon name={name} aria-hidden className="size-5" />
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
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            {getMessages(commonMessages).cancel}
          </Button>
          <Button type="submit" form="badge-form" disabled={saving}>
            {saving && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
            {msg().save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BadgesPage() {
  const list = useServiceQuery(() => adminService.listBadges(), "", { raw: true });
  const [editing, setEditing] = React.useState<AdminBadgeRow | null>(null);
  const users = list.data ? Math.max(...list.data.map((b) => b.unlockedUsers), 1) : 1;

  return (
    <>
      <AdminHeader title={msg().badges.title} description={msg().badges.intro} />
      <Panel className="p-0 md:p-0">
        {list.error ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : (
          <Table aria-label={msg().badges.tableLabel}>
            <TableHeader className="bg-surface-subtle">
              <TableRow className="hover:bg-transparent">
                <TableHead>{msg().badges.badge}</TableHead>
                <TableHead>{msg().code}</TableHead>
                <TableHead>{msg().badges.conditionShort}</TableHead>
                <TableHead className="w-56">{msg().badges.unlockedBy}</TableHead>
                <TableHead className="w-16 text-right">
                  <span className="sr-only">{getMessages(commonMessages).actions}</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.loading
                ? Array.from({ length: 9 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-5 w-full" />
                      </TableCell>
                    </TableRow>
                  ))
                : (list.data ?? []).map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-md bg-xp-soft text-xp-text">
                            <AchievementIcon name={b.icon} className="size-4" />
                          </span>
                          <span className="font-medium">{b.name}</span>
                        </span>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">{b.code}</TableCell>
                      <TableCell className="whitespace-normal">{b.condition}</TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <span className="block h-full rounded-full bg-xp" style={{ width: `${(b.unlockedUsers / users) * 100}%` }} />
                          </span>
                          <span className="num w-10 text-right">{nf.format(b.unlockedUsers)}</span>
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="icon-xs" variant="ghost" aria-label={msg().editItem(b.name)} title={msg().edit} onClick={() => setEditing(b)} className="max-md:size-9">
                          <Pencil aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </Panel>
      <BadgeDialog badge={editing} onClose={() => setEditing(null)} />
    </>
  );
}
