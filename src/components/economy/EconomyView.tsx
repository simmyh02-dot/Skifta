"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Avatar } from "@/components/ui/Avatar";
import { ArrowDownIcon, CheckIcon } from "@/components/ui/icons";
import { parseTemplateHeaders } from "@/lib/export-template";
import { AppShell } from "@/components/app/AppShell";

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
    <AppShell role={role} restaurantName={restaurantName} displayName={displayName} canClock>
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
    </AppShell>
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

type MappingRow = { header: string; field: ExportFieldName | null };
type ExportFieldName = "employee" | "periodStart" | "periodEnd" | "hours";
const EXPORT_FIELD_NAMES: ExportFieldName[] = ["employee", "periodStart", "periodEnd", "hours"];

function CustomTemplateSection() {
  const { t } = useTranslations();
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [current, setCurrent] = useState<MappingRow[] | null>(null);

  useEffect(() => {
    fetch("/api/economy/export/template")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { mapping: MappingRow[] | null } | null) => {
        if (d?.mapping) setCurrent(d.mapping);
      });
  }, []);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const headers = parseTemplateHeaders(text);
    setFileName(file.name);
    setRows(headers.map((header) => ({ header, field: null })));
    setError(null);
  }

  function setField(index: number, field: ExportFieldName | null) {
    setRows((rs) => rs.map((r, i) => (i === index ? { ...r, field } : r)));
  }

  async function save() {
    setError(null);
    const res = await fetch("/api/economy/export/template", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping: rows }),
    });
    if (res.ok) {
      setCurrent(rows);
      setSavedMsg(t("economy.exportPanel.customTemplate.saved"));
      setTimeout(() => setSavedMsg(null), 2500);
    } else {
      setError(t("economy.exportPanel.customTemplate.invalid"));
    }
  }

  const usedFields = new Set(rows.map((r) => r.field).filter((f): f is ExportFieldName => f != null));

  return (
    <div className="mt-4 rounded-xl border border-border p-4">
      <h3 className="font-medium text-ink">{t("economy.exportPanel.customTemplate.title")}</h3>
      <p className="mt-1 text-sm text-ink-muted">{t("economy.exportPanel.customTemplate.hint")}</p>

      {current && rows.length === 0 && (
        <p className="mt-2 text-sm text-ink-faint">
          {t("economy.exportPanel.customTemplate.current", { count: current.length })}
        </p>
      )}
      {!current && rows.length === 0 && (
        <p className="mt-2 text-sm text-ink-faint">{t("economy.exportPanel.customTemplate.none")}</p>
      )}

      <label className="mt-3 inline-flex h-10 cursor-pointer items-center rounded-full border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface-2">
        {t("economy.exportPanel.customTemplate.upload")}
        <input type="file" accept=".csv,.txt" className="hidden" onChange={onFile} />
      </label>
      {fileName && rows.length > 0 && (
        <p className="mt-2 text-sm text-ink-muted">
          {t("economy.exportPanel.customTemplate.uploaded", { count: rows.length, filename: fileName })}
        </p>
      )}

      {rows.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          <h4 className="text-sm font-semibold text-ink">{t("economy.exportPanel.customTemplate.mapTitle")}</h4>
          {rows.map((r, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="min-w-32 rounded-md bg-surface-2 px-3 py-1.5 text-sm text-ink">{r.header}</span>
              <select
                value={r.field ?? ""}
                onChange={(e) => setField(i, (e.target.value || null) as ExportFieldName | null)}
                className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
              >
                <option value="">{t("economy.exportPanel.customTemplate.blank")}</option>
                {EXPORT_FIELD_NAMES.map((f) => (
                  <option key={f} value={f} disabled={usedFields.has(f) && r.field !== f}>
                    {t(`economy.exportPanel.customTemplate.fields.${f}`)}
                  </option>
                ))}
              </select>
            </div>
          ))}
          {error && <p className="text-sm text-accent">{error}</p>}
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              className="h-10 rounded-full bg-primary px-4 text-sm font-medium text-primary-ink hover:bg-primary-hover"
            >
              {t("economy.exportPanel.customTemplate.save")}
            </button>
            {savedMsg && <span className="text-sm text-primary">{savedMsg}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

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

        {format === "CUSTOM" && <CustomTemplateSection />}

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

type ObWindowDraft = {
  id: string;
  label: string;
  days: number[];
  startMinute: number;
  endMinute: number;
  percent: number;
};
type ObOvertimeDraft = { thresholdHours: number; percent: number } | null;

const CUSTOM_RULE_SET_ID = "custom";

function toHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, "0");
  const m = (minutes % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function ObRulesSection() {
  const { t, m } = useTranslations();
  const weekdays = m.schedule.weekdays;
  const [presets, setPresets] = useState<{ id: string; name: string }[]>([]);
  const [activeId, setActiveId] = useState<string>("none");
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [name, setName] = useState("");
  const [windows, setWindows] = useState<ObWindowDraft[]>([]);
  const [overtime, setOvertime] = useState<ObOvertimeDraft>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch("/api/economy/payroll/ruleset")
      .then((r) => (r.ok ? r.json() : null))
      .then(
        (d: {
          activeId: string;
          presets: { id: string; name: string }[];
          active: { name: string; windows: ObWindowDraft[]; overtime: ObOvertimeDraft } | null;
        } | null) => {
          if (!d) return;
          setPresets(d.presets);
          setActiveId(d.activeId);
          if (d.activeId === CUSTOM_RULE_SET_ID && d.active) {
            setName(d.active.name);
            setWindows(d.active.windows);
            setOvertime(d.active.overtime);
          }
        },
      );
  }, []);
  useEffect(() => {
    load();
  }, [load]);

  async function pick(id: string) {
    setActiveId(id);
    setShowBuilder(false);
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

  function openBuilder() {
    if (!name) setName(t("economy.obRules.customTitle"));
    setShowBuilder(true);
  }

  function addWindow() {
    setWindows((ws) => [
      ...ws,
      { id: `w${ws.length}-${Date.now()}`, label: "", days: [0, 1, 2, 3, 4], startMinute: 18 * 60, endMinute: 24 * 60, percent: 0.5 },
    ]);
  }
  function removeWindow(id: string) {
    setWindows((ws) => ws.filter((w) => w.id !== id));
  }
  function updateWindow(id: string, patch: Partial<ObWindowDraft>) {
    setWindows((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
  }
  function toggleDay(id: string, day: number) {
    setWindows((ws) =>
      ws.map((w) => {
        if (w.id !== id) return w;
        const days = w.days.includes(day) ? w.days.filter((d) => d !== day) : [...w.days, day].sort();
        return { ...w, days };
      }),
    );
  }

  async function saveCustom() {
    setError(null);
    const res = await fetch("/api/economy/payroll/ruleset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom: { name, windows, overtime } }),
    });
    if (res.ok) {
      setActiveId(CUSTOM_RULE_SET_ID);
      setSavedMsg(t("economy.obRules.saved"));
      setTimeout(() => setSavedMsg(null), 2500);
    } else {
      setError(t("economy.obRules.invalid"));
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
        <button
          type="button"
          onClick={openBuilder}
          className={`h-10 rounded-full px-4 text-sm font-medium transition-colors ${
            activeId === CUSTOM_RULE_SET_ID ? "bg-primary text-primary-ink" : "bg-surface-2 text-ink-muted hover:text-ink"
          }`}
        >
          {t("economy.obRules.customize")}
        </button>
        {savedMsg && <span className="self-center text-sm text-primary">{savedMsg}</span>}
      </div>

      {showBuilder && (
        <div className="mt-5 rounded-xl border border-border p-4">
          <h3 className="font-medium text-ink">{t("economy.obRules.customTitle")}</h3>
          <label className="mt-3 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink">{t("economy.obRules.nameLabel")}</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("economy.obRules.namePlaceholder")}
              className="h-11 rounded-lg border border-border bg-surface px-3 text-sm text-ink"
            />
          </label>

          <h4 className="mt-5 text-sm font-semibold text-ink">{t("economy.obRules.windowsTitle")}</h4>
          {windows.length === 0 && (
            <p className="mt-2 text-sm text-ink-faint">{t("economy.obRules.noWindows")}</p>
          )}
          <div className="mt-2 flex flex-col gap-3">
            {windows.map((w) => (
              <div key={w.id} className="rounded-lg bg-surface-2 p-3">
                <div className="flex items-start gap-2">
                  <input
                    type="text"
                    value={w.label}
                    onChange={(e) => updateWindow(w.id, { label: e.target.value })}
                    placeholder={t("economy.obRules.windowLabelPlaceholder")}
                    className="h-10 flex-1 rounded-lg border border-border bg-surface px-3 text-sm text-ink"
                  />
                  <button
                    type="button"
                    onClick={() => removeWindow(w.id)}
                    className="h-10 shrink-0 rounded-lg px-3 text-sm text-ink-muted hover:text-accent"
                  >
                    {t("economy.obRules.removeWindow")}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {weekdays.map((label: string, i: number) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => toggleDay(w.id, i)}
                      className={`h-8 w-10 rounded-md text-xs font-medium ${
                        w.days.includes(i) ? "bg-primary text-primary-ink" : "bg-surface text-ink-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap items-end gap-3">
                  <label className="flex flex-col gap-1 text-xs text-ink-muted">
                    {t("economy.obRules.from")}
                    <input
                      type="time"
                      value={toHHMM(w.startMinute)}
                      onChange={(e) => updateWindow(w.id, { startMinute: toMinutes(e.target.value) })}
                      className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-ink-muted">
                    {t("economy.obRules.to")}
                    <input
                      type="time"
                      value={toHHMM(w.endMinute === 1440 ? 1439 : w.endMinute)}
                      onChange={(e) => {
                        const v = toMinutes(e.target.value);
                        updateWindow(w.id, { endMinute: v === 1439 ? 1440 : v });
                      }}
                      className="h-9 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-ink-muted">
                    {t("economy.obRules.uplift")}
                    <input
                      type="number"
                      min={0}
                      max={500}
                      step={1}
                      value={Math.round(w.percent * 100)}
                      onChange={(e) => updateWindow(w.id, { percent: Number(e.target.value) / 100 })}
                      className="h-9 w-20 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addWindow}
            className="mt-3 h-10 rounded-full border border-border-strong px-4 text-sm font-medium text-ink hover:bg-surface-2"
          >
            {t("economy.obRules.addWindow")}
          </button>

          <h4 className="mt-5 text-sm font-semibold text-ink">{t("economy.obRules.overtimeTitle")}</h4>
          <label className="mt-2 flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={overtime != null}
              onChange={(e) => setOvertime(e.target.checked ? { thresholdHours: 40, percent: 0.5 } : null)}
            />
            {t("economy.obRules.overtimeEnabled")}
          </label>
          {overtime && (
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                {t("economy.obRules.overtimeThreshold")}
                <input
                  type="number"
                  min={1}
                  max={168}
                  value={overtime.thresholdHours}
                  onChange={(e) => setOvertime({ ...overtime, thresholdHours: Number(e.target.value) })}
                  className="h-9 w-24 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                />
              </label>
              <label className="flex flex-col gap-1 text-xs text-ink-muted">
                {t("economy.obRules.overtimePercent")}
                <input
                  type="number"
                  min={0}
                  max={500}
                  value={Math.round(overtime.percent * 100)}
                  onChange={(e) => setOvertime({ ...overtime, percent: Number(e.target.value) / 100 })}
                  className="h-9 w-24 rounded-md border border-border bg-surface px-2 text-sm text-ink"
                />
              </label>
            </div>
          )}

          <p className="mt-4 text-xs text-ink-faint">{t("economy.obRules.versionHint")}</p>
          {error && <p className="mt-2 text-sm text-accent">{error}</p>}
          <button
            type="button"
            onClick={saveCustom}
            className="mt-3 h-11 rounded-full bg-primary px-5 text-sm font-medium text-primary-ink hover:bg-primary-hover"
          >
            {t("economy.obRules.save")}
          </button>
        </div>
      )}
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
