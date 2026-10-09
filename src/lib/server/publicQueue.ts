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

  return {
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
        queueLength: live?.queueLength ?? 0,
        current: cur
          ? { ticket: cur.queue?.ticketCode ?? null, service: cur.services.map((s) => s.name).join(" + "), status: cur.status, startedAt: cur.startedAt ?? null, durationMinutes: cur.durationMinutes }
          : null,
      };
    }),
    entries,
  };
}
