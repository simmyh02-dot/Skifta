"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "@/i18n/LocaleProvider";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { LogoutButton } from "@/components/auth/LogoutButton";
import { Button } from "@/components/ui/Button";

type Person = { id: string; displayName: string };

type SwapRequest = {
  id: string;
  mode: "DIRECTED" | "BROAD";
  status: "PENDING" | "ACCEPTED" | "APPROVED" | "ESCALATED" | "DECLINED" | "CANCELED";
  requestedBy: Person;
  directedTo: Person | null;
  acceptedBy: Person | null;
};

type ShiftDTO = {
  id: string;
  startsAt: string;
  endsAt: string;
  status: "OPEN" | "ASSIGNED" | "COMPLETED" | "CANCELED";
  note: string | null;
  assignedUser: Person | null;
  requiredTags: { id: string; name: string }[];
  swapRequests: SwapRequest[];
  interests: { user: Person }[];
};

type Member = { userId: string; displayName: string; role: string; tagIds: string[] };

export function ScheduleView({
  userId,
  role,
  initialWeekStart,
  initialShifts,
  openShiftFill,
}: {
  userId: string;
  role: string;
  initialWeekStart: string;
  initialShifts: ShiftDTO[];
  openShiftFill: "FIRST_COME" | "MANUAL_PICK";
}) {
  const { t, m } = useTranslations();
  const isAdmin = role === "OWNER" || role === "CO_OWNER";

  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [shifts, setShifts] = useState<ShiftDTO[]>(initialShifts);
  const [fillMode, setFillMode] = useState(openShiftFill);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin && members === null) {
      fetch("/api/members")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setMembers(data.members));
    }
  }, [isAdmin, members]);

  async function loadWeek(start: string) {
    const res = await fetch(`/api/shifts?week=${encodeURIComponent(start)}`);
    if (!res.ok) return;
    const data = await res.json();
    setWeekStart(data.weekStart);
    setShifts(data.shifts);
    if (data.openShiftFill) setFillMode(data.openShiftFill);
  }

  function shiftWeek(deltaDays: number) {
    const next = new Date(new Date(weekStart).getTime() + deltaDays * 24 * 60 * 60_000);
    loadWeek(next.toISOString());
  }

  async function refresh() {
    await loadWeek(weekStart);
  }

  async function call(url: string, body?: unknown) {
    setBusy(url);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (res.ok) await refresh();
      return res.ok;
    } finally {
      setBusy(null);
    }
  }

  const days = useMemo(() => {
    const start = new Date(weekStart);
    return Array.from({ length: 7 }, (_, i) => {
      const day = new Date(start.getTime() + i * 24 * 60 * 60_000);
      const dayShifts = shifts
        .filter((s) => new Date(s.startsAt).toDateString() === day.toDateString())
        .sort((a, b) => +new Date(a.startsAt) - +new Date(b.startsAt));
      return { date: day, shifts: dayShifts };
    });
  }, [weekStart, shifts]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="flex items-center justify-between border-b border-border px-5 py-4">
        <div className="flex items-center gap-4">
          <Logo />
          <nav className="flex items-center gap-3 text-sm text-ink-muted">
            <a href="/app/schedule" className="text-ink hover:text-primary">
              {t("app.nav.schedule")}
            </a>
            <a href="/app/availability" className="hover:text-primary">
              {t("availability.title")}
            </a>
            {isAdmin && (
              <a href="/app/admin/members" className="hover:text-primary">
                {t("invite.admin.title")}
              </a>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <LangToggle />
          <LogoutButton />
        </div>
      </header>

      <main className="flex-1 px-4 py-6 sm:px-6">
        <div className="mx-auto max-w-5xl">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-xl font-bold text-ink">{t("schedule.title")}</h1>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => shiftWeek(-7)}
                className="h-9 rounded-full border border-border-strong px-3 text-sm text-ink hover:bg-surface-2"
              >
                ← {t("schedule.prevWeek")}
              </button>
              <button
                type="button"
                onClick={() => shiftWeek(7)}
                className="h-9 rounded-full border border-border-strong px-3 text-sm text-ink hover:bg-surface-2"
              >
                {t("schedule.nextWeek")} →
              </button>
              {isAdmin && (
                <Button size="md" onClick={() => setShowForm((s) => !s)}>
                  {t("schedule.newShift")}
                </Button>
              )}
            </div>
          </div>

          {showForm && isAdmin && (
            <NewShiftForm
              weekStart={weekStart}
              members={members ?? []}
              onCreated={async () => {
                setShowForm(false);
                await refresh();
              }}
              onCancel={() => setShowForm(false)}
            />
          )}

          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-7">
            {days.map((day, i) => (
              <div key={i} className="flex flex-col gap-2">
                <div className="text-xs font-semibold uppercase text-ink-faint">
                  {m.schedule.weekdays[i]}{" "}
                  <span className="text-ink-muted">
                    {day.date.getDate()}/{day.date.getMonth() + 1}
                  </span>
                </div>
                {day.shifts.length === 0 && (
                  <p className="text-xs text-ink-faint">{t("schedule.noShifts")}</p>
                )}
                {day.shifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    userId={userId}
                    isAdmin={isAdmin}
                    fillMode={fillMode}
                    members={members}
                    busy={busy}
                    call={call}
                    refresh={refresh}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function ShiftCard({
  shift,
  userId,
  isAdmin,
  fillMode,
  members,
  busy,
  call,
  refresh,
}: {
  shift: ShiftDTO;
  userId: string;
  isAdmin: boolean;
  fillMode: "FIRST_COME" | "MANUAL_PICK";
  members: Member[] | null;
  busy: string | null;
  call: (url: string, body?: unknown) => Promise<boolean>;
  refresh: () => Promise<void>;
}) {
  const { t } = useTranslations();
  const isMine = shift.assignedUser?.id === userId;
  const activeSwap = shift.swapRequests.find((s) =>
    ["PENDING", "ACCEPTED", "ESCALATED"].includes(s.status),
  );
  const myTagIds = members?.find((m) => m.userId === userId)?.tagIds ?? [];
  const qualifiesForOpen =
    shift.requiredTags.length === 0 ||
    shift.requiredTags.every((tag) => myTagIds.includes(tag.id));
  const alreadyInterested = shift.interests.some((i) => i.user.id === userId);

  return (
    <div className="rounded-xl bg-surface p-3 text-sm shadow-sm ring-1 ring-border">
      <p className="font-medium text-ink">
        {fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}
      </p>
      <p className="text-xs text-ink-muted">
        {shift.assignedUser ? shift.assignedUser.displayName : t("schedule.unassigned")}
      </p>
      {shift.requiredTags.length > 0 && (
        <p className="mt-1 text-xs text-ink-faint">
          {shift.requiredTags.map((tg) => tg.name).join(", ")}
        </p>
      )}
      {shift.note && <p className="mt-1 text-xs text-ink-faint">{shift.note}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {/* Employee: can't work on my own assigned shift */}
        {!isAdmin && isMine && shift.status === "ASSIGNED" && !activeSwap && (
          <ActionButton
            label={t("schedule.actions.cantWork")}
            busy={busy === `/api/shifts/${shift.id}/swap`}
            onClick={() => call(`/api/shifts/${shift.id}/swap`)}
          />
        )}

        {/* Open shift: claim or express interest, if qualified */}
        {shift.status === "OPEN" && !isAdmin && qualifiesForOpen && (
          fillMode === "FIRST_COME" ? (
            <ActionButton
              label={t("schedule.actions.claim")}
              busy={busy === `/api/shifts/${shift.id}/claim`}
              onClick={() => call(`/api/shifts/${shift.id}/claim`)}
            />
          ) : alreadyInterested ? (
            <span className="text-xs text-ink-faint">
              {t("schedule.actions.waitingInterest")}
            </span>
          ) : (
            <ActionButton
              label={t("schedule.actions.interested")}
              busy={busy === `/api/shifts/${shift.id}/interest`}
              onClick={() => call(`/api/shifts/${shift.id}/interest`)}
            />
          )
        )}

        {/* Owner: pick among interested for a manual-pick open shift */}
        {shift.status === "OPEN" && isAdmin && shift.interests.length > 0 && (
          <div className="flex flex-col gap-1">
            {shift.interests.map((interest) => (
              <ActionButton
                key={interest.user.id}
                label={`${t("schedule.actions.pick")}: ${interest.user.displayName}`}
                busy={busy === `/api/shifts/${shift.id}/pick`}
                onClick={() => call(`/api/shifts/${shift.id}/pick`, { userId: interest.user.id })}
              />
            ))}
          </div>
        )}

        {/* Owner: delete an open/assigned shift */}
        {isAdmin && shift.status !== "COMPLETED" && (
          <ActionButton
            label={t("schedule.actions.delete")}
            variant="secondary"
            busy={busy === `delete-${shift.id}`}
            onClick={async () => {
              await fetch(`/api/shifts/${shift.id}`, { method: "DELETE" });
              await refresh();
            }}
          />
        )}

        {/* Active swap request */}
        {activeSwap && (
          <SwapBlock
            shift={shift}
            swap={activeSwap}
            userId={userId}
            isAdmin={isAdmin}
            members={members}
            busy={busy}
            call={call}
          />
        )}
      </div>
    </div>
  );
}

function SwapBlock({
  shift,
  swap,
  userId,
  isAdmin,
  members,
  busy,
  call,
}: {
  shift: ShiftDTO;
  swap: SwapRequest;
  userId: string;
  isAdmin: boolean;
  members: Member[] | null;
  busy: string | null;
  call: (url: string, body?: unknown) => Promise<boolean>;
}) {
  const { t } = useTranslations();
  const isRequester = swap.requestedBy.id === userId;
  const myTagIds = members?.find((m) => m.userId === userId)?.tagIds ?? [];
  const qualifies =
    shift.requiredTags.length === 0 ||
    shift.requiredTags.every((tag) => myTagIds.includes(tag.id));

  return (
    <div className="mt-1 w-full rounded-lg bg-surface-2 p-2 text-xs">
      <p className="text-ink-muted">
        {t("schedule.swap.requestedBy", { name: swap.requestedBy.displayName })}
      </p>

      {swap.status === "PENDING" && swap.mode === "DIRECTED" && !swap.directedTo && isAdmin && (
        <div className="mt-1 flex flex-wrap gap-1">
          <span className="text-ink-faint">{t("schedule.swap.waitingDirection")}</span>
          {(members ?? [])
            .filter(
              (m) =>
                m.userId !== swap.requestedBy.id &&
                (shift.requiredTags.length === 0 ||
                  shift.requiredTags.every((tag) => m.tagIds.includes(tag.id))),
            )
            .map((m) => (
              <ActionButton
                key={m.userId}
                label={m.displayName}
                busy={busy === `/api/swaps/${swap.id}/direct`}
                onClick={() => call(`/api/swaps/${swap.id}/direct`, { userId: m.userId })}
              />
            ))}
        </div>
      )}

      {swap.status === "PENDING" && swap.mode === "DIRECTED" && swap.directedTo && (
        <p className="mt-1 text-ink-faint">
          {t("schedule.swap.waitingDirected", { name: swap.directedTo.displayName })}
        </p>
      )}
      {swap.status === "PENDING" && swap.mode === "BROAD" && (
        <p className="mt-1 text-ink-faint">{t("schedule.swap.waitingBroad")}</p>
      )}

      {/* Colleague can respond: directed-to-me, or broad + qualified */}
      {swap.status === "PENDING" &&
        !isRequester &&
        ((swap.mode === "DIRECTED" && swap.directedTo?.id === userId) ||
          (swap.mode === "BROAD" && qualifies)) && (
          <div className="mt-1 flex gap-1">
            <ActionButton
              label={t("schedule.actions.accept")}
              busy={busy === `/api/swaps/${swap.id}/respond`}
              onClick={() => call(`/api/swaps/${swap.id}/respond`)}
            />
            {swap.mode === "DIRECTED" && (
              <ActionButton
                label={t("schedule.actions.decline")}
                variant="secondary"
                busy={busy === `/api/swaps/${swap.id}/decline`}
                onClick={() => call(`/api/swaps/${swap.id}/decline`)}
              />
            )}
          </div>
        )}

      {swap.status === "ACCEPTED" && swap.acceptedBy && (
        <p className="mt-1 text-ink-faint">
          {t("schedule.swap.acceptedBy", { name: swap.acceptedBy.displayName })}
        </p>
      )}
      {swap.status === "ACCEPTED" && isAdmin && (
        <ActionButton
          label={t("schedule.actions.approve")}
          busy={busy === `/api/swaps/${swap.id}/approve`}
          onClick={() => call(`/api/swaps/${swap.id}/approve`)}
        />
      )}

      {isRequester && (swap.status === "PENDING" || swap.status === "ACCEPTED") && (
        <ActionButton
          label={t("schedule.actions.cancelSwap")}
          variant="secondary"
          busy={busy === `/api/swaps/${swap.id}/cancel`}
          onClick={() => call(`/api/swaps/${swap.id}/cancel`)}
        />
      )}
    </div>
  );
}

function ActionButton({
  label,
  onClick,
  busy,
  variant = "primary",
}: {
  label: string;
  onClick: () => void | Promise<void | boolean>;
  busy?: boolean;
  variant?: "primary" | "secondary";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={
        variant === "primary"
          ? "h-7 rounded-full bg-primary px-2.5 text-xs font-medium text-primary-ink hover:bg-primary-hover disabled:opacity-60"
          : "h-7 rounded-full border border-border-strong px-2.5 text-xs text-ink hover:bg-surface-2 disabled:opacity-60"
      }
    >
      {label}
    </button>
  );
}

function NewShiftForm({
  weekStart,
  members,
  onCreated,
  onCancel,
}: {
  weekStart: string;
  members: Member[];
  onCreated: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslations();
  const defaultDate = new Date(weekStart).toISOString().slice(0, 10);
  const [date, setDate] = useState(defaultDate);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("22:00");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const inputClass =
    "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const startsAt = new Date(`${date}T${start}:00`);
      const endsAt = new Date(`${date}T${end}:00`);
      const res = await fetch("/api/shifts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          assignedUserId: assignedUserId || null,
          note: note || null,
          requiredTagNames: tags
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
        }),
      });
      if (!res.ok) {
        setError(t("schedule.form.error"));
        return;
      }
      onCreated();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border sm:flex-row sm:flex-wrap sm:items-end"
    >
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("schedule.form.start")}</span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("schedule.form.start")}</span>
        <input
          type="time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("schedule.form.end")}</span>
        <input
          type="time"
          value={end}
          onChange={(e) => setEnd(e.target.value)}
          className={inputClass}
          required
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("schedule.form.assign")}</span>
        <select
          value={assignedUserId}
          onChange={(e) => setAssignedUserId(e.target.value)}
          className={inputClass}
        >
          <option value="">{t("schedule.form.assignOpen")}</option>
          {members.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.displayName}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("schedule.form.tags")}</span>
        <input
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder={t("schedule.form.tagsPlaceholder")}
          className={inputClass}
        />
      </label>
      <label className="flex flex-1 flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("schedule.form.note")}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </label>
      {error && <p className="w-full text-sm text-accent">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" disabled={loading}>
          {t("schedule.form.save")}
        </Button>
        <button
          type="button"
          onClick={onCancel}
          className="h-10 rounded-full border border-border-strong px-4 text-sm text-ink hover:bg-surface-2"
        >
          {t("schedule.form.cancel")}
        </button>
      </div>
    </form>
  );
}
