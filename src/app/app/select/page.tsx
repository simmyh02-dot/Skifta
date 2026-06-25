import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Logo } from "@/components/ui/Logo";
import { LangToggle } from "@/components/landing/LangToggle";
import { RestaurantPicker } from "@/components/auth/RestaurantPicker";

export const dynamic = "force-dynamic";

export default async function SelectRestaurantPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const memberships = await prisma.membership.findMany({
    where: { userId: session.userId, endedAt: null },
    include: { restaurant: { select: { name: true } } },
  });

  // Nothing to pick between → straight to the app.
  if (memberships.length <= 1) redirect("/app");

  const restaurants = memberships.map((m) => ({
    id: m.restaurantId,
    name: m.restaurant.name,
    role: m.role,
  }));

  return (
    <div className="flex min-h-full flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5">
        <Logo />
        <LangToggle />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <RestaurantPicker restaurants={restaurants} />
      </main>
    </div>
  );
}
