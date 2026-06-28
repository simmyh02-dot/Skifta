import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const session = await getSession();
  if (!session) redirect("/login");

  // More than one restaurant and none chosen yet → pick first (§3.3).
  if (!session.activeRestaurantId) {
    const count = await prisma.membership.count({
      where: { userId: session.userId, endedAt: null },
    });
    if (count > 1) redirect("/app/select");
  } else {
    // Frozen account (§12.1): trial ended, no card on file — login itself
    // isn't blocked (the session is still valid), but every page beyond this
    // one is, so route here first rather than letting each page 404/loop.
    const restaurant = await prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: { subscriptionStatus: true },
    });
    if (restaurant?.subscriptionStatus === "FROZEN") redirect("/app/frozen");
  }

  redirect("/app/schedule");
}
