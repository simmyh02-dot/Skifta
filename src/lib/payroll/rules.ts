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
