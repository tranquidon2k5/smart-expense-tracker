"use client";

import { Check } from "lucide-react";
import type { Category } from "@/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { CategoryIcon } from "@/components/category-icon";
import { normalize } from "@/lib/text";

/** Danh sách danh mục tìm được bằng bàn phím (gõ để lọc, ↑↓, Enter) */
export function CategoryCommand({
  categories,
  value,
  onSelect,
  placeholder = "Tìm danh mục…",
}: {
  categories: Category[];
  value?: string;
  onSelect: (category: Category) => void;
  placeholder?: string;
}) {
  const groups: [string, Category[]][] = [
    ["Khoản chi", categories.filter((c) => c.type === "expense")],
    ["Khoản thu", categories.filter((c) => c.type === "income")],
  ];
  return (
    <Command>
      <CommandInput placeholder={placeholder} />
      <CommandList className="max-h-72">
        <CommandEmpty>Không có danh mục phù hợp.</CommandEmpty>
        {groups.map(([label, items]) =>
          items.length ? (
            <CommandGroup key={label} heading={label}>
              {items.map((c) => (
                <CommandItem
                  key={c.id}
                  // Gõ có dấu hay không dấu đều tìm được ("di chuyen" → "Di chuyển"); tên danh mục là duy nhất
                  value={normalize(c.name)}
                  keywords={[c.name]}
                  onSelect={() => onSelect(c)}
                  className="gap-2.5"
                >
                  <CategoryIcon icon={c.icon} color={c.color} size="sm" />
                  <span className="flex-1">{c.name}</span>
                  {value === c.id && <Check aria-label="Đang chọn" className="size-4 text-primary" />}
                </CommandItem>
              ))}
            </CommandGroup>
          ) : null,
        )}
      </CommandList>
    </Command>
  );
}
