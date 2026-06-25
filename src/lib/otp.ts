import type { CodePurpose } from "@prisma/client";
import { prisma } from "./prisma";
import { generateNumericCode, hashSecret, verifySecret } from "./hash";
import { getSender, type ContactTarget } from "./messaging";

// One-time code lifecycle (§4, §5, §12.1). Codes are 6 digits, stored hashed,
// short-lived, and rate-limited by an attempt counter. Verifying a code never
// reveals whether the contact exists — callers get a plain boolean.

const TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;

export async function issueCode(
  contact: ContactTarget,
  purpose: CodePurpose,
): Promise<void> {
  const code = generateNumericCode(6);
  const codeHash = await hashSecret(code);

  // Invalidate any earlier live codes for this contact+purpose so only the
  // latest works.
  await prisma.verificationCode.updateMany({
    where: { normalizedContact: contact.value, purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  await prisma.verificationCode.create({
    data: {
      contactType: contact.type,
      normalizedContact: contact.value,
      codeHash,
      purpose,
      expiresAt: new Date(Date.now() + TTL_MINUTES * 60_000),
    },
  });

  await getSender().send(
    contact,
    `Din Skifta-kod är ${code}. Den gäller i ${TTL_MINUTES} minuter.`,
  );
}

export async function verifyCode(
  contact: ContactTarget,
  purpose: CodePurpose,
  code: string,
): Promise<boolean> {
  const record = await prisma.verificationCode.findFirst({
    where: {
      normalizedContact: contact.value,
      purpose,
      consumedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!record || record.attempts >= MAX_ATTEMPTS) return false;

  const ok = await verifySecret(code, record.codeHash);
  if (!ok) {
    await prisma.verificationCode.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return false;
  }

  await prisma.verificationCode.update({
    where: { id: record.id },
    data: { consumedAt: new Date() },
  });
  return true;
}
