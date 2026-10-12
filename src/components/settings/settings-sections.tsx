"use client";

import { Check, Loader2 } from "lucide-react";
import * as React from "react";
import { toast } from "sonner";
import type { UserSettings } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initialsOf } from "@/components/app-shell/account-menu";
import { FormAlert, FormField, PasswordChecklist, PasswordInput } from "@/components/form-field";
import { Panel } from "@/components/panel";
import { authService, settingsService } from "@/services";
import { formatDate } from "@/lib/format";

/** Nút lưu: chỉ bật khi có thay đổi; hiện trạng thái đang lưu */
export function SaveBar({ dirty, saving, onReset }: { dirty: boolean; saving: boolean; onReset?: () => void }) {
  return (
    <div className="mt-5 flex flex-wrap items-center justify-end gap-2 border-t pt-4">
      {dirty && onReset && (
        <Button type="button" variant="ghost" onClick={onReset} disabled={saving}>
          Huỷ thay đổi
        </Button>
      )}
      <Button type="submit" disabled={!dirty || saving}>
        {saving ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <Check aria-hidden />}
        {saving ? "Đang lưu…" : "Lưu thay đổi"}
      </Button>
    </div>
  );
}

// ───────────── Hồ sơ ─────────────

export function ProfileSection({ settings }: { settings: UserSettings }) {
  const initial = { fullName: settings.profile.fullName, email: settings.profile.email };
  const [values, setValues] = React.useState(initial);
  const [errors, setErrors] = React.useState<{ fullName?: string; email?: string }>({});
  const [saving, setSaving] = React.useState(false);
  const dirty = values.fullName !== initial.fullName || values.email !== initial.email;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    try {
      await settingsService.updateProfile(values);
      toast.success("Đã lưu hồ sơ");
    } catch (err) {
      const field = err instanceof authService.AuthError && (err.field === "email" || err.field === "fullName") ? err.field : "fullName";
      setErrors({ [field]: err instanceof Error ? err.message : "Không lưu được" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel id="ho-so" title="Hồ sơ" description="Tên dùng trong lời chào và câu khích lệ; email dùng để đăng nhập." className="scroll-mt-24">
      <form noValidate onSubmit={submit}>
        <div className="flex flex-col gap-5 md:flex-row md:items-start">
          <div className="flex items-center gap-3 md:w-40 md:flex-col md:items-start">
            <Avatar className="size-14">
              <AvatarFallback className="bg-accent text-xl font-semibold text-accent-foreground">{initialsOf(values.fullName || "?")}</AvatarFallback>
            </Avatar>
            <p className="text-xs text-muted-foreground">
              Tham gia từ <span className="num">{formatDate(settings.profile.createdAt.slice(0, 10))}</span>
            </p>
          </div>
          <div className="grid flex-1 gap-4 sm:grid-cols-2">
            <FormField label="Họ và tên" error={errors.fullName}>
              {(p) => <Input {...p} autoComplete="name" value={values.fullName} onChange={(e) => setValues((v) => ({ ...v, fullName: e.target.value }))} />}
            </FormField>
            <FormField label="Email" error={errors.email}>
              {(p) => (
                <Input {...p} type="email" autoComplete="email" value={values.email} onChange={(e) => setValues((v) => ({ ...v, email: e.target.value }))} />
              )}
            </FormField>
          </div>
        </div>
        <SaveBar dirty={dirty} saving={saving} onReset={() => setValues(initial)} />
      </form>
    </Panel>
  );
}

// ───────────── Mật khẩu ─────────────

export function PasswordSection() {
  const empty = { current: "", next: "", confirm: "" };
  const [values, setValues] = React.useState(empty);
  const [errors, setErrors] = React.useState<{ current?: string; next?: string; confirm?: string }>({});
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      current: values.current ? undefined : "Nhập mật khẩu hiện tại",
      next: authService.validatePassword(values.next) ?? undefined,
      confirm: values.confirm !== values.next ? "Hai mật khẩu chưa giống nhau" : undefined,
    };
    setErrors(next);
    if (next.current || next.next || next.confirm) return;
    setSaving(true);
    try {
      await authService.changePassword(values.current, values.next);
      setValues(empty);
      toast.success("Đã đổi mật khẩu", { description: "Lần đăng nhập sau dùng mật khẩu mới nhé." });
    } catch (err) {
      const field = err instanceof authService.AuthError && err.field === "currentPassword" ? "current" : "next";
      setErrors({ [field]: err instanceof Error ? err.message : "Không đổi được mật khẩu" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel id="mat-khau" title="Đổi mật khẩu" className="scroll-mt-24">
      <form noValidate onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Mật khẩu hiện tại" error={errors.current} className="sm:col-span-2 sm:max-w-[calc(50%-8px)]">
          {(p) => <PasswordInput {...p} autoComplete="current-password" value={values.current} onChange={(e) => setValues((v) => ({ ...v, current: e.target.value }))} />}
        </FormField>
        <FormField label="Mật khẩu mới" error={errors.next} hint={<PasswordChecklist checks={authService.passwordChecks(values.next)} />}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.next} onChange={(e) => setValues((v) => ({ ...v, next: e.target.value }))} />}
        </FormField>
        <FormField label="Nhập lại mật khẩu mới" error={errors.confirm}>
          {(p) => <PasswordInput {...p} autoComplete="new-password" value={values.confirm} onChange={(e) => setValues((v) => ({ ...v, confirm: e.target.value }))} />}
        </FormField>
        <div className="sm:col-span-2">
          <SaveBar dirty={!!(values.current || values.next || values.confirm)} saving={saving} onReset={() => setValues(empty)} />
        </div>
      </form>
    </Panel>
  );
}

// ───────────── Tiền tệ & múi giờ ─────────────

export function PreferencesSection({ settings }: { settings: UserSettings }) {
  const initial = { currency: settings.profile.currency as string, timezone: settings.profile.timezone };
  const [values, setValues] = React.useState(initial);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const dirty = values.currency !== initial.currency || values.timezone !== initial.timezone;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await settingsService.updatePreferences(values);
      toast.success("Đã lưu tuỳ chọn");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không lưu được");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel id="tuy-chon" title="Tiền tệ và múi giờ" className="scroll-mt-24">
      <form noValidate onSubmit={submit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Đơn vị tiền tệ" hint="Số tiền hiển thị dạng 45.000đ.">
            {(p) => (
              <Select value={values.currency} onValueChange={(currency) => setValues((v) => ({ ...v, currency }))}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settingsService.CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} disabled={!c.available}>
                      {c.label}
                      {!c.available && <span className="text-muted-foreground"> · sắp có</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <FormField label="Múi giờ" hint="Dùng để tính “một ngày” (00:00–23:59) cho chuỗi ghi chép và giờ nhắc.">
            {(p) => (
              <Select value={values.timezone} onValueChange={(timezone) => setValues((v) => ({ ...v, timezone }))}>
                <SelectTrigger {...p} className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {settingsService.TIMEZONES.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </FormField>
        </div>
        {error && (
          <div className="mt-4">
            <FormAlert>{error}</FormAlert>
          </div>
        )}
        <SaveBar dirty={dirty} saving={saving} onReset={() => setValues(initial)} />
      </form>
    </Panel>
  );
}
