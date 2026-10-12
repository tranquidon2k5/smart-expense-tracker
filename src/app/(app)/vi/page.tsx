import type { Metadata } from "next";
import { WalletsPage } from "@/components/wallets/wallets-page";

export const metadata: Metadata = { title: "Ví" };

export default function Page() {
  return <WalletsPage />;
}
