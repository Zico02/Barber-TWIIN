import "server-only";
import { getRepo } from "@/lib/repo";
import { generateSlots, getWorkingWindow, isBarberWorking, type WorkingWindow } from "@/lib/domain/slots";
import { barbersForServices, buildServiceLines, totals } from "@/lib/domain/pricing";
import { addDays, dayBounds, todayInTz } from "@/lib/domain/time";
import { DomainError } from "@/lib/domain/errors";
import { estimateWaits } from "@/lib/domain/waiting";
import type { Appointment, Barber, Slot } from "@/lib/domain/types";

export interface SlotsResult {
  slots: Slot[];
  working: boolean;
  durationMinutes: number;
  totalPrice: number;
}

/** Available slots for a barber/date/services — server-side source of truth. */
export async function computeSlots(params: {
  barberId: string;
  date: string;
  serviceIds: string[];
  excludeAppointmentId?: string;
}): Promise<SlotsResult> {
  const repo = getRepo();
  const [shop, barber, services] = await Promise.all([repo.getShop(), repo.getBarber(params.barberId), repo.listServices()]);
  if (!barber || !barber.active) throw new DomainError("BARBER_UNAVAILABLE");
  const chosen = params.serviceIds.map((id) => services.find((s) => s.id === id));
  if (chosen.some((s) => !s) || !barbersForServices([barber], params.serviceIds).length)
    throw new DomainError("INVALID_INPUT", "Service indisponible avec ce barbier");

  const tz = shop.timezone;
  const today = todayInTz(tz);
  if (params.date < today || params.date > addDays(today, shop.settings.maxDaysAhead))
    return { slots: [], working: false, durationMinutes: 0, totalPrice: 0 };

  const lines = buildServiceLines(chosen as NonNullable<(typeof chosen)[number]>[], barber);
  const t = totals(lines);
  const { start, end } = dayBounds(params.date, tz);
  const [rules, exceptions, blocks, busy] = await Promise.all([
    repo.listAvailability(barber.id),
    repo.listExceptions(barber.id),
    repo.listBlocks({ barberId: barber.id, from: start, to: end }).catch(() => []),
    repo.getBusyIntervals(barber.id, start, end, params.excludeAppointmentId),
  ]);
  const working = isBarberWorking(params.date, rules, exceptions, blocks, tz);
  const slots = working
    ? generateSlots({
        date: params.date,
        tz,
        rules,
        exceptions,
        blocks,
        busy,
        durationMinutes: t.duration,
        stepMinutes: shop.settings.slotStepMinutes,
        minLeadMinutes: shop.settings.minLeadMinutes,
        now: new Date(),
      })
    : [];
  return { slots, working, durationMinutes: t.duration, totalPrice: t.price };
}

export interface LiveQueue {
  generatedAt: string;
  barbers: Barber[];
  appointments: Appointment[];
  windows: Record<string, WorkingWindow | null>;
  estimates: ReturnType<typeof estimateWaits>;
}

/**
 * Today's live queue with waiting estimates.
 * `publicView` uses the anonymized RPC (initials only, no phone numbers).
 */
export async function getLiveQueue(opts: { publicView: boolean }): Promise<LiveQueue> {
  const repo = getRepo();
  const shop = await repo.getShop();
  const tz = shop.timezone;
  const today = todayInTz(tz);
  const { start, end } = dayBounds(today, tz);
  const [barbers, rules, exceptions, appointments] = await Promise.all([
    repo.listBarbers(),
    repo.listAvailability(),
    repo.listExceptions(),
    opts.publicView ? repo.listPublicQueue(start, end) : repo.listAppointments({ from: start, to: end }),
  ]);
  const blocks = opts.publicView ? [] : await repo.listBlocks({ barberId: "all", from: start, to: end });
  const windows: Record<string, WorkingWindow | null> = {};
  for (const b of barbers) {
    const r = rules.filter((x) => x.barberId === b.id);
    const e = exceptions.filter((x) => x.barberId === b.id);
    const bl = blocks.filter((x) => x.barberId === b.id || x.barberId === null);
    windows[b.id] = isBarberWorking(today, r, e, bl, tz) ? getWorkingWindow(today, r, e, tz) : null;
  }
  const now = new Date();
  return {
    generatedAt: now.toISOString(),
    barbers,
    appointments,
    windows,
    estimates: estimateWaits({ barbers, appointments, windows, now, rules: { dueGraceMinutes: 5, lateGraceMinutes: shop.settings.lateGraceMinutes, overrunToleranceMinutes: 5 } }),
  };
}
