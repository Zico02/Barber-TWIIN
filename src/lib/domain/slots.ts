import type {
  Appointment,
  AvailabilityException,
  AvailabilityRule,
  BlockedPeriod,
  Slot,
} from "./types";
import { ACTIVE_STATUSES } from "./types";
import { addMinutes, overlaps, weekdayOf, zonedToUtc, SHOP_TZ } from "./time";

export interface Interval {
  start: Date;
  end: Date;
  label?: string;
}

export interface WorkingWindow {
  start: Date;
  end: Date;
  breaks: Interval[];
}

/**
 * Working window for a barber on a local date.
 * An exception for that date overrides the weekly rule (and has no breaks).
 */
export function getWorkingWindow(
  date: string,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[],
  tz = SHOP_TZ,
): WorkingWindow | null {
  const exception = exceptions.find((e) => e.date === date);
  if (exception) {
    return {
      start: zonedToUtc(date, exception.start, tz),
      end: zonedToUtc(date, exception.end, tz),
      breaks: [],
    };
  }
  const rule = rules.find((r) => r.weekday === weekdayOf(date));
  if (!rule) return null;
  return {
    start: zonedToUtc(date, rule.start, tz),
    end: zonedToUtc(date, rule.end, tz),
    breaks: rule.breaks.map((b) => ({
      start: zonedToUtc(date, b.start, tz),
      end: zonedToUtc(date, b.end, tz),
      label: b.label,
    })),
  };
}

/** Time ranges an appointment occupies in the barber's calendar. */
export function busyIntervals(appointments: Appointment[], now = new Date()): Interval[] {
  const out: Interval[] = [];
  for (const a of appointments) {
    if (!ACTIVE_STATUSES.includes(a.status)) continue;
    if (a.startAt && a.endAt) {
      out.push({ start: new Date(a.startAt), end: new Date(a.endAt) });
    } else if (a.status === "in_progress" && a.startedAt) {
      // A walk-in already in the chair blocks the time it will actually take.
      const s = new Date(a.startedAt);
      const e = addMinutes(s, a.durationMinutes);
      if (e > now) out.push({ start: s, end: e });
    }
  }
  return out;
}

export interface SlotContext {
  date: string;
  tz?: string;
  rules: AvailabilityRule[];
  exceptions: AvailabilityException[];
  blocks: BlockedPeriod[];
  busy: Interval[];
  durationMinutes: number;
  stepMinutes: number;
  minLeadMinutes: number;
  now: Date;
}

export type RangeCheck =
  | { ok: true }
  | { ok: false; reason: NonNullable<Slot["reason"]> | "closed" };

/**
 * Checks that the COMPLETE period [start, start + duration) is bookable,
 * not only its first slot.
 */
export function checkRange(ctx: SlotContext, start: Date, window?: WorkingWindow | null): RangeCheck {
  const w = window === undefined ? getWorkingWindow(ctx.date, ctx.rules, ctx.exceptions, ctx.tz) : window;
  if (!w) return { ok: false, reason: "closed" };
  const end = addMinutes(start, ctx.durationMinutes);
  if (start < addMinutes(ctx.now, ctx.minLeadMinutes)) return { ok: false, reason: "past" };
  if (start < w.start || end > w.end) return { ok: false, reason: "closing" };
  if (w.breaks.some((b) => overlaps(start, end, b.start, b.end))) return { ok: false, reason: "break" };
  if (ctx.blocks.some((b) => overlaps(start, end, new Date(b.startAt), new Date(b.endAt))))
    return { ok: false, reason: "blocked" };
  if (ctx.busy.some((b) => overlaps(start, end, b.start, b.end))) return { ok: false, reason: "booked" };
  return { ok: true };
}

export function generateSlots(ctx: SlotContext): Slot[] {
  const w = getWorkingWindow(ctx.date, ctx.rules, ctx.exceptions, ctx.tz);
  if (!w) return [];
  const slots: Slot[] = [];
  for (let t = w.start; addMinutes(t, ctx.stepMinutes) <= w.end; t = addMinutes(t, ctx.stepMinutes)) {
    const res = checkRange(ctx, t, w);
    // Hide starts that only fail because of breaks/closing; they are noise for customers.
    slots.push({
      start: t.toISOString(),
      end: addMinutes(t, ctx.durationMinutes).toISOString(),
      available: res.ok,
      reason: res.ok ? undefined : res.reason === "closed" ? "closing" : res.reason,
    });
  }
  return slots;
}

/** Whether the barber has any working time at all on that date (ignoring bookings). */
export function isBarberWorking(
  date: string,
  rules: AvailabilityRule[],
  exceptions: AvailabilityException[],
  blocks: BlockedPeriod[],
  tz = SHOP_TZ,
) {
  const w = getWorkingWindow(date, rules, exceptions, tz);
  if (!w) return false;
  return !blocks.some((b) => new Date(b.startAt) <= w.start && new Date(b.endAt) >= w.end);
}
