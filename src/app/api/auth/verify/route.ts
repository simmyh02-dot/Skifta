import { normalizeContact } from "@/lib/contact";
import { prisma } from "@/lib/prisma";
import { verifyCode } from "@/lib/otp";
import { createSession } from "@/lib/session";

// POST { contact, code } → verifies the login code and, on success, mints a
// session. Auto-selects the restaurant if the user belongs to exactly one,
// otherwise the client routes to the picker (§3.3).
export async function POST(req: Request) {
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

  const ok = await verifyCode(normalized, "LOGIN", code);
  if (!ok) {
    return Response.json({ error: "invalid_code" }, { status: 401 });
  }

  const user =
    normalized.type === "PHONE"
      ? await prisma.user.findUnique({
          where: { normalizedPhone: normalized.value },
        })
      : await prisma.user.findUnique({
          where: { normalizedEmail: normalized.value },
        });
  if (!user) {
    return Response.json({ error: "invalid_code" }, { status: 401 });
  }

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id, endedAt: null },
    select: { restaurantId: true },
  });
  const activeRestaurantId =
    memberships.length === 1 ? memberships[0].restaurantId : undefined;

  await createSession({ userId: user.id, activeRestaurantId });

  return Response.json({ ok: true, restaurantCount: memberships.length });
}
