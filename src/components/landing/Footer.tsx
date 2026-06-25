"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";

export function Footer() {
  const { t } = useTranslations();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-5 py-7 sm:flex-row">
        <Logo />
        <p className="text-xs text-ink-faint">{t("footer.copy")}</p>
      </div>
    </footer>
  );
}
