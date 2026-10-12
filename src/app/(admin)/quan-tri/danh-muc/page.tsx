import type { Metadata } from "next";
import { DefaultCategoriesPage } from "@/components/admin/default-categories-page";

export const metadata: Metadata = { title: "Danh mục mặc định" };

export default function Page() {
  return <DefaultCategoriesPage />;
}
