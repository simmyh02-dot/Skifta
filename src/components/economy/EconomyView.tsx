"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Avatar } from "@/components/ui/Avatar";
import { MobileTabBar } from "@/components/app/MobileTabBar";
import { ArrowDownIcon, CheckIcon } from "@/components/ui/icons";

type ExportFormat = "FORTNOX" | "VISMA" | "CSV" | "CUSTOM";

type MemberSummary = {
  userId: string;
  displayName: string;
  activated: boolean;
  hours: number;
  openDeviations: number;
  reviewedDeviations: number;
  hasUnreviewedDeviations: boolean;
  openSince: string | null;
};
type DeviationRow = {
  id: string;
  userId: string;
  displayName: string;
  severity: "NONE" | "LOW" | "HIGH";
  status: "OPEN" | "REVIEWED" | "APPROVED";
  minutesDelta: number;
  direction: "IN" | "OUT" | null;
  stampAt: string | null;
  shiftStartsAt: string | null;
  shiftEndsAt: string | null;
  reason: string | null;
  createdAt: string;
};
type OnShiftEntry = {
  userId: string;
  displayName: string;
  since: string;
  tagNames: string[];
  onTime: boolean | null;
};
type Overview = {
  periodStart: string;
  periodEnd: string;
  members: MemberSummary[];
  deviations: DeviationRow[];
  onShift: OnShiftEntry[];
  totals: {
    totalHours: number;
    openDeviations: number;
    onShiftCount: number;
    staffCount: number;
    activatedCount: number;
  };
};

