"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { startAuthentication } from "@simplewebauthn/browser";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { Avatar } from "@/components/ui/Avatar";
import { TagDot } from "@/components/ui/TagDot";
import { ScanIcon } from "@/components/ui/icons";
import { enqueue, flush, pendingCount, type QueuedStamp } from "@/lib/clock-queue";

type Result =
  | { kind: "stamped"; direction: "IN" | "OUT"; name: string; time: string }
  | { kind: "queued" };

type OnShift = {
  userId: string;
  displayName: string;
  since: string;
  tagNames: string[];
  onTime: boolean | null;
};

const PIN_LENGTH = 4;

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}
function useOnline() {
  return useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
}

function fmtTime(d: Date | string) {
  return new Date(d).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

export function ClockKiosk({
  token,
  valid,
  tierLocked,
  restaurantName,
  qrSvg,
}: {
  token: string;
  valid: boolean;
  tierLocked: boolean;
  restaurantName: string;
  qrSvg: string;
}) {
  const { t, locale } = useTranslations();
  const [pin, setPin] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(0);
  const [onShift, setOnShift] = useState<OnShift[]>([]);
  const [now, setNow] = useState(() => new Date());
  const online = useOnline();
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = valid && !tierLocked;

  const refreshQueue = useCallback(() => {
    pendingCount().then(setQueued).catch(() => {});
  }, []);

  const loadOnShift = useCallback(() => {
    if (!active) return;
    fetch(`/api/clock/onshift?token=${encodeURIComponent(token)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setOnShift(d.onShift))
      .catch(() => {});
  }, [active, token]);

  // Live header clock.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(id);
  }, []);

  // Register the offline shell cache once.
  useEffect(() => {
    if (!active) return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/clock-sw.js").catch(() => {});
    }
    refreshQueue();
    loadOnShift();
    const id = setInterval(loadOnShift, 20_000);
    return () => clearInterval(id);
  }, [active, refreshQueue, loadOnShift]);

  // Flush queued stamps on first load and when connectivity returns (§6.2).
  useEffect(() => {
    if (!active || !online) return;
    flush().then((n) => {
      setQueued(n);
      loadOnShift();
    }).catch(() => {});
  }, [active, online, loadOnShift]);

  function scheduleReset() {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = setTimeout(() => {
      setResult(null);
      setError(null);
      setPin("");
    }, 4000);
  }

  function confirm(r: Result) {
    setResult(r);
    setError(null);
    setPin("");
    navigator.vibrate?.(60);
    loadOnShift();
    scheduleReset();
  }

  async function sendStamp(identity: { pin?: string; assertion?: unknown }) {
    setBusy(true);
    setError(null);
    const stamp: QueuedStamp = {
      clientId: crypto.randomUUID(),
      token,
      timestamp: new Date().toISOString(),
      pin: identity.pin,
      deviceLabel: navigator.platform || null,
    };
    try {
      const res = await fetch("/api/clock/stamp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...stamp, assertion: identity.assertion }),
      });
      if (res.ok) {
        const data = await res.json();
        confirm({ kind: "stamped", direction: data.direction, name: data.displayName, time: fmtTime(data.timestamp) });
        refreshQueue();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(data.error === "tier_locked" ? t("clock.kiosk.tierLocked") : t("clock.kiosk.identityFailed"));
      setPin("");
    } catch {
      // Network failure: never tell staff it didn't work. Queue and reassure.
      if (identity.pin) {
        await enqueue(stamp);
        setQueued(await pendingCount());
        confirm({ kind: "queued" });
      } else {
        setError(t("clock.kiosk.failed"));
      }
    } finally {
      setBusy(false);
    }
  }

  function pressDigit(d: string) {
    if (busy) return;
    setError(null);
    const next = (pin + d).slice(0, PIN_LENGTH);
    setPin(next);
    if (next.length === PIN_LENGTH) sendStamp({ pin: next });
  }

  async function stampWithFaceId() {
    setBusy(true);
    setError(null);
    try {
      const optRes = await fetch("/api/clock/webauthn/auth/options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!optRes.ok) throw new Error();
      const assertion = await startAuthentication({ optionsJSON: await optRes.json() });
      await sendStamp({ assertion });
    } catch {
      setError(t("clock.kiosk.identityFailed"));
      setBusy(false);
    }
  }

  // ── Invalid / tier-locked ───────────────────────────────────────────────────
  if (!valid || tierLocked) {
    return (
      <Shell restaurantName={restaurantName} now={now} locale={locale}>
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          {!valid ? (
            <>
              <h1 className="text-2xl font-bold text-ink">{t("clock.kiosk.invalidTitle")}</h1>
              <p className="mt-2 max-w-sm text-ink-muted">{t("clock.kiosk.invalidBody")}</p>
            </>
          ) : (
            <p className="max-w-sm text-lg text-ink-muted">{t("clock.kiosk.tierLocked")}</p>
          )}
        </div>
      </Shell>
    );
  }

  // ── Result overlay ──────────────────────────────────────────────────────────
  if (result) {
    return (
      <Shell restaurantName={restaurantName} now={now} locale={locale}>
        <button
          type="button"
          onClick={() => {
            if (resetTimer.current) clearTimeout(resetTimer.current);
            setResult(null);
          }}
          className="flex flex-1 flex-col items-center justify-center gap-4"
        >
          <CheckMark />
          {result.kind === "stamped" ? (
            <>
              <p className="font-display text-4xl font-bold text-ink">
                {result.direction === "IN" ? t("clock.kiosk.stampedIn") : t("clock.kiosk.stampedOut")}
              </p>
              {result.name && <p className="text-xl text-ink-muted">{result.name}</p>}
              <p className="text-ink-faint">{t("clock.kiosk.at", { time: result.time })}</p>
            </>
          ) : (
            <p className="max-w-xs text-center text-xl text-ink-muted">{t("clock.kiosk.queued")}</p>
          )}
          <span className="mt-2 text-sm text-ink-faint">{t("clock.kiosk.again")}</span>
        </button>
      </Shell>
    );
  }

  // ── Idle: keypad + sidebar ──────────────────────────────────────────────────
  return (
    <Shell restaurantName={restaurantName} now={now} locale={locale} online={online} queued={queued} offlineLabel={t("clock.kiosk.offline")} queuedLabel={t("clock.kiosk.pendingCount", { count: queued })}>
      <div className="grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        {/* PIN entry */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-ink-faint">
            {t("clock.kiosk.eyebrow")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("clock.kiosk.pinPrompt")}</h1>
          <p className="mt-1.5 text-sm text-ink-muted">{t("clock.kiosk.pinSub")}</p>

          <div className="mt-6 flex gap-3">
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <span
                key={i}
                className={`h-3.5 w-3.5 rounded-full transition-colors ${
                  i < pin.length ? "bg-primary" : "bg-border-strong"
                }`}
              />
            ))}
          </div>

          {error && <p className="mt-4 text-sm text-accent">{error}</p>}

          <div className="mt-7 grid grid-cols-3 gap-3">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
              <KeypadButton key={d} onClick={() => pressDigit(d)} disabled={busy}>
                {d}
              </KeypadButton>
            ))}
            <span />
            <KeypadButton onClick={() => pressDigit("0")} disabled={busy}>
              0
            </KeypadButton>
            <KeypadButton
              onClick={() => setPin((p) => p.slice(0, -1))}
              disabled={busy || pin.length === 0}
              aria-label={t("clock.kiosk.backspace")}
            >
              ⌫
            </KeypadButton>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-5">
          <button
            type="button"
            onClick={stampWithFaceId}
            disabled={busy}
            className="flex items-center gap-4 rounded-2xl bg-surface p-5 text-left shadow-sm ring-1 ring-border transition hover:ring-border-strong disabled:opacity-70"
          >
            {qrSvg ? (
              <span
                className="h-24 w-24 shrink-0 [&>svg]:h-full [&>svg]:w-full"
                dangerouslySetInnerHTML={{ __html: qrSvg }}
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-xl bg-surface-2 text-2xl text-ink-faint">
                <ScanIcon />
              </span>
            )}
            <span>
              <span className="block font-semibold text-ink">{t("clock.kiosk.scanTitle")}</span>
              <span className="mt-1 block text-sm text-ink-muted">{t("clock.kiosk.scanBody")}</span>
              <span className="mt-2 flex items-center gap-1.5 text-xs text-ink-faint">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                {t("clock.kiosk.scanMeta")}
              </span>
            </span>
          </button>

          <div className="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-border">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-faint">
                {t("clock.kiosk.onShift")}
              </p>
              <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
                {t("clock.kiosk.clockedIn", { count: onShift.length })}
              </p>
            </div>
            <ul className="mt-3 flex flex-col divide-y divide-border">
              {onShift.length === 0 && (
                <li className="py-2 text-sm text-ink-faint">{t("clock.noEvents")}</li>
              )}
              {onShift.map((p) => (
                <li key={p.userId} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={p.displayName} size="sm" />
                    <div>
                      <p className="text-sm font-medium text-ink">{p.displayName}</p>
                      {p.tagNames[0] && <TagDot name={p.tagNames[0]} muted />}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-ink-muted">{t("clock.direction.IN")} {fmtTime(p.since)}</p>
                    {p.onTime !== null && (
                      <p className={p.onTime ? "text-success" : "text-accent"}>
                        {p.onTime ? t("clock.kiosk.onTime") : t("clock.flagged")}
                      </p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({
  restaurantName,
  now,
  locale,
  children,
  online,
  queued,
  offlineLabel,
  queuedLabel,
}: {
  restaurantName: string;
  now: Date;
  locale: string;
  children: React.ReactNode;
  online?: boolean;
  queued?: number;
  offlineLabel?: string;
  queuedLabel?: string;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <header className="flex items-center justify-between px-6 py-5 sm:px-10">
        <div className="flex items-center gap-2">
          <Logo />
          {restaurantName && <span className="text-sm text-ink-muted">· {restaurantName}</span>}
        </div>
        <div className="flex items-center gap-5">
          <div className="text-right">
            <p className="font-display text-2xl font-bold leading-none text-ink">
              {now.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="text-xs text-ink-muted">
              {now.toLocaleDateString(locale, { weekday: "long", day: "numeric", month: "long" })}
            </p>
          </div>
          <LangToggle />
        </div>
      </header>
      <main className="flex flex-1 flex-col px-6 pb-10 sm:px-10">{children}</main>
      {(online === false || (queued ?? 0) > 0) && (
        <footer className="px-6 pb-6 text-center text-sm text-accent sm:px-10">
          {online === false && <span>{offlineLabel}</span>}
          {(queued ?? 0) > 0 && <span className="ml-2">{queuedLabel}</span>}
        </footer>
      )}
    </div>
  );
}

function KeypadButton({
  children,
  onClick,
  disabled,
  ...rest
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface text-2xl font-semibold text-ink shadow-sm ring-1 ring-border transition active:scale-95 hover:ring-border-strong disabled:opacity-50"
      {...rest}
    >
      {children}
    </button>
  );
}

function CheckMark() {
  return (
    <span className="flex h-24 w-24 items-center justify-center rounded-full bg-success-soft">
      <svg viewBox="0 0 24 24" className="h-12 w-12 text-success" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}
