"use client";

import { useTranslations } from "@/i18n/LocaleProvider";

export function StatsBand() {
  const { m } = useTranslations();
  const stats = [m.stats.size, m.stats.price, m.stats.clock, m.stats.trial];

  return (
    <section className="bg-dark">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-8 px-5 py-12 md:grid-cols-4 md:py-14">
        {stats.map((stat) => (
          <div key={stat.label}>
            <div className="font-display text-3xl font-bold text-primary sm:text-4xl">
              {stat.value}
            </div>
            <div className="mt-1.5 text-xs leading-snug text-dark-muted sm:text-sm">
              {stat.label}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
