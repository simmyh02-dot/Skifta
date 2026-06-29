import { SignJWT, jwtVerify } from "jose";

// Pure JWT sign/verify for the long-lived "remembered device" cookie (§12
// decided design: OTP only on the first login per device, silent re-entry
// after that). Edge-safe (no `next/headers`), mirrors session-token.ts.
// Deliberately separate from the session cookie/secret scope: losing or
// expiring the session shouldn't force a fresh OTP if the device is known.

export const DEVICE_COOKIE = "skifta_device";
export const DEVICE_MAX_AGE_SECONDS = 60 * 60 * 24 * 90; // 90 days

export type DeviceTokenPayload = {
  userId: string;
  activeRestaurantId?: string;
};

function getSecret(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(secret);
}

export async function signDeviceToken(
  payload: DeviceTokenPayload,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DEVICE_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifyDeviceToken(
  token: string,
): Promise<DeviceTokenPayload | null> {
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
