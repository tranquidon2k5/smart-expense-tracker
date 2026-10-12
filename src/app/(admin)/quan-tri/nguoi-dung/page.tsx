import type { Metadata } from "next";
import { UsersPage } from "@/components/admin/users-page";

export const metadata: Metadata = { title: "Người dùng" };

export default function Page() {
  return <UsersPage />;
}
