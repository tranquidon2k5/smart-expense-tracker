import {
  Bike,
  Briefcase,
  Clapperboard,
  Coins,
  Gift,
  GraduationCap,
  HeartPulse,
  Shapes,
  ShoppingBag,
  Utensils,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  Bike,
  Briefcase,
  Clapperboard,
  Coins,
  Gift,
  GraduationCap,
  HeartPulse,
  Shapes,
  ShoppingBag,
  Utensils,
  Zap,
};

interface CategoryIconProps {
  icon: string;
  color: string;
  size?: "sm" | "md";
  className?: string;
}

/** Icon danh mục trong vòng tròn nền màu danh mục 12% (trang trí, aria-hidden) */
export function CategoryIcon({ icon, color, size = "md", className }: CategoryIconProps) {
  const Icon = ICONS[icon] ?? Shapes;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full",
        size === "md" ? "size-8" : "size-6",
        className,
      )}
      style={{ backgroundColor: `${color}1F`, color }}
    >
      <Icon className={size === "md" ? "size-4" : "size-3.5"} />
    </span>
  );
}

/** Chip danh mục: chấm màu + tên (không chỉ dùng màu) */
export function CategoryChip({ name, color, className }: { name: string; color: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-[13px]", className)}>
      <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      {name}
    </span>
  );
}
