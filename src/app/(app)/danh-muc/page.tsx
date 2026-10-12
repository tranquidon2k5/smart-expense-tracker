import type { Metadata } from "next";
import { CategoriesPage } from "@/components/categories/categories-page";

export const metadata: Metadata = { title: "Danh mục" };

export default function Page() {
  return <CategoriesPage />;
}
