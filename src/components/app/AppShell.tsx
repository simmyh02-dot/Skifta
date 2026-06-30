"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/ui/Logo";
import { Avatar } from "@/components/ui/Avatar";
import {
  CalendarIcon,
  ClockIcon,
  ChartIcon,
  PersonIcon,
  BellIcon,
  SettingsIcon,
  MenuIcon,
  XIcon,
  LogoutIcon,
} from "@/components/ui/icons";
import { useTranslations } from "@/i18n/LocaleProvider";

type NavItem = {
  href: string;
  label: string;
  Icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: number;
};

function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string | null;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 px-3 py-2 space-y-0.5">
      {items.map((item) => {
        const isActive =
          pathname === item.href ||
          (item.href !== "/app/schedule" && (pathname ?? "").startsWith(item.href));
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
              isActive
                ? "bg-primary text-primary-ink"
                : "text-dark-muted hover:bg-dark-2 hover:text-dark-ink"
            }`}
          >
            <item.Icon className="text-[1.1rem] shrink-0" />
            <span className="flex-1 leading-none">{item.label}</span>
            {(item.badge ?? 0) > 0 && (
              <span className="flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-1 text-[0.6rem] font-bold leading-none text-white">
                {(item.badge ?? 0) > 9 ? "9+" : item.badge}
              </span>
            )}
          </a>
        );
      })}
    </nav>
  );
}

function SidebarFooter({
  displayName,
  restaurantName,
  onLogout,
  logoutLabel,
}: {
  displayName: string;
  restaurantName: string;
  onLogout: () => void;
  logoutLabel: string;
}) {
  return (
    <div className="border-t border-dark-2 p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
        <Avatar name={displayName} size="sm" filled />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[0.8125rem] font-medium text-dark-ink">
            {displayName}
          </span>
          <span className="truncate text-[0.7rem] text-dark-muted">{restaurantName}</span>
        </div>
        <button
          type="button"
          onClick={onLogout}
          title={logoutLabel}
          aria-label={logoutLabel}
          className="shrink-0 rounded-md p-1 text-dark-muted transition-colors hover:text-dark-ink"
        >
          <LogoutIcon className="text-[1.1rem]" />
        </button>
      </div>
    </div>
  );
}

export function AppShell({
  role,
  restaurantName,
  displayName,
  canClock = false,
  children,
}: {
  role: string;
  restaurantName: string;
  displayName: string;
  canClock?: boolean;
  children: ReactNode;
}) {
  const { t } = useTranslations();
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = role === "OWNER" || role === "CO_OWNER";
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    function poll() {
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => d && setUnread(d.unreadCount ?? 0))
        .catch(() => {});
    }
    poll();
    const id = setInterval(poll, 20_000);
    return () => clearInterval(id);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const navItems: NavItem[] = [
    { href: "/app/schedule", label: t("app.nav.schedule"), Icon: CalendarIcon },
    {
      href: "/app/notifications",
      label: t("app.nav.notifications"),
      Icon: BellIcon,
      badge: unread,
    },
    ...(canClock
      ? [{ href: "/app/clock", label: t("app.nav.clock"), Icon: ClockIcon }]
      : []),
    ...(isAdmin
      ? [
          { href: "/app/economy", label: t("app.nav.economy"), Icon: ChartIcon },
          { href: "/app/admin/members", label: t("app.nav.members"), Icon: PersonIcon },
          { href: "/app/settings", label: t("app.nav.settings"), Icon: SettingsIcon },
        ]
      : [{ href: "/app/availability", label: t("app.nav.availability"), Icon: PersonIcon }]),
  ];

  const footerProps = {
    displayName,
    restaurantName,
    onLogout: logout,
    logoutLabel: t("auth.logout"),
  };

  return (
    <div className="flex min-h-dvh">
      {/* ── Desktop sidebar ── */}
      <aside className="hidden w-60 shrink-0 flex-col bg-dark md:flex">
        <div className="px-5 py-6">
          <Logo tone="light" />
        </div>
        <NavList items={navItems} pathname={pathname} />
        <SidebarFooter {...footerProps} />
      </aside>

      {/* ── Content column ── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between bg-dark px-4 py-3 md:hidden">
          <Logo tone="light" />
          <div className="flex items-center gap-3">
            <a
              href="/app/notifications"
              className="relative text-dark-muted hover:text-dark-ink"
              aria-label={t("app.nav.notifications")}
            >
              <BellIcon className="text-[1.3rem]" />
              {unread > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-accent px-0.5 text-[0.6rem] font-bold leading-none text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </a>
            <button
              type="button"
              aria-label="Öppna meny"
              onClick={() => setDrawerOpen(true)}
              className="text-dark-muted hover:text-dark-ink"
            >
              <MenuIcon className="text-[1.3rem]" />
            </button>
          </div>
        </header>

        {/* Page content */}
        {children}
      </div>

      {/* ── Mobile drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-30 md:hidden" aria-modal="true" role="dialog">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-dark/60 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          {/* Drawer panel */}
          <div className="absolute bottom-0 left-0 top-0 flex w-72 flex-col bg-dark shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4">
              <Logo tone="light" />
              <button
                type="button"
                aria-label="Stäng meny"
                onClick={() => setDrawerOpen(false)}
                className="text-dark-muted hover:text-dark-ink"
              >
                <XIcon className="text-[1.3rem]" />
              </button>
            </div>
            <NavList
              items={navItems}
              pathname={pathname}
              onNavigate={() => setDrawerOpen(false)}
            />
            <SidebarFooter {...footerProps} />
          </div>
        </div>
      )}
    </div>
  );
}
