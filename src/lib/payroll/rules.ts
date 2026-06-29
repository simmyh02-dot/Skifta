// OB-rule presets (§8.2 + §13). The spec is explicit: the payroll draft applies
// FIXED rules the restaurant chose — it is NOT an AI guess (§8.2). OB rates come
// from preset templates the owner picks, not free-form entry (§13), which keeps
// misconfiguration low. These presets are illustrative starting points; the
// real numbers come from the restaurant's collective agreement, and the owner
// can adjust them. Skifta produces *underlag* — it deliberately does NOT build a
// tax, AGI, or holiday-pay engine (§6.3, §17).

/** An OB window: a weekday + time-of-day band that earns a supplement on top of
 *  base pay. Windows do not wrap past midnight — an evening that runs into the
 *  next morning is two windows. Keep windows non-overlapping so supplements
 *  don't stack on the same minute. `percent` is the uplift (0.5 = +50%). */
export type ObWindow = {
  id: string;
  label: string;
  /** Weekdays this window applies to. 0 = Monday … 6 = Sunday. */
  days: number[];
  /** Minutes from local midnight, [start, end). */
  startMinute: number;
  endMinute: number;
  percent: number;
};

/** A simple period overtime rule: hours beyond `thresholdHours` in the period
 *  earn `percent` on top of base. A deliberately simple model — real overtime
 *  rules vary by agreement; this is underlag, refined downstream. */
export type Overtime = { thresholdHours: number; percent: number };

export type ObRuleSet = {
  id: string;
  name: string;
  windows: ObWindow[];
  overtime: Overtime | null;
};

const EVENING_START = 18 * 60; // 18:00
const DAY_END = 24 * 60; // 24:00
const WEEKDAYS = [0, 1, 2, 3, 4];
const WEEKEND = [5, 6];

/** The presets the owner can pick from. `none` is the honest default until the
 *  restaurant configures its agreement's rates. */
export const OB_PRESETS: ObRuleSet[] = [
  { id: "none", name: "Inget OB-tillägg", windows: [], overtime: null },
  {
    id: "evening_weekend",
    name: "Kväll & helg",
    windows: [
      {
        id: "evening_weekday",
        label: "Kväll (vardag)",
        days: WEEKDAYS,
        startMinute: EVENING_START,
        endMinute: DAY_END,
        percent: 0.5,
      },
      {
        id: "weekend",
        label: "Helg",
        days: WEEKEND,
        startMinute: 0,
        endMinute: DAY_END,
        percent: 1.0,
      },
    ],
    overtime: null,
  },
];

export function presetById(id: string | null | undefined): ObRuleSet {
  return OB_PRESETS.find((p) => p.id === id) ?? OB_PRESETS[0];
}

export const CUSTOM_RULE_SET_ID = "custom";

/** Sanity caps for a custom OB ruleset (§13 decided design: owners can now edit
 *  their own windows/overtime instead of being limited to the two presets, but
 *  input is still validated server-side — never trusted free-form). */
const MAX_PERCENT = 5; // +500% would already be a data-entry mistake
const MAX_OVERTIME_THRESHOLD = 168; // hours in a week

function isValidWindow(w: unknown): w is ObWindow {
  if (!w || typeof w !== "object") return false;
  const win = w as Record<string, unknown>;
  if (typeof win.label !== "string" || !win.label.trim()) return false;
  if (
    !Array.isArray(win.days) ||
    win.days.length === 0 ||
    !win.days.every((d) => Number.isInteger(d) && d >= 0 && d <= 6) ||
    new Set(win.days).size !== win.days.length
  )
    return false;
  if (
    !Number.isInteger(win.startMinute) ||
    !Number.isInteger(win.endMinute) ||
    (win.startMinute as number) < 0 ||
    (win.endMinute as number) > 24 * 60 ||
    (win.startMinute as number) >= (win.endMinute as number)
  )
    return false;
  if (
    typeof win.percent !== "number" ||
    !Number.isFinite(win.percent) ||
    win.percent < 0 ||
    win.percent > MAX_PERCENT
  )
    return false;
  return true;
}

/** Validates + sanitizes an owner-submitted custom ruleset. Returns `null` on
 *  any invalid field rather than guessing/clamping — the caller responds 400. */
export function parseCustomRuleSet(input: unknown): Omit<ObRuleSet, "id"> | null {
  if (!input || typeof input !== "object") return null;
  const body = input as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return null;

  const rawWindows = body.windows;
  if (!Array.isArray(rawWindows)) return null;
  const windows: ObWindow[] = [];
  for (const w of rawWindows) {
    if (!isValidWindow(w)) return null;
    windows.push({
      id: typeof w.id === "string" && w.id ? w.id : `w${windows.length}`,
      label: w.label.trim(),
      days: [...w.days],
      startMinute: w.startMinute,
      endMinute: w.endMinute,
      percent: w.percent,
    });
  }

  let overtime: Overtime | null = null;
  if (body.overtime != null) {
    const ot = body.overtime as Record<string, unknown>;
    if (
      typeof ot.thresholdHours !== "number" ||
      !Number.isFinite(ot.thresholdHours) ||
      ot.thresholdHours <= 0 ||
      ot.thresholdHours > MAX_OVERTIME_THRESHOLD ||
      typeof ot.percent !== "number" ||
      !Number.isFinite(ot.percent) ||
      ot.percent < 0 ||
      ot.percent > MAX_PERCENT
    ) {
      return null;
    }
    overtime = { thresholdHours: ot.thresholdHours, percent: ot.percent };
  }

  return { name, windows, overtime };
}
