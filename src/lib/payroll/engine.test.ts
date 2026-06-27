import { describe, it, expect } from "vitest";
import { computeDraft, pairIntervals, type WorkedInterval } from "./engine";
import { presetById, type ObRuleSet } from "./rules";

const evWeekend = presetById("evening_weekend");
const none = presetById("none");
const RATE = 150;

function iv(start: Date, end: Date): WorkedInterval {
  return { start, end };
}
// 2026-06-01 is a Monday; -05 Friday; -06 Saturday.
const mon = (h: number, m = 0) => new Date(2026, 5, 1, h, m);
const fri = (h: number, m = 0) => new Date(2026, 5, 5, h, m);
const sat = (h: number, m = 0) => new Date(2026, 5, 6, h, m);

describe("pairIntervals", () => {
  it("pairs IN→OUT and ignores a trailing open IN (still clocked in)", () => {
    const ivs = pairIntervals([
      { id: "a", direction: "IN", timestamp: mon(9) },
      { id: "b", direction: "OUT", timestamp: mon(17) },
      { id: "c", direction: "IN", timestamp: mon(18) },
    ]);
    expect(ivs).toHaveLength(1);
    expect(ivs[0]).toMatchObject({ inEventId: "a", outEventId: "b" });
  });

  it("sorts out-of-order stamps before pairing", () => {
    const ivs = pairIntervals([
      { id: "b", direction: "OUT", timestamp: mon(17) },
      { id: "a", direction: "IN", timestamp: mon(9) },
    ]);
    expect(ivs).toHaveLength(1);
    expect(ivs[0].start).toEqual(mon(9));
  });
});

describe("computeDraft — base pay", () => {
  it("weekday daytime shift earns base only (no OB before 18:00)", () => {
    const d = computeDraft([iv(mon(9), mon(17))], RATE, evWeekend);
    expect(d.baseHours).toBe(8);
    expect(d.obHours).toBe(0);
    expect(d.grossAmount).toBe(8 * RATE);
    expect(d.lines).toHaveLength(1);
    expect(d.lines[0]).toMatchObject({ type: "base", hours: 8, amount: 1200 });
  });

  it("carries the stamp ids it was built from (traceability §8.2)", () => {
    const d = computeDraft(
      [{ start: mon(9), end: mon(17), inEventId: "in1", outEventId: "out1" }],
      RATE,
      evWeekend,
    );
    expect(d.eventIds).toEqual(["in1", "out1"]);
  });
});

describe("computeDraft — OB supplements (on top of base, never double-counted)", () => {
  it("evening weekday: only the after-18:00 portion gets +50%", () => {
    const d = computeDraft([iv(mon(16), mon(22))], RATE, evWeekend); // 6h, 4h after 18:00
    expect(d.baseHours).toBe(6);
    expect(d.obHours).toBe(4);
    const ob = d.lines.find((l) => l.type === "ob");
    expect(ob).toMatchObject({ windowId: "evening_weekday", hours: 4, percent: 0.5, amount: 4 * RATE * 0.5 });
    expect(d.grossAmount).toBe(6 * RATE + 4 * RATE * 0.5); // 900 + 300
  });

  it("weekend: the whole shift gets +100%", () => {
    const d = computeDraft([iv(sat(10), sat(14))], RATE, evWeekend); // 4h Saturday
    expect(d.baseHours).toBe(4);
    expect(d.obHours).toBe(4);
    expect(d.grossAmount).toBe(4 * RATE + 4 * RATE * 1.0); // 600 + 600
  });

  it("overnight shift splits across the midnight boundary and applies each window", () => {
    // Fri 22:00 → Sat 06:00. Fri 22–24 = evening weekday (+50%); Sat 00–06 = weekend (+100%).
    const d = computeDraft([iv(fri(22), sat(6))], RATE, evWeekend);
    expect(d.baseHours).toBe(8);
    expect(d.obHours).toBe(8); // 2h evening + 6h weekend
    const evening = d.lines.find((l) => l.type === "ob" && l.windowId === "evening_weekday");
    const weekend = d.lines.find((l) => l.type === "ob" && l.windowId === "weekend");
    expect(evening).toMatchObject({ hours: 2, amount: 2 * RATE * 0.5 });
    expect(weekend).toMatchObject({ hours: 6, amount: 6 * RATE * 1.0 });
    expect(d.grossAmount).toBe(8 * RATE + 2 * RATE * 0.5 + 6 * RATE * 1.0); // 1200 + 150 + 900
  });

  it("the 'none' preset never adds OB", () => {
    const d = computeDraft([iv(sat(10), sat(20))], RATE, none);
    expect(d.obHours).toBe(0);
    expect(d.lines).toHaveLength(1);
    expect(d.grossAmount).toBe(10 * RATE);
  });
});

describe("computeDraft — overtime supplement", () => {
  const ot: ObRuleSet = { id: "ot", name: "OT", windows: [], overtime: { thresholdHours: 5, percent: 0.5 } };
  it("hours beyond the threshold earn the overtime percent on top of base", () => {
    const d = computeDraft([iv(mon(9), mon(17))], 100, ot); // 8h, 3h over
    expect(d.baseHours).toBe(8);
    const overtime = d.lines.find((l) => l.type === "overtime");
    expect(overtime).toMatchObject({ hours: 3, percent: 0.5, amount: 3 * 100 * 0.5 });
    expect(d.grossAmount).toBe(8 * 100 + 3 * 100 * 0.5); // 800 + 150
  });

  it("no overtime line when under the threshold", () => {
    const d = computeDraft([iv(mon(9), mon(13))], 100, ot); // 4h
    expect(d.lines.some((l) => l.type === "overtime")).toBe(false);
  });
});

describe("computeDraft — empty input", () => {
  it("no intervals → zeroed draft, base line only", () => {
    const d = computeDraft([], RATE, evWeekend);
    expect(d).toMatchObject({ baseHours: 0, obHours: 0, grossAmount: 0 });
    expect(d.eventIds).toEqual([]);
  });
});
