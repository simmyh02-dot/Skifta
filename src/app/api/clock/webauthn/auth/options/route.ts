import { verifyClockToken } from "@/lib/clock-token";
import { startAuthentication } from "@/lib/webauthn";
import { getSession } from "@/lib/session";

// Discoverable-credential authentication options for Face ID clock-in (§5
// method 1). Two callers: the public kiosk (proves place with a valid token)
// and the signed-in app (the session is the trust anchor, no token needed).
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const tokenValid =
      typeof body?.token === "string" && verifyClockToken(body.token) !== null;
    const session = tokenValid ? null : await getSession();
    if (!tokenValid && !session) {
      return Response.json({ error: "invalid_token" }, { status: 400 });
    }

    const options = await startAuthentication();
    return Response.json(options);
  } catch (err) {
    console.error(err);
    return Response.json({ error: "internal_error" }, { status: 500 });
  }
}
