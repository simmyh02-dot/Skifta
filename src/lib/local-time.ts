// Local wall-clock time → UTC instant, DST-aware (§6.1/§8.1). Sweden is the
// only locale per §17, so the zone is fixed rather than configurable.
//
// `new Date(`${date}T${time}:00`)` (no offset) is parsed as UTC, which is
// wrong whenever the owner or the AI mean *local* time — this is the bug that
// silently shifted AI-proposed shift times. The fix: read the same instant's
// wall-clock in the target zone, diff against the naive UTC guess, and use
// that diff as the zone's real offset at that moment (correct across the
// CET/CEST DST boundary, no dependency needed).

const RESTAURANT_TIME_ZONE = "Europe/Stockholm";

export function localDateTimeToUtc(
  date: string,
  time: string,
  timeZone: string = RESTAURANT_TIME_ZONE,
): Date {
  const naiveUtc = new Date(`${date}T${time}:00Z`);
  if (Number.isNaN(naiveUtc.getTime())) return naiveUtc;

  // Read the same instant's wall-clock in `timeZone`, building it back as a
  // UTC instant (via Date.UTC + formatToParts, never re-parsing a locale
  // string — that would silently use the *host's* timezone instead of the
  // target one). The difference from `naiveUtc` is exactly the zone's real
  // offset at this moment, DST included.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(naiveUtc);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  const zonedAsUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  const offset = naiveUtc.getTime() - zonedAsUtc;
  return new Date(naiveUtc.getTime() + offset);
}
