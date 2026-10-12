import type { Metadata } from "next";
import { ImportPage } from "@/components/import/import-page";

export const metadata: Metadata = { title: "Nhập sao kê" };

export default function Page() {
  return <ImportPage />;
}
