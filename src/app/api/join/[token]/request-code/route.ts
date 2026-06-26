import { getLiveInvite } from "@/lib/invite";
import { issueCode } from "@/lib/otp";

// POST → send an OTP to the invite's own contact (§4 step 4). The contact is
// never taken from the request — only from the invite itself — so this route
// can't be used to spam an arbitrary number/email.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getLiveInvite(token);
  if (!invite) {
    return Response.json({ error: "invalid_or_expired" }, { status: 404 });
  }

  await issueCode(
    { type: invite.contactType, value: invite.normalizedContact },
    "INVITE_ACCEPT",
  );

  return Response.json({ ok: true });
}
