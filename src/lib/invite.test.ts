import { describe, it, expect } from "vitest";
import { generateToken } from "./invite";

describe("invite token generation (§4)", () => {
  it("generates a URL-safe, sufficiently long random token", () => {
    const token = generateToken();
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(24);
  });

  it("never repeats across many calls", () => {
    const tokens = new Set(Array.from({ length: 200 }, () => generateToken()));
    expect(tokens.size).toBe(200);
  });
});
