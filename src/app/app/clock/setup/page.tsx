import { redirect } from "next/navigation";
import QRCode from "qrcode";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { can } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { signClockToken } from "@/lib/clock-token";
import { ClockAdminView } from "@/components/clock/ClockAdminView";

export const dynamic = "force-dynamic";

export default async function ClockSetupPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ctx = await getAccessContext(session.userId, session.activeRestaurantId);
  // Admin + FULL tier (the QR/kiosk is meaningless without the clock feature).
  if (!ctx || !can(ctx, "settings:manage") || !can(ctx, "clock:viewOwn")) {
    redirect("/app/schedule");
  }

  const restaurant = await prisma.restaurant.findUnique({
    where: { id: session.activeRestaurantId },
    select: { toleranceLowMinutes: true, toleranceHighMinutes: true },
  });

  const token = signClockToken(session.activeRestaurantId);
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const kioskUrl = `${appUrl}/clock/${token}`;
  const qrSvg = await QRCode.toString(kioskUrl, {
    type: "svg",
    margin: 1,
    color: { dark: "#1b1b18", light: "#fcfbf7" },
  });

  return (
    <ClockAdminView
      qrSvg={qrSvg}
      kioskUrl={kioskUrl}
      toleranceLowMinutes={restaurant?.toleranceLowMinutes ?? 10}
      toleranceHighMinutes={restaurant?.toleranceHighMinutes ?? 30}
    />
  );
}
