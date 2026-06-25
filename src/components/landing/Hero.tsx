"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import { ButtonLink } from "@/components/ui/Button";

export function Hero() {
  const { t } = useTranslations();

  return (
    <section className="mx-auto max-w-3xl px-5 pt-14 pb-10 text-center sm:pt-20">
      <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs font-semibold text-primary">
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
        {t("hero.pill")}
      </span>

      <h1 className="mx-auto mt-6 max-w-2xl text-4xl font-bold leading-[1.05] text-ink sm:text-6xl">
        {t("hero.title")}
      </h1>

      <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-ink-muted sm:text-lg">
        {t("hero.subtitle")}
      </p>

      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <ButtonLink
          href="/signup"
          variant="primary"
          size="lg"
          className="w-full sm:w-auto"
        >
          {t("hero.ctaPrimary")}
        </ButtonLink>
        <ButtonLink
          href="#pricing"
          variant="secondary"
          size="lg"
          className="w-full sm:w-auto"
        >
          {t("hero.ctaSecondary")}
        </ButtonLink>
      </div>

      <p className="mt-4 text-xs text-ink-faint">{t("hero.note")}</p>
    </section>
  );
}
