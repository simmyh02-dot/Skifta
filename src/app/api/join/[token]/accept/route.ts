import { verifyCode } from "@/lib/otp";
import { acceptInvite, getLiveInvite } from "@/lib/invite";
import { createSession } from "@/lib/session";

// POST { code } → verify the OTP against the invite's own contact, then
// consume the invite: create/join the User + Membership and sign them in
// (§4 steps 4–5). A forwarded link fails here because the code only ever
// went to the original contact.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getLiveInvite(token);
  if (!invite) {
    return Response.json({ error: "invalid_or_expired" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const code = body?.code;
  if (typeof code !== "string") {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const ok = await verifyCode(
    { type: invite.contactType, value: invite.normalizedContact },
    "INVITE_ACCEPT",
    code,
  );
  if (!ok) {
    return Response.json({ error: "invalid_code" }, { status: 401 });
  }

  const result = await acceptInvite(token, invite.name);
  if (!result) {
    return Response.json({ error: "invalid_or_expired" }, { status: 404 });
  }

  await createSession({
    userId: result.userId,
    activeRestaurantId: result.restaurantId,
  });

  return Response.json({ ok: true });
}
