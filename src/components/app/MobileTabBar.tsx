"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import {
  CalendarIcon,
  ClockIcon,
  ChartIcon,
  PersonIcon,
} from "@/components/ui/icons";

// Bottom tab bar for the employee-/owner-facing app on phones (design refs).
// Hidden on ≥sm, where the top nav takes over. The third tab is role-aware:
// owners/co-owners get Admin, employees get Availability.

type Tab = "schedule" | "clock" | "third";

export function MobileTabBar({
  active,
  isAdmin,
  canClock = true,
}: {
  active: Tab;
  isAdmin: boolean;
  canClock?: boolean;
}) {
  const { t } = useTranslations();

  // Owners' Admin tab opens the economy/admin section (§6.3) — the richer
  // owner surface; member management is linked from inside it. Employees get
  // their availability tab instead.
  const third = isAdmin
    ? { href: "/app/economy", label: t("app.nav.admin"), Icon: ChartIcon }
    : { href: "/app/availability", label: t("app.nav.availability"), Icon: PersonIcon };

  const items: { key: Tab; href: string; label: string; Icon: typeof ClockIcon }[] = [
    { key: "schedule", href: "/app/schedule", label: t("app.nav.schedule"), Icon: CalendarIcon },
    ...(canClock
      ? [{ key: "clock" as Tab, href: "/app/clock", label: t("app.nav.clock"), Icon: ClockIcon }]
      : []),
    { key: "third", href: third.href, label: third.label, Icon: third.Icon },
  ];

  return (
    <nav className="sticky bottom-0 z-10 flex items-stretch justify-around border-t border-border bg-surface/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <a
            key={item.key}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-1 py-2.5 text-[0.7rem] font-medium ${
              isActive ? "text-primary" : "text-ink-faint"
            }`}
          >
            <item.Icon className="text-lg" />
            {item.label}
          </a>
        );
      })}
    </nav>
  );
}
