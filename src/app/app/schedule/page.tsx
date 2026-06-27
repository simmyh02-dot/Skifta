import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAccessContext } from "@/lib/guard";
import { can } from "@/lib/authz";
import { listWeek } from "@/lib/shifts";
import { startOfWeek } from "@/lib/week";
import { prisma } from "@/lib/prisma";
import { ScheduleView } from "@/components/schedule/ScheduleView";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ctx = await getAccessContext(
    session.userId,
    session.activeRestaurantId,
  );
  if (!ctx) redirect("/app");

  const weekStart = startOfWeek(new Date());
  const [shifts, restaurant] = await Promise.all([
    listWeek(session.activeRestaurantId, weekStart),
    prisma.restaurant.findUnique({
      where: { id: session.activeRestaurantId },
      select: { openShiftFill: true },
    }),
  ]);

  return (
    <ScheduleView
      userId={session.userId}
      role={ctx.role}
      initialWeekStart={weekStart.toISOString()}
      initialShifts={JSON.parse(JSON.stringify(shifts))}
      openShiftFill={restaurant?.openShiftFill ?? "MANUAL_PICK"}
      canClock={can(ctx, "clock:viewOwn")}
      canAiSchedule={can(ctx, "ai:schedule")}
    />
  );
}
