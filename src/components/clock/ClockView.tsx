"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Avatar } from "@/components/ui/Avatar";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { QrClockInOverlay } from "@/components/clock/QrClockInOverlay";
import { QrIcon, ScanIcon } from "@/components/ui/icons";

type Flag = { minutesDelta: number; severity: "NONE" | "LOW" | "HIGH" };
type ClockEventDTO = {
  id: string;
  direction: "IN" | "OUT";
  timestamp: string;
  verificationMethod: "WEBAUTHN" | "PIN" | "GEOFENCE" | "MANUAL";
  syncStatus: "QUEUED" | "SYNCED";
  flag: Flag | null;
};
type Device = { id: string; deviceLabel: string | null };
type History = {
  events: ClockEventDTO[];
  hours: number;
  openSince: string | null;
  hasPin: boolean;
  hasDevice: boolean;
  devices: Device[];
  todayShift: { startsAt: string; endsAt: string } | null;
};

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtHM(hoursDecimal: number) {
  const total = Math.max(0, Math.round(hoursDecimal * 60));
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}
function fmtDayLabel(iso: string, todayLabel: string) {
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return todayLabel;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric" });
}

/** Pair raw events into per-day in/out rows for the history list. */
type DayRow = { key: string; label: string; inTime: string | null; outTime: string | null; flag: Flag | null };

