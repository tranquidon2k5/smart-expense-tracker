"use client";

import { Construction } from "lucide-react";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/provider";
import { shellMessages } from "@/i18n/messages/shell";

export function ComingSoon() {
  const t = useT(shellMessages).comingSoon;
  return (
    <div className="mx-auto flex min-h-[60svh] max-w-[1600px] flex-col px-4 py-6 md:px-6 xl:px-8">
      <h1 className="sr-only">{t.heading}</h1>
      <EmptyState
        icon={Construction}
        title={t.title}
        description={t.text}
        action={
          <Button asChild>
            <Link href="/">{t.back}</Link>
          </Button>
        }
      />
    </div>
  );
}
