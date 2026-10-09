"use server";
// Barber "Ma journée" actions: add / edit / move / delete clients and change their state.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getRepo } from "@/lib/repo";
import { getSession } from "@/lib/auth/session";
import { assertCanActOn, assertStaff, can } from "@/lib/domain/permissions";
import { phoneSchema } from "@/lib/domain/validation";
import { canTransition, timestampFor } from "@/lib/domain/status";
import { DomainError } from "@/lib/domain/errors";
import type { AppointmentStatus, Session } from "@/lib/domain/types";
import type { AppointmentPatch } from "@/lib/repo/types";
import { safe } from "./_util";

const entrySchema = z.object({
  id: z.string().min(1).max(64).optional(),
  barberId: z.string().min(1).max(64),
  serviceIds: z.array(z.string().min(1).max(64)).min(1, "Choisissez au moins un service").max(8),
  startAt: z.string().datetime({ message: "Heure invalide" }),
  name: z.string().trim().min(2, "Nom trop court").max(80),
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  note: z.string().trim().max(500).optional(),
  extraMinutes: z.coerce.number().int().min(0).max(240).default(0),
  finalPrice: z.coerce.number().int().min(0).max(100_000).nullable().optional(),
});
export type DayEntryInput = z.input<typeof entrySchema>;

async function staff() {
  const session = await getSession();
  assertStaff(session);
  return session;
}

function assertOwnBarber(session: Session, barberId: string) {
  if (can(session, "appointments:all")) return;
  if (session.role === "barber" && session.barberId === barberId) return;
  throw new DomainError("FORBIDDEN");
}

const refresh = () => {
  revalidatePath("/dashboard", "layout");
  revalidatePath("/file-attente");
};

/** Create or edit a client of the day (services, time, extra time, note, final price). */
export async function saveDayEntryAction(input: DayEntryInput) {
  return safe(async () => {
    const session = await staff();
    const data = entrySchema.parse(input);
    assertOwnBarber(session, data.barberId);
    const repo = getRepo();
    if (data.id) {
      const existing = await repo.getAppointment(data.id);
      if (!existing) throw new DomainError("NOT_FOUND");
      assertCanActOn(session, existing);
    }
    const saved = await repo.staffSaveAppointment({
      id: data.id,
      barberId: data.barberId,
      serviceIds: data.serviceIds,
      startAt: new Date(data.startAt).toISOString(),
      name: data.name,
      phone: data.phone ?? null,
      note: data.note || null,
      extraMinutes: data.extraMinutes,
      finalPrice: data.finalPrice ?? null,
    });
    if (repo.mode === "demo")
      await repo.addAudit({ actorId: session.userId, actorName: session.name, action: data.id ? "day_entry_updated" : "day_entry_created", entity: "appointment", entityId: saved.id });
    refresh();
    return saved;
  }, input.id ? "Client mis à jour" : "Client ajouté");
}

/** Drag & drop: move a client to another time, keeping services and extra time. */
export async function moveDayEntryAction(input: { id: string; startAt: string; barberId?: string }) {
  return safe(async () => {
    const session = await staff();
    const repo = getRepo();
    const a = await repo.getAppointment(z.string().min(1).parse(input.id));
    if (!a) throw new DomainError("NOT_FOUND");
    assertCanActOn(session, a);
    const barberId = input.barberId ?? a.barberId;
    if (!barberId) throw new DomainError("INVALID_INPUT", "Choisissez un barbier.");
    assertOwnBarber(session, barberId);
    const servicesDuration = a.services.reduce((s, x) => s + x.durationMinutes, 0);
    const saved = await repo.staffSaveAppointment({
      id: a.id,
      barberId,
      serviceIds: a.services.map((s) => s.serviceId),
      startAt: new Date(z.string().datetime().parse(input.startAt)).toISOString(),
      name: a.customerName,
      phone: a.customerPhone || null,
      note: a.note ?? null,
      extraMinutes: Math.max(0, a.durationMinutes - servicesDuration),
      finalPrice: a.finalPrice,
    });
    refresh();
    return saved;
  }, "Horaire modifié");
}

export async function deleteDayEntryAction(id: string) {
  return safe(async () => {
    const session = await staff();
    const repo = getRepo();
    const a = await repo.getAppointment(z.string().min(1).parse(id));
    if (!a) throw new DomainError("NOT_FOUND");
    assertCanActOn(session, a);
    await repo.deleteAppointment(a.id);
    await repo.addAudit({ actorId: session.userId, actorName: session.name, action: "day_entry_deleted", entity: "appointment", entityId: a.id, details: { name: a.customerName, startAt: a.startAt } });
    refresh();
    return true;
  }, "Client supprimé");
}

/** Terminé (green) / En retard (orange) / Annulé (red); clicking the active state again restores "Confirmé". */
export async function setDayStatusAction(input: { id: string; status: AppointmentStatus }) {
  return safe(async () => {
    const session = await staff();
    const repo = getRepo();
    const a = await repo.getAppointment(z.string().min(1).parse(input.id));
    if (!a) throw new DomainError("NOT_FOUND");
    assertCanActOn(session, a);
    const target: AppointmentStatus = a.status === input.status ? (a.startAt ? "confirmed" : "waiting") : input.status;
    if (!canTransition(a.status, target)) throw new DomainError("INVALID_TRANSITION");
    const now = new Date().toISOString();
    const patch: AppointmentPatch = { status: target };
    const field = timestampFor(target);
    if (field && !a[field]) (patch as Record<string, string>)[field] = now;
    if (target === "completed") {
      patch.completedAt = now;
      if (!a.startedAt) patch.startedAt = a.startAt && new Date(a.startAt) < new Date() ? a.startAt : now;
    }
    if (target === "cancelled") patch.cancelReason = "Annulée par le barbier";
    // Leaving a final state (mis-tap correction): clear what it had recorded.
    if (a.status === "completed" && target !== "completed") patch.completedAt = null;
    if (a.status === "cancelled" && target !== "cancelled") Object.assign(patch, { cancelledAt: null, cancelReason: null, lateCancellation: false });
    if (!a.barberId && session.role === "barber") patch.barberId = session.barberId;
    const updated = await repo.updateAppointment(a.id, patch);
    await repo.addAudit({ actorId: session.userId, actorName: session.name, action: `status:${a.status}->${target}`, entity: "appointment", entityId: a.id });
    refresh();
    return updated;
  });
}
