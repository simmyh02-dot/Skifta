"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  const { t } = useTranslations();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 sm:flex-row">
        <Logo />
        <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-ink-faint">
          <a href="/privacy" className="hover:text-primary">
            {t("footer.privacy")}
          </a>
          <a href="/dpa" className="hover:text-primary">
            {t("footer.dpa")}
          </a>
          <span>{t("footer.copy")}</span>
        </nav>
      </div>
    </footer>
  );
}
