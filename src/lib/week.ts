// Week boundaries (§6.1: "view is a week, not a month"). Weeks start Monday.

export function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const isoWeekday = d.getUTCDay() === 0 ? 7 : d.getUTCDay(); // 1 = Mon … 7 = Sun
  d.setUTCDate(d.getUTCDate() - (isoWeekday - 1));
  return d;
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60_000);
}
