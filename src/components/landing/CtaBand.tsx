"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import { ButtonLink } from "@/components/ui/Button";

export function CtaBand() {
  const { t } = useTranslations();

  return (
    <section className="mx-auto max-w-6xl px-5 pb-16 sm:pb-20">
      <div className="rounded-3xl bg-primary px-6 py-12 text-center text-primary-ink sm:py-16">
        <h2 className="mx-auto max-w-md text-3xl font-bold sm:text-4xl">
          {t("ctaBand.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-primary-ink/80">
          {t("ctaBand.subtitle")}
        </p>
        <ButtonLink
          href="/signup"
          variant="white"
          size="lg"
          className="mt-7"
        >
          {t("ctaBand.cta")}
        </ButtonLink>
      </div>
    </section>
  );
}
