import QRCode from "qrcode";
import { verifyClockToken } from "@/lib/clock-token";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ClockKiosk } from "@/components/clock/ClockKiosk";

export const dynamic = "force-dynamic";

// Public kiosk / QR target (§5). Reachable without a login: scanning the QR (or
// running the shared tablet) is the place proof; identity is proven on-device by
// Face ID or PIN. Lives outside `/app`, so the auth proxy doesn't gate it.
export default async function KioskPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const restaurantId = verifyClockToken(token);
  // Best-effort only: this page stays fully public/token-gated either way
  // (§5) — a session just lets the result screen offer a way back into the
  // app instead of leaving a signed-in worker stranded on the public kiosk.
  const session = await getSession();

  const restaurant = restaurantId
    ? await prisma.restaurant.findUnique({
        where: { id: restaurantId },
        select: { name: true, tier: true },
      })
    : null;

  // The "scan with your phone" QR points back at this same kiosk URL, so a
  // member can switch from the shared tablet to their own phone for Face ID.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qrSvg =
    restaurant && restaurant.tier === "FULL"
      ? await QRCode.toString(`${appUrl}/clock/${token}`, {
          type: "svg",
          margin: 0,
          color: { dark: "#1b1b18", light: "#00000000" },
        })
      : "";

  return (
    <ClockKiosk
      token={token}
      valid={!!restaurant}
      tierLocked={restaurant ? restaurant.tier !== "FULL" : false}
      restaurantName={restaurant?.name ?? ""}
      qrSvg={qrSvg}
      hasSession={!!session}
    />
  );
}
