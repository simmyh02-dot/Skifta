"use client";

import Link from "next/link";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";

// §13 legal documents (privacy policy + DPA). Content lives in the i18n
// catalogs and is read structurally via `m` (sections are arrays), keeping
// rule #1 (no hardcoded UI text) intact for long-form prose too.
export function LegalDoc({ doc }: { doc: "privacy" | "dpa" }) {
  const { t, m } = useTranslations();
  const content = m.legal[doc];

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-5 py-5">
        <Link href="/" aria-label="Skifta">
          <Logo />
        </Link>
        <LangToggle />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-5 pb-16">
        <Link href="/" className="text-sm text-ink-muted hover:text-primary">
          ← {t("legal.back")}
        </Link>
        <h1 className="mt-3 text-3xl font-bold text-ink">{content.title}</h1>
        <p className="mt-1 text-xs text-ink-faint">{t("legal.updated")}</p>
        <p className="mt-5 text-sm leading-relaxed text-ink-muted">{content.intro}</p>

        <div className="mt-8 flex flex-col gap-6">
          {content.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-base font-semibold text-ink">{section.heading}</h2>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">
                {section.body}
              </p>
            </section>
          ))}
        </div>
      </main>
    </div>
  );
}
