"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";

export function ClockAdminView({
  qrSvg,
  kioskUrl,
  toleranceLowMinutes,
  toleranceHighMinutes,
}: {
  qrSvg: string;
  kioskUrl: string;
  toleranceLowMinutes: number;
  toleranceHighMinutes: number;
}) {
  const { t } = useTranslations();
  const [low, setLow] = useState(String(toleranceLowMinutes));
  const [high, setHigh] = useState(String(toleranceHighMinutes));
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveTolerance(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setSaved(false);
    try {
      const res = await fetch("/api/clock/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toleranceLowMinutes: Number(low),
          toleranceHighMinutes: Number(high),
        }),
      });
      if (res.ok) setSaved(true);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(kioskUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const inputClass =
    "h-10 w-24 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          <nav className="flex items-center gap-3 text-sm text-ink-muted">
            <a href="/app/schedule" className="hover:text-primary">
              {t("app.nav.schedule")}
            </a>
            <a href="/app/clock" className="hover:text-primary">
              {t("app.nav.clock")}
            </a>
            <a href="/app/clock/setup" className="text-ink hover:text-primary">
              {t("clock.admin.title")}
            </a>
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LangToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
        <h1 className="text-xl font-bold text-ink">{t("clock.admin.title")}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t("clock.admin.subtitle")}</p>

        {/* QR code */}
        <div className="mt-6 flex flex-col items-center rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-border">
          <div
            className="h-56 w-56 [&>svg]:h-full [&>svg]:w-full"
            // QR markup generated server-side by the qrcode library.
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <p className="mt-4 text-center text-xs text-ink-muted">
            {t("clock.admin.qrHint")}
          </p>
        </div>

        {/* Kiosk link */}
        <div className="mt-4">
          <p className="text-xs font-medium text-ink">{t("clock.admin.kioskLink")}</p>
          <div className="mt-1.5 flex items-center gap-2">
            <input
              readOnly
              value={kioskUrl}
              className="h-10 flex-1 rounded-lg border border-border bg-surface-2 px-3 text-xs text-ink-muted"
            />
            <button
              type="button"
              onClick={copyLink}
              className="h-10 shrink-0 rounded-lg border border-border-strong px-3 text-sm text-ink hover:bg-surface-2"
            >
              {copied ? t("clock.admin.copied") : t("clock.admin.copy")}
            </button>
          </div>
        </div>

        {/* Tolerance window */}
        <form
          onSubmit={saveTolerance}
          className="mt-8 border-t border-border pt-6"
        >
          <h2 className="text-sm font-semibold text-ink">
            {t("clock.admin.toleranceTitle")}
          </h2>
          <p className="mt-1 text-xs text-ink-muted">{t("clock.admin.toleranceHint")}</p>
          <div className="mt-4 flex flex-col gap-3">
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">{t("clock.admin.toleranceLow")}</span>
              <input
                type="number"
                min={0}
                max={240}
                value={low}
                onChange={(e) => setLow(e.target.value)}
                className={inputClass}
              />
            </label>
            <label className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink">{t("clock.admin.toleranceHigh")}</span>
              <input
                type="number"
                min={0}
                max={240}
                value={high}
                onChange={(e) => setHigh(e.target.value)}
                className={inputClass}
              />
            </label>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button type="submit" disabled={busy}>
              {t("clock.admin.save")}
            </Button>
            {saved && <span className="text-sm text-ink-muted">{t("clock.admin.saved")}</span>}
          </div>
        </form>
      </main>
    </div>
  );
}
