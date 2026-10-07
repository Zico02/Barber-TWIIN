"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { getSession } from "@/lib/auth/session";
import { assertCanManageBarber, assertStaff, can } from "@/lib/domain/permissions";
import { blockSchema, exceptionSchema, weeklyAvailabilitySchema } from "@/lib/domain/validation";
import { DomainError } from "@/lib/domain/errors";
import { addDays, formatDateLong, formatTime, overlaps, zonedToUtc } from "@/lib/domain/time";
import { renderTemplate } from "@/lib/domain/notifications";
import { whatsappLink } from "@/lib/domain/phone";
import { safe } from "./_util";

async function staff() {
  const session = await getSession();
  assertStaff(session);
  return { session, repo: getRepo() };
}

const refresh = () => revalidatePath("/dashboard", "layout");

export async function saveWeeklyAvailabilityAction(input: z.input<typeof weeklyAvailabilitySchema>) {
  return safe(async () => {
    const { session, repo } = await staff();
    const data = weeklyAvailabilitySchema.parse(input);
    assertCanManageBarber(session, data.barberId);
    await repo.replaceWeeklyAvailability(data.barberId, data.days);
    await repo.addAudit({ actorId: session.userId, actorName: session.name, action: "weekly_availability_saved", entity: "barber", entityId: data.barberId });
    refresh();
    return true;
  }, "Horaires hebdomadaires enregistrés");
}

/**
 * Blocks a day / time range / vacation. If confirmed bookings are affected, the first call
 * returns them (code CONFLICTS) and nothing changes; the barber must confirm to cancel them.
 */
export async function addBlockAction(input: z.input<typeof blockSchema>) {
  return safe(async () => {
    const { session, repo } = await staff();
    const data = blockSchema.parse(input);
    if (data.barberId) assertCanManageBarber(session, data.barberId);
    else if (!can(session, "availability:all")) throw new DomainError("FORBIDDEN");

    const shop = await repo.getShop();
    const tz = shop.timezone;
    const ranged = data.kind === "time_block" || data.kind === "break";
    const start = ranged ? zonedToUtc(data.startDate, data.startTime!, tz) : zonedToUtc(data.startDate, "00:00", tz);
    const end = ranged ? zonedToUtc(data.endDate, data.endTime!, tz) : zonedToUtc(addDays(data.endDate, 1), "00:00", tz);
    if (end <= start) throw new DomainError("INVALID_INPUT", "Période invalide");

    const affected = (
      await repo.listAppointments({ barberId: data.barberId ?? "all", from: addDays0(start), to: end, statuses: ["pending", "confirmed"] })
    ).filter((a) => a.startAt && a.endAt && (data.barberId === null || a.barberId === data.barberId) && overlaps(new Date(a.startAt), new Date(a.endAt), start, end));

    if (affected.length && !data.confirmCancellations) {
      throw new DomainError("CONFLICTS", `${affected.length} réservation(s) seront annulées. Confirmez pour continuer.`, {
        affected: affected.map((a) => ({ id: a.id, customerName: a.customerName, startAt: a.startAt, services: a.services.map((s) => s.name).join(", ") })),
      });
    }

    const block = await repo.addBlock({ barberId: data.barberId, kind: data.kind, startAt: start.toISOString(), endAt: end.toISOString(), reason: data.reason ?? null });
    const notices: { customerName: string; url: string | null }[] = [];
    for (const a of affected) {
      await repo.updateAppointment(a.id, { status: "cancelled", cancelledAt: new Date().toISOString(), cancelReason: `Indisponibilité : ${data.reason ?? data.kind}` });
      const barber = a.barberId ? await repo.getBarber(a.barberId) : null;
      const body = renderTemplate("cancellation", {
        name: a.customerName.split(" ")[0], barber: barber?.name, date: formatDateLong(a.startAt!), time: formatTime(a.startAt!),
        link: `${process.env.NEXT_PUBLIC_SITE_URL ?? ""}/reservation`,
      });
      if (a.customerPhone)
        await repo.addNotification({ appointmentId: a.id, customerId: a.customerId, channel: "whatsapp", template: "cancellation", to: a.customerPhone, body, status: "queued" });
      notices.push({ customerName: a.customerName, url: a.customerPhone ? whatsappLink(a.customerPhone, body) : null });
    }
    await repo.addAudit({ actorId: session.userId, actorName: session.name, action: "block_added", entity: "blocked_period", entityId: block.id, details: { cancelled: affected.length } });
    refresh();
    return { block, cancelled: notices };
  }, "Période bloquée");
}

// Appointments are listed by their start time; include those starting just before `start`.
function addDays0(d: Date) {
  return new Date(d.getTime() - 12 * 3600_000);
}

export async function deleteBlockAction(id: string) {
  return safe(async () => {
    const { session, repo } = await staff();
    const all = await repo.listBlocks({ barberId: "all", from: new Date(0), to: new Date("2100-01-01") });
    const block = all.find((b) => b.id === id);
    if (!block) throw new DomainError("NOT_FOUND");
    if (block.barberId) assertCanManageBarber(session, block.barberId);
    else if (!can(session, "availability:all")) throw new DomainError("FORBIDDEN");
    await repo.deleteBlock(id);
    refresh();
    return true;
  }, "Période débloquée");
}

export async function addExceptionAction(input: z.input<typeof exceptionSchema>) {
  return safe(async () => {
    const { session, repo } = await staff();
    const data = exceptionSchema.parse(input);
    assertCanManageBarber(session, data.barberId);
    const x = await repo.addException({ barberId: data.barberId, date: data.date, start: data.start, end: data.end, note: data.note ?? null });
    refresh();
    return x;
  }, "Disponibilité exceptionnelle ajoutée");
}

export async function deleteExceptionAction(input: { id: string; barberId: string }) {
  return safe(async () => {
    const { session, repo } = await staff();
    assertCanManageBarber(session, input.barberId);
    const list = await repo.listExceptions(input.barberId);
    if (!list.some((e) => e.id === input.id)) throw new DomainError("NOT_FOUND");
    await repo.deleteException(input.id);
    refresh();
    return true;
  }, "Exception supprimée");
}
