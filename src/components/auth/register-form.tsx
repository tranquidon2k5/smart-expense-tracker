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

type Field = "fullName" | "email" | "password" | "confirm";

export function RegisterForm() {
  const router = useRouter();
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
      fullName: values.fullName.trim().length < 2 ? "Nhập họ tên của bạn" : undefined,
      email: authService.validateEmail(values.email) ?? undefined,
      password: authService.validatePassword(values.password) ?? undefined,
      confirm: values.confirm !== values.password ? "Hai mật khẩu chưa giống nhau" : undefined,
    };
    setErrors(next);
    setFormError(null);
    const first = (Object.keys(next) as Field[]).find((k) => next[k]);
    if (first) return refs[first].current?.focus();

    setPending(true);
    try {
      const s = await authService.register({ fullName: values.fullName, email: values.email, password: values.password });
      toast.success(`Chào mừng ${s.fullName.split(" ").at(-1)} đến với Sổ Tiền!`, {
        description: "Gõ thử “ăn phở 45k” vào ô Ghi nhanh để bắt đầu nhé.",
      });
      router.replace("/");
      // Next giữ trang đã rời (ẩn) để quay lại nhanh → không để lại mật khẩu và nút đang chờ
      setValues({ fullName: "", email: "", password: "", confirm: "" });
      setPending(false);
    } catch (err) {
      setPending(false);
      if (err instanceof authService.AuthError && err.field && err.field in refs) {
        setErrors({ [err.field]: err.message });
        refs[err.field as Field].current?.focus();
      } else setFormError(err instanceof Error ? err.message : "Không tạo được tài khoản. Thử lại nhé.");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl leading-8 font-bold">Tạo tài khoản</h1>
        <p className="mt-1 text-sm text-muted-foreground">Miễn phí. Mất chưa tới một phút.</p>
      </div>

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField label="Họ và tên" error={errors.fullName}>
          {(p) => <Input {...p} ref={refs.fullName} autoComplete="name" autoFocus value={values.fullName} onChange={set("fullName")} placeholder="Nguyễn Thị Lan" />}
        </FormField>
        <FormField label="Email" error={errors.email}>
          {(p) => (
            <Input {...p} ref={refs.email} type="email" inputMode="email" autoComplete="email" value={values.email} onChange={set("email")} placeholder="ten@example.com" />
          )}
        </FormField>
        <FormField label="Mật khẩu" error={errors.password} hint={<PasswordChecklist checks={authService.passwordChecks(values.password)} />}>
          {(p) => <PasswordInput {...p} ref={refs.password} autoComplete="new-password" value={values.password} onChange={set("password")} />}
        </FormField>
        <FormField label="Nhập lại mật khẩu" error={errors.confirm}>
          {(p) => <PasswordInput {...p} ref={refs.confirm} autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />}
        </FormField>

        {formError && <FormAlert>{formError}</FormAlert>}

        <Button type="submit" disabled={pending} className="h-11 w-full md:h-10">
          {pending ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <UserPlus aria-hidden />}
          {pending ? "Đang tạo tài khoản…" : "Tạo tài khoản"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Mật khẩu được mã hoá trước khi lưu. Bạn xuất hoặc xoá được toàn bộ dữ liệu của mình bất cứ lúc nào trong Cài đặt.
        </p>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link href="/dang-nhap" className="font-medium text-primary underline-offset-4 hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
