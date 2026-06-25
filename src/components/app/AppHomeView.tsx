"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { CheckIcon } from "@/components/ui/icons";

export function AppHomeView({
  restaurantName,
  role,
}: {
  restaurantName: string | null;
  role: string | null;
}) {
  const { t } = useTranslations();

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <Logo />
          {restaurantName && (
            <span className="text-sm text-ink-muted">· {restaurantName}</span>
          )}
        </div>
        <div className="flex items-center gap-4">
          <LangToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-16">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary-soft text-xl text-primary">
            <CheckIcon />
          </div>
          <h1 className="mt-4 text-xl font-bold text-ink">
            {t("app.soon.title")}
          </h1>
          <p className="mt-2 text-sm text-ink-muted">{t("app.soon.body")}</p>
          {role && (
            <p className="mt-3 text-xs text-ink-faint">
              {t(`app.roles.${role}`)}
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
