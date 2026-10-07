"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { getSession } from "@/lib/auth/session";
import { assertCanActOn, assertStaff, can, resolveBarberScope } from "@/lib/domain/permissions";
import { appointmentEditSchema, statusChangeSchema, walkInSchema } from "@/lib/domain/validation";
import { canTransition, timestampFor } from "@/lib/domain/status";
import { DomainError } from "@/lib/domain/errors";
import { bumpToMoveLower, orderQueue, pickNext } from "@/lib/domain/queue";
import { buildServiceLines, totals } from "@/lib/domain/pricing";
import { addMinutes, dayBounds, formatDateLong, formatTime, todayInTz } from "@/lib/domain/time";
import { renderTemplate } from "@/lib/domain/notifications";
import { whatsappLink } from "@/lib/domain/phone";
import type { Appointment, AppointmentStatus, NotificationTemplate, Session } from "@/lib/domain/types";
import type { AppointmentPatch } from "@/lib/repo/types";
import { computeSlots } from "@/lib/server/scheduling";
import { safe } from "./_util";

async function staff() {
  const session = await getSession();
  assertStaff(session);
  return { session, repo: getRepo() };
}

async function load(id: string, session: Session) {
  const appt = await getRepo().getAppointment(id);
  if (!appt) throw new DomainError("NOT_FOUND");
  assertCanActOn(session, appt);
  return appt;
}

function refresh() {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/file-attente");
}

async function audit(session: Session, action: string, entityId: string, details?: Record<string, unknown>) {
  await getRepo().addAudit({ actorId: session.userId, actorName: session.name, action, entity: "appointment", entityId, details });
}

async function todays() {
  const repo = getRepo();
  const shop = await repo.getShop();
  const { start, end } = dayBounds(todayInTz(shop.timezone), shop.timezone);
  return { shop, list: await repo.listAppointments({ from: start, to: end }) };
}

/** Moves an appointment to a new status (used by buttons and drag & drop). */
export async function changeStatusAction(input: { appointmentId: string; status: AppointmentStatus; reason?: string; barberId?: string }) {
  return safe(async () => {
    const { session, repo } = await staff();
    const data = statusChangeSchema.parse(input);
    const appt = await load(data.appointmentId, session);
    if (!canTransition(appt.status, data.status)) throw new DomainError("INVALID_TRANSITION");
    const now = new Date().toISOString();
    const patch: AppointmentPatch = { status: data.status };

    // Assign "any barber" walk-ins when they are called / started.
    let barberId = appt.barberId;
    if (!barberId && ["called", "in_progress"].includes(data.status)) {
      barberId = session.role === "barber" ? session.barberId : (input.barberId ?? null);
      if (!barberId) throw new DomainError("INVALID_INPUT", "Choisissez le barbier qui prend ce client.");
      patch.barberId = barberId;
    }
    if (data.status === "in_progress" && barberId) {
      const { list } = await todays();
      if (list.some((a) => a.barberId === barberId && a.status === "in_progress" && a.id !== appt.id))
        throw new DomainError("BARBER_BUSY");
    }

    // Record the timestamp of the new status — original times are never overwritten.
    const field = timestampFor(data.status);
    if (field && !appt[field]) (patch as Record<string, string>)[field] = now;
    if (data.status === "cancelled") patch.cancelReason = data.reason ?? "Annulée par le salon";
    if (data.status === "completed") patch.completedAt = now;

    const updated = await repo.updateAppointment(appt.id, patch);
    if (["arrived", "waiting"].includes(data.status) && !appt.queue) await repo.ensureQueueTicket(appt.id, appt.arrivedAt ?? now);
    await audit(session, `status:${appt.status}->${data.status}`, appt.id, data.reason ? { reason: data.reason } : undefined);
    refresh();
    return updated;
  });
}

