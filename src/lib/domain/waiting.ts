import type { Appointment, Barber } from "./types";
import type { WorkingWindow } from "./slots";
import { orderQueue, DEFAULT_QUEUE_RULES, type QueueRules } from "./queue";
import { addMinutes, minutesBetween } from "./time";

const SCHEDULED: Appointment["status"][] = ["pending", "confirmed", "late"];

export type BarberLiveStatus = "free" | "busy" | "break" | "off";

export interface BarberLive {
  barberId: string;
  status: BarberLiveStatus;
  current: Appointment | null;
  queueLength: number;
  /** Approx. minutes until this barber can take a NEW walk-in. */
  nextFreeMinutes: number | null;
  /** Exact moment behind `nextFreeMinutes` (ISO), for live countdowns. */
  nextFreeAt: string | null;
}

export interface EntryEstimate {
  appointmentId: string;
  barberId: string | null;
  position: number; // 1-based position in this barber's queue
  waitMinutes: number; // rounded, approximate
}

export interface WaitEstimates {
  entries: Record<string, EntryEstimate>;
  barbers: Record<string, BarberLive>;
  /** Shortest approximate wait for a new walk-in across working barbers. */
  shopWaitMinutes: number | null;
}

export function roundWait(min: number) {
  return Math.max(0, Math.ceil(min / 5) * 5);
}

/** Moves t out of a break if [t, t+dur) overlaps one. */
function skipBreaks(t: Date, dur: number, breaks: { start: Date; end: Date }[]) {
  let moved = true;
  while (moved) {
    moved = false;
    for (const b of breaks) {
      if (t < b.end && addMinutes(t, dur) > b.start) {
        t = b.end;
        moved = true;
      }
    }
  }
  return t;
}

/**
 * Approximate waiting times. Considers: service in progress & its remaining time,
 * customers already waiting, upcoming booked appointments, barber delays and breaks.
 */
