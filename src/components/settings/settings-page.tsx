"use client";

import { BellOff, Check, Download, FileJson, FileSpreadsheet, Loader2, LogOut, Trash2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import type { ReminderSettings } from "@/types";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { ErrorState } from "@/components/error-state";
import { FormAlert } from "@/components/form-field";
import { PageContainer, PageHeader } from "@/components/page-header";
import { Panel } from "@/components/panel";
import { useServiceQuery } from "@/hooks/use-service-query";
import { authService, notificationService, settingsService, transactionService } from "@/services";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { LanguageSection, PasswordSection, PreferencesSection, ProfileSection } from "./settings-sections";
import { getMessages } from "@/i18n/core";
import { settingsMessages } from "@/i18n/messages/settings";
import { te } from "@/i18n/errors";

const msg = () => getMessages(settingsMessages);

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const SECTION_IDS = ["ho-so", "mat-khau", "ngon-ngu", "tuy-chon", "nhac-nho", "du-lieu"] as const;

// ───────────── Nhắc nhở (PRD §6.3, §6.1 "không gây áp lực") ─────────────

function ReminderSection({ initial }: { initial: ReminderSettings }) {
  const [value, setValue] = React.useState(initial);
  const [status, setStatus] = React.useState<"idle" | "saving" | "saved" | "error">("idle");
  const saveSeq = React.useRef(0);

  // Tự lưu ngay khi đổi (công tắc, giờ nhắc, kênh)
  const save = async (next: ReminderSettings) => {
    setValue(next);
    const seq = ++saveSeq.current;
    setStatus("saving");
    try {
      await settingsService.updateReminder(next);
      if (seq === saveSeq.current) setStatus("saved");
    } catch (e) {
      if (seq === saveSeq.current) {
        setStatus("error");
        toast.error(e instanceof Error ? te(e.message) : msg().reminder.saveFailed);
      }
    }
  };

  const sendTest = async () => {
    try {
      await notificationService.sendTestReminder();
      toast.success(msg().reminder.testSent, { description: msg().reminder.testSentHint });
    } catch (e) {
      toast.error(e instanceof Error ? te(e.message) : msg().reminder.testFailed);
    }
  };

  return (
    <Panel
      id="nhac-nho"
      title={msg().reminder.title}
      description={msg().reminder.intro}
      className="scroll-mt-24"
      action={
        <span role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-muted-foreground">
          {status === "saving" && (
            <>
              <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" /> {msg().saving}
            </>
          )}
          {status === "saved" && (
            <>
              <Check aria-hidden className="size-3.5 text-success" /> {msg().saved}
            </>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-subtle px-4 py-3">
          <div>
            <Label htmlFor="reminder-enabled" className="text-sm font-medium">
              {msg().reminder.enable}
            </Label>
            <p id="reminder-enabled-help" className="mt-0.5 text-[13px] text-muted-foreground">
              {value.enabled
                ? msg().reminder.on
                : msg().reminder.off}
            </p>
          </div>
          <Switch
            id="reminder-enabled"
            checked={value.enabled}
            onCheckedChange={(enabled) => void save({ ...value, enabled })}
            aria-describedby="reminder-enabled-help"
            className="mt-0.5"
          />
        </div>

        <fieldset disabled={!value.enabled} className={cn("grid gap-5 sm:grid-cols-2", !value.enabled && "opacity-60")}>
          <div className="flex flex-col gap-1.5">
            <span id="reminder-time-label" className="text-[13px] font-medium">
              {msg().reminder.time}
            </span>
            {/* Hai ô chọn thay cho input type="time" để luôn hiển thị 24 giờ (HH:mm) bất kể ngôn ngữ trình duyệt */}
            <div role="group" aria-labelledby="reminder-time-label" aria-describedby="reminder-time-help" className="flex items-center gap-1.5">
              <Select value={value.time.slice(0, 2)} onValueChange={(h) => void save({ ...value, time: `${h}:${value.time.slice(3, 5)}` })}>
                <SelectTrigger aria-label={msg().reminder.hour} className="num w-[76px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {HOURS.map((h) => (
                    <SelectItem key={h} value={h} className="num">
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span aria-hidden className="font-semibold">
                :
              </span>
              <Select value={value.time.slice(3, 5)} onValueChange={(m) => void save({ ...value, time: `${value.time.slice(0, 2)}:${m}` })}>
                <SelectTrigger aria-label={msg().reminder.minute} className="num w-[76px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MINUTES.map((m) => (
                    <SelectItem key={m} value={m} className="num">
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p id="reminder-time-help" className="text-xs text-muted-foreground">
              {msg().reminder.defaultTime(settingsService.DEFAULT_REMINDER_TIME)}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">{msg().reminder.channels}</span>
            <div className="flex items-center gap-2">
              <Checkbox id="ch-app" checked disabled aria-describedby="ch-app-help" />
              <Label htmlFor="ch-app" className="text-sm font-normal">
                {msg().reminder.inApp}
              </Label>
              <span id="ch-app-help" className="text-xs text-muted-foreground">
                {msg().reminder.alwaysOn}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ch-email" checked={value.email} onCheckedChange={(c) => void save({ ...value, email: c === true })} />
              <Label htmlFor="ch-email" className="text-sm font-normal">
                {msg().reminder.email}
              </Label>
            </div>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button variant="outline" size="sm" disabled={!value.enabled} onClick={() => void sendTest()}>
            {msg().reminder.sendTest}
          </Button>
          {!value.enabled && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BellOff aria-hidden className="size-3.5" /> {msg().reminder.enableToTest}
            </span>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ───────────── Xuất / xoá dữ liệu (PRD §8 Quyền riêng tư) ─────────────

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function DataSection() {
  const router = useRouter();
  const [exporting, setExporting] = React.useState<"json" | "csv" | null>(null);
  const [open, setOpen] = React.useState(false);
  const [phrase, setPhrase] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const today = transactionService.getToday();
  const counts = useServiceQuery(async () => {
    const d = await settingsService.exportAllData();
    return { transactions: d.transactions.length, wallets: d.wallets.length, budgets: d.budgets.length, rules: d.classificationRules.length };
  });

  const doExport = async (kind: "json" | "csv") => {
    setExporting(kind);
    try {
      const data = await settingsService.exportAllData();
      if (kind === "json") download(`so-tien-du-lieu-${today}.json`, JSON.stringify(data, null, 2), "application/json");
      else download(`so-tien-giao-dich-${today}.csv`, settingsService.transactionsToCsv(data), "text/csv;charset=utf-8");
      toast.success(kind === "json" ? msg().data.exportedJson : msg().data.exportedCsv(data.transactions.length));
    } catch (e) {
      toast.error(e instanceof Error ? te(e.message) : msg().data.exportFailed);
    } finally {
      setExporting(null);
    }
  };

  const phraseOk = normalize(phrase).replace(/\s+/g, " ").trim() === "xoa du lieu";

  const doDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await settingsService.deleteAllData(phrase);
      setOpen(false);
      setPhrase("");
      toast.success(msg().data.deleted, { description: msg().data.deletedHint });
      router.push("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? te(e.message) : msg().data.deleteFailed);
    } finally {
      setDeleting(false);
    }
  };

  const c = counts.data;

  return (
    <Panel id="du-lieu" title={msg().data.title} description={msg().data.intro} className="scroll-mt-24">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-semibold">{msg().data.exportTitle}</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {msg().data.exportText}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={!!exporting} onClick={() => void doExport("json")}>
              {exporting === "json" ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <FileJson aria-hidden />}
              {msg().data.exportJson}
            </Button>
            <Button variant="outline" disabled={!!exporting} onClick={() => void doExport("csv")}>
              {exporting === "csv" ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <FileSpreadsheet aria-hidden />}
              {msg().data.exportCsv}
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-danger/40 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <TriangleAlert aria-hidden className="size-4 text-danger" /> {msg().data.deleteTitle}
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {msg().data.deleteText}
          </p>
          <Button variant="destructive" className="mt-3" onClick={() => setOpen(true)}>
            <Trash2 aria-hidden /> {msg().data.deleteButton}
          </Button>
        </div>
      </div>

      <AlertDialog
        open={open}
        onOpenChange={(o) => {
          if (deleting) return;
          setOpen(o);
          if (!o) {
            setPhrase("");
            setDeleteError(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{msg().data.confirmTitle}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>{msg().data.willDelete}</p>
                <ul className="list-disc pl-5 text-foreground">
                  {c ? (
                    <>
                      <li>
                        <span className="num">{msg().data.counts(c.transactions, c.wallets, c.budgets)}</span>
                      </li>
                      <li>
                        <span className="num">{msg().data.rules(c.rules)}</span>
                      </li>
                      <li>{msg().data.gamification}</li>
                    </>
                  ) : (
                    <li>{msg().data.everything}</li>
                  )}
                </ul>
                <p>{msg().data.backupFirst}</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Button variant="outline" size="sm" className="w-fit" disabled={!!exporting} onClick={() => void doExport("json")}>
            <Download aria-hidden /> {msg().data.backup}
          </Button>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-phrase" className="text-[13px] font-medium">
              <span>
                {msg().data.typeBefore} <span className="font-semibold text-foreground">{settingsService.DELETE_PHRASE}</span> {msg().data.typeAfter}
              </span>
            </Label>
            <Input
              id="delete-phrase"
              autoComplete="off"
              value={phrase}
              onChange={(e) => setPhrase(e.target.value)}
              aria-describedby={deleteError ? "delete-error" : undefined}
            />
          </div>
          {deleteError && (
            <div id="delete-error">
              <FormAlert>{deleteError}</FormAlert>
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{msg().data.keep}</AlertDialogCancel>
            <Button disabled={!phraseOk || deleting} onClick={() => void doDelete()} className="bg-danger text-white hover:bg-danger/90">
              {deleting ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Trash2 aria-hidden />}
              {deleting ? msg().data.deleting : msg().data.deleteForever}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}

// ───────────── Trang ─────────────

export function SettingsPage() {
  const router = useRouter();
  const settings = useServiceQuery(() => settingsService.getSettings());
  const s = settings.data;

  const logout = async () => {
    await authService.logout();
    router.replace("/dang-nhap");
  };

  return (
    <PageContainer>
      <PageHeader title={msg().title} description={msg().intro} />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12 xl:gap-6">
        <nav aria-label={msg().navLabel} className="xl:sticky xl:top-24 xl:col-span-3">
          <ul className="flex gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
            {SECTION_IDS.map((id) => (
              <li key={id} className="shrink-0">
                <a
                  href={`#${id}`}
                  className="flex h-9 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:bg-row-hover hover:text-foreground max-md:h-11"
                >
                  {msg().sections[id]}
                </a>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={() => void logout()} className="mt-2 w-full justify-start text-muted-foreground max-xl:hidden">
            <LogOut aria-hidden /> {msg().logout}
          </Button>
        </nav>

        <div className="flex min-w-0 flex-col gap-5 xl:col-span-9 xl:max-w-[880px] xl:gap-6">
          {settings.error ? (
            <Panel>
              <ErrorState title={msg().loadFailed} error={settings.error} onRetry={settings.refetch} />
            </Panel>
          ) : !s ? (
            Array.from({ length: 3 }, (_, i) => (
              <div key={i} aria-hidden className="flex flex-col gap-4 rounded-xl border bg-card p-5">
                <Skeleton className="h-6 w-40" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Skeleton className="h-9" />
                  <Skeleton className="h-9" />
                </div>
              </div>
            ))
          ) : (
            <>
              <ProfileSection settings={s} />
              <PasswordSection />
              <LanguageSection />
              <PreferencesSection settings={s} />
              <ReminderSection initial={s.reminder} />
              <DataSection />
              <Button variant="outline" onClick={() => void logout()} className="w-full xl:hidden">
                <LogOut aria-hidden /> {msg().logout}
              </Button>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
