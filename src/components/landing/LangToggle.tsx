"use client";

import { useTranslations } from "@/i18n/LocaleProvider";
import { locales, localeLabels } from "@/i18n/config";
import { clsx } from "@/lib/clsx";

/**
 * Discreet SV / EN pill (spec §11). Flipping the locale swaps every string
 * in place — no reload, no navigation — because all copy is read from the
 * locale context.
 */
export function LangToggle({ tone = "ink" }: { tone?: "ink" | "light" }) {
  const { locale, setLocale, t } = useTranslations();

  return (
    <div
      role="group"
      aria-label={t("lang.toggle")}
      className={clsx(
        "inline-flex items-center rounded-full p-0.5 text-xs font-semibold",
        tone === "light" ? "bg-white/10" : "bg-surface-2 border border-border",
      )}
    >
      {locales.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            onClick={() => setLocale(code)}
            className={clsx(
              "rounded-full px-2.5 py-1 transition-colors",
              active
                ? "bg-primary text-primary-ink"
                : tone === "light"
                  ? "text-dark-muted hover:text-dark-ink"
                  : "text-ink-muted hover:text-ink",
            )}
          >
            {localeLabels[code]}
          </button>
        );
      })}
    </div>
  );
}
