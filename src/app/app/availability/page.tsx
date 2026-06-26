import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { getAvailability } from "@/lib/availability";
import { AvailabilityView } from "@/components/schedule/AvailabilityView";

export const dynamic = "force-dynamic";

export default async function AvailabilityPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeRestaurantId) redirect("/app/select");

  const ranges = await getAvailability(session.userId, session.activeRestaurantId);

  return (
    <AvailabilityView
      initialRanges={ranges.map((r) => ({
        weekday: r.weekday,
        startMinute: r.startMinute,
        endMinute: r.endMinute,
      }))}
    />
  );
}
