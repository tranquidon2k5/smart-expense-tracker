"use client";

import { ArrowLeft, CircleCheck, Loader2, MailCheck } from "lucide-react";
import Link from "next/link";
import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormAlert, FormField, PasswordChecklist, PasswordInput } from "@/components/form-field";
import { authService } from "@/services";

const RESEND_SECONDS = 30;

export function ForgotPasswordForm() {
  const [step, setStep] = React.useState<"email" | "code" | "done">("email");
  const [email, setEmail] = React.useState("");
  const [code, setCode] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [errors, setErrors] = React.useState<{ email?: string; code?: string; password?: string; confirm?: string }>({});
  const [pending, setPending] = React.useState(false);
  const [cooldown, setCooldown] = React.useState(0);
  const headingRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Bước nhập mã tự focus ô mã (autoFocus); bước xong thì đưa focus về tiêu đề để trình đọc màn hình đọc kết quả
  React.useEffect(() => {
    if (step === "done") headingRef.current?.focus();
  }, [step]);

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const err = authService.validateEmail(email);
    setErrors({ email: err ?? undefined });
    if (err) return;
    setPending(true);
    try {
      await authService.requestPasswordReset(email);
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (e) {
      setErrors({ email: e instanceof Error ? e.message : "Không gửi được mã" });
    } finally {
      setPending(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    const next = {
      code: /^\d{6}$/.test(code.trim()) ? undefined : "Mã gồm 6 chữ số",
      password: authService.validatePassword(password) ?? undefined,
      confirm: confirm !== password ? "Hai mật khẩu chưa giống nhau" : undefined,
    };
    setErrors(next);
    if (next.code || next.password || next.confirm) return;
    setPending(true);
    try {
      await authService.resetPassword(email, code, password);
      setStep("done");
    } catch (err) {
      const field = err instanceof authService.AuthError && err.field === "password" ? "password" : "code";
      setErrors({ [field]: err instanceof Error ? err.message : "Không đặt lại được mật khẩu" });
    } finally {
      setPending(false);
    }
  };

  if (step === "done") {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-income-soft text-success">
          <CircleCheck className="size-6" />
        </span>
        <h1 ref={headingRef} tabIndex={-1} className="text-2xl leading-8 font-bold outline-none">
          Đã đổi mật khẩu
        </h1>
        <p className="text-sm text-muted-foreground">Bạn đăng nhập bằng mật khẩu mới nhé.</p>
        <Button asChild className="h-11 w-full md:h-10">
          <Link href="/dang-nhap">Đăng nhập</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href="/dang-nhap" className="flex w-fit items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">
        <ArrowLeft aria-hidden className="size-4" /> Quay lại đăng nhập
      </Link>

      {step === "email" ? (
        <>
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl leading-8 font-bold outline-none">
              Quên mật khẩu
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Nhập email đã đăng ký, Sổ Tiền sẽ gửi mã 6 số để bạn đặt mật khẩu mới.</p>
          </div>
          <form noValidate onSubmit={sendCode} className="flex flex-col gap-4">
            <FormField label="Email" error={errors.email}>
              {(p) => (
                <Input {...p} type="email" inputMode="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ten@example.com" />
              )}
            </FormField>
            <Button type="submit" disabled={pending} className="h-11 w-full md:h-10">
              {pending && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
              {pending ? "Đang gửi…" : "Gửi mã đặt lại"}
            </Button>
          </form>
        </>
      ) : (
        <>
          <div>
            <h1 ref={headingRef} tabIndex={-1} className="text-2xl leading-8 font-bold outline-none">
              Nhập mã và mật khẩu mới
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Nếu <span className="font-medium text-foreground">{email}</span> đã đăng ký, mã 6 số vừa được gửi tới hộp thư. Mã có hiệu lực 15 phút.
            </p>
          </div>
          <FormAlert tone="info">
            <span className="flex items-center gap-1.5">
              <MailCheck aria-hidden className="size-4 text-info" /> Bản demo không gửi email thật: mã là{" "}
              <span className="num font-semibold">{authService.DEMO_RESET_CODE}</span>
            </span>
          </FormAlert>
          <form noValidate onSubmit={reset} className="flex flex-col gap-4">
            <FormField label="Mã xác nhận" error={errors.code}>
              {(p) => (
                <Input
                  {...p}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="num tracking-[0.3em]"
                  placeholder="••••••"
                />
              )}
            </FormField>
            <FormField label="Mật khẩu mới" error={errors.password} hint={<PasswordChecklist checks={authService.passwordChecks(password)} />}>
              {(p) => <PasswordInput {...p} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
            </FormField>
            <FormField label="Nhập lại mật khẩu mới" error={errors.confirm}>
              {(p) => <PasswordInput {...p} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />}
            </FormField>
            <Button type="submit" disabled={pending} className="h-11 w-full md:h-10">
              {pending && <Loader2 aria-hidden className="motion-safe:animate-spin" />}
              {pending ? "Đang lưu…" : "Đặt mật khẩu mới"}
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              Chưa nhận được mã?{" "}
              <button
                type="button"
                disabled={cooldown > 0 || pending}
                onClick={() => void sendCode()}
                className="font-medium text-primary underline-offset-4 hover:underline disabled:cursor-not-allowed disabled:text-muted-foreground disabled:no-underline"
              >
                {cooldown > 0 ? (
                  <>
                    Gửi lại sau <span className="num">{cooldown}</span> giây
                  </>
                ) : (
                  "Gửi lại mã"
                )}
              </button>
            </p>
          </form>
        </>
      )}
    </div>
  );
}
