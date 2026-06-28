import { finishRegistration, takeReregisterUser } from "@/lib/webauthn";
import { errorResponse } from "@/lib/guard";

// POST { response, deviceLabel? } → §5 lost/new-device self-service, step 3.
// Persists the new credential for whichever userId the OTP step bound to the
// reregister cookie. The cookie is single-use (deleted on read) and short-lived,
// so this can't be replayed for a different device later.
export async function POST(req: Request) {
  try {
    const userId = await takeReregisterUser();
    if (!userId) {
      return Response.json({ error: "reregister_expired" }, { status: 401 });
    }

    const body = await req.json().catch(() => null);
    if (!body?.response) {
      return Response.json({ error: "invalid_body" }, { status: 400 });
    }

    const ok = await finishRegistration(
      userId,
      body.response,
      typeof body.deviceLabel === "string" ? body.deviceLabel : null,
    );
    if (!ok) return Response.json({ error: "verification_failed" }, { status: 400 });

    return Response.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
