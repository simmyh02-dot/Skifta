import { describe, expect, it } from "vitest";
import { isDigestDue } from "./deviation-digest";

describe("isDigestDue", () => {
  const now = new Date(2026, 5, 15);

  it("is due when never sent", () => {
    expect(isDigestDue(null, now)).toBe(true);
  });

  it("is not due less than 7 days after the last send", () => {
    const lastSent = new Date(2026, 5, 10); // 5 days before now
    expect(isDigestDue(lastSent, now)).toBe(false);
  });

  it("is due exactly 7 days after the last send", () => {
    const lastSent = new Date(2026, 5, 8); // 7 days before now
    expect(isDigestDue(lastSent, now)).toBe(true);
  });

  it("is due if the cron missed a window (catches up rather than skipping)", () => {
    const lastSent = new Date(2026, 4, 1); // over a month ago
    expect(isDigestDue(lastSent, now)).toBe(true);
  });
});