/** Selects and calls the correct next customer for a barber. */
export async function callNextAction(input: { barberId?: string }) {
  return safe(async () => {
    const { session, repo } = await staff();
    const scope = resolveBarberScope(session, input.barberId);
    if (scope === "all") throw new DomainError("INVALID_INPUT", "Choisissez un barbier.");
    const { shop, list } = await todays();
    const pick = pickNext(scope, list, new Date(), { dueGraceMinutes: 5, lateGraceMinutes: shop.settings.lateGraceMinutes, overrunToleranceMinutes: 5 });
    if (pick.reason === "busy") throw new DomainError("BARBER_BUSY");
    if (!pick.next) throw new DomainError("QUEUE_EMPTY");
    const updated = await repo.updateAppointment(pick.next.id, {
      status: "called",
      calledAt: new Date().toISOString(),
      ...(pick.next.barberId ? {} : { barberId: scope }),
    });
    const barber = await repo.getBarber(scope);
    const body = renderTemplate("barber_ready", { name: updated.customerName.split(" ")[0], barber: barber?.name, shop: shop.name });
    await audit(session, "call_next", updated.id, { reason: pick.reason, skipped: pick.skipped.map((s) => s.appointment.id) });
    refresh();
    return {
      appointment: updated,
      reason: pick.reason,
      skipped: pick.skipped.length,
      whatsappUrl: updated.customerPhone ? whatsappLink(updated.customerPhone, body) : null,
    };
  });
}

export async function addWalkInAction(input: z.input<typeof walkInSchema>) {
  return safe(async () => {
    const { session, repo } = await staff();
    const data = walkInSchema.parse(input);
    if (session.role === "barber" && data.barberId && data.barberId !== session.barberId) throw new DomainError("FORBIDDEN");
    const appt = await repo.createWalkIn({
      barberId: data.barberId,
      serviceIds: data.serviceIds,
      customer: { name: data.name, phone: data.phone ?? null },
      note: data.note || null,
      arrivedAt: data.arrivedAt ?? new Date().toISOString(),
      priority: data.priority,
    });
    await audit(session, "walk_in_added", appt.id);
    refresh();
    return appt;
  }, "Client sans rendez-vous ajouté");
}

/** Moves a client one place lower without touching the original arrival time. */
export async function moveLowerAction(appointmentId: string) {
  return safe(async () => {
    const { session, repo } = await staff();
    const appt = await load(appointmentId, session);
    if (!appt.queue) throw new DomainError("INVALID_INPUT", "Ce client n'est pas dans la file.");
    const { list } = await todays();
    const ordered = orderQueue(list, new Date(), appt.barberId ?? undefined);
    const bump = bumpToMoveLower(appt, ordered);
    if (bump === null) throw new DomainError("INVALID_INPUT", "Ce client est déjà le dernier de la file.");
    await repo.updateQueueTicket(appt.id, { bumpMinutes: bump });
    await audit(session, "moved_lower", appt.id, { bumpMinutes: bump });
    refresh();
    return true;
  });
}

export async function editAppointmentAction(input: z.input<typeof appointmentEditSchema>) {
  return safe(async () => {
    const { session, repo } = await staff();
    const data = appointmentEditSchema.parse(input);
    const appt = await load(data.appointmentId, session);
    const patch: AppointmentPatch = {};
    if (data.note !== undefined) patch.note = data.note || null;
    if (data.finalPrice !== undefined) patch.finalPrice = data.finalPrice;
    if (data.serviceIds) {
      const [services, barber] = await Promise.all([repo.listServices({ includeInactive: true }), appt.barberId ? repo.getBarber(appt.barberId) : null]);
      const chosen = data.serviceIds.map((id) => services.find((s) => s.id === id));
      if (chosen.some((s) => !s)) throw new DomainError("INVALID_INPUT", "Service inconnu");
      const lines = buildServiceLines(chosen as NonNullable<(typeof chosen)[number]>[], barber);
      const t = totals(lines);
      Object.assign(patch, { services: lines, totalPrice: t.price, durationMinutes: t.duration });
      if (appt.startAt) patch.endAt = addMinutes(new Date(appt.startAt), t.duration).toISOString();
    }
    const updated = Object.keys(patch).length ? await repo.updateAppointment(appt.id, patch) : appt;
    if (appt.queue && (data.waitAdjustMinutes !== undefined || data.priority !== undefined))
      await repo.updateQueueTicket(appt.id, { waitAdjustMinutes: data.waitAdjustMinutes, priority: data.priority });
    await audit(session, "edited", appt.id, { ...data, appointmentId: undefined });
    refresh();
    return updated;
  }, "Modifications enregistrées");
}

