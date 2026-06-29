import { describe, it, expect } from "vitest";
import { expandWeekdayDates } from "./shifts";

describe("expandWeekdayDates", () => {
  it("picks matching weekdays within an inclusive range", () => {
    // 2026-05-01 is a Friday (weekday index 4); Mon(0) + Wed(2) in May 2026.
    const dates = expandWeekdayDates("2026-05-01", "2026-05-14", [0, 2]);
    expect(dates).toEqual(["2026-05-04", "2026-05-06", "2026-05-11", "2026-05-13"]);
  });

  it("includes both endpoints when they match", () => {
    // 2026-05-04 is a Monday, 2026-05-10 is a Sunday.
    const dates = expandWeekdayDates("2026-05-04", "2026-05-10", [0, 6]);
    expect(dates).toEqual(["2026-05-04", "2026-05-10"]);
  });

  it("returns an empty list when no weekday matches", () => {
    expect(expandWeekdayDates("2026-05-01", "2026-05-03", [3])).toEqual([]);
  });

  it("returns a single date for a one-day range that matches", () => {
    expect(expandWeekdayDates("2026-05-04", "2026-05-04", [0])).toEqual(["2026-05-04"]);
  });
});
