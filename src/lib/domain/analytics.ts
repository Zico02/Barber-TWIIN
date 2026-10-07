import type { Appointment, Barber } from "./types";
import { addDays, minutesBetween, zonedParts, SHOP_TZ } from "./time";

export interface Analytics {
  today: {
    total: number;
    completed: number;
    cancelled: number;
    noShows: number;
    walkIns: number;
    waiting: number;
    revenue: number;
  };
  weekRevenue: number;
  revenueByDay: { date: string; revenue: number; count: number }[]; // last 7 days
  topServices: { name: string; count: number }[];
  busiestWeekdays: { weekday: number; count: number }[];
  busiestHours: { hour: number; count: number }[];
  avgWaitMinutes: number | null;
  byBarber: { barberId: string; name: string; count: number; completed: number; revenue: number }[];
}

export const amountOf = (a: Appointment) => a.finalPrice ?? a.totalPrice;

export function computeAnalytics(
  appts: Appointment[],
  barbers: Barber[],
  now = new Date(),
  tz = SHOP_TZ,
): Analytics {
  const today = zonedParts(now, tz).date;
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const local = appts.map((a) => {
    const ref = a.startAt ?? a.queue?.arrivedAt ?? a.arrivedAt ?? a.createdAt;
    return { a, p: zonedParts(new Date(ref), tz) };
  });
  const todays = local.filter((x) => x.p.date === today).map((x) => x.a);
  const done = local.filter((x) => x.a.status === "completed");

  const revenueByDay = days.map((date) => {
    const list = done.filter((x) => x.p.date === date);
    return { date, revenue: list.reduce((s, x) => s + amountOf(x.a), 0), count: list.length };
  });

  const serviceCount = new Map<string, number>();
  for (const x of local) {
    if (x.a.status === "cancelled") continue;
    for (const s of x.a.services) serviceCount.set(s.name, (serviceCount.get(s.name) ?? 0) + 1);
  }

  const weekday = new Array(7).fill(0);
  const hours = new Map<number, number>();
  for (const x of local) {
    if (x.a.status === "cancelled") continue;
    weekday[x.p.weekday]++;
    const h = Math.floor(x.p.minutes / 60);
    hours.set(h, (hours.get(h) ?? 0) + 1);
  }

  const waits = appts
    .filter((a) => a.startedAt && (a.queue?.arrivedAt ?? a.arrivedAt))
    .map((a) => {
      const arrived = new Date(a.queue?.arrivedAt ?? a.arrivedAt!);
      // Walk-ins wait from arrival; booked clients from their appointment time if they came early.
      const ref = a.source !== "walk_in" && a.startAt && new Date(a.startAt) > arrived ? new Date(a.startAt) : arrived;
      return Math.max(0, minutesBetween(ref, new Date(a.startedAt!)));
    });

  return {
    today: {
      total: todays.filter((a) => a.status !== "cancelled").length,
      completed: todays.filter((a) => a.status === "completed").length,
      cancelled: todays.filter((a) => a.status === "cancelled").length,
      noShows: todays.filter((a) => a.status === "no_show").length,
      walkIns: todays.filter((a) => a.source === "walk_in").length,
      waiting: todays.filter((a) => a.status === "arrived" || a.status === "waiting").length,
      revenue: todays.filter((a) => a.status === "completed").reduce((s, a) => s + amountOf(a), 0),
    },
    weekRevenue: revenueByDay.reduce((s, d) => s + d.revenue, 0),
    revenueByDay,
    topServices: [...serviceCount.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6),
    busiestWeekdays: weekday.map((count, wd) => ({ weekday: wd, count })),
    busiestHours: [...hours.entries()].map(([hour, count]) => ({ hour, count })).sort((a, b) => a.hour - b.hour),
    avgWaitMinutes: waits.length ? Math.round(waits.reduce((s, w) => s + w, 0) / waits.length) : null,
    byBarber: barbers.map((b) => {
      const mine = local.filter((x) => x.a.barberId === b.id && x.a.status !== "cancelled");
      const completed = mine.filter((x) => x.a.status === "completed");
      return {
        barberId: b.id,
        name: b.name,
        count: mine.length,
        completed: completed.length,
        revenue: completed.reduce((s, x) => s + amountOf(x.a), 0),
      };
    }),
  };
}
