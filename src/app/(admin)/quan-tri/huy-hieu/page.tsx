import type { Metadata } from "next";
import { BadgesPage } from "@/components/admin/badges-page";

export const metadata: Metadata = { title: "Huy hiệu" };

export default function Page() {
  return <BadgesPage />;
}
