"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Button } from "@/components/ui/Button";
import { AppShell } from "@/components/app/AppShell";

type OpenShiftFill = "FIRST_COME" | "MANUAL_PICK";

export function SettingsView({
  role,
  restaurantName: initialName,
  displayName,
  openShiftFill: initialFill,
}: {
  role: string;
  restaurantName: string;
  displayName: string;
  openShiftFill: OpenShiftFill;
}) {
  const { t } = useTranslations();
  const [name, setName] = useState(initialName);
  const [openShiftFill, setOpenShiftFill] = useState<OpenShiftFill>(initialFill);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const res = await fetch("/api/restaurants/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, openShiftFill }),
      });
      if (!res.ok) {
        setError(t("settings.saveError"));
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      setError(t("settings.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "h-11 w-full rounded-xl border border-border bg-surface px-4 text-ink placeholder:text-ink-faint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <AppShell role={role} restaurantName={initialName} displayName={displayName}>
      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-lg">
          <h1 className="font-display text-2xl font-bold text-ink">{t("settings.title")}</h1>

          <form onSubmit={save} className="mt-6 flex flex-col gap-6">
            <section className="rounded-2xl bg-surface p-5 ring-1 ring-border">
              <h2 className="mb-4 text-sm font-semibold text-ink">{t("settings.restaurantSection")}</h2>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-muted">{t("settings.restaurantNameLabel")}</span>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t("settings.restaurantNamePlaceholder")}
                  className={inputClass}
                  required
                  maxLength={120}
                />
              </label>

              <label className="mt-4 flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-muted">{t("settings.openShiftLabel")}</span>
                <p className="text-xs text-ink-faint">{t("settings.openShiftHint")}</p>
                <select
                  value={openShiftFill}
                  onChange={(e) => setOpenShiftFill(e.target.value as OpenShiftFill)}
                  className={inputClass}
                >
                  <option value="FIRST_COME">{t("settings.openShiftFirstCome")}</option>
                  <option value="MANUAL_PICK">{t("settings.openShiftManual")}</option>
                </select>
              </label>
            </section>

            {error && <p className="text-sm text-accent">{error}</p>}
            {saved && <p className="text-sm text-primary">{t("settings.saved")}</p>}

            <Button type="submit" disabled={saving}>
              {t("settings.save")}
            </Button>
          </form>
        </div>
      </main>
    </AppShell>
  );
}
