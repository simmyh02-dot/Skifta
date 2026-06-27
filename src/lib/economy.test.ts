import { describe, it, expect } from "vitest";
import {
  monthBounds,
  shiftMonth,
  periodKey,
  parsePeriodKey,
  csvEscape,
  toCsv,
  splitExportable,
  buildExportCsv,
  roundHours,
  type MemberSummary,
} from "./economy";

function member(over: Partial<MemberSummary> = {}): MemberSummary {
  return {
    userId: "u",
    displayName: "Erik L.",
    activated: true,
    hours: 36.5,
    openDeviations: 0,
    reviewedDeviations: 0,
    hasUnreviewedDeviations: false,
    openSince: null,
    ...over,
  };
}

describe("periods", () => {
  it("month bounds are a half-open [first, next-first) interval", () => {
    const { start, end } = monthBounds(new Date(2026, 5, 15)); // 15 Jun 2026
    expect(start).toEqual(new Date(2026, 5, 1));
    expect(end).toEqual(new Date(2026, 6, 1));
  });

  it("shiftMonth crosses year boundaries", () => {
    expect(shiftMonth(new Date(2026, 0, 10), -1)).toEqual(new Date(2025, 11, 1));
    expect(shiftMonth(new Date(2026, 11, 10), 1)).toEqual(new Date(2027, 0, 1));
  });

  it("periodKey/parsePeriodKey round-trip", () => {
    const d = new Date(2026, 5, 1);
    expect(periodKey(d)).toBe("2026-06");
    expect(parsePeriodKey("2026-06")).toEqual(d);
  });

  it("parsePeriodKey rejects junk", () => {
    expect(parsePeriodKey("2026-13")).toBeNull();
    expect(parsePeriodKey("nope")).toBeNull();
    expect(parsePeriodKey(null)).toBeNull();
  });
});

describe("csv", () => {
  it("escapes commas, quotes and newlines", () => {
    expect(csvEscape("plain")).toBe("plain");
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line\nbreak")).toBe('"line\nbreak"');
  });

  it("builds CRLF-joined rows", () => {
    const csv = toCsv(["A", "B"], [["x", "y"], [1, 2]]);
    expect(csv).toBe("A,B\r\nx,y\r\n1,2");
  });
});

describe("export gate (§6.3 — never export an unreviewed deviation silently)", () => {
  it("holds back members with an unreviewed deviation, names them, exports the rest", () => {
    const clean = member({ userId: "a", displayName: "Sara M." });
    const flagged = member({
      userId: "b",
      displayName: "Olle R.",
      hasUnreviewedDeviations: true,
      openDeviations: 1,
    });
    const { exportable, blocked } = splitExportable([clean, flagged]);
    expect(exportable.map((m) => m.userId)).toEqual(["a"]);
    expect(blocked.map((m) => m.userId)).toEqual(["b"]);
  });

  it("a cleared member's reviewed deviation does not block export", () => {
    const { exportable, blocked } = splitExportable([
      member({ reviewedDeviations: 2, hasUnreviewedDeviations: false }),
    ]);
    expect(exportable).toHaveLength(1);
    expect(blocked).toHaveLength(0);
  });
});

describe("buildExportCsv", () => {
  const period = { start: new Date(2026, 5, 1), end: new Date(2026, 6, 1) };

  it("CSV format: generic columns, inclusive end date, rounded hours", () => {
    const csv = buildExportCsv([member({ hours: 36.499 })], "CSV", period);
    expect(csv).toBe(
      "Anställd,Periodstart,Periodslut,Arbetade timmar\r\nErik L.,2026-06-01,2026-06-30,36.5",
    );
  });

  it("Fortnox format uses a salary-code transaction layout", () => {
    const csv = buildExportCsv([member({ hours: 40 })], "FORTNOX", period);
    expect(csv.split("\r\n")[0]).toBe("Anställdsnummer,Namn,Löneart,Antal,Datum");
    expect(csv.split("\r\n")[1]).toBe(",Erik L.,TID,40,2026-06-30");
  });

  it("Visma format uses a time-code layout with from/to", () => {
    const csv = buildExportCsv([member({ hours: 12 })], "VISMA", period);
    expect(csv.split("\r\n")[0]).toBe("Anställd,Tidkod,Timmar,Från,Till");
    expect(csv.split("\r\n")[1]).toBe("Erik L.,ARB,12,2026-06-01,2026-06-30");
  });
});

describe("roundHours", () => {
  it("rounds to two decimals", () => {
    expect(roundHours(8.005)).toBe(8.01);
    expect(roundHours(8)).toBe(8);
    expect(roundHours(7.999)).toBe(8);
  });
});
