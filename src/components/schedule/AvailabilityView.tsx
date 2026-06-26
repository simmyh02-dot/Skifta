"use client";

import { useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";

type Range = { weekday: number; startMinute: number; endMinute: number };

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60)
    .toString()
    .padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function AvailabilityView({ initialRanges }: { initialRanges: Range[] }) {
  const { t, m } = useTranslations();

  const [days, setDays] = useState(() =>
    Array.from({ length: 7 }, (_, weekday) => {
      const existing = initialRanges.find((r) => r.weekday === weekday);
      return {
        available: !!existing,
        start: existing ? toHHMM(existing.startMinute) : "09:00",
        end: existing ? toHHMM(existing.endMinute) : "17:00",
      };
    }),
  );
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setSaved(false);
    try {
      const ranges: Range[] = days
        .map((d, weekday) => ({ ...d, weekday }))
        .filter((d) => d.available)
        .map((d) => ({
          weekday: d.weekday,
          startMinute: toMinutes(d.start),
          endMinute: toMinutes(d.end),
        }));
      await fetch("/api/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ranges }),
      });
      setSaved(true);
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          <a href="/app/schedule" className="text-sm text-ink-muted hover:text-primary">
            {t("app.nav.schedule")}
          </a>
        </div>
        <div className="flex items-center gap-4">
          <LangToggle />
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto w-full max-w-md flex-1 px-5 py-10">
        <h1 className="text-xl font-bold text-ink">{t("availability.title")}</h1>
        <p className="mt-1.5 text-sm text-ink-muted">{t("availability.subtitle")}</p>

        <form onSubmit={save} className="mt-6 flex flex-col gap-3">
          {days.map((day, i) => (
            <div
              key={i}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 shadow-sm ring-1 ring-border"
            >
              <label className="flex w-24 items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={day.available}
                  onChange={(e) =>
                    setDays((prev) =>
                      prev.map((d, j) =>
                        j === i ? { ...d, available: e.target.checked } : d,
                      ),
                    )
                  }
                />
                {m.schedule.weekdays[i]}
              </label>
              <input
                type="time"
                value={day.start}
                disabled={!day.available}
                onChange={(e) =>
                  setDays((prev) =>
                    prev.map((d, j) => (j === i ? { ...d, start: e.target.value } : d)),
                  )
                }
                className={inputClass}
              />
              <span className="text-ink-faint">–</span>
              <input
                type="time"
                value={day.end}
                disabled={!day.available}
                onChange={(e) =>
                  setDays((prev) =>
                    prev.map((d, j) => (j === i ? { ...d, end: e.target.value } : d)),
                  )
                }
                className={inputClass}
              />
            </div>
          ))}
          {saved && <p className="text-sm text-ink-muted">{t("availability.saved")}</p>}
          <Button type="submit" disabled={loading}>
            {t("availability.save")}
          </Button>
        </form>
      </main>
    </div>
  );
}
