"use client";

import type { ReactNode } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { CalendarIcon, ClockIcon, DocIcon } from "@/components/ui/icons";

function Feature({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl bg-surface p-5 shadow-sm md:bg-transparent md:p-0 md:shadow-none">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-soft text-lg text-primary">
        {icon}
      </div>
      <h3 className="mt-3 text-base font-semibold text-ink">{title}</h3>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
    </div>
  );
}

/** Browser-chrome mock that stands in for a product screenshot. */
function MockWindow({ label }: { label: string }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
        <span className="h-2.5 w-2.5 rounded-full bg-border-strong" />
      </div>
      <div className="px-4 pt-4">
        <div className="h-1.5 w-24 rounded-full bg-primary" />
      </div>
      <div className="hatch m-4 flex h-64 items-center justify-center rounded-lg sm:h-80">
        <span className="rounded bg-surface/80 px-2 py-1 font-mono text-xs text-ink-faint">
          {label}
        </span>
      </div>
    </div>
  );
}

export function Features() {
  const { t } = useTranslations();

  return (
    <section id="features" className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <div className="grid items-center gap-8 md:grid-cols-2 md:gap-12">
        <div className="flex flex-col gap-4 md:gap-8">
          <Feature
            icon={<CalendarIcon />}
            title={t("features.shifts.title")}
            body={t("features.shifts.body")}
          />
          <Feature
            icon={<ClockIcon />}
            title={t("features.clock.title")}
            body={t("features.clock.body")}
          />
          <Feature
            icon={<DocIcon />}
            title={t("features.payroll.title")}
            body={t("features.payroll.body")}
          />
        </div>
        <MockWindow label={t("hero.mockLabel")} />
      </div>
    </section>
  );
}
