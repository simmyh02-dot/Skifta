import { sendTrialReminders, freezeExpiredTrials } from "@/lib/billing";

// Daily trial-lifecycle tick (§12.1 steps 6): reminder e-mail on day 25–28,
// freeze on day 30 with no card attached. Triggered by Vercel Cron
// (vercel.json) — GET with a bearer secret, the documented pattern for
// authenticating Vercel Cron requests since they can't be scoped by IP.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const reminded = await sendTrialReminders();
  const frozen = await freezeExpiredTrials();

  return Response.json({ ok: true, reminded, frozen });
}