export async function rescheduleStaffAction(input: { appointmentId: string; startAt: string }) {
  return safe(async () => {
    const { session, repo } = await staff();
    const appt = await load(input.appointmentId, session);
    if (!appt.barberId || !["pending", "confirmed"].includes(appt.status)) throw new DomainError("INVALID_TRANSITION");
    const shop = await repo.getShop();
    const iso = new Date(z.string().datetime().parse(input.startAt)).toISOString();
    const { slots } = await computeSlots({
      barberId: appt.barberId,
      date: new Intl.DateTimeFormat("en-CA", { timeZone: shop.timezone }).format(new Date(iso)),
      serviceIds: appt.services.map((s) => s.serviceId),
      excludeAppointmentId: appt.id,
    });
    if (!slots.find((s) => s.start === iso)?.available) throw new DomainError("SLOT_TAKEN");
    const updated = await repo.updateAppointment(appt.id, { startAt: iso, endAt: addMinutes(new Date(iso), appt.durationMinutes).toISOString() });
    await audit(session, "rescheduled", appt.id, { from: appt.startAt, to: iso });
    refresh();
    return updated;
  }, "Rendez-vous déplacé");
}

export async function setDelayAction(input: { barberId?: string; minutes: number }) {
  return safe(async () => {
    const { session, repo } = await staff();
    const scope = resolveBarberScope(session, input.barberId);
    if (scope === "all") throw new DomainError("INVALID_INPUT", "Choisissez un barbier.");
    const minutes = z.number().int().min(0).max(240).parse(input.minutes);
    await repo.updateBarber(scope, { delayMinutes: minutes });
    refresh();
    return minutes;
  }, "Retard mis à jour");
}

/**
 * Prepares a customer message (confirmation, reminder, cancellation…), stores it in the
 * notification outbox and returns a ready-to-send WhatsApp / SMS / e-mail link.
 */
export async function prepareMessageAction(input: { appointmentId: string; template: NotificationTemplate; channel: "whatsapp" | "sms" | "email" }) {
  return safe(async () => {
    const { session, repo } = await staff();
    const appt = await load(input.appointmentId, session);
    const [shop, barber] = await Promise.all([repo.getShop(), appt.barberId ? repo.getBarber(appt.barberId) : null]);
    const site = process.env.NEXT_PUBLIC_SITE_URL ?? "";
    const body = renderTemplate(input.template, {
      name: appt.customerName.split(" ")[0],
      barber: barber?.name ?? "notre équipe",
      date: appt.startAt ? formatDateLong(appt.startAt) : "aujourd'hui",
      time: appt.startAt ? formatTime(appt.startAt) : "",
      reference: appt.reference,
      delay: barber?.delayMinutes ? `${barber.delayMinutes} min` : "quelques minutes",
      shop: shop.name,
      link: input.template === "review_request" ? `${site}/ma-reservation?ref=${appt.reference}` : `${site}/reservation`,
    });
    const to = input.channel === "email" ? (appt.customerEmail ?? "") : appt.customerPhone;
    if (!to) throw new DomainError("INVALID_INPUT", input.channel === "email" ? "Aucun e-mail pour ce client." : "Aucun téléphone pour ce client.");
    await repo.addNotification({ appointmentId: appt.id, customerId: appt.customerId, channel: input.channel, template: input.template, to, body, status: "manual" });
    const url =
      input.channel === "whatsapp"
        ? whatsappLink(to, body)
        : input.channel === "sms"
          ? `sms:${to}?&body=${encodeURIComponent(body)}`
          : `mailto:${to}?subject=${encodeURIComponent(shop.name)}&body=${encodeURIComponent(body)}`;
    return { url, body };
  });
}

/** Today's board data for the dashboard (client refresh / realtime). */
export async function canSeeRevenue() {
  return can(await getSession(), "revenue:view");
}

export type BoardAppointment = Appointment;
