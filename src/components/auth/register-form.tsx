"use client";

import { Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField, PasswordChecklist, PasswordInput } from "@/components/form-field";
import { authService } from "@/services";
import { useT } from "@/i18n/provider";
import { authMessages } from "@/i18n/messages/auth";
import { te } from "@/i18n/errors";

type Field = "fullName" | "email" | "password" | "confirm";

export function RegisterForm() {
  const router = useRouter();
  const t = useT(authMessages);
  const tr = t.register;
  const [values, setValues] = React.useState({ fullName: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = React.useState<Partial<Record<Field, string>>>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const refs = {
    fullName: React.useRef<HTMLInputElement>(null),
    email: React.useRef<HTMLInputElement>(null),
    password: React.useRef<HTMLInputElement>(null),
    confirm: React.useRef<HTMLInputElement>(null),
  };

  const set = (k: Field) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next: Partial<Record<Field, string>> = {
      fullName: values.fullName.trim().length < 2 ? tr.nameRequired : undefined,
      email: authService.validateEmail(values.email) ?? undefined,
      password: authService.validatePassword(values.password) ?? undefined,
      confirm: values.confirm !== values.password ? tr.mismatch : undefined,
    };
    setErrors(next);
    setFormError(null);
    const first = (Object.keys(next) as Field[]).find((k) => next[k]);
    if (first) return refs[first].current?.focus();

    setPending(true);
    try {
      const s = await authService.register({ fullName: values.fullName, email: values.email, password: values.password });
      toast.success(tr.welcome(s.fullName.split(" ").at(-1) ?? ""), {
        description: tr.welcomeHint,
      });
      router.replace("/");
      // Next giữ trang đã rời (ẩn) để quay lại nhanh → không để lại mật khẩu và nút đang chờ
      setValues({ fullName: "", email: "", password: "", confirm: "" });
      setPending(false);
    } catch (err) {
      setPending(false);
      if (err instanceof authService.AuthError && err.field && err.field in refs) {
        setErrors({ [err.field]: te(err.message) });
        refs[err.field as Field].current?.focus();
      } else setFormError(err instanceof Error ? te(err.message) : tr.failed);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl leading-8 font-bold">{tr.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tr.subtitle}</p>
      </div>

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField label={tr.fullName} error={errors.fullName}>
          {(p) => <Input {...p} ref={refs.fullName} autoComplete="name" autoFocus value={values.fullName} onChange={set("fullName")} placeholder={tr.fullNamePlaceholder} />}
        </FormField>
        <FormField label={t.email} error={errors.email}>
          {(p) => (
            <Input {...p} ref={refs.email} type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set("email")} placeholder={t.emailPlaceholder} />
          )}
        </FormField>
        <FormField label={t.password} error={errors.password} hint={<PasswordChecklist checks={authService.passwordChecks(values.password)} />}>
          {(p) => <PasswordInput {...p} ref={refs.password} autoComplete="new-password" value={values.password} onChange={set("password")} />}
        </FormField>
        <FormField label={tr.confirm} error={errors.confirm}>
          {(p) => <PasswordInput {...p} ref={refs.confirm} autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />}
        </FormField>

        {formError && <FormAlert>{formError}</FormAlert>}

        <Button type="submit" disabled={pending} className="h-11 w-full md:h-10">
          {pending ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <UserPlus aria-hidden />}
          {pending ? tr.submitting : tr.submit}
        </Button>
        <p className="text-xs text-muted-foreground">
          {tr.privacy}
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        {tr.haveAccount}{" "}
        <Link href="/dang-nhap" className="font-medium text-primary underline-offset-4 hover:underline">
          {tr.loginLink}
        </Link>
      </p>
    </div>
  );
}