type Tab = "payroll" | "draft" | "timeclock" | "deviations" | "settings";

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}
function fmtHours(h: number) {
  return Number.isInteger(h) ? String(h) : h.toFixed(1);
}
function shiftPeriodKey(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function EconomyView({
  role,
  restaurantName,
  displayName,
  defaultFormat,
  initialPeriod,
  initialOverview,
}: {
  role: string;
  restaurantName: string;
  displayName: string;
  defaultFormat: ExportFormat;
  initialPeriod: string;
  initialOverview: Overview;
}) {
  const { t, locale } = useTranslations();
  const isAdmin = role === "OWNER" || role === "CO_OWNER";

  const [period, setPeriod] = useState(initialPeriod);
  const [data, setData] = useState<Overview>(initialOverview);
  const [tab, setTab] = useState<Tab>("payroll");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (nextPeriod: string) => {
    setBusy(true);
    try {
      const res = await fetch(`/api/economy/overview?period=${nextPeriod}`);
      if (res.ok) setData(await res.json());
    } finally {
      setBusy(false);
    }
  }, []);

  function changePeriod(delta: number) {
    const next = shiftPeriodKey(period, delta);
    setPeriod(next);
    load(next);
  }

  const periodLabel = useMemo(
    () =>
      new Date(data.periodStart).toLocaleDateString(locale, {
        month: "long",
        year: "numeric",
      }),
    [data.periodStart, locale],
  );

  const openDeviations = data.deviations.filter((d) => d.status === "OPEN");

  async function actOnDeviation(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/economy/deviations/${id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) await load(period);
    return res.ok;
  }

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
            <a href="/app/clock" className="hover:text-primary">{t("app.nav.clock")}</a>
            <a href="/app/economy" className="text-ink hover:text-primary">{t("app.nav.economy")}</a>
            <a href="/app/admin/members" className="hover:text-primary">{t("app.nav.admin")}</a>
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setTab("settings")}
            className="hidden h-9 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-ink hover:bg-primary-hover sm:inline-flex"
          >
            <ArrowDownIcon className="text-sm" />
            {t("economy.export")}
          </button>
          <LangToggle />
          <span className="hidden sm:inline"><LogoutButton /></span>
          <Avatar name={displayName} size="md" filled />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-6">
        {/* Period + tabs */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold text-ink">{t("economy.title")}</h1>
            <p className="mt-0.5 text-sm text-ink-muted">
              {t("economy.subtitle", { period: periodLabel, restaurant: restaurantName })}
            </p>
            {/* Member management lives one tap away; visible on phones too,
                where this section is the owner's Admin tab. */}
            <a href="/app/admin/members" className="mt-1 inline-block text-sm text-primary hover:underline sm:hidden">
              {t("app.nav.admin")} · {t("invite.admin.title")} →
            </a>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-surface px-1 py-1 ring-1 ring-border">
            <button
              type="button"
              onClick={() => changePeriod(-1)}
              disabled={busy}
              aria-label={t("economy.prevPeriod")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 disabled:opacity-50"
            >
              ‹
            </button>
            <span className="px-2 text-sm font-medium text-ink">{periodLabel}</span>
            <button
              type="button"
              onClick={() => changePeriod(1)}
              disabled={busy}
              aria-label={t("economy.nextPeriod")}
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-muted hover:bg-surface-2 disabled:opacity-50"
            >
              ›
            </button>
          </div>
        </div>

        <nav className="mt-5 flex items-center gap-1 overflow-x-auto border-b border-border text-sm">
          {(["payroll", "draft", "timeclock", "deviations", "settings"] as Tab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 font-medium transition-colors ${
                tab === key
                  ? "border-primary text-ink"
                  : "border-transparent text-ink-muted hover:text-ink"
              }`}
            >
              {key === "draft" ? t("economy.draft.tab") : t(`economy.tabs.${key}`)}
              {key === "deviations" && data.totals.openDeviations > 0 && (
                <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1.5 text-xs font-semibold text-white">
                  {data.totals.openDeviations}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="mt-6">
          {tab === "payroll" && (
            <PayrollTab
              data={data}
              onReviewAll={() => setTab("deviations")}
            />
          )}
          {tab === "draft" && <DraftTab period={period} />}
          {tab === "timeclock" && <TimeClockTab onShift={data.onShift} />}
          {tab === "deviations" && (
            <DeviationsTab deviations={data.deviations} onAct={actOnDeviation} />
          )}
          {tab === "settings" && (
            <SettingsTab period={period} defaultFormat={defaultFormat} />
          )}
        </div>
      </main>

      <MobileTabBar active="third" isAdmin={isAdmin} />
    </div>
  );
}

// ─────────────────────────── Payroll tab ────────────────────────────

function StatCard({ label, value, unit, accent }: { label: string; value: string; unit?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-surface p-4 ring-1 ring-border">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-faint">{label}</p>
      <p className={`mt-2 font-display text-3xl font-bold ${accent ? "text-accent" : "text-ink"}`}>
        {value}
        {unit && <span className="ml-1 text-base font-medium text-ink-muted">{unit}</span>}
      </p>
    </div>
  );
}

function PayrollTab({ data, onReviewAll }: { data: Overview; onReviewAll: () => void }) {
  const { t } = useTranslations();
  const { totals } = data;

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={t("economy.stats.totalHours")} value={fmtHours(totals.totalHours)} unit={t("economy.stats.hoursUnit")} />
        <StatCard label={t("economy.stats.flagged")} value={String(totals.openDeviations)} accent={totals.openDeviations > 0} />
        <StatCard label={t("economy.stats.onShift")} value={String(totals.onShiftCount)} />
        <StatCard label={t("economy.stats.staff")} value={t("economy.stats.staffOf", { active: totals.activatedCount, total: totals.staffCount })} />
      </div>

      {totals.openDeviations > 0 ? (
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft p-4 ring-1 ring-accent/20">
          <div>
            <p className="font-semibold text-accent-ink">
              {t("economy.approvalBanner.title", { count: totals.openDeviations })}
            </p>
            <p className="mt-0.5 text-sm text-accent-ink/80">{t("economy.approvalBanner.body")}</p>
          </div>
          <button
            type="button"
            onClick={onReviewAll}
            className="h-10 shrink-0 rounded-full bg-accent px-5 text-sm font-semibold text-white hover:bg-accent-hover"
          >
            {t("economy.approvalBanner.reviewAll")}
          </button>
        </div>
      ) : (
        <p className="mt-5 flex items-center gap-2 rounded-2xl bg-success-soft p-4 text-sm text-primary ring-1 ring-primary/15">
          <CheckIcon /> {t("economy.noApprovalNeeded")}
        </p>
      )}

      {/* Per-employee table */}
      <div className="mt-6 overflow-hidden rounded-2xl ring-1 ring-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-surface-2 text-xs uppercase tracking-wide text-ink-faint">
            <tr>
              <th className="px-4 py-3 font-medium">{t("economy.table.employee")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("economy.table.hours")}</th>
              <th className="hidden px-4 py-3 text-right font-medium sm:table-cell">{t("economy.table.deviations")}</th>
              <th className="px-4 py-3 text-right font-medium">{t("economy.table.status")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border bg-surface">
            {data.members.map((m) => (
              <tr key={m.userId}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.displayName} size="sm" />
                    <span className="font-medium text-ink">{m.displayName}</span>
                    {m.openSince && (
                      <span className="inline-block h-2 w-2 rounded-full bg-primary" title={t("economy.status.onShift")} />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-ink">
                  {fmtHours(m.hours)}<span className="text-ink-faint"> {t("economy.stats.hoursUnit")}</span>
                </td>
                <td className="hidden px-4 py-3 text-right tabular-nums sm:table-cell">
                  {m.openDeviations + m.reviewedDeviations > 0 ? (
                    <span className={m.hasUnreviewedDeviations ? "text-accent" : "text-ink-muted"}>
                      {m.openDeviations + m.reviewedDeviations}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {m.hasUnreviewedDeviations ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink">
                      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                      {t("economy.status.needsReview")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-1 text-xs font-medium text-primary">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {t("economy.status.ready")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─────────────────────────── Time clock tab ─────────────────────────

function TimeClockTab({ onShift }: { onShift: OnShiftEntry[] }) {
  const { t } = useTranslations();
  if (onShift.length === 0) {
    return <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-muted ring-1 ring-border">{t("economy.onShiftEmpty")}</p>;
  }
  return (
    <div className="flex flex-col gap-2.5">
      {onShift.map((e) => (
        <div key={e.userId} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 ring-1 ring-border">
          <div className="flex items-center gap-3">
            <Avatar name={e.displayName} size="sm" filled />
            <div>
              <p className="font-medium text-ink">{e.displayName}</p>
              <p className="text-xs text-ink-muted">{t("economy.since", { time: fmtTime(e.since) })}</p>
            </div>
          </div>
          {e.onTime === false && (
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink">
              {t("economy.status.needsReview")}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────── Pay draft tab (§8.2) ───────────────────

type DraftLine = {
  type: "base" | "ob" | "overtime";
  hours: number;
  rate: number;
  amount: number;
  label?: string;
  windowId?: string;
  percent?: number;
};
type MemberDraft = {
  userId: string;
  name: string;
  rate: number | null;
  missingRate: boolean;
  unreviewed: boolean;
  draft: { baseHours: number; obHours: number; grossAmount: number; lines: DraftLine[] };
};
type Preview = {
  ruleSet: { id: string; name: string };
  members: MemberDraft[];
  note: { text: string; source: "ai" | "fallback" };
};
type ApproveResult = {
  approved: string[];
  skipped: { userId: string; reason: "unreviewed" | "missing_rate" }[];
};

function fmtKr(n: number) {
  return Math.round(n).toLocaleString("sv-SE");
}

function DraftTab({ period }: { period: string }) {
  const { t } = useTranslations();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<ApproveResult | null>(null);

  async function generate() {
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/economy/payroll/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (res.ok) setPreview(await res.json());
    } finally {
      setBusy(false);
    }
  }

  async function approve() {
    setApproving(true);
    try {
      const res = await fetch("/api/economy/payroll/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      });
      if (res.ok) {
        const body = await res.json();
        setResult({ approved: body.approved, skipped: body.skipped });
      }
    } finally {
      setApproving(false);
    }
  }

  const nameById = (id: string) => preview?.members.find((m) => m.userId === id)?.name ?? id;
  const skippedUnreviewed = result?.skipped.filter((s) => s.reason === "unreviewed") ?? [];
  const skippedMissingRate = result?.skipped.filter((s) => s.reason === "missing_rate") ?? [];

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-xl">
          <h2 className="font-semibold text-ink">{t("economy.draft.title")}</h2>
          <p className="mt-1 text-sm text-ink-muted">{t("economy.draft.hint")}</p>
          {preview && (
            <p className="mt-1 text-xs text-ink-faint">
              {t("economy.draft.ruleSet", { name: preview.ruleSet.name })}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={busy}
          className="h-11 shrink-0 rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
        >
          {busy
            ? t("economy.draft.generating")
            : preview
              ? t("economy.draft.regenerate")
              : t("economy.draft.generate")}
        </button>
      </div>

      {preview && (
        <>
          {/* AI presentation note */}
          <div className="mt-5 rounded-2xl bg-primary-soft p-4 ring-1 ring-primary/15">
            <div className="mb-1 flex items-center gap-2">
              <span className="rounded-full bg-primary px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-primary-ink">
                {preview.note.source === "ai" ? t("economy.draft.aiBadge") : t("economy.draft.fallbackBadge")}
              </span>
            </div>
            <p className="text-sm text-ink">{preview.note.text}</p>
          </div>

          {/* Per-employee review cards (transparent breakdown, §8.2) */}
          <div className="mt-5 flex flex-col gap-3">
            {preview.members.length === 0 && (
              <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-faint ring-1 ring-border">
                {t("economy.draft.empty")}
              </p>
            )}
            {preview.members.map((m) => (
              <div key={m.userId} className="rounded-2xl bg-surface p-4 ring-1 ring-border">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={m.name} size="sm" />
                    <div>
                      <p className="font-medium text-ink">{m.name}</p>
                      <p className="text-xs text-ink-faint">
                        {m.rate != null ? t("economy.draft.perHour", { n: m.rate }) : t("economy.draft.missingRate")}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {m.missingRate ? (
                      <span className="text-sm font-medium text-accent">{t("economy.draft.missingRate")}</span>
                    ) : (
                      <p className="font-display text-xl font-bold text-ink">
                        {t("economy.draft.gross", { n: fmtKr(m.draft.grossAmount) })}
                      </p>
                    )}
                    <p className="text-xs text-ink-faint">
                      {fmtHours(m.draft.baseHours)} {t("economy.draft.colBase")} · {fmtHours(m.draft.obHours)} {t("economy.draft.colOb")}
                    </p>
                  </div>
                </div>

                {/* Transparent line breakdown */}
                <div className="mt-3 flex flex-col gap-1 border-t border-border pt-2 text-sm">
                  {m.draft.lines.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-ink-muted">
                      <span>
                        {line.type === "base" && t("economy.draft.lineBase")}
                        {line.type === "ob" && line.label}
                        {line.type === "overtime" && t("economy.draft.lineOvertime")}
                        {line.percent ? ` +${Math.round(line.percent * 100)}%` : ""}
                        <span className="text-ink-faint"> · {fmtHours(line.hours)} h</span>
                      </span>
                      {!m.missingRate && (
                        <span className="tabular-nums text-ink">{t("economy.draft.gross", { n: fmtKr(line.amount) })}</span>
                      )}
                    </div>
                  ))}
                </div>

                {(m.unreviewed || m.missingRate) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {m.unreviewed && (
                      <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-ink">
                        {t("economy.draft.unreviewedFlag")}
                      </span>
                    )}
                    {m.missingRate && (
                      <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-muted">
                        {t("economy.draft.setRate")}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Confirm → write */}
          {preview.members.length > 0 && (
            <div className="mt-5">
              <button
                type="button"
                onClick={approve}
                disabled={approving}
                className="h-12 rounded-full bg-primary px-6 text-sm font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
              >
                {approving ? t("economy.draft.approving") : t("economy.draft.approve")}
              </button>
              <p className="mt-2 text-xs text-ink-faint">{t("economy.draft.disclaimer")}</p>
            </div>
          )}

          {result && (
            <div className="mt-4 rounded-2xl bg-success-soft p-4 ring-1 ring-primary/15">
              <p className="flex items-center gap-2 font-semibold text-primary">
                <CheckIcon /> {t("economy.draft.approvedTitle", { count: result.approved.length })}
              </p>
              {skippedUnreviewed.length > 0 && (
                <p className="mt-1 text-sm text-accent-ink">
                  {t("economy.draft.skippedUnreviewed", { names: skippedUnreviewed.map((s) => nameById(s.userId)).join(", ") })}
                </p>
              )}
              {skippedMissingRate.length > 0 && (
                <p className="mt-1 text-sm text-ink-muted">
                  {t("economy.draft.skippedMissingRate", { names: skippedMissingRate.map((s) => nameById(s.userId)).join(", ") })}
                </p>
              )}
              <p className="mt-1 text-sm text-ink-muted">{t("economy.draft.approvedNote")}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─────────────────────────── Deviations tab ─────────────────────────

function DeviationsTab({
  deviations,
  onAct,
}: {
  deviations: DeviationRow[];
  onAct: (id: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useTranslations();
  if (deviations.length === 0) {
    return <p className="rounded-2xl bg-surface p-6 text-center text-sm text-ink-muted ring-1 ring-border">{t("economy.deviation.none")}</p>;
  }
  const open = deviations.filter((d) => d.status === "OPEN");
  const resolved = deviations.filter((d) => d.status !== "OPEN");
  return (
    <div className="flex flex-col gap-5">
      {open.length > 0 && (
        <section>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-faint">{t("economy.needsApproval")}</p>
          <div className="flex flex-col gap-2.5">
            {open.map((d) => <DeviationCard key={d.id} d={d} onAct={onAct} />)}
          </div>
        </section>
      )}
      {resolved.length > 0 && (
        <section>
          <div className="flex flex-col gap-2.5">
            {resolved.map((d) => <DeviationCard key={d.id} d={d} onAct={onAct} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function DeviationCard({
  d,
  onAct,
}: {
  d: DeviationRow;
  onAct: (id: string, body: Record<string, unknown>) => Promise<boolean>;
}) {
  const { t } = useTranslations();
  const [adjusting, setAdjusting] = useState(false);
  const [newTime, setNewTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const dir = d.direction === "OUT" ? t("economy.deviation.out") : t("economy.deviation.in");
  const time = d.stampAt ? fmtTime(d.stampAt) : "";
  const late = d.minutesDelta >= 0;
  const detail = late
    ? t("economy.deviation.vsScheduleLate", { dir, time, min: d.minutesDelta })
    : t("economy.deviation.vsScheduleEarly", { dir, time, min: Math.abs(d.minutesDelta) });

  async function run(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await onAct(d.id, body);
    } finally {
      setBusy(false);
    }
  }

  const resolved = d.status !== "OPEN";

  return (
    <div className={`rounded-2xl bg-surface p-4 ring-1 ${resolved ? "ring-border opacity-80" : "ring-accent/25"}`}>
      <div className="flex items-start gap-3">
        <Avatar name={d.displayName} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="font-medium text-ink">{d.displayName}</p>
          <p className={`text-sm ${resolved ? "text-ink-muted" : "text-accent-ink"}`}>{detail}</p>
          {resolved && (
            <p className="mt-1 text-xs text-ink-faint">
              {d.status === "APPROVED" ? t("economy.deviation.approved") : t("economy.deviation.reviewed")}
              {d.reason ? ` · ${d.reason}` : ""}
            </p>
          )}
        </div>
      </div>

      {!resolved && !adjusting && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "approve" })}
            className="h-10 rounded-xl bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
          >
            {t("economy.deviation.approveAsClocked")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => setAdjusting(true)}
            className="h-10 rounded-xl border border-border-strong px-4 text-sm font-semibold text-ink hover:bg-surface-2 disabled:opacity-60"
          >
            {t("economy.deviation.adjust")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => run({ action: "review" })}
            className="h-10 rounded-xl px-3 text-sm font-medium text-ink-muted hover:text-ink disabled:opacity-60"
          >
            {t("economy.deviation.markReviewed")}
          </button>
        </div>
      )}

      {!resolved && adjusting && (
        <form
          className="mt-3 rounded-xl bg-surface-2 p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const ok = await (async () => {
              setBusy(true);
              try {
                return await onAct(d.id, { action: "adjust", newTime: new Date(newTime).toISOString(), reason });
              } finally {
                setBusy(false);
              }
            })();
            if (ok) setAdjusting(false);
          }}
        >
          <p className="text-xs text-ink-muted">{t("economy.deviation.adjustHint")}</p>
          <label className="mt-2 block text-xs font-medium text-ink">{t("economy.deviation.newTime")}</label>
          <input
            type="datetime-local"
            required
            value={newTime}
            onChange={(e) => setNewTime(e.target.value)}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <label className="mt-2 block text-xs font-medium text-ink">{t("economy.deviation.reason")}</label>
          <input
            type="text"
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("economy.deviation.reasonPlaceholder")}
            className="mt-1 h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          />
          <div className="mt-3 flex gap-2">
            <button
              type="submit"
              disabled={busy || !newTime || !reason.trim()}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
            >
              {t("economy.deviation.saveAdjust")}
            </button>
            <button
              type="button"
              onClick={() => setAdjusting(false)}
              className="h-10 rounded-xl px-3 text-sm font-medium text-ink-muted hover:text-ink"
            >
              {t("economy.deviation.cancel")}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

// ─────────────────────────── Settings tab ───────────────────────────

const FORMATS: ExportFormat[] = ["FORTNOX", "VISMA", "CSV", "CUSTOM"];

function SettingsTab({ period, defaultFormat }: { period: string; defaultFormat: ExportFormat }) {
  const { t } = useTranslations();
  const [format, setFormat] = useState<ExportFormat>(defaultFormat);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [blocked, setBlocked] = useState<{ displayName: string }[] | null>(null);
  const [busy, setBusy] = useState(false);

  async function download(exclude: boolean) {
    setBusy(true);
    setBlocked(null);
    try {
      const url = `/api/economy/export?period=${period}&format=${format}${exclude ? "&exclude=1" : ""}`;
      const res = await fetch(url);
      if (res.status === 409) {
        const body = await res.json();
        setBlocked(body.blocked ?? []);
        return;
      }
      if (!res.ok) return;
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") ?? "";
      const name = /filename="(.+?)"/.exec(cd)?.[1] ?? "export.csv";
      triggerDownload(blob, name);
    } finally {
      setBusy(false);
    }
  }

  async function saveDefault() {
    const res = await fetch("/api/economy/export/default", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ format }),
    });
    if (res.ok) {
      setSavedMsg(t("economy.exportPanel.saved"));
      setTimeout(() => setSavedMsg(null), 2500);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ObRulesSection />
      <RatesSection />

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-border">
        <h2 className="font-semibold text-ink">{t("economy.exportPanel.title")}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t("economy.exportPanel.hint")}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          {FORMATS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`h-10 rounded-full px-4 text-sm font-medium transition-colors ${
                format === f
                  ? "bg-primary text-primary-ink"
                  : "bg-surface-2 text-ink-muted hover:text-ink"
              }`}
            >
              {t(`economy.exportPanel.formats.${f}`)}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => download(false)}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-ink hover:bg-primary-hover disabled:opacity-60"
          >
            <ArrowDownIcon className="text-sm" />
            {t("economy.exportPanel.download", { format: t(`economy.exportPanel.formats.${format}`) })}
          </button>
          <button
            type="button"
            onClick={saveDefault}
            className="h-11 rounded-full border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface-2"
          >
            {t("economy.exportPanel.saveDefault")}
          </button>
          {savedMsg && <span className="text-sm text-primary">{savedMsg}</span>}
        </div>

        {blocked && blocked.length > 0 && (
          <div className="mt-4 rounded-xl bg-accent-soft p-4 ring-1 ring-accent/20">
            <p className="font-semibold text-accent-ink">{t("economy.exportPanel.blockedTitle")}</p>
            <p className="mt-0.5 text-sm text-accent-ink/80">{t("economy.exportPanel.blockedBody")}</p>
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {blocked.map((b, i) => (
                <li key={i} className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-accent-ink">
                  {b.displayName}
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={busy}
              onClick={() => download(true)}
              className="mt-3 h-10 rounded-full bg-accent px-4 text-sm font-semibold text-white hover:bg-accent-hover disabled:opacity-60"
            >
              {t("economy.exportPanel.exportRest")}
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-surface p-5 ring-1 ring-border">
        <h2 className="font-semibold text-ink">{t("economy.exportPanel.allData")}</h2>
        <p className="mt-1 text-sm text-ink-muted">{t("economy.exportPanel.allDataHint")}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a
            href="/api/economy/export-all?format=json"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface-2"
          >
            <ArrowDownIcon className="text-sm" /> {t("economy.exportPanel.json")}
          </a>
          <a
            href="/api/economy/export-all?format=csv"
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface-2"
          >
            <ArrowDownIcon className="text-sm" /> {t("economy.exportPanel.csv")}
          </a>
        </div>
      </section>
    </div>
  );
}

function ObRulesSection() {
  const { t } = useTranslations();
  const [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [activeId, setActiveId] = useState<string>("none");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/economy/payroll/ruleset")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setPresets(d.presets);
          setActiveId(d.activeId);
        }
      });
  }, []);

  async function pick(id: string) {
    setActiveId(id);
    const res = await fetch("/api/economy/payroll/ruleset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: id }),
    });
    if (res.ok) {
      setSavedMsg(t("economy.obRules.saved"));
      setTimeout(() => setSavedMsg(null), 2500);
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-border">
      <h2 className="font-semibold text-ink">{t("economy.obRules.title")}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t("economy.obRules.hint")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => pick(p.id)}
            className={`h-10 rounded-full px-4 text-sm font-medium transition-colors ${
              activeId === p.id ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-muted hover:text-ink"
            }`}
          >
            {p.name}
          </button>
        ))}
        {savedMsg && <span className="self-center text-sm text-primary">{savedMsg}</span>}
      </div>
    </section>
  );
}

function RatesSection() {
  const { t } = useTranslations();
  const [members, setMembers] = useState<{ userId: string; name: string; hourlyRate: number | null }[]>([]);
  const [savedId, setSavedId] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/economy/payroll/rate")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setMembers(d.members));
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function save(userId: string, value: string) {
    const rate = Number(value);
    if (!Number.isFinite(rate) || rate < 0) return;
    const res = await fetch("/api/economy/payroll/rate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, hourlyRate: rate }),
    });
    if (res.ok) {
      setSavedId(userId);
      setTimeout(() => setSavedId((id) => (id === userId ? null : id)), 2000);
      load();
    }
  }

  return (
    <section className="rounded-2xl bg-surface p-5 ring-1 ring-border">
      <h2 className="font-semibold text-ink">{t("economy.rates.title")}</h2>
      <p className="mt-1 text-sm text-ink-muted">{t("economy.rates.hint")}</p>
      <div className="mt-4 flex flex-col gap-2">
        {members.map((m) => (
          <RateRow
            key={m.userId}
            member={m}
            saved={savedId === m.userId}
            onSave={(v) => save(m.userId, v)}
          />
        ))}
      </div>
    </section>
  );
}

function RateRow({
  member,
  saved,
  onSave,
}: {
  member: { userId: string; name: string; hourlyRate: number | null };
  saved: boolean;
  onSave: (value: string) => void;
}) {
  const { t } = useTranslations();
  const [value, setValue] = useState(member.hourlyRate != null ? String(member.hourlyRate) : "");

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2.5">
        <Avatar name={member.name} size="sm" />
        <span className="text-sm font-medium text-ink">{member.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
          inputMode="decimal"
          placeholder={t("economy.rates.placeholder")}
          className="h-10 w-24 rounded-lg border border-border bg-surface px-3 text-right text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        />
        <button
          type="button"
          onClick={() => onSave(value)}
          className="h-10 rounded-full border border-border-strong px-3 text-sm font-medium text-ink hover:bg-surface-2"
        >
          {saved ? t("economy.rates.saved") : t("economy.rates.save")}
        </button>
      </div>
    </div>
  );
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
