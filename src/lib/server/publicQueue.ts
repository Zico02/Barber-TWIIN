import "server-only";
import { getLiveQueue } from "./scheduling";
import { orderQueue } from "@/lib/domain/queue";
import type { AppointmentStatus } from "@/lib/domain/types";
import type { BarberLiveStatus } from "@/lib/domain/waiting";

/** Anonymized DTO — safe for public screens (no names, no phones, no references). */
export interface PublicQueueDTO {
  generatedAt: string;
  shopWaitMinutes: number | null;
  barbers: {
    id: string;
    name: string;
    status: BarberLiveStatus;
    delayMinutes: number;
    nextFreeMinutes: number | null;
    nextFreeAt: string | null;
    queueLength: number;
    current: { ticket: string | null; service: string; status: AppointmentStatus; startedAt: string | null; durationMinutes: number } | null;
  }[];
  entries: {
    ticket: string;
    initials: string;
    barberName: string | null;
    service: string;
    status: AppointmentStatus;
    waitMinutes: number | null;
    isNext: boolean;
  }[];
  /** Today's next booked clients (no ticket yet), soonest first — shown in « Suivant » without anyone tapping « Arrivé ». */
  upcoming: { id: string; startAt: string; barberName: string | null; service: string }[];
}

export async function getPublicQueue(): Promise<PublicQueueDTO> {
  const q = await getLiveQueue({ publicView: true });
  const now = new Date();
  const name = (id: string | null) => q.barbers.find((b) => b.id === id)?.name ?? null;
  const ordered = orderQueue(q.appointments, now).filter((e) => e.appointment.queue);
  // "Next" = first in line for each barber.
  const firstPerBarber = new Set<string>();
  const seen = new Set<string>();
  for (const e of ordered) {
    const key = e.appointment.barberId ?? "any";
    if (!seen.has(key)) {
      seen.add(key);
      firstPerBarber.add(e.appointment.id);
    }
  }
  const entries = [
    ...q.appointments.filter((a) => a.status === "called" && a.queue),
    ...ordered.map((e) => e.appointment),
  ].map((a) => ({
    ticket: a.queue!.ticketCode,
    initials: a.customerName,
    barberName: name(a.barberId),
    service: a.services.map((s) => s.name).join(" + "),
    status: a.status,
    waitMinutes: a.status === "called" ? 0 : (q.estimates.entries[a.id]?.waitMinutes ?? null),
    isNext: a.status === "called" || firstPerBarber.has(a.id),
  }));
  entries.sort((x, y) => (x.waitMinutes ?? 999) - (y.waitMinutes ?? 999));

  // Booked clients still to come today: not in the chair, no ticket yet, not more than 15 min late.
  const currentIds = new Set(Object.values(q.estimates.barbers).map((b) => b.current?.id).filter(Boolean));
  const upcoming = q.appointments
    .filter((a) => ["pending", "confirmed", "late"].includes(a.status) && a.startAt && !a.queue && !currentIds.has(a.id))
    .filter((a) => new Date(a.startAt!).getTime() > now.getTime() - 15 * 60_000)
    .sort((x, y) => +new Date(x.startAt!) - +new Date(y.startAt!))
    .slice(0, 6)
    .map((a) => ({ id: a.id, startAt: a.startAt!, barberName: name(a.barberId), service: a.services.map((s) => s.name).join(" + ") }));

  return {
    upcoming,
    generatedAt: q.generatedAt,
    shopWaitMinutes: q.estimates.shopWaitMinutes,
    barbers: q.barbers.map((b) => {
      const live = q.estimates.barbers[b.id];
      const cur = live?.current;
      return {
        id: b.id,
        name: b.name,
        status: live?.status ?? "off",
        delayMinutes: b.delayMinutes,
        nextFreeMinutes: live?.nextFreeMinutes ?? null,
        nextFreeAt: live?.nextFreeAt ?? null,
        queueLength: live?.queueLength ?? 0,
        current: cur
          ? { ticket: cur.queue?.ticketCode ?? null, service: cur.services.map((s) => s.name).join(" + "), status: cur.status, startedAt: cur.startedAt ?? null, durationMinutes: cur.durationMinutes }
          : null,
      };
    }),
    entries,
  };
}
