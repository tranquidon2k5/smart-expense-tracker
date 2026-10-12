import type { Metadata } from "next";
import { MissionsPage } from "@/components/admin/missions-page";

export const metadata: Metadata = { title: "Nhiệm vụ" };

export default function Page() {
  return <MissionsPage />;
}
