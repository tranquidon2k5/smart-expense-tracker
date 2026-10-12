import * as React from "react";
import {
  Archive,
  Award,
  Flame,
  Footprints,
  GraduationCap,
  ListChecks,
  MessageCircle,
  PiggyBank,
  ShieldCheck,
  Star,
  type LucideIcon,
} from "lucide-react";

/** Icon cho huy hiệu và thông báo chúc mừng (tên lưu trong dữ liệu → component Lucide) */
const ICONS: Record<string, LucideIcon> = {
  Archive,
  Award,
  Flame,
  Footprints,
  GraduationCap,
  ListChecks,
  MessageCircle,
  PiggyBank,
  ShieldCheck,
  Star,
};

export function AchievementIcon({ name, ...props }: { name: string } & React.ComponentProps<LucideIcon>) {
  return React.createElement(ICONS[name] ?? Award, props);
}
