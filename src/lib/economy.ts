import type { ExportFormat } from "@prisma/client";
import type { ColumnMapping, ExportField } from "./export-template";

// Economy/admin core (§6.3). This is the section that replaces the paper
// logbook and the manual hour-counting. Two hard rules from the spec live here:
//
//   • We produce clean *underlag* and export it — we never build our own tax,
//     AGI, or holiday-pay engine (§6.3 avgränsning, §17). So this file sums
//     worked hours and formats them; it does not compute net pay.
//   • Unreviewed deviations are NEVER silently exported (§6.3). A human must
//     have seen every flag. `splitExportable` enforces that: a member with an
//     open/unreviewed deviation is held back from the export, explicitly, and
//     reported — never quietly folded in or quietly adjusted.

// ───────────────────────────── Periods ──────────────────────────────

/** Calendar-month bounds [start, end) for the month containing `d`. Periods are
 *  whole months for the MVP; the boundary is a half-open interval so a stamp at
 *  23:59 on the last day is in, and the first instant of next month is out. */
export function monthBounds(d: Date): { start: Date; end: Date } {
  const start = new Date(d.getFullYear(), d.getMonth(), 1);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return { start, end };
}

/** Move `delta` whole months from the first of `d`'s month. */
export function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

/** Stable `YYYY-MM` key for a period, used in URLs and as the month identifier. */
export function periodKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Parse a `YYYY-MM` key back to the first instant of that month, or null. */
export function parsePeriodKey(key: string | null | undefined): Date | null {
  if (!key) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

// ─────────────────────────── Hour summary ───────────────────────────

/** One employee's summed work for the period. `hours` is the paired IN→OUT
 *  total (see `accumulateHours`); a still-open stamp's open time is reported
 *  separately and never counted as if it were finished. */
export type MemberSummary = {
  userId: string;
  displayName: string;
  /** Activated = has at least one credential (PIN or device) — adoption (§6.3). */
  activated: boolean;
  hours: number;
  /** Deviations on this member's stamps in the period, by review status. */
  openDeviations: number;
  reviewedDeviations: number;
  /** True while any deviation is still OPEN — blocks a silent export (§6.3). */
  hasUnreviewedDeviations: boolean;
  /** Set when the member is still clocked in at read time. */
  openSince: string | null;
};

/** Round hours to two decimals for display/export without lying about the sum. */
export function roundHours(hours: number): number {
  return Math.round(hours * 100) / 100;
}

// ──────────────────────────── CSV / export ──────────────────────────

/** Escape one CSV cell per RFC 4180: quote when it contains a comma, quote,
 *  or newline, and double any embedded quotes. */
export function csvEscape(value: string | number): string {
  const s = String(value);
  return /[",\r\n]/.test(s) ? `"${s.replaceAll('"', '""')}"` : s;
}

/** Join headers + rows into CSV text (CRLF line endings, RFC 4180). The caller
 *  prepends a BOM when handing this to a spreadsheet so å/ä/ö survive. */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers, ...rows].map((row) => row.map(csvEscape).join(","));
  return lines.join("\r\n");
}

/** Column layout per export format. Fortnox/Visma both ingest CSV; the format
 *  picker (§6.3) chooses the column structure the downstream system expects.
 *  These are documented, plausible layouts — "import my own template" (CUSTOM)
 *  overrides them with the byrå's exact columns. */
type ColumnSet = { headers: string[]; row: (s: ExportableRow) => (string | number)[] };

export type ExportableRow = {
  employee: string;
  hours: number;
  periodStart: Date;
  periodEnd: Date;
};

/** Local-calendar `YYYY-MM-DD`. Periods are local concepts, so we format from
 *  the local Y/M/D, not UTC, or a midnight boundary would slip to the day
 *  before in a positive-offset timezone. */
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Last day of the half-open period, for systems that label a period by its
 *  inclusive end date (period end is exclusive internally). */
function inclusiveEnd(d: Date): Date {
  return new Date(d.getTime() - 24 * 60 * 60_000);
}

const COLUMN_SETS: Record<ExportFormat, ColumnSet> = {
  CSV: {
    headers: ["Anställd", "Periodstart", "Periodslut", "Arbetade timmar"],
    row: (r) => [r.employee, isoDate(r.periodStart), isoDate(inclusiveEnd(r.periodEnd)), r.hours],
  },
  FORTNOX: {
    // Fortnox lön imports time transactions: employee, salary code, amount, date.
    headers: ["Anställdsnummer", "Namn", "Löneart", "Antal", "Datum"],
    row: (r) => ["", r.employee, "TID", r.hours, isoDate(inclusiveEnd(r.periodEnd))],
  },
  VISMA: {
    // Visma Lön time import: employee, time code, hours, from/to date.
    headers: ["Anställd", "Tidkod", "Timmar", "Från", "Till"],
    row: (r) => [r.employee, "ARB", r.hours, isoDate(r.periodStart), isoDate(inclusiveEnd(r.periodEnd))],
  },
  CUSTOM: {
    // Falls back to the generic layout until a template is imported (§6.3).
    headers: ["Anställd", "Periodstart", "Periodslut", "Arbetade timmar"],
    row: (r) => [r.employee, isoDate(r.periodStart), isoDate(inclusiveEnd(r.periodEnd)), r.hours],
  },
};

/** The §6.3 export gate: separate the members that may be exported from the
 *  ones held back because a deviation hasn't been reviewed. Unreviewed flags
 *  are never silently included — they are excluded *explicitly* and named, so a
 *  human reviews them first. No silent automatic adjustment, ever. */
export function splitExportable(summaries: MemberSummary[]): {
  exportable: MemberSummary[];
  blocked: MemberSummary[];
} {
  const exportable: MemberSummary[] = [];
  const blocked: MemberSummary[] = [];
  for (const s of summaries) {
    (s.hasUnreviewedDeviations ? blocked : exportable).push(s);
  }
  return { exportable, blocked };
}

/** Build the export CSV for the already-cleared members in the chosen format.
 *  For CUSTOM with a saved column mapping (§6.3 "import my own template"), the
 *  owner's exact header order/labels are used instead of the generic fallback. */
export function buildExportCsv(
  members: MemberSummary[],
  format: ExportFormat,
  period: { start: Date; end: Date },
  customMapping?: ColumnMapping | null,
): string {
  if (format === "CUSTOM" && customMapping && customMapping.length > 0) {
    const values: Record<ExportField, string | number> = {
      employee: "",
      periodStart: isoDate(period.start),
      periodEnd: isoDate(inclusiveEnd(period.end)),
      hours: 0,
    };
    const headers = customMapping.map((c) => c.header);
    const rows = members.map((m) => {
      const row = { ...values, employee: m.displayName, hours: roundHours(m.hours) };
      return customMapping.map((c) => (c.field ? row[c.field] : ""));
    });
    return toCsv(headers, rows);
  }

  const cols = COLUMN_SETS[format];
  const rows = members.map((m) =>
    cols.row({
      employee: m.displayName,
      hours: roundHours(m.hours),
      periodStart: period.start,
      periodEnd: period.end,
    }),
  );
  return toCsv(cols.headers, rows);
}
