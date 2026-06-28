import { escalateOverdueSwaps } from "@/lib/swaps";

// Frequent shift-lifecycle tick (§6.1): flip swap requests that passed their
// reply window to ESCALATED and ping the owners. Same Vercel Cron + bearer
// secret pattern as the billing cron; runs often (the window is minutes, not
// days), so it's a separate schedule from the daily billing tick.
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const escalated = await escalateOverdueSwaps();
  return Response.json({ ok: true, escalated });
}