export function estimateWaits(params: {
  barbers: Barber[];
  appointments: Appointment[]; // today's appointments (all barbers)
  windows: Record<string, WorkingWindow | null>;
  now: Date;
  rules?: QueueRules;
}): WaitEstimates {
  const { barbers, appointments, windows, now } = params;
  const rules = params.rules ?? DEFAULT_QUEUE_RULES;
  const entries: Record<string, EntryEstimate> = {};
  const live: Record<string, BarberLive> = {};
  const cursor: Record<string, Date> = {};
  const upcomingBy: Record<string, Appointment[]> = {};

  const consumeUpcoming = (barberId: string, t: Date, dur: number) => {
    const list = upcomingBy[barberId];
    while (list.length && new Date(list[0].startAt!) < addMinutes(t, dur)) {
      const a = list.shift()!;
      const s = new Date(a.startAt!);
      t = addMinutes(t > s ? t : s, a.durationMinutes);
    }
    return t;
  };

  for (const b of barbers) {
    const w = windows[b.id];
    const mine = appointments.filter((a) => a.barberId === b.id);
    // In the chair: started / called, or a booked client whose slot is happening now.
    const current =
      mine.find((a) => a.status === "in_progress") ??
      mine.find((a) => a.status === "called") ??
      mine.find((a) => SCHEDULED.includes(a.status) && a.startAt && a.endAt && new Date(a.startAt) <= now && new Date(a.endAt) > now) ??
      null;
    // Before opening or after closing the barber counts as off (no live estimate).
    const working = !!w && now >= w.start && now < w.end;
    const onBreak = !!w && w.breaks.some((br) => now >= br.start && now < br.end);

    let t = new Date(Math.max(now.getTime(), w && now < w.start ? w.start.getTime() : now.getTime()));
    if (current) {
      // A booked client ends at the booked end time (the barber's planning), even if the chair
      // timer started a bit late; walk-ins end « start + duration ». Overrunning = about to free up.
      const started = new Date(current.startedAt ?? current.startAt ?? now.toISOString());
      const end = current.endAt ? new Date(current.endAt) : addMinutes(started, current.durationMinutes);
      const remaining = Math.max(1, minutesBetween(now, end));
      t = addMinutes(now, current.status === "called" ? current.durationMinutes : remaining);
    }
    t = addMinutes(t, b.delayMinutes || 0);
    if (w) t = skipBreaks(t, 1, w.breaks);
    cursor[b.id] = t;

    upcomingBy[b.id] = mine
      .filter((a) => SCHEDULED.includes(a.status) && a.startAt && a.id !== current?.id)
      .filter((a) => new Date(a.startAt!) > addMinutes(now, -rules.lateGraceMinutes))
      .sort((x, y) => +new Date(x.startAt!) - +new Date(y.startAt!));

    live[b.id] = {
      barberId: b.id,
      status: !working ? "off" : onBreak ? "break" : current ? "busy" : "free",
      current,
      queueLength: 0,
      nextFreeMinutes: null,
      nextFreeAt: null,
    };
  }

  const working = barbers.filter((b) => live[b.id].status !== "off");

  // 1) Clients assigned to a specific barber.
  for (const b of working) {
    const queue = orderQueue(appointments, now, b.id, rules).filter((e) => e.appointment.barberId === b.id);
    const breaks = windows[b.id]?.breaks ?? [];
    queue.forEach((e, i) => {
      const a = e.appointment;
      let t = consumeUpcoming(b.id, cursor[b.id], a.durationMinutes);
      t = skipBreaks(t, a.durationMinutes, breaks);
      entries[a.id] = {
        appointmentId: a.id,
        barberId: b.id,
        position: i + 1,
        waitMinutes: roundWait(minutesBetween(now, t) + (a.queue?.waitAdjustMinutes ?? 0)),
      };
      cursor[b.id] = addMinutes(t, a.durationMinutes);
    });
    live[b.id].queueLength = queue.length;
  }

  // 2) "Any barber" walk-ins go to whoever frees up first.
  const anyQueue = orderQueue(appointments, now, undefined, rules).filter((e) => e.appointment.barberId === null);
  for (const e of anyQueue) {
    if (!working.length) break;
    const a = e.appointment;
    let best: { id: string; t: Date } | null = null;
    for (const b of working) {
      let t = consumeUpcomingPreview(upcomingBy[b.id], cursor[b.id], a.durationMinutes);
      t = skipBreaks(t, a.durationMinutes, windows[b.id]?.breaks ?? []);
      if (!best || t < best.t) best = { id: b.id, t };
    }
    const t = consumeUpcoming(best!.id, cursor[best!.id], a.durationMinutes);
    live[best!.id].queueLength += 1;
    entries[a.id] = {
      appointmentId: a.id,
      barberId: null,
      position: live[best!.id].queueLength,
      waitMinutes: roundWait(minutesBetween(now, t) + (a.queue?.waitAdjustMinutes ?? 0)),
    };
    cursor[best!.id] = addMinutes(t, a.durationMinutes);
  }

  // 3) When could each barber take a new 30-minute walk-in?
  let shop: number | null = null;
  for (const b of working) {
    const w = windows[b.id]!;
    let t = consumeUpcomingPreview(upcomingBy[b.id], cursor[b.id], 30);
    t = skipBreaks(t, 30, w.breaks);
    if (addMinutes(t, 30) > w.end) continue;
    // Exact minutes for « Libre dans X min »; the shop-wide estimate stays rounded to 5.
    const exact = Math.max(0, Math.ceil(minutesBetween(now, t)));
    live[b.id].nextFreeMinutes = exact;
    live[b.id].nextFreeAt = t.toISOString();
    const m = roundWait(exact);
    shop = shop === null ? m : Math.min(shop, m);
  }

  return { entries, barbers: live, shopWaitMinutes: shop };
}

function consumeUpcomingPreview(list: Appointment[], t: Date, dur: number) {
  for (const a of list) {
    const s = new Date(a.startAt!);
    if (s < addMinutes(t, dur)) t = addMinutes(t > s ? t : s, a.durationMinutes);
    else break;
  }
  return t;
}
