import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  signSession,
  verifySessionToken,
  type SessionPayload,
} from "./session-token";
import {
  DEVICE_COOKIE,
  DEVICE_MAX_AGE_SECONDS,
  signDeviceToken,
} from "./device-token";

// Cookie-backed session helpers (server-only; uses next/headers). The session
// is a signed JWT — no DB row. Auth itself is OTP-based (§4, §12.1); this only
// mints/reads the session once a contact has been verified.

export type { SessionPayload } from "./session-token";
export { SESSION_COOKIE, verifySessionToken } from "./session-token";

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  };
}

export async function createSession(payload: SessionPayload): Promise<void> {
  const token = await signSession(payload);
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions());
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function setActiveRestaurant(
  restaurantId: string,
): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;
  await createSession({ ...session, activeRestaurantId: restaurantId });
  return true;
}

// Clears both the session and the remembered-device cookie — an explicit
// logout must forget the device too, or the next /app visit would just get
// silently re-signed-in by the proxy's device-cookie fallback.
export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(DEVICE_COOKIE);
}

// Marks this browser as a known device (§12 decided design: OTP only on the
// first login per device, then silent re-entry). Call once, right after a
// successful OTP verify — never on session refresh, so a stranger who steals
// a live session can't extend the remembered-device window.
export async function rememberDevice(payload: SessionPayload): Promise<void> {
  const token = await signDeviceToken(payload);
  (await cookies()).set(DEVICE_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DEVICE_MAX_AGE_SECONDS,
  });
}
