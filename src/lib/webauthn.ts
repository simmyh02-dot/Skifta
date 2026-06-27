import { cookies } from "next/headers";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type VerifiedRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { prisma } from "./prisma";

// WebAuthn — QR + Face ID/Touch ID (§5 method 1, the standard recommendation).
// The biometric never leaves the device; we only ever store the public
// credential (§5, §13). A User can hold many credentials, one per device, which
// is load-bearing for the "new phone / lost phone" flows (§5) — never assume a
// single credential per person.
//
// Registration is done while signed in (own device). Authentication at the
// kiosk is *discoverable* (usernameless): the QR proves place, the resident
// credential proves person, so no prior login is needed for the <3s flow.

const rpID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const rpName = process.env.WEBAUTHN_RP_NAME ?? "Skifta";
const origin = process.env.WEBAUTHN_ORIGIN ?? "http://localhost:3000";

const REG_CHALLENGE_COOKIE = "skifta_wa_reg";
const AUTH_CHALLENGE_COOKIE = "skifta_wa_auth";
const CHALLENGE_TTL = 300; // seconds

async function setChallenge(name: string, challenge: string) {
  (await cookies()).set(name, challenge, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: CHALLENGE_TTL,
  });
}

async function takeChallenge(name: string): Promise<string | null> {
  const jar = await cookies();
  const value = jar.get(name)?.value ?? null;
  if (value) jar.delete(name);
  return value;
}

/** Registration options for a signed-in user's current device. */
export async function startRegistration(user: {
  id: string;
  displayName: string;
}) {
  const existing = await prisma.webAuthnCredential.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.displayName,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({ id: c.credentialId })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await setChallenge(REG_CHALLENGE_COOKIE, options.challenge);
  return options;
}

/** Verify a registration response and persist the new credential. */
export async function finishRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceLabel?: string | null,
): Promise<boolean> {
  const expectedChallenge = await takeChallenge(REG_CHALLENGE_COOKIE);
  if (!expectedChallenge) return false;

  let verification: VerifiedRegistrationResponse;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
    });
  } catch {
    return false;
  }
  if (!verification.verified || !verification.registrationInfo) return false;

  const { credential } = verification.registrationInfo;
  await prisma.webAuthnCredential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      deviceLabel: deviceLabel ?? null,
    },
  });
  return true;
}

/** Discoverable-credential authentication options for the kiosk (no username). */
export async function startAuthentication() {
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
  });
  await setChallenge(AUTH_CHALLENGE_COOKIE, options.challenge);
  return options;
}

/** Verify a kiosk authentication response → the userId it proves, or null.
 *  Bumps the stored signature counter (clone/replay defence). */
export async function finishAuthentication(
  response: AuthenticationResponseJSON,
): Promise<string | null> {
  const expectedChallenge = await takeChallenge(AUTH_CHALLENGE_COOKIE);
  if (!expectedChallenge) return null;

  const stored = await prisma.webAuthnCredential.findUnique({
    where: { credentialId: response.id },
  });
  if (!stored) return null;

  try {
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: stored.credentialId,
        publicKey: new Uint8Array(stored.publicKey),
        counter: Number(stored.counter),
        transports: stored.transports as AuthenticatorTransportFuture[],
      },
    });
    if (!verification.verified) return null;

    await prisma.webAuthnCredential.update({
      where: { id: stored.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    });
    return stored.userId;
  } catch {
    return null;
  }
}
