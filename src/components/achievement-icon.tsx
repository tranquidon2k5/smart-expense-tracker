import * as React from "react";
import {
  Archive,
  Award,
  Flame,
  Footprints,
  Gem,
  GraduationCap,
  ListChecks,
  MessageCircle,
  PiggyBank,
  ShieldCheck,
  Star,
  Target,
  Trophy,
  type LucideIcon,
} from "lucide-react";

/** Icon cho huy hiệu và thông báo chúc mừng (tên lưu trong dữ liệu → component Lucide) */
const ICONS: Record<string, LucideIcon> = {
  Archive,
  Award,
  Flame,
  Footprints,
  Gem,
  GraduationCap,
  ListChecks,
  MessageCircle,
  PiggyBank,
  ShieldCheck,
  Star,
  Target,
  Trophy,
};

/** Tên icon được phép chọn cho huy hiệu (trang quản trị) */
export const ACHIEVEMENT_ICON_NAMES = Object.keys(ICONS);

export function AchievementIcon({ name, ...props }: { name: string } & React.ComponentProps<LucideIcon>) {
  return React.createElement(ICONS[name] ?? Award, props);
}
