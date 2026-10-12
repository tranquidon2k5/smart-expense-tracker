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
import { PasswordSection, PreferencesSection, ProfileSection } from "./settings-sections";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

const SECTIONS = [
  { id: "ho-so", label: "Hồ sơ" },
  { id: "mat-khau", label: "Mật khẩu" },
  { id: "tuy-chon", label: "Tiền tệ và múi giờ" },
  { id: "nhac-nho", label: "Nhắc nhở" },
  { id: "du-lieu", label: "Dữ liệu của bạn" },
] as const;

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
        toast.error(e instanceof Error ? e.message : "Không lưu được cài đặt nhắc nhở");
      }
    }
  };

  const sendTest = async () => {
    try {
      await notificationService.sendTestReminder();
      toast.success("Đã gửi một nhắc nhở thử", { description: "Mở chuông thông báo ở góc trên để xem." });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không gửi được");
    }
  };

  return (
    <Panel
      id="nhac-nho"
      title="Nhắc nhở ghi chép"
      description="Nhắc một lần mỗi ngày nếu tới giờ nhắc mà bạn chưa ghi khoản nào. Không nhắc vào ngày bạn đã ghi."
      className="scroll-mt-24"
      action={
        <span role="status" aria-live="polite" className="flex items-center gap-1 text-xs text-muted-foreground">
          {status === "saving" && (
            <>
              <Loader2 aria-hidden className="size-3.5 motion-safe:animate-spin" /> Đang lưu…
            </>
          )}
          {status === "saved" && (
            <>
              <Check aria-hidden className="size-3.5 text-success" /> Đã lưu
            </>
          )}
        </span>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-start justify-between gap-4 rounded-lg bg-surface-subtle px-4 py-3">
          <div>
            <Label htmlFor="reminder-enabled" className="text-sm font-medium">
              Nhắc tôi ghi chép mỗi ngày
            </Label>
            <p id="reminder-enabled-help" className="mt-0.5 text-[13px] text-muted-foreground">
              {value.enabled
                ? "Đang bật."
                : "Đang tắt hoàn toàn: không có nhắc nhở trong app hay email. Chuỗi ngày và thẻ đóng băng vẫn hoạt động bình thường."}
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
              Giờ nhắc
            </span>
            {/* Hai ô chọn thay cho input type="time" để luôn hiển thị 24 giờ (HH:mm) bất kể ngôn ngữ trình duyệt */}
            <div role="group" aria-labelledby="reminder-time-label" aria-describedby="reminder-time-help" className="flex items-center gap-1.5">
              <Select value={value.time.slice(0, 2)} onValueChange={(h) => void save({ ...value, time: `${h}:${value.time.slice(3, 5)}` })}>
                <SelectTrigger aria-label="Giờ" className="num w-[76px]">
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
                <SelectTrigger aria-label="Phút" className="num w-[76px]">
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
              Mặc định {settingsService.DEFAULT_REMINDER_TIME}, theo múi giờ của bạn.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <span className="text-[13px] font-medium">Kênh nhận</span>
            <div className="flex items-center gap-2">
              <Checkbox id="ch-app" checked disabled aria-describedby="ch-app-help" />
              <Label htmlFor="ch-app" className="text-sm font-normal">
                Thông báo trong app
              </Label>
              <span id="ch-app-help" className="text-xs text-muted-foreground">
                (luôn bật khi nhắc nhở bật)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="ch-email" checked={value.email} onCheckedChange={(c) => void save({ ...value, email: c === true })} />
              <Label htmlFor="ch-email" className="text-sm font-normal">
                Email
              </Label>
            </div>
          </div>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Button variant="outline" size="sm" disabled={!value.enabled} onClick={() => void sendTest()}>
            Gửi thử một nhắc nhở
          </Button>
          {!value.enabled && (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <BellOff aria-hidden className="size-3.5" /> Bật nhắc nhở để gửi thử
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
      toast.success(kind === "json" ? "Đã tải toàn bộ dữ liệu (JSON)" : `Đã tải ${data.transactions.length} giao dịch (CSV)`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xuất được dữ liệu");
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
      toast.success("Đã xoá toàn bộ dữ liệu", { description: "Tài khoản vẫn còn, bạn bắt đầu lại với sổ trống." });
      router.push("/");
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : "Không xoá được. Thử lại nhé.");
    } finally {
      setDeleting(false);
    }
  };

  const c = counts.data;

  return (
    <Panel id="du-lieu" title="Dữ liệu của bạn" description="Dữ liệu là của bạn: tải về bất cứ lúc nào, hoặc xoá hẳn." className="scroll-mt-24">
      <div className="flex flex-col gap-5">
        <div>
          <h3 className="text-sm font-semibold">Xuất dữ liệu</h3>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            JSON chứa mọi thứ (hồ sơ, ví, giao dịch, ngân sách, luật phân loại, thành tích). CSV chỉ gồm giao dịch, mở được bằng Excel.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="outline" disabled={!!exporting} onClick={() => void doExport("json")}>
              {exporting === "json" ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <FileJson aria-hidden />}
              Tải toàn bộ (JSON)
            </Button>
            <Button variant="outline" disabled={!!exporting} onClick={() => void doExport("csv")}>
              {exporting === "csv" ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <FileSpreadsheet aria-hidden />}
              Tải giao dịch (CSV)
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-danger/40 p-4">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold">
            <TriangleAlert aria-hidden className="size-4 text-danger" /> Xoá toàn bộ dữ liệu
          </h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            Xoá mọi giao dịch, ví, ngân sách, luật phân loại, lịch sử trợ lý AI, chuỗi ngày, XP và huy hiệu. Tài khoản vẫn giữ để bạn dùng lại từ đầu.
            Không hoàn tác được.
          </p>
          <Button variant="destructive" className="mt-3" onClick={() => setOpen(true)}>
            <Trash2 aria-hidden /> Xoá toàn bộ dữ liệu…
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
            <AlertDialogTitle>Xoá toàn bộ dữ liệu?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="flex flex-col gap-2 text-sm text-muted-foreground">
                <p>Những thứ sau sẽ bị xoá vĩnh viễn:</p>
                <ul className="list-disc pl-5 text-foreground">
                  {c ? (
                    <>
                      <li>
                        <span className="num">{c.transactions}</span> giao dịch, <span className="num">{c.wallets}</span> ví, <span className="num">{c.budgets}</span> ngân sách
                      </li>
                      <li>
                        <span className="num">{c.rules}</span> luật phân loại và lịch sử trợ lý AI
                      </li>
                      <li>Chuỗi ngày, XP, cấp độ và huy hiệu</li>
                    </>
                  ) : (
                    <li>Toàn bộ giao dịch, ví, ngân sách, thành tích</li>
                  )}
                </ul>
                <p>Nên tải bản sao trước khi xoá.</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <Button variant="outline" size="sm" className="w-fit" disabled={!!exporting} onClick={() => void doExport("json")}>
            <Download aria-hidden /> Tải bản sao (JSON) trước
          </Button>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="delete-phrase" className="text-[13px] font-medium">
              <span>
                Gõ <span className="font-semibold text-foreground">{settingsService.DELETE_PHRASE}</span> để xác nhận
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
            <AlertDialogCancel disabled={deleting}>Giữ dữ liệu</AlertDialogCancel>
            <Button disabled={!phraseOk || deleting} onClick={() => void doDelete()} className="bg-danger text-white hover:bg-danger/90">
              {deleting ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Trash2 aria-hidden />}
              {deleting ? "Đang xoá…" : "Xoá vĩnh viễn"}
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
      <PageHeader title="Cài đặt" description="Tài khoản, nhắc nhở và dữ liệu của bạn" />
      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-12 xl:gap-6">
        <nav aria-label="Mục cài đặt" className="xl:sticky xl:top-24 xl:col-span-3">
          <ul className="flex gap-1 overflow-x-auto pb-1 xl:flex-col xl:overflow-visible xl:pb-0">
            {SECTIONS.map((x) => (
              <li key={x.id} className="shrink-0">
                <a
                  href={`#${x.id}`}
                  className="flex h-9 items-center rounded-lg px-3 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors duration-150 hover:bg-row-hover hover:text-foreground max-md:h-11"
                >
                  {x.label}
                </a>
              </li>
            ))}
          </ul>
          <Button variant="ghost" onClick={() => void logout()} className="mt-2 w-full justify-start text-muted-foreground max-xl:hidden">
            <LogOut aria-hidden /> Đăng xuất
          </Button>
        </nav>

        <div className="flex min-w-0 flex-col gap-5 xl:col-span-9 xl:max-w-[880px] xl:gap-6">
          {settings.error ? (
            <Panel>
              <ErrorState title="Không tải được cài đặt" error={settings.error} onRetry={settings.refetch} />
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
              <PreferencesSection settings={s} />
              <ReminderSection initial={s.reminder} />
              <DataSection />
              <Button variant="outline" onClick={() => void logout()} className="w-full xl:hidden">
                <LogOut aria-hidden /> Đăng xuất
              </Button>
            </>
          )}
        </div>
      </div>
    </PageContainer>
  );
}
