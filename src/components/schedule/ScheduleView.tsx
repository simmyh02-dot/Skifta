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
  slots: number;
  assignments: { user: Person }[];
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
  canClock = false,
  canAiSchedule = false,
}: {
  userId: string;
  role: string;
  initialWeekStart: string;
  initialShifts: ShiftDTO[];
  openShiftFill: "FIRST_COME" | "MANUAL_PICK";
  canClock?: boolean;
  canAiSchedule?: boolean;
}) {
  const { t, m } = useTranslations();
  const isAdmin = role === "OWNER" || role === "CO_OWNER";

  const [weekStart, setWeekStart] = useState(initialWeekStart);
  const [shifts, setShifts] = useState<ShiftDTO[]>(initialShifts);
  const [fillMode, setFillMode] = useState(openShiftFill);
  const [members, setMembers] = useState<Member[] | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  useEffect(() => {
    if (isAdmin && members === null) {
      fetch("/api/members")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setMembers(data.members));
    }
  }, [isAdmin, members]);

  useEffect(() => {
    function loadUnread() {
      fetch("/api/notifications")
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => data && setUnreadNotifications(data.unreadCount ?? 0))
        .catch(() => {});
    }
    loadUnread();
    const id = setInterval(loadUnread, 20_000);
    return () => clearInterval(id);
  }, []);

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
            <a href="/app/notifications" className="relative hover:text-primary">
              {t("app.nav.notifications")}
              {unreadNotifications > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[0.625rem] font-semibold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </a>
            <a href="/app/availability" className="hover:text-primary">
              {t("availability.title")}
            </a>
            {canClock && (
              <a href="/app/clock" className="hover:text-primary">
                {t("app.nav.clock")}
              </a>
            )}
            {isAdmin && (
              <a href="/app/economy" className="hover:text-primary">
                {t("app.nav.economy")}
              </a>
            )}
            {isAdmin && (
              <a href="/app/admin/members" className="hover:text-primary">
                {t("invite.admin.title")}
              </a>
            )}
            {isAdmin && (
              <a href="/app/billing" className="hover:text-primary">
                {t("app.nav.billing")}
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
                <button
                  type="button"
                  onClick={() => setShowBulk((s) => !s)}
                  className="h-9 rounded-full border border-border-strong px-3 text-sm text-ink hover:bg-surface-2"
                >
                  {t("schedule.bulk.button")}
                </button>
              )}
              {isAdmin && canAiSchedule && (
                <button
                  type="button"
                  onClick={() => setShowAi((s) => !s)}
                  className="h-9 rounded-full border border-border-strong px-3 text-sm text-ink hover:bg-surface-2"
                >
                  {t("schedule.ai.button")}
                </button>
              )}
              {isAdmin && (
                <Button size="md" onClick={() => setShowForm((s) => !s)}>
                  {t("schedule.newShift")}
                </Button>
              )}
            </div>
          </div>

          {showBulk && isAdmin && (
            <BulkShiftForm
              weekStart={weekStart}
              members={members ?? []}
              onCreated={async () => {
                setShowBulk(false);
                await refresh();
              }}
              onCancel={() => setShowBulk(false)}
            />
          )}

          {showAi && isAdmin && canAiSchedule && (
            <AiScheduleAssistant
              members={members ?? []}
              onDone={async () => {
                setShowAi(false);
                await refresh();
              }}
              onCancel={() => setShowAi(false)}
            />
          )}

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
  const isMine = shift.assignments.some((a) => a.user.id === userId);
  const activeSwap = shift.swapRequests.find((s) =>
    ["PENDING", "ACCEPTED", "ESCALATED"].includes(s.status),
  );
  const lastDeclinedSwap = !activeSwap
    ? shift.swapRequests.find((s) => s.status === "DECLINED")
    : undefined;
  const myTagIds = members?.find((m) => m.userId === userId)?.tagIds ?? [];
  const qualifiesForOpen =
    shift.requiredTags.length === 0 ||
    shift.requiredTags.every((tag) => myTagIds.includes(tag.id));
  const alreadyInterested = shift.interests.some((i) => i.user.id === userId);
  const filled = shift.assignments.length;
  const hasOpenSlot = shift.status === "OPEN" && filled < shift.slots;
  const needsReplacement = shift.status === "OPEN" && filled > 0;
  const assignableMembers = (members ?? []).filter(
    (m) =>
      !shift.assignments.some((a) => a.user.id === m.userId) &&
      (shift.requiredTags.length === 0 ||
        shift.requiredTags.every((tag) => m.tagIds.includes(tag.id))),
  );

  return (
    <div className="rounded-xl bg-surface p-3 text-sm shadow-sm ring-1 ring-border">
      <p className="font-medium text-ink">
        {fmtTime(shift.startsAt)}–{fmtTime(shift.endsAt)}
      </p>

      {filled === 0 ? (
        <p className="text-xs text-ink-muted">{t("schedule.unassigned")}</p>
      ) : (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {shift.assignments.map((a) => (
            <li key={a.user.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
              <span>{a.user.displayName}</span>
              {isAdmin && (
                <button
                  type="button"
                  aria-label={t("schedule.actions.unassign", { name: a.user.displayName })}
                  disabled={busy === `/api/shifts/${shift.id}/unassign`}
                  onClick={() => call(`/api/shifts/${shift.id}/unassign`, { userId: a.user.id })}
                  className="text-ink-faint hover:text-accent disabled:opacity-50"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {shift.slots > 1 && (
        <p className="mt-0.5 text-xs text-ink-faint">
          {t("schedule.slotsFilled", { filled: String(filled), slots: String(shift.slots) })}
        </p>
      )}
      {needsReplacement && (
        <p className="mt-0.5 text-xs font-medium text-accent">{t("schedule.needsReplacement")}</p>
      )}
      {lastDeclinedSwap && (
        <p className="mt-0.5 text-xs text-accent">
          {t("schedule.swap.declinedBy", {
            name: lastDeclinedSwap.directedTo?.displayName ?? lastDeclinedSwap.requestedBy.displayName,
          })}
        </p>
      )}
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
        {hasOpenSlot && !isAdmin && qualifiesForOpen && !isMine && (
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

        {/* Owner: pick among interested, or directly assign a qualified member to an open slot */}
        {hasOpenSlot && isAdmin && (
          <div className="flex flex-col gap-1">
            {shift.interests.map((interest) => (
              <ActionButton
                key={interest.user.id}
                label={`${t("schedule.actions.pick")}: ${interest.user.displayName}`}
                busy={busy === `/api/shifts/${shift.id}/pick`}
                onClick={() => call(`/api/shifts/${shift.id}/pick`, { userId: interest.user.id })}
              />
            ))}
            {assignableMembers.length > 0 && (
              <select
                value=""
                disabled={busy === `/api/shifts/${shift.id}/assign`}
                onChange={(e) => {
                  if (e.target.value) call(`/api/shifts/${shift.id}/assign`, { userId: e.target.value });
                }}
                className="h-7 rounded-full border border-border-strong bg-surface px-2 text-xs text-ink"
              >
                <option value="">{t("schedule.actions.assignMore")}</option>
                {assignableMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.displayName}
                  </option>
                ))}
              </select>
            )}
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
  const [slots, setSlots] = useState("1");
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
          slots: Math.max(1, parseInt(slots, 10) || 1),
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
      <label className="flex flex-col gap-1">
        <span className="text-xs text-ink-muted">{t("schedule.form.slots")}</span>
        <input
          type="number"
          min={1}
          max={20}
          value={slots}
          onChange={(e) => setSlots(e.target.value)}
          className={`${inputClass} w-20`}
        />
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

const WEEKDAY_LETTERS = [0, 1, 2, 3, 4, 5, 6];

function BulkShiftForm({
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
  const { t, m } = useTranslations();
  const defaultDate = new Date(weekStart).toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(defaultDate);
  const [endDate, setEndDate] = useState(defaultDate);
  const [weekdays, setWeekdays] = useState<number[]>([]);
  const [start, setStart] = useState("17:00");
  const [end, setEnd] = useState("22:00");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [slots, setSlots] = useState("1");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const inputClass =
    "h-10 rounded-lg border border-border bg-surface px-3 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  function toggleWeekday(d: number) {
    setWeekdays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (weekdays.length === 0) {
      setError(t("schedule.bulk.errorNoWeekday"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/shifts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate,
          endDate,
          weekdays,
          startTime: start,
          endTime: end,
          assignedUserId: assignedUserId || null,
          slots: Math.max(1, parseInt(slots, 10) || 1),
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
      const data = await res.json();
      setResult({ created: data.created ?? 0, skipped: Array.isArray(data.skipped) ? data.skipped.length : 0 });
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    return (
      <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
        <p className="text-sm text-ink">
          {t("schedule.ai.done", { created: String(result.created) })}
          {result.skipped > 0 && ` ${t("schedule.ai.doneSkipped", { skipped: String(result.skipped) })}`}
        </p>
        <Button onClick={onCreated}>{t("schedule.form.save")}</Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mt-4 flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border"
    >
      <p className="text-sm font-medium text-ink">{t("schedule.bulk.title")}</p>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.bulk.startDate")}</span>
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.bulk.endDate")}</span>
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.form.start")}</span>
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} required />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.form.end")}</span>
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} required />
        </label>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs text-ink-muted">{t("schedule.bulk.weekdays")}</span>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAY_LETTERS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => toggleWeekday(d)}
              className={`h-9 w-12 rounded-full text-xs font-medium ring-1 ${
                weekdays.includes(d)
                  ? "bg-primary text-primary-ink ring-primary"
                  : "bg-surface text-ink ring-border-strong hover:bg-surface-2"
              }`}
            >
              {m.schedule.weekdays[d]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.form.assign")}</span>
          <select value={assignedUserId} onChange={(e) => setAssignedUserId(e.target.value)} className={inputClass}>
            <option value="">{t("schedule.form.assignOpen")}</option>
            {members.map((mb) => (
              <option key={mb.userId} value={mb.userId}>
                {mb.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.form.slots")}</span>
          <input type="number" min={1} max={20} value={slots} onChange={(e) => setSlots(e.target.value)} className={`${inputClass} w-20`} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.form.tags")}</span>
          <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder={t("schedule.form.tagsPlaceholder")} className={inputClass} />
        </label>
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-xs text-ink-muted">{t("schedule.form.note")}</span>
          <input value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
        </label>
      </div>

      {error && <p className="text-sm text-accent">{error}</p>}
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

type ProposedRow = {
  memberId: string | null;
  memberName: string;
  date: string;
  startTime: string;
  endTime: string;
  requiredTags: string[];
  ambiguous: boolean;
  note: string;
};

function AiScheduleAssistant({
  members,
  onDone,
  onCancel,
}: {
  members: Member[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslations();
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<"unavailable" | "error" | null>(null);
  const [rows, setRows] = useState<ProposedRow[] | null>(null);
  const [editable, setEditable] = useState(false);
  const [approving, setApproving] = useState(false);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);

  const inputClass =
    "h-9 rounded-lg border border-border bg-surface px-2 text-sm text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

  async function submitInstruction(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setRows(null);
    setResult(null);
    try {
      const res = await fetch("/api/schedule/ai/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instruction }),
      });
      if (res.status === 503) {
        setError("unavailable");
        return;
      }
      if (!res.ok) {
        setError("error");
        return;
      }
      const data = await res.json();
      setRows(data.shifts ?? []);
      setEditable(false);
    } finally {
      setLoading(false);
    }
  }

  function updateRow(i: number, patch: Partial<ProposedRow>) {
    setRows((prev) => (prev ? prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) : prev));
  }

  function removeRow(i: number) {
    setRows((prev) => (prev ? prev.filter((_, idx) => idx !== i) : prev));
  }

  async function approve() {
    if (!rows || rows.length === 0) return;
    setApproving(true);
    try {
      const res = await fetch("/api/schedule/ai/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shifts: rows.map((r) => ({
            memberId: r.memberId,
            date: r.date,
            startTime: r.startTime,
            endTime: r.endTime,
            requiredTags: r.requiredTags,
          })),
        }),
      });
      if (!res.ok) {
        setError("error");
        return;
      }
      const data = await res.json();
      setResult({ created: data.created ?? 0, skipped: Array.isArray(data.skipped) ? data.skipped.length : 0 });
      setRows(null);
    } finally {
      setApproving(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm ring-1 ring-border">
      <p className="text-sm font-medium text-ink">{t("schedule.ai.title")}</p>
      <p className="text-xs text-ink-faint">{t("schedule.ai.disclaimer")}</p>

      {!rows && !result && (
        <form onSubmit={submitInstruction} className="flex flex-col gap-2 sm:flex-row">
          <input
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder={t("schedule.ai.placeholder")}
            className={`${inputClass} flex-1`}
            required
          />
          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? t("schedule.ai.loading") : t("schedule.ai.propose")}
            </Button>
            <button
              type="button"
              onClick={onCancel}
              className="h-9 rounded-full border border-border-strong px-4 text-sm text-ink hover:bg-surface-2"
            >
              {t("schedule.form.cancel")}
            </button>
          </div>
        </form>
      )}

      {error === "unavailable" && <p className="text-sm text-accent">{t("schedule.ai.unavailable")}</p>}
      {error === "error" && <p className="text-sm text-accent">{t("schedule.ai.error")}</p>}

      {rows && (
        <>
          <p className="text-sm font-medium text-ink">{t("schedule.ai.proposalTitle")}</p>
          {rows.length === 0 && <p className="text-sm text-ink-faint">{t("schedule.ai.none")}</p>}
          <div className="flex flex-col gap-2">
            {rows.map((row, i) => (
              <div
                key={i}
                className={`flex flex-col gap-2 rounded-lg p-2 ring-1 sm:flex-row sm:flex-wrap sm:items-center ${
                  row.ambiguous ? "bg-accent/10 ring-accent/40" : "bg-surface-2 ring-border"
                }`}
              >
                {editable ? (
                  <>
                    <select
                      value={row.memberId ?? ""}
                      onChange={(e) => updateRow(i, { memberId: e.target.value || null })}
                      className={inputClass}
                    >
                      <option value="">{t("schedule.form.assignOpen")}</option>
                      {members.map((m) => (
                        <option key={m.userId} value={m.userId}>
                          {m.displayName}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={row.date}
                      onChange={(e) => updateRow(i, { date: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="time"
                      value={row.startTime}
                      onChange={(e) => updateRow(i, { startTime: e.target.value })}
                      className={inputClass}
                    />
                    <input
                      type="time"
                      value={row.endTime}
                      onChange={(e) => updateRow(i, { endTime: e.target.value })}
                      className={inputClass}
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      className="h-9 rounded-full border border-border-strong px-3 text-xs text-ink hover:bg-surface"
                    >
                      {t("schedule.actions.delete")}
                    </button>
                  </>
                ) : (
                  <p className="flex-1 text-sm text-ink">
                    <span className="font-medium">
                      {row.memberId ? members.find((m) => m.userId === row.memberId)?.displayName ?? row.memberName : t("schedule.form.assignOpen")}
                    </span>{" "}
                    — {row.date} {row.startTime}–{row.endTime}
                    {row.requiredTags.length > 0 && ` (${row.requiredTags.join(", ")})`}
                  </p>
                )}
                {row.ambiguous && row.note && <p className="w-full text-xs text-accent">{row.note}</p>}
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={approve} disabled={approving || rows.length === 0}>
              {t("schedule.ai.approve")}
            </Button>
            <button
              type="button"
              onClick={() => setEditable((e) => !e)}
              className="h-9 rounded-full border border-border-strong px-3 text-sm text-ink hover:bg-surface-2"
            >
              {editable ? t("schedule.ai.doneEditing") : t("schedule.ai.editManually")}
            </button>
            <button
              type="button"
              onClick={() => {
                setRows(null);
                onCancel();
              }}
              className="h-9 rounded-full border border-border-strong px-3 text-sm text-ink hover:bg-surface-2"
            >
              {t("schedule.form.cancel")}
            </button>
          </div>
        </>
      )}

      {result && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-ink">
            {t("schedule.ai.done", { created: String(result.created) })}
            {result.skipped > 0 && ` ${t("schedule.ai.doneSkipped", { skipped: String(result.skipped) })}`}
          </p>
          <Button
            onClick={() => {
              setResult(null);
              setInstruction("");
              onDone();
            }}
          >
            {t("schedule.form.save")}
          </Button>
        </div>
      )}
    </div>
  );
}
