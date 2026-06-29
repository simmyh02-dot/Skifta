import { describe, it, expect } from "vitest";
import { localDateTimeToUtc } from "./local-time";

describe("localDateTimeToUtc", () => {
  it("converts winter (CET, UTC+1) local time correctly", () => {
    const d = localDateTimeToUtc("2026-01-15", "14:00");
    expect(d.toISOString()).toBe("2026-01-15T13:00:00.000Z");
  });

  it("converts summer (CEST, UTC+2) local time correctly", () => {
    const d = localDateTimeToUtc("2026-06-29", "14:00");
    expect(d.toISOString()).toBe("2026-06-29T12:00:00.000Z");
  });

  it("handles midnight without rolling to the wrong day", () => {
    const d = localDateTimeToUtc("2026-06-01", "00:30");
    expect(d.toISOString()).toBe("2026-05-31T22:30:00.000Z");
  });

  it("returns an invalid Date for malformed input instead of throwing", () => {
    const d = localDateTimeToUtc("not-a-date", "14:00");
    expect(Number.isNaN(d.getTime())).toBe(true);
  });
});