export function ClockView({
  role,
  restaurantName,
  displayName,
}: {
  role: string;
  restaurantName: string;
  displayName: string;
}) {
  const { t } = useTranslations();
  const isAdmin = role === "OWNER" || role === "CO_OWNER";
  const [data, setData] = useState<History | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [nowTs, setNowTs] = useState(() => new Date());
  const [scanning, setScanning] = useState(false);

  const load = useCallback(() => {
    fetch("/api/clock/history")
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setData(d));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  // Live-tick the elapsed counter while clocked in.
  useEffect(() => {
    if (!data?.openSince) return;
    const id = setInterval(() => setNowTs(new Date()), 30_000);
    return () => clearInterval(id);
  }, [data?.openSince]);

  const elapsedHours = data?.openSince
    ? (nowTs.getTime() - new Date(data.openSince).getTime()) / 3_600_000
    : 0;

  const dayRows = useMemo<DayRow[]>(() => {
    if (!data) return [];
    const byDay = new Map<string, ClockEventDTO[]>();
    for (const e of data.events) {
      const key = new Date(e.timestamp).toDateString();
      (byDay.get(key) ?? byDay.set(key, []).get(key)!).push(e);
    }
    const rows: DayRow[] = [];
    for (const [key, evs] of byDay) {
      const sorted = [...evs].sort((a, b) => +new Date(a.timestamp) - +new Date(b.timestamp));
      const inEv = sorted.find((e) => e.direction === "IN") ?? null;
      const outEv = [...sorted].reverse().find((e) => e.direction === "OUT") ?? null;
      rows.push({
        key,
        label: fmtDayLabel(evs[0].timestamp, t("schedule.today")),
        inTime: inEv ? fmtTime(inEv.timestamp) : null,
        outTime: outEv ? fmtTime(outEv.timestamp) : null,
        flag: outEv?.flag ?? inEv?.flag ?? null,
      });
    }
    return rows.sort((a, b) => +new Date(b.key) - +new Date(a.key));
  }, [data, t]);

  // Clock-OUT only (§5/§6.2) — session + own-device Face ID, no QR needed.
  // Clock-IN is gated behind the QR overlay below; it must never be reachable
  // through this function.
  async function stamp() {
    if (busy || !data) return;
    if (!data.hasDevice) {
      setMsg(t("clock.needDevice"));
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const optRes = await fetch("/api/clock/webauthn/auth/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!optRes.ok) throw new Error();
      const assertion = await startAuthentication({ optionsJSON: await optRes.json() });
      const res = await fetch("/api/clock/self", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assertion,
          clientId: crypto.randomUUID(),
          direction: data.openSince ? "OUT" : "IN",
        }),
      });
      if (!res.ok) throw new Error();
      navigator.vibrate?.(60);
      load();
    } catch {
      setMsg(t("clock.setup.error"));
    } finally {
      setBusy(false);
    }
  }

  const clockedIn = !!data?.openSince;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <Logo />
          {restaurantName && (
            <span className="hidden text-sm text-ink-muted sm:inline">· {restaurantName}</span>
          )}
          <nav className="ml-2 hidden items-center gap-3 text-sm text-ink-muted sm:flex">
            <a href="/app/schedule" className="hover:text-primary">{t("app.nav.schedule")}</a>
            <a href="/app/clock" className="text-ink hover:text-primary">{t("app.nav.clock")}</a>
            {isAdmin && (
              <a href="/app/economy" className="hover:text-primary">{t("app.nav.economy")}</a>
            )}
            {isAdmin && (
              <a href="/app/clock/setup" className="hover:text-primary">{t("clock.admin.title")}</a>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <LangToggle />
          <span className="hidden sm:inline"><LogoutButton /></span>
          <Avatar name={displayName} size="md" filled />
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-5 py-6">
        {/* Hero card */}
        <section className="rounded-3xl bg-primary p-6 text-primary-ink shadow-lg">
          <div className="flex items-center gap-2 text-sm font-medium text-primary-ink/80">
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full ${clockedIn ? "bg-white" : "bg-white/40"}`}
            />
            {clockedIn ? t("clock.onShiftNow") : t("clock.notClockedIn")}
          </div>

          {clockedIn ? (
            <>
              <p className="mt-3 font-display text-5xl font-bold tracking-tight">
                {fmtHM(elapsedHours)}
              </p>
              <p className="mt-2 text-sm text-primary-ink/80">
                {data?.todayShift
                  ? t("clock.clockedInUntil", {
                      time: fmtTime(data.openSince!),
                      until: fmtTime(data.todayShift.endsAt),
                    })
                  : fmtTime(data!.openSince!)}
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-primary-ink/80">
              {data?.todayShift
                ? t("clock.scheduledToday", {
                    start: fmtTime(data.todayShift.startsAt),
                    end: fmtTime(data.todayShift.endsAt),
                  })
                : t("clock.noShiftToday")}
            </p>
          )}

          <div className="mt-5 flex items-center gap-3">
            <button
              type="button"
              onClick={clockedIn ? stamp : () => setScanning(true)}
              disabled={busy}
              className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-surface text-base font-semibold text-primary shadow-sm transition active:scale-[0.98] disabled:opacity-70"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm bg-primary" />
              {clockedIn ? t("clock.clockOut") : t("clock.clockIn")}
            </button>
            {!clockedIn && (
              <button
                type="button"
                onClick={() => setScanning(true)}
                disabled={busy}
                aria-label={t("clock.clockIn")}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-xl text-primary-ink hover:bg-white/25 disabled:opacity-70"
              >
                <QrIcon />
              </button>
            )}
          </div>
        </section>

        <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-ink-muted">
          <ScanIcon className="text-sm" />
          {clockedIn ? t("clock.confirmFaceId") : t("clock.scan.hint")}
        </p>
        {msg && <p className="mt-2 text-center text-xs text-accent">{msg}</p>}
        {scanning && <QrClockInOverlay onClose={() => setScanning(false)} />}

        {/* Period total + history */}
        <div className="mt-7 flex items-baseline justify-between">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {t("clock.thisPeriod")}
          </p>
          <p className="font-display text-lg font-bold text-ink">
            {data ? fmtHM(data.hours) : "—"}
          </p>
        </div>

        <div className="mt-3 flex flex-col gap-2.5">
          {data && dayRows.length === 0 && (
            <p className="text-sm text-ink-faint">{t("clock.noEvents")}</p>
          )}
          {dayRows.map((row) => (
            <div
              key={row.key}
              className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3.5 shadow-sm ring-1 ring-border"
            >
              <p className="font-medium text-ink">{row.label}</p>
              <div className="text-right">
                <p className="text-sm">
                  <span className="text-primary">{row.inTime ?? "—"}</span>
                  <span className="text-ink-faint"> – </span>
                  <span className={row.outTime ? "text-ink" : "text-primary"}>
                    {row.outTime ?? t("clock.now")}
                  </span>
                </p>
                {row.flag && (
                  <p className="text-xs text-accent">
                    {row.flag.minutesDelta > 0 ? "+" : ""}
                    {row.flag.minutesDelta} {t("clock.min")} · {t("clock.flagged")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <SetupSection data={data} onChange={load} />
      </main>

      <MobileTabBar active="clock" isAdmin={isAdmin} />
    </div>
  );
}

function SetupSection({ data, onChange }: { data: History | null; onChange: () => void }) {
  const { t } = useTranslations();
  const [pin, setPin] = useState("");
  const [pinMsg, setPinMsg] = useState<string | null>(null);
  const [devMsg, setDevMsg] = useState<string | null>(null);
  const [registering, setRegistering] = useState(false);

  async function registerDevice() {
    setRegistering(true);
    setDevMsg(null);
    try {
      const optRes = await fetch("/api/clock/webauthn/register/options", { method: "POST" });
      if (!optRes.ok) throw new Error();
      const attResp = await startRegistration({ optionsJSON: await optRes.json() });
      const verifyRes = await fetch("/api/clock/webauthn/register/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ response: attResp, deviceLabel: navigator.platform || null }),
      });
      if (!verifyRes.ok) throw new Error();
      setDevMsg(t("clock.setup.registered"));
      onChange();
    } catch {
      setDevMsg(t("clock.setup.error"));
    } finally {
      setRegistering(false);
    }
  }

  async function savePin(e: React.FormEvent) {
    e.preventDefault();
    setPinMsg(null);
    const res = await fetch("/api/clock/pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (res.ok) {
      setPin("");
      setPinMsg(t("clock.setup.pinSaved"));
      onChange();
    } else {
      setPinMsg(t("clock.setup.error"));
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-5 border-t border-border pt-6">
      <section>
        <h2 className="text-sm font-semibold text-ink">{t("clock.setup.deviceTitle")}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t("clock.setup.deviceHint")}</p>
        <button
          type="button"
          onClick={registerDevice}
          disabled={registering}
          className="mt-3 h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
        >
          {registering ? t("clock.setup.registering") : t("clock.setup.registerDevice")}
        </button>
        {devMsg && <p className="mt-2 text-xs text-ink-muted">{devMsg}</p>}
        {data && data.devices.length > 0 && (
          <ul className="mt-3 flex flex-col gap-1 text-xs text-ink-muted">
            {data.devices.map((d) => (
              <li key={d.id} className="flex items-center gap-2">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                {d.deviceLabel || t("clock.setup.unnamedDevice")}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-semibold text-ink">{t("clock.setup.pinTitle")}</h2>
        <p className="mt-1 text-xs text-ink-muted">{t("clock.setup.pinHint")}</p>
        {data?.hasPin && <p className="mt-1 text-xs text-success">{t("clock.setup.pinSet")}</p>}
        <form onSubmit={savePin} className="mt-3 flex items-center gap-2">
          <input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric"
            type="password"
            placeholder={t("clock.setup.pinPlaceholder")}
            className="h-11 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <button
            type="submit"
            disabled={pin.length < 4}
            className="h-11 rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
          >
            {t("clock.setup.savePin")}
          </button>
        </form>
        {pinMsg && <p className="mt-2 text-xs text-ink-muted">{pinMsg}</p>}
      </section>
    </div>
  );
}
