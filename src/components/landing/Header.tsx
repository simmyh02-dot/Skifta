"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { LangToggle } from "./LangToggle";
import { MenuIcon } from "@/components/ui/icons";

export function Header() {
  const { t } = useTranslations();
  const [open, setOpen] = useState(false);

  const links = [
    { href: "#features", label: t("nav.features") },
    { href: "#pricing", label: t("nav.pricing") },
    { href: "/login", label: t("nav.login") },
  ];

  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-bg/85 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
        <a href="/" aria-label="Skifta">
          <Logo />
        </a>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 md:flex">
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-ink-muted transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
          <LangToggle />
          <ButtonLink href="/signup" variant="primary" size="md">
            {t("nav.cta")}
          </ButtonLink>
        </nav>

        {/* Mobile controls */}
        <div className="flex items-center gap-2 md:hidden">
          <LangToggle />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-label={t("nav.menu")}
            className="flex h-10 w-10 items-center justify-center rounded-full text-ink hover:bg-surface-2"
          >
            <MenuIcon className="text-xl" />
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-border bg-bg px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {links.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-2.5 text-sm font-medium text-ink-muted hover:bg-surface-2 hover:text-ink"
              >
                {link.label}
              </a>
            ))}
            <ButtonLink
              href="/signup"
              variant="primary"
              size="lg"
              className="mt-2 w-full"
            >
              {t("nav.cta")}
            </ButtonLink>
          </nav>
        </div>
      )}
    </header>
  );
}
