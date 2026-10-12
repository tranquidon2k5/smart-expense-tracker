"use client";

import { Loader2, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField, PasswordInput } from "@/components/form-field";
import { useSession } from "@/hooks/use-session";
import { authService } from "@/services";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const session = useSession();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [errors, setErrors] = React.useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);

  // Đã đăng nhập mà vào trang này → về trang chính
  React.useEffect(() => {
    if (session && !pending) router.replace(authService.safeNext(params.get("tiep"), session));
  }, [session, pending, params, router]);

  const reason = params.get("ly-do");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      email: authService.validateEmail(email) ?? undefined,
      password: password ? undefined : "Nhập mật khẩu",
    };
    setErrors(next);
    setFormError(null);
    if (next.email) return emailRef.current?.focus();
    if (next.password) return passwordRef.current?.focus();
    setPending(true);
    try {
      const s = await authService.login(email, password);
      router.replace(authService.safeNext(params.get("tiep"), s));
      // Next giữ trang đã rời (ẩn) để quay lại nhanh → xoá mật khẩu và trạng thái chờ
      setPassword("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Không đăng nhập được. Thử lại nhé.");
      passwordRef.current?.select();
    } finally {
      setPending(false);
    }
  };

  const fill = (a: (typeof authService.DEMO_ACCOUNTS)[number]) => {
    setEmail(a.email);
    setPassword(a.password);
    setErrors({});
    setFormError(null);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl leading-8 font-bold">Đăng nhập</h1>
        <p className="mt-1 text-sm text-muted-foreground">Chào mừng bạn quay lại. Ghi một khoản hôm nay để giữ chuỗi nhé!</p>
      </div>

      {reason === "het-phien" && <FormAlert tone="info">Bạn cần đăng nhập để tiếp tục.</FormAlert>}

      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <FormField label="Email" error={errors.email}>
          {(p) => (
            <Input
              {...p}
              ref={emailRef}
              type="email"
              autoComplete="email"
              inputMode="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ten@example.com"
            />
          )}
        </FormField>
        <FormField
          label="Mật khẩu"
          error={errors.password}
          action={
            <Link href="/quen-mat-khau" className="text-[13px] font-medium text-primary underline-offset-4 hover:underline">
              Quên mật khẩu?
            </Link>
          }
        >
          {(p) => (
            <PasswordInput {...p} ref={passwordRef} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          )}
        </FormField>

        {formError && <FormAlert>{formError}</FormAlert>}

        <Button type="submit" disabled={pending} className="h-11 w-full md:h-10">
          {pending ? <Loader2 aria-hidden className="motion-safe:animate-spin" /> : <LogIn aria-hidden />}
          {pending ? "Đang đăng nhập…" : "Đăng nhập"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        Chưa có tài khoản?{" "}
        <Link href="/dang-ky" className="font-medium text-primary underline-offset-4 hover:underline">
          Đăng ký miễn phí
        </Link>
      </p>

      <section aria-labelledby="demo-accounts" className="rounded-xl border border-dashed bg-card p-4">
        <h2 id="demo-accounts" className="text-[13px] font-semibold">
          Tài khoản dùng thử
        </h2>
        <ul className="mt-2 flex flex-col divide-y">
          {authService.DEMO_ACCOUNTS.map((a) => (
            <li key={a.email} className="flex items-center justify-between gap-3 py-2 first:pt-0 last:pb-0">
              <div className="min-w-0 text-[13px]">
                <p className="font-medium">{a.label}</p>
                <p className="truncate text-muted-foreground">
                  {a.email} · <span className="num">{a.password}</span>
                </p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={() => fill(a)} className="max-md:h-11">
                Điền sẵn
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
