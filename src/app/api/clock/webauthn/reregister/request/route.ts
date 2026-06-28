import { normalizeContact } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { issueCode } from "@/lib/otp";

// POST { contact } → §5 lost/new-device self-service, step 1. Sends a
// DEVICE_REREGISTER one-time code to a contact already on file. Public (the
// kiosk has no session) — always responds 200 so it never reveals whether a
// contact has an account, same pattern as the login request-code route.
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
      ? await prisma.user.findUnique({ where: { normalizedPhone: normalized.value } })
      : await prisma.user.findUnique({ where: { normalizedEmail: normalized.value } });

  if (user) {
    await issueCode(normalized, "DEVICE_REREGISTER");
  }

  return Response.json({ ok: true });
}
