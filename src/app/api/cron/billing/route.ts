import { sendTrialReminders, freezeExpiredTrials } from "@/lib/billing";
import { runRetentionSweep } from "@/lib/gdpr";

// Daily tick: trial lifecycle (§12.1 step 6 — reminder e-mail on day 25–28,
// freeze on day 30 with no card) plus the §13 GDPR retention sweep
// (anonymize PII of long-departed staff). Both are daily-cadence, so they
// share one Vercel Cron (vercel.json) rather than burning a second schedule.
// Authenticated with a bearer secret, the documented Vercel Cron pattern.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const reminded = await sendTrialReminders();
  const frozen = await freezeExpiredTrials();
  const anonymized = await runRetentionSweep();

  return Response.json({ ok: true, reminded, frozen, anonymized });
}
