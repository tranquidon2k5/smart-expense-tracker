import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Đăng ký" };

/** useSearchParams cần Suspense khi bật Cache Components */
export default function Page() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
