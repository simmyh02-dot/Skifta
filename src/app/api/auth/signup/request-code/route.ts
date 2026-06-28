import { normalizeContact } from "@/lib/contact";
import { issueCode } from "@/lib/otp";

// POST { contact } → sends a one-time code to verify the founding owner's
// contact before creating a new restaurant (§12.1 step 4, soft qualification).
// Unlike /api/auth/request-code, this always sends — the contact doesn't need
// to belong to an existing account yet, that's the whole point of signup.
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

  await issueCode(normalized, "SIGNUP");
  return Response.json({ ok: true });
}
