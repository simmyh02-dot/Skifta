"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import { ButtonLink } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { clsx } from "@/lib/clsx";

function PlanCard({
  name,
  price,
  perMonth,
  billed,
  features,
  ctaLabel,
  href,
  featured,
  recommendedLabel,
}: {
  name: string;
  price: string;
  perMonth: string;
  billed: string;
  features: string[];
  ctaLabel: string;
  href: string;
  featured?: boolean;
  recommendedLabel?: string;
}) {
  return (
    <div
      className={clsx(
        "flex flex-col rounded-3xl p-7 sm:p-8",
        featured
          ? "bg-dark text-dark-ink"
          : "bg-surface text-ink shadow-sm ring-1 ring-border",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold">{name}</h3>
        {featured && recommendedLabel && (
          <span className="rounded-full bg-primary px-2.5 py-1 text-xs font-semibold text-primary-ink">
            {recommendedLabel}
          </span>
        )}
      </div>

      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-5xl font-bold tabular">{price}</span>
        <span
          className={clsx(
            "text-sm",
            featured ? "text-dark-muted" : "text-ink-muted",
          )}
        >
          {perMonth}
        </span>
      </div>
      <p
        className={clsx(
          "mt-1 text-xs",
          featured ? "text-dark-muted" : "text-ink-faint",
        )}
      >
        {billed}
      </p>

      <ButtonLink
        href={href}
        variant={featured ? "primary" : "secondary"}
        size="lg"
        className={clsx(
          "mt-6 w-full",
          !featured && "border-primary/30 text-primary hover:bg-primary-soft",
        )}
      >
        {ctaLabel}
      </ButtonLink>

      <ul className="mt-6 flex flex-col gap-3">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2.5 text-sm">
            <CheckIcon
              className={clsx(
                "mt-0.5 shrink-0 text-base",
                featured ? "text-primary" : "text-primary",
              )}
            />
            <span className={featured ? "text-dark-ink" : "text-ink"}>
              {feature}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Pricing() {
  const { t, m } = useTranslations();

  return (
    <section id="pricing" className="mx-auto max-w-5xl px-5 py-16 sm:py-20">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-ink sm:text-4xl">
          {t("pricing.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-ink-muted">
          {t("pricing.subtitle")}
        </p>
      </div>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        <PlanCard
          name={m.pricing.bas.name}
          price="249"
          perMonth={t("pricing.perMonth")}
          billed={t("pricing.billed")}
          features={m.pricing.bas.features}
          ctaLabel={t("pricing.cta")}
          href="/signup?plan=bas"
        />
        <PlanCard
          featured
          recommendedLabel={t("pricing.recommended")}
          name={m.pricing.full.name}
          price="499"
          perMonth={t("pricing.perMonth")}
          billed={t("pricing.billed")}
          features={m.pricing.full.features}
          ctaLabel={t("pricing.cta")}
          href="/signup?plan=full"
        />
      </div>
    </section>
  );
}
