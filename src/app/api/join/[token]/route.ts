import { getLiveInvite } from "@/lib/invite";

// GET → public, minimal invite preview for the /join/[token] page. Exposes
// only what's needed to render "You've been invited to X as Y" — never the
// contact value itself.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const invite = await getLiveInvite(token);
  if (!invite) {
    return Response.json({ error: "invalid_or_expired" }, { status: 404 });
  }

  return Response.json({
    name: invite.name,
    restaurantName: invite.restaurant.name,
    role: invite.role,
    contactType: invite.contactType,
  });
}
