import { normalizeContact } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { issueCode } from "@/lib/otp";

// POST { contact } → sends a login one-time code (§12.1). Always responds 200
// so we never reveal whether an account exists for that contact.
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const contact = body?.contact;
  if (typeof contact !== "string") {
    return Response.json({ error: "invalid_contact" }, { status: 400 });
  }

  const normalized = normalizeContact(contact);
  if (!normalized) {
    return Response.json({ error: "invalid_contact" }, { status: 400 });
  }

  const user =
    normalized.type === "PHONE"
      ? await prisma.user.findUnique({
          where: { normalizedPhone: normalized.value },
        })
      : await prisma.user.findUnique({
          where: { normalizedEmail: normalized.value },
        });

  if (user) {
    await issueCode(normalized, "LOGIN");
  }

  return Response.json({ ok: true });
}
