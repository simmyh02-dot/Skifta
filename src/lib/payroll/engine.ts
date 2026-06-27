import type { ObRuleSet, ObWindow } from "./rules";

// Deterministic payroll draft engine (§8.2). The numbers here are RULE-BASED,
// not AI — the AI's only job is to present and explain the result (§8.2). Every
// figure traces back to the exact worked intervals and rules it was built on
// (§8.2 spårbarhet): the draft carries a transparent line breakdown, never just
// a total. Base pay covers all worked hours; OB and overtime are supplements on
// top, so nothing is double-counted.

const MS_PER_MIN = 60_000;

/** A paired IN→OUT span of work, with the stamp ids it came from (traceability). */
export type WorkedInterval = {
  start: Date;
  end: Date;
  inEventId?: string;
  outEventId?: string;
};

export type PayrollLine =
  | { type: "base"; hours: number; rate: number; amount: number }
  | { type: "ob"; windowId: string; label: string; hours: number; rate: number; percent: number; amount: number }
  | { type: "overtime"; hours: number; rate: number; percent: number; amount: number };

export type PayrollDraft = {
  baseHours: number;
  obHours: number;
  grossAmount: number;
  lines: PayrollLine[];
  /** Stamp ids the draft was built from, for the transparent audit trail. */
  eventIds: string[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/** JS getDay() is 0=Sun…6=Sat; the rules use 0=Mon…6=Sun. */
function isoWeekday(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Split an interval at local midnights into same-day segments, each carrying
 *  its weekday and a [startMinute, endMinute) band in local minutes. Handles
 *  overnight shifts correctly. */
function splitByLocalDay(start: Date, end: Date): { weekday: number; startMin: number; endMin: number }[] {
  const out: { weekday: number; startMin: number; endMin: number }[] = [];
  let cursor = new Date(start);
  while (cursor < end) {
    const dayStart = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate());
    const nextMidnight = new Date(dayStart.getTime() + 24 * 60 * MS_PER_MIN);
    const segEnd = end < nextMidnight ? end : nextMidnight;
    const startMin = Math.round((cursor.getTime() - dayStart.getTime()) / MS_PER_MIN);
    const endMin = Math.round((segEnd.getTime() - dayStart.getTime()) / MS_PER_MIN);
    if (endMin > startMin) out.push({ weekday: isoWeekday(cursor), startMin, endMin });
    cursor = nextMidnight;
  }
  return out;
}

/** Overlap in minutes between a day-segment band and an OB window on that day. */
function windowOverlapMinutes(
  seg: { weekday: number; startMin: number; endMin: number },
  win: ObWindow,
): number {
  if (!win.days.includes(seg.weekday)) return 0;
  const lo = Math.max(seg.startMin, win.startMinute);
  const hi = Math.min(seg.endMin, win.endMinute);
  return Math.max(0, hi - lo);
}

/** Build the per-employee payroll draft from worked intervals, a base rate, and
 *  the restaurant's chosen OB ruleset. Pure and deterministic. */
export function computeDraft(
  intervals: WorkedInterval[],
  rate: number,
  rules: ObRuleSet,
): PayrollDraft {
  let baseMinutes = 0;
  const obMinutesByWindow = new Map<string, number>();
  const eventIds: string[] = [];

  for (const iv of intervals) {
    if (iv.inEventId) eventIds.push(iv.inEventId);
    if (iv.outEventId) eventIds.push(iv.outEventId);
    for (const seg of splitByLocalDay(iv.start, iv.end)) {
      baseMinutes += seg.endMin - seg.startMin;
      for (const win of rules.windows) {
        const overlap = windowOverlapMinutes(seg, win);
        if (overlap > 0) obMinutesByWindow.set(win.id, (obMinutesByWindow.get(win.id) ?? 0) + overlap);
      }
    }
  }

  const baseHours = round2(baseMinutes / 60);
  const baseAmount = round2(baseHours * rate);
  const lines: PayrollLine[] = [{ type: "base", hours: baseHours, rate, amount: baseAmount }];

  let obHours = 0;
  let obAmount = 0;
  for (const win of rules.windows) {
    const minutes = obMinutesByWindow.get(win.id) ?? 0;
    if (minutes <= 0) continue;
    const hours = round2(minutes / 60);
    const amount = round2(hours * rate * win.percent);
    obHours = round2(obHours + hours);
    obAmount += amount;
    lines.push({ type: "ob", windowId: win.id, label: win.label, hours, rate, percent: win.percent, amount });
  }

  let overtimeAmount = 0;
  if (rules.overtime && baseHours > rules.overtime.thresholdHours) {
    const hours = round2(baseHours - rules.overtime.thresholdHours);
    overtimeAmount = round2(hours * rate * rules.overtime.percent);
    lines.push({ type: "overtime", hours, rate, percent: rules.overtime.percent, amount: overtimeAmount });
  }

  const grossAmount = round2(baseAmount + obAmount + overtimeAmount);
  return { baseHours, obHours, grossAmount, lines, eventIds };
}

/** Pair an ordered IN/OUT stamp list into worked intervals. A trailing unmatched
 *  IN (still clocked in) is left out — never counted as finished work. */
export function pairIntervals(
  events: { id: string; direction: "IN" | "OUT"; timestamp: Date }[],
): WorkedInterval[] {
  const sorted = [...events].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  const intervals: WorkedInterval[] = [];
  let openIn: { id: string; timestamp: Date } | null = null;
  for (const e of sorted) {
    if (e.direction === "IN") {
      openIn = { id: e.id, timestamp: e.timestamp };
    } else if (openIn) {
      intervals.push({ start: openIn.timestamp, end: e.timestamp, inEventId: openIn.id, outEventId: e.id });
      openIn = null;
    }
  }
  return intervals;
}
