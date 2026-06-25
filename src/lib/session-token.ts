import { SignJWT, jwtVerify } from "jose";

// Pure JWT sign/verify with NO `next/headers` import, so this module is safe to
// use from edge middleware. Cookie reading/writing lives in `session.ts`.

export const SESSION_COOKIE = "skifta_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SessionPayload = {
  userId: string;
  /** Restaurant the user is currently acting in (§3.3 multi-restaurant). */
  activeRestaurantId?: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (typeof payload.userId !== "string") return null;
    return {
      userId: payload.userId,
      activeRestaurantId:
        typeof payload.activeRestaurantId === "string"
          ? payload.activeRestaurantId
          : undefined,
    };
  } catch {
    return null;
  }
}
