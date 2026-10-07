"use server";
import { getRepo } from "@/lib/repo";
import { computeSlots } from "@/lib/server/scheduling";
import {
  bookingSchema,
  lookupSchema,
  noteUpdateSchema,
  rescheduleSchema,
  reviewSchema,
  slotsQuerySchema,
  type BookingInput,
} from "@/lib/domain/validation";
import { DomainError } from "@/lib/domain/errors";
import { formatDateLong, formatTime, zonedParts } from "@/lib/domain/time";
import { renderTemplate } from "@/lib/domain/notifications";
import { safe } from "./_util";

const IMAGE_DATA_URL = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/;

export async function getSlotsAction(input: unknown) {
  return safe(async () => computeSlots(slotsQuerySchema.parse(input)));
}

/** Verifies that the exact start is still offered (friendly error before the atomic insert). */
async function assertStillAvailable(barberId: string, serviceIds: string[], startAt: string, tz: string, excludeAppointmentId?: string) {
  const iso = new Date(startAt).toISOString();
  const date = zonedParts(new Date(iso), tz).date;
  const { slots } = await computeSlots({ barberId, date, serviceIds, excludeAppointmentId });
  const slot = slots.find((s) => s.start === iso);
  if (!slot?.available) {
    throw slot?.reason === "booked"
      ? new DomainError("SLOT_TAKEN")
      : new DomainError("BARBER_UNAVAILABLE", "Ce créneau n'est plus disponible.");
  }
}

export async function createBookingAction(input: BookingInput) {
  return safe(async () => {
    const data = bookingSchema.parse(input);
    if (data.website) throw new DomainError("INVALID_INPUT", "Requête refusée");
    if (data.inspirationUrl && (!IMAGE_DATA_URL.test(data.inspirationUrl) || data.inspirationUrl.length > 2_000_000))
      throw new DomainError("INVALID_INPUT", "Image d'inspiration invalide (JPG, PNG ou WebP, 1,5 Mo max.)");

    const repo = getRepo();
    const shop = await repo.getShop();
    await assertStillAvailable(data.barberId, data.serviceIds, data.startAt, shop.timezone);

    const appt = await repo.createAppointment({
      barberId: data.barberId,
      serviceIds: data.serviceIds,
      startAt: new Date(data.startAt).toISOString(),
      customer: { name: data.name, phone: data.phone, email: data.email ?? null },
      note: data.note || null,
      inspirationUrl: data.inspirationUrl ?? null,
      source: "online",
    });
    const barber = await repo.getBarber(data.barberId);
    const vars = {
      name: data.name.split(" ")[0],
      barber: barber?.name ?? "",
      date: formatDateLong(appt.startAt!),
      time: formatTime(appt.startAt!),
      reference: appt.reference,
      shop: shop.name,
    };
    const message = renderTemplate("booking_confirmation", vars);
    // Outbox entry (sent by a provider when configured). Ignored if RLS forbids it for anonymous users.
    await repo
      .addNotification({ appointmentId: appt.id, customerId: appt.customerId, channel: "whatsapp", template: "booking_confirmation", to: data.phone, body: message, status: "queued" })
      .catch(() => undefined);

    return {
      reference: appt.reference,
      startAt: appt.startAt!,
      endAt: appt.endAt!,
      barberName: barber?.name ?? "",
      services: appt.services,
      totalPrice: appt.totalPrice,
      durationMinutes: appt.durationMinutes,
      customerName: data.name,
      shopWhatsapp: shop.whatsapp,
      message,
    };
  });
}

// ── Customer self-service (reference + phone) ──

async function withBarber(appt: Awaited<ReturnType<ReturnType<typeof getRepo>["lookupBooking"]>>) {
  if (!appt) throw new DomainError("NOT_FOUND", "Aucune réservation ne correspond à ces informations.");
  const repo = getRepo();
  const [barber, shop] = await Promise.all([appt.barberId ? repo.getBarber(appt.barberId) : null, repo.getShop()]);
  const upcoming = !!appt.startAt && new Date(appt.startAt) > new Date() && ["pending", "confirmed"].includes(appt.status);
  return {
    appointment: { ...appt, customerPhone: "" }, // never echo the phone back
    barberName: barber?.name ?? null,
    serviceIds: appt.services.map((s) => s.serviceId),
    canCancel: upcoming,
    canReschedule: upcoming,
    canReview: appt.status === "completed",
    freeUntilHours: shop.settings.cancellation.freeUntilHours,
  };
}

export async function lookupBookingAction(input: { reference: string; phone: string }) {
  return safe(async () => {
    const { reference, phone } = lookupSchema.parse(input);
    return withBarber(await getRepo().lookupBooking(reference, phone));
  });
}

export async function cancelBookingAction(input: { reference: string; phone: string }) {
  return safe(async () => {
    const { reference, phone } = lookupSchema.parse(input);
    const repo = getRepo();
    const shop = await repo.getShop();
    const appt = await repo.cancelByReference(reference, phone, shop.settings.cancellation.freeUntilHours);
    if (repo.mode === "demo")
      await repo.addAudit({ actorId: null, actorName: "client", action: "customer_cancel", entity: "appointment", entityId: appt.id });
    return withBarber(appt);
  }, "Réservation annulée");
}

export async function rescheduleBookingAction(input: { reference: string; phone: string; startAt: string }) {
  return safe(async () => {
    const data = rescheduleSchema.parse(input);
    const repo = getRepo();
    const current = await repo.lookupBooking(data.reference, data.phone);
    if (!current || !current.barberId) throw new DomainError("NOT_FOUND");
    const shop = await repo.getShop();
    await assertStillAvailable(current.barberId, current.services.map((s) => s.serviceId), data.startAt, shop.timezone, current.id);
    const appt = await repo.rescheduleByReference(data.reference, data.phone, new Date(data.startAt).toISOString());
    return withBarber(appt);
  }, "Rendez-vous modifié avec succès");
}

export async function updateBookingNoteAction(input: { reference: string; phone: string; note: string }) {
  return safe(async () => {
    const data = noteUpdateSchema.parse(input);
    return withBarber(await getRepo().updateNoteByReference(data.reference, data.phone, data.note));
  }, "Note enregistrée");
}

export async function submitReviewAction(input: unknown) {
  return safe(async () => {
    const data = reviewSchema.parse(input);
    await getRepo().submitReview(data.reference, data.phone, data.ratings, data.comment);
    return true;
  }, "Merci ! Votre avis sera publié après validation.");
}
