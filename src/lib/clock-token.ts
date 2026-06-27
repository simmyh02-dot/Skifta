import { createHmac, timingSafeEqual } from "node:crypto";

// The "place proof" for clock-in (§5). A restaurant's QR code and shared-tablet
// kiosk both open `/clock/<token>`; possessing a valid token means you are
// physically at the venue (the QR is printed by the staff entrance) or on the
// authorised terminal. The token is a stateless HMAC of the restaurant id —
// no DB column, no expiry, rotatable by changing AUTH_SECRET — so a kiosk page
// can be cached offline and still carry a verifiable restaurant identity.
//
// Identity (which employee) is proven separately by one of session / WebAuthn /
// PIN. Token = place; credential = person. Both are required to stamp.

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set");
  return s;
}

function sign(restaurantId: string): string {
  return createHmac("sha256", secret())
    .update(restaurantId)
    .digest("base64url");
}

/** The opaque token embedded in a restaurant's QR / kiosk URL. */
export function signClockToken(restaurantId: string): string {
  const id = Buffer.from(restaurantId).toString("base64url");
  return `${id}.${sign(restaurantId)}`;
}

/** Verify a token and return the restaurant id, or null if tampered/malformed. */
export function verifyClockToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const restaurantId = Buffer.from(token.slice(0, dot), "base64url").toString(
    "utf8",
  );
  if (!restaurantId) return null;

  const expected = Buffer.from(sign(restaurantId));
  const got = Buffer.from(token.slice(dot + 1));
  if (expected.length !== got.length) return null;
  return timingSafeEqual(expected, got) ? restaurantId : null;
}
