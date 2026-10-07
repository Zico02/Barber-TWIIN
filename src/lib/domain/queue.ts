import type { Appointment } from "./types";
import { PRESENT_WAITING } from "./types";
import { addMinutes } from "./time";

export interface QueueRules {
  /** An appointment becomes "due" this many minutes before its start. */
  dueGraceMinutes: number;
  /** Arriving later than this after the appointment start loses priority. */
  lateGraceMinutes: number;
  /** A walk-in may overrun the next booked appointment by at most this. */
  overrunToleranceMinutes: number;
}

export const DEFAULT_QUEUE_RULES: QueueRules = {
  dueGraceMinutes: 5,
  lateGraceMinutes: 15,
  overrunToleranceMinutes: 5,
};

export type QueueClass = 0 | 1;

export interface RankedEntry {
  appointment: Appointment;
  cls: QueueClass; // 0 = due appointment, 1 = everyone else
  key: number; // ms timestamp used for ordering inside the class
  priority: number;
  isLateAppointment: boolean;
  arrivedAt: number;
}

export function arrivalOf(a: Appointment) {
  return new Date(a.queue?.arrivedAt ?? a.arrivedAt ?? a.createdAt).getTime();
}

export function isScheduled(a: Appointment) {
  return a.source !== "walk_in" && !!a.startAt;
}

export function rankEntry(a: Appointment, now: Date, rules = DEFAULT_QUEUE_RULES): RankedEntry {
  const arrivedAt = arrivalOf(a);
  const bump = (a.queue?.bumpMinutes ?? 0) * 60_000;
  const priority = a.queue?.priority ?? 0;
  if (isScheduled(a)) {
    const start = new Date(a.startAt!).getTime();
    const late = arrivedAt - start > rules.lateGraceMinutes * 60_000;
    if (!late) {
      const due = start <= now.getTime() + rules.dueGraceMinutes * 60_000;
      // Due holders go first by appointment time; early arrivals compete with
      // walk-ins using their appointment time as key.
      return { appointment: a, cls: due ? 0 : 1, key: start + bump, priority, isLateAppointment: false, arrivedAt };
    }
    return { appointment: a, cls: 1, key: arrivedAt + bump, priority, isLateAppointment: true, arrivedAt };
  }
  return { appointment: a, cls: 1, key: arrivedAt + bump, priority, isLateAppointment: false, arrivedAt };
}

export function compareRanked(x: RankedEntry, y: RankedEntry) {
  return x.cls - y.cls || y.priority - x.priority || x.key - y.key || x.arrivedAt - y.arrivedAt;
}

/** Ordered waiting queue (present clients only) for a barber, including "any barber" walk-ins. */
export function orderQueue(
  appointments: Appointment[],
  now: Date,
  barberId?: string | null,
  rules = DEFAULT_QUEUE_RULES,
): RankedEntry[] {
  return appointments
    .filter((a) => PRESENT_WAITING.includes(a.status))
    .filter((a) => barberId === undefined || a.barberId === barberId || a.barberId === null)
    .map((a) => rankEntry(a, now, rules))
    .sort(compareRanked);
}

export interface NextPick {
  next: Appointment | null;
  reason: "due_appointment" | "arrival_order" | "priority" | "no_fit_fallback" | "empty" | "busy";
  skipped: { appointment: Appointment; why: "would_overrun_next_booking" }[];
}

/**
 * Selects the correct next customer for a barber:
 * due appointments → priority → arrival order, skipping walk-ins that would make
 * the barber late for an upcoming booked client (unless nobody fits).
 */
export function pickNext(
  barberId: string,
  appointments: Appointment[],
  now: Date,
  rules = DEFAULT_QUEUE_RULES,
): NextPick {
  const mine = appointments.filter((a) => a.barberId === barberId);
  if (mine.some((a) => a.status === "in_progress" || a.status === "called")) {
    return { next: null, reason: "busy", skipped: [] };
  }
  const queue = orderQueue(appointments, now, barberId, rules);
  if (!queue.length) return { next: null, reason: "empty", skipped: [] };

  const nextBooking = mine
    .filter((a) => ["pending", "confirmed", "late"].includes(a.status) && a.startAt)
    .map((a) => new Date(a.startAt!))
    .filter((d) => d > now)
    .sort((a, b) => a.getTime() - b.getTime())[0];

  const skipped: NextPick["skipped"] = [];
  for (const entry of queue) {
    const a = entry.appointment;
    if (entry.cls === 0) return { next: a, reason: "due_appointment", skipped };
    if (nextBooking) {
      const finish = addMinutes(now, a.durationMinutes);
      if (finish > addMinutes(nextBooking, rules.overrunToleranceMinutes)) {
        skipped.push({ appointment: a, why: "would_overrun_next_booking" });
        continue;
      }
    }
    return { next: a, reason: entry.priority > 0 ? "priority" : "arrival_order", skipped };
  }
  return { next: queue[0].appointment, reason: "no_fit_fallback", skipped };
}

/**
 * Bump needed to move `target` just after the following entry in the ordered queue.
 * Returns null when it is already last.
 */
export function bumpToMoveLower(target: Appointment, ordered: RankedEntry[]): number | null {
  const idx = ordered.findIndex((e) => e.appointment.id === target.id);
  if (idx < 0 || idx === ordered.length - 1) return null;
  const me = ordered[idx];
  const below = ordered[idx + 1];
  const deltaMin = Math.max(1, Math.ceil((below.key - me.key) / 60_000) + 1);
  return (target.queue?.bumpMinutes ?? 0) + deltaMin;
}

/** Ticket code, e.g. B12. */
export function ticketCode(n: number) {
  return `B${n}`;
}

/** Initials for public display ("Youssef Amrani" → "Y. A."). */
export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => `${p[0]!.toUpperCase()}.`)
    .join(" ");
}
