"use client";

import { Loader2, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";
import type { TransactionView } from "@/types";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { CategoryIcon } from "@/components/category-icon";
import { Money } from "@/components/money";
import { transactionService } from "@/services";
import { NAV_MAIN, NAV_SECONDARY, navSearchText } from "@/lib/nav";
import { formatDate } from "@/lib/format";
import { normalize } from "@/lib/text";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n/provider";
import { shellMessages } from "@/i18n/messages/shell";

const PAGES = [...NAV_MAIN, ...NAV_SECONDARY];

export function SearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const t = useT(shellMessages).search;
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<TransactionView[]>([]);
  const [searching, setSearching] = React.useState(false);

  const changeQuery = (value: string) => {
    setQuery(value);
    const hasText = !!value.trim();
    setSearching(hasText);
    if (!hasText) setResults([]);
  };

  // Tìm giao dịch, debounce 200ms
  React.useEffect(() => {
    if (!query.trim()) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const found = await transactionService.searchTransactions(query);
      if (!cancelled) {
        setResults(found);
        setSearching(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const q = normalize(query.trim());
  const pages = q ? PAGES.filter((p) => normalize(navSearchText(p)).includes(q)) : PAGES;

  const go = (href: string) => {
    onOpenChange(false);
    changeQuery("");
    router.push(href);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) changeQuery("");
      }}
      title={t.title}
      description={t.description}
      className="sm:max-w-xl"
    >
      {/* Tự lọc (kết quả giao dịch đến từ service) nên tắt bộ lọc của cmdk */}
      <Command shouldFilter={false}>
        <CommandInput placeholder={t.placeholder} value={query} onValueChange={changeQuery} />
        <CommandList className="max-h-[min(420px,60svh)]">
          {!searching && pages.length === 0 && results.length === 0 && (
            <CommandEmpty>{t.empty(query)}</CommandEmpty>
          )}
          {pages.length > 0 && (
            <CommandGroup heading={t.pages}>
              {pages.map((p) => (
                <CommandItem key={p.href} value={`page:${p.href}`} onSelect={() => go(p.href)}>
                  <p.icon aria-hidden />
                  {p.label}
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {searching && (
            <div role="status" className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <Loader2 aria-hidden className="size-4 animate-spin" /> {t.searching}
            </div>
          )}
          {!searching && results.length > 0 && (
            <CommandGroup heading={t.transactions}>
              {results.map((t) => (
                <CommandItem key={t.id} value={`tx:${t.id}`} onSelect={() => go(`/giao-dich?id=${t.id}`)} className="gap-3">
                  <CategoryIcon icon={t.category.icon} color={t.category.color} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{t.description}</span>
                    <span className="text-xs text-muted-foreground">
                      {t.category.name} · <span className="num">{formatDate(t.date)}</span>
                    </span>
                  </span>
                  <Money amount={t.amount} type={t.type} className="text-sm" />
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

/** Nút mở tìm kiếm trên thanh trên */
export function SearchButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const t = useT(shellMessages).search;
  return (
    <Button
      variant="outline"
      onClick={onClick}
      aria-label={t.button}
      aria-keyshortcuts="Control+K /"
      className={cn("h-10 gap-2 text-muted-foreground max-xl:w-10 max-xl:px-0 max-md:size-11", className)}
    >
      <Search aria-hidden />
      <span className="hidden xl:inline">{t.title}</span>
      <kbd aria-hidden className="num ml-2 hidden rounded border bg-muted px-1.5 py-0.5 text-[11px] font-medium xl:inline">
        Ctrl K
      </kbd>
    </Button>
  );
}
