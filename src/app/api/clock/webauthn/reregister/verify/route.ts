import { normalizeContact } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { verifyCode } from "@/lib/otp";
import { startRegistration, setReregisterUser } from "@/lib/webauthn";
import { errorResponse } from "@/lib/guard";

// POST { contact, code } → §5 lost/new-device self-service, step 2. Verifies
// the DEVICE_REREGISTER code and, on success, immediately starts a new
// WebAuthn registration ceremony for the resolved user — binding their userId
// to a short-lived cookie (not a full session) so step 3 can persist the
// credential without ever logging the kiosk into the owner/economy app.
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const contact = body?.contact;
    const code = body?.code;
    if (typeof contact !== "string" || typeof code !== "string") {
      return Response.json({ error: "invalid_input" }, { status: 400 });
    }

    const normalized = normalizeContact(contact);
    if (!normalized) {
      return Response.json({ error: "invalid_contact" }, { status: 400 });
    }

    const ok = await verifyCode(normalized, "DEVICE_REREGISTER", code);
    if (!ok) return Response.json({ error: "invalid_code" }, { status: 401 });

    const user =
      normalized.type === "PHONE"
        ? await prisma.user.findUnique({ where: { normalizedPhone: normalized.value } })
        : await prisma.user.findUnique({ where: { normalizedEmail: normalized.value } });
    if (!user) return Response.json({ error: "invalid_code" }, { status: 401 });

    await setReregisterUser(user.id);
    const options = await startRegistration(user);
    return Response.json(options);
  } catch (err) {
    return errorResponse(err);
  }
}
