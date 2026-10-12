import { AuthLayout } from "@/components/auth/auth-layout";

export default function Layout({ children }: LayoutProps<"/">) {
  return <AuthLayout>{children}</AuthLayout>;
}
