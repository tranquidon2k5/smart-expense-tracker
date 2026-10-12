import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Đăng nhập" };

/** useSearchParams cần Suspense khi bật Cache Components */
export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
