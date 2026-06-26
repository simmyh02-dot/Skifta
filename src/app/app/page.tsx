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
  }

  redirect("/app/schedule");
}
