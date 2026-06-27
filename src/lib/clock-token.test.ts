import { describe, it, expect, beforeAll } from "vitest";
import { signClockToken, verifyClockToken } from "./clock-token";

beforeAll(() => {
  process.env.AUTH_SECRET ||= "test-secret-for-clock-token";
});

describe("clock token (§5 place proof)", () => {
  it("round-trips a restaurant id", () => {
    const token = signClockToken("rest_abc123");
    expect(verifyClockToken(token)).toBe("rest_abc123");
  });

  it("rejects a tampered signature", () => {
    const token = signClockToken("rest_abc123");
    const tampered = token.slice(0, -2) + (token.endsWith("aa") ? "bb" : "aa");
    expect(verifyClockToken(tampered)).toBeNull();
  });

  it("rejects a swapped restaurant id (signature no longer matches)", () => {
    const token = signClockToken("rest_one");
    const other = Buffer.from("rest_two").toString("base64url");
    const forged = `${other}.${token.slice(token.indexOf(".") + 1)}`;
    expect(verifyClockToken(forged)).toBeNull();
  });

  it("rejects malformed tokens", () => {
    expect(verifyClockToken("")).toBeNull();
    expect(verifyClockToken("no-dot")).toBeNull();
    expect(verifyClockToken(".onlysig")).toBeNull();
  });
});
