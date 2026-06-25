import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppHomeView } from "@/components/app/AppHomeView";

export const dynamic = "force-dynamic";

export default async function AppHome() {
  const session = await getSession();
  if (!session) redirect("/login");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId, endedAt: null },
    include: { restaurant: { select: { name: true } } },
  });

  // More than one restaurant and none chosen yet → pick first (§3.3).
  if (memberships.length > 1 && !session.activeRestaurantId) {
    redirect("/app/select");
  }

  const active =
    memberships.find((m) => m.restaurantId === session.activeRestaurantId) ??
    memberships[0] ??
    null;

  return (
    <AppHomeView
      restaurantName={active?.restaurant.name ?? null}
      role={active?.role ?? null}
    />
  );
}
