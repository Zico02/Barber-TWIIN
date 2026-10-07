import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Appointment,
  AuditLog,
  AvailabilityException,
  AvailabilityRule,
  Barber,
  BlockedPeriod,
  Customer,
  NotificationRecord,
  PortfolioImage,
  QueueTicket,
  Review,
  Service,
  Shop,
} from "@/lib/domain/types";
import { DomainError, type DomainErrorCode } from "@/lib/domain/errors";
import { supabaseServer } from "@/lib/supabase/server";
import type { AppointmentQuery, Repo } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;

// ── Error mapping: RPC exception names / Postgres codes → domain errors ──
const RPC_ERRORS: Record<string, [DomainErrorCode, string]> = {
  SLOT_TAKEN: ["SLOT_TAKEN", "Ce créneau vient d'être réservé"],
  BARBER_UNAVAILABLE: ["BARBER_UNAVAILABLE", "Le barbier n'est pas disponible à cette heure"],
  OUTSIDE_HOURS: ["OUTSIDE_HOURS", "Hors des horaires du barbier"],
  SLOT_IN_PAST: ["INVALID_INPUT", "Ce créneau est déjà passé"],
  INVALID_PHONE: ["INVALID_INPUT", "Numéro de téléphone invalide"],
  SERVICE_UNAVAILABLE: ["INVALID_INPUT", "Service indisponible avec ce barbier"],
  INVALID_INPUT: ["INVALID_INPUT", "Données invalides"],
  NOT_FOUND: ["NOT_FOUND", "Réservation introuvable"],
  INVALID_TRANSITION: ["INVALID_TRANSITION", "Action impossible pour ce statut"],
  FORBIDDEN: ["FORBIDDEN", "Accès refusé"],
};

function fail(error: { code?: string; message?: string } | null): never {
  const msg = error?.message ?? "";
  if (error?.code === "23P01") throw new DomainError("SLOT_TAKEN", RPC_ERRORS.SLOT_TAKEN[1]);
  if (error?.code === "23505" && msg.includes("reviews")) throw new DomainError("INVALID_INPUT", "Vous avez déjà laissé un avis pour cette visite");
  if (error?.code === "42501") throw new DomainError("FORBIDDEN", "Accès refusé");
  const known = Object.keys(RPC_ERRORS).find((k) => msg.includes(k));
  if (known) throw new DomainError(RPC_ERRORS[known][0], RPC_ERRORS[known][1]);
  console.error("[supabase]", error);
  throw new DomainError("INVALID_INPUT", "Erreur serveur, veuillez réessayer");
}

async function run<T>(p: PromiseLike<{ data: T; error: any }>): Promise<T> {
  const { data, error } = await p;
  if (error) fail(error);
  return data;
}

// ── Row → domain mappers ──
const hm = (t: string) => t.slice(0, 5);

const toShop = (r: Row): Shop => ({
  id: r.id, name: r.name, tagline: r.tagline ?? "", address: r.address ?? "", city: r.city ?? "",
  phone: r.phone ?? "", whatsapp: r.whatsapp ?? "", email: r.email ?? "", mapsQuery: r.maps_query ?? "",
  lat: r.lat, lng: r.lng, socials: r.socials, hours: r.hours, timezone: r.timezone, settings: r.settings,
});

const toBarber = (r: Row): Barber => ({
  id: r.id, slug: r.slug, name: r.name, title: r.title, bio: r.bio, specialties: r.specialties ?? [],
  experienceYears: r.experience_years, rating: Number(r.rating), reviewCount: r.review_count,
  photoUrl: r.photo_url, introPhotoUrl: r.intro_photo_url ?? null, phone: r.phone ?? null, socials: r.socials ?? {}, active: r.active, delayMinutes: r.delay_minutes,
  sortOrder: r.sort_order,
  serviceIds: (r.barber_services ?? []).map((x: Row) => x.service_id),
  durationOverrides: Object.fromEntries(
    (r.barber_services ?? []).filter((x: Row) => x.duration_override).map((x: Row) => [x.service_id, x.duration_override]),
  ),
});

const toService = (r: Row): Service => ({
  id: r.id, slug: r.slug, name: r.name, description: r.description, price: r.price, priceFrom: r.price_from ?? false,
  durationMinutes: r.duration_minutes, category: r.category, icon: r.icon, imageUrl: r.image_url,
  active: r.active, sortOrder: r.sort_order,
});

const toQueue = (r: Row | null | undefined): QueueTicket | null =>
  r
    ? {
        id: r.id ?? `q-${r.appointment_id}`, appointmentId: r.appointment_id, ticketNumber: r.ticket_number,
        ticketCode: r.ticket_code, arrivedAt: r.arrived_at, priority: r.priority ?? 0,
        bumpMinutes: r.bump_minutes ?? 0, waitAdjustMinutes: r.wait_adjust_minutes ?? 0,
      }
    : null;

const one = (v: any) => (Array.isArray(v) ? v[0] : v);

const toAppointment = (r: Row): Appointment => ({
  id: r.id, reference: r.reference ?? "", barberId: r.barber_id, customerId: r.customer_id ?? "",
  customerName: r.customer_name ?? r.initials ?? "", customerPhone: r.customer_phone ?? "",
  customerEmail: r.customer_email ?? null,
  services: ((r.appointment_services ?? r.services ?? []) as Row[])
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map((s) => ({ serviceId: s.service_id ?? "", name: s.name, price: s.price ?? 0, durationMinutes: s.duration_minutes })),
  startAt: r.start_at, endAt: r.end_at, durationMinutes: r.duration_minutes, totalPrice: r.total_price ?? 0,
  finalPrice: r.final_price ?? null, status: r.status, source: r.source, note: r.note ?? null,
  inspirationUrl: r.inspiration_url ?? null, lateCancellation: r.late_cancellation ?? false,
  cancelReason: r.cancel_reason ?? null, createdAt: r.created_at, updatedAt: r.updated_at ?? r.created_at,
  confirmedAt: r.confirmed_at ?? null, arrivedAt: r.arrived_at ?? null, calledAt: r.called_at ?? null,
  startedAt: r.started_at ?? null, completedAt: r.completed_at ?? null, cancelledAt: r.cancelled_at ?? null,
  queue: toQueue(one(r.walk_in_queue ?? r.queue) ? { appointment_id: r.id, ...one(r.walk_in_queue ?? r.queue) } : null),
});

const toCustomer = (r: Row): Customer => ({
  id: r.id, name: r.name, phone: r.phone ?? "", email: r.email, notes: r.notes,
  preferredBarberId: r.preferred_barber_id, archived: r.archived, anonymized: r.anonymized, createdAt: r.created_at,
});

const toReview = (r: Row): Review => ({
  id: r.id, appointmentId: r.appointment_id, barberId: r.barber_id, authorName: r.author_name,
  ratings: { barber: r.rating_barber, quality: r.rating_quality, waiting: r.rating_waiting, cleanliness: r.rating_cleanliness, overall: r.rating_overall },
  comment: r.comment, status: r.status, featured: r.featured, createdAt: r.created_at,
});

const toPortfolio = (r: Row): PortfolioImage => ({
  id: r.id, barberId: r.barber_id, category: r.category, title: r.title, description: r.description,
  imageUrl: r.image_url, art: r.art, date: r.taken_on, instagramUrl: r.instagram_url,
});

const toBlock = (r: Row): BlockedPeriod => {
  // tstzrange text: ["2026-10-04 10:00:00+00","2026-10-04 12:00:00+00")
  const [s, e] = String(r.period).replace(/[[\]()"]/g, "").split(",");
  return { id: r.id, barberId: r.barber_id, kind: r.kind, startAt: new Date(s).toISOString(), endAt: new Date(e).toISOString(), reason: r.reason };
};

const APPT_SELECT = "*, appointment_services(*), walk_in_queue(*)";

let shopIdCache: string | null = null;

export function createSupabaseRepo(clientFactory: () => Promise<SupabaseClient> = supabaseServer as any): Repo {
  const db = () => clientFactory();
  const shopId = async () => {
    if (shopIdCache) return shopIdCache;
    const r = await run((await db()).from("shops").select("id").order("created_at").limit(1).single());
    return (shopIdCache = (r as Row).id as string);
  };

  const repo: Repo = {
    mode: "supabase",

    async getShop() {
      return toShop((await run((await db()).from("shops").select("*").order("created_at").limit(1).single())) as Row);
    },
    async listBarbers(opts) {
      let q = (await db()).from("barbers").select("*, barber_services(service_id, duration_override)").order("sort_order");
      if (!opts?.includeInactive) q = q.eq("active", true);
      return ((await run(q)) as Row[]).map(toBarber);
    },
    async getBarber(id) {
      const r = await run((await db()).from("barbers").select("*, barber_services(service_id, duration_override)").eq("id", id).maybeSingle());
      return r ? toBarber(r) : null;
    },
    async getBarberBySlug(slug) {
      const r = await run((await db()).from("barbers").select("*, barber_services(service_id, duration_override)").eq("slug", slug).eq("active", true).maybeSingle());
      return r ? toBarber(r) : null;
    },
    async updateBarber(id, patch) {
      await run((await db()).from("barbers").update({ delay_minutes: patch.delayMinutes, bio: patch.bio, specialties: patch.specialties }).eq("id", id));
    },
    async listServices(opts) {
      let q = (await db()).from("services").select("*").order("sort_order");
      if (!opts?.includeInactive) q = q.eq("active", true);
      return ((await run(q)) as Row[]).map(toService);
    },
    async upsertService(input, barberIds) {
      const c = await db();
      const row: Row = {
        shop_id: await shopId(), name: input.name, description: input.description, price: input.price,
        duration_minutes: input.durationMinutes, price_from: input.priceFrom, category: input.category, icon: input.icon, active: input.active,
        ...(input.id ? { id: input.id } : { slug: input.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-") }),
      };
      const saved = (await run(c.from("services").upsert(row).select("*").single())) as Row;
      await run(c.from("barber_services").delete().eq("service_id", saved.id).not("barber_id", "in", `(${barberIds.join(",") || "00000000-0000-0000-0000-000000000000"})`));
      if (barberIds.length)
        await run(c.from("barber_services").upsert(barberIds.map((b) => ({ barber_id: b, service_id: saved.id })), { ignoreDuplicates: true }));
      return toService(saved);
    },

    async listAvailability(barberId) {
      let q = (await db()).from("availability").select("*");
      if (barberId) q = q.eq("barber_id", barberId);
      return ((await run(q)) as Row[]).map(
        (r): AvailabilityRule => ({ id: r.id, barberId: r.barber_id, weekday: r.weekday, start: hm(r.start_time), end: hm(r.end_time), breaks: r.breaks ?? [] }),
      );
    },
    async replaceWeeklyAvailability(barberId, rules) {
      const c = await db();
      await run(c.from("availability").delete().eq("barber_id", barberId));
      if (rules.length)
        await run(c.from("availability").insert(rules.map((r) => ({ barber_id: barberId, weekday: r.weekday, start_time: r.start, end_time: r.end, breaks: r.breaks }))));
    },
    async listExceptions(barberId) {
      let q = (await db()).from("availability_exceptions").select("*").order("date");
      if (barberId) q = q.eq("barber_id", barberId);
      return ((await run(q)) as Row[]).map(
        (r): AvailabilityException => ({ id: r.id, barberId: r.barber_id, date: r.date, start: hm(r.start_time), end: hm(r.end_time), note: r.note }),
      );
    },
    async addException(e) {
      const r = (await run(
        (await db()).from("availability_exceptions").upsert({ barber_id: e.barberId, date: e.date, start_time: e.start, end_time: e.end, note: e.note }, { onConflict: "barber_id,date" }).select("*").single(),
      )) as Row;
      return { id: r.id, barberId: r.barber_id, date: r.date, start: hm(r.start_time), end: hm(r.end_time), note: r.note };
    },
    async deleteException(id) {
      await run((await db()).from("availability_exceptions").delete().eq("id", id));
    },
    async listBlocks({ barberId, from, to }) {
      let q = (await db()).from("blocked_periods").select("*").overlaps("period", `[${from.toISOString()},${to.toISOString()})`);
      if (barberId && barberId !== "all") q = q.or(`barber_id.eq.${barberId},barber_id.is.null`);
      return ((await run(q)) as Row[]).map(toBlock);
    },
    async addBlock(b) {
      const r = (await run(
        (await db()).from("blocked_periods").insert({ shop_id: await shopId(), barber_id: b.barberId, kind: b.kind, period: `[${b.startAt},${b.endAt})`, reason: b.reason }).select("*").single(),
      )) as Row;
      return toBlock(r);
    },
    async deleteBlock(id) {
      const r = (await run((await db()).from("blocked_periods").delete().eq("id", id).select("*").maybeSingle())) as Row | null;
      return r ? toBlock(r) : null;
    },
    async getBusyIntervals(barberId, from, to, excludeAppointmentId) {
      const rows = (await run(
        (await db()).rpc("barber_busy_intervals", { p_barber_id: barberId, p_from: from.toISOString(), p_to: to.toISOString(), p_exclude: excludeAppointmentId ?? null }),
      )) as Row[];
      return rows.map((r) => ({ start: new Date(r.start_at), end: new Date(r.end_at) }));
    },

    async listAppointments(q: AppointmentQuery) {
      let query = (await db()).from("appointments").select(APPT_SELECT);
      if (q.statuses) query = query.in("status", q.statuses);
      if (q.customerId) query = query.eq("customer_id", q.customerId);
      if (q.customerIds) query = query.in("customer_id", q.customerIds);
      if (q.from && q.to) {
        const f = q.from.toISOString();
        const t = q.to.toISOString();
        query = query.or(`and(start_at.gte.${f},start_at.lt.${t}),and(start_at.is.null,arrived_at.gte.${f},arrived_at.lt.${t})`);
      } else if (q.from) {
        query = query.or(`start_at.gte.${q.from.toISOString()},and(start_at.is.null,arrived_at.gte.${q.from.toISOString()})`);
      }
      const rows = ((await run(query.limit(5000))) as Row[]).map(toAppointment);
      const scoped = q.barberId && q.barberId !== "all" ? rows.filter((a) => a.barberId === q.barberId || a.barberId === null) : rows;
      const ref = (a: Appointment) => +new Date(a.startAt ?? a.queue?.arrivedAt ?? a.arrivedAt ?? a.createdAt);
      return scoped.sort((a, b) => ref(a) - ref(b));
    },
    async getAppointment(id) {
      const r = await run((await db()).from("appointments").select(APPT_SELECT).eq("id", id).maybeSingle());
      return r ? toAppointment(r) : null;
    },
    async createAppointment(input) {
      const r = (await run(
        (await db()).rpc("book_appointment", {
          p_barber_id: input.barberId, p_service_ids: input.serviceIds, p_start: input.startAt,
          p_name: input.customer.name, p_phone: input.customer.phone, p_email: input.customer.email ?? null,
          p_note: input.note ?? null, p_inspiration_url: input.inspirationUrl ?? null, p_source: input.source,
        }),
      )) as Row;
      // Return what the RPC created (services are embedded via a second read for the customer flow).
      const full = await repo.lookupBooking(r.reference, input.customer.phone);
      return full ?? toAppointment(r);
    },
    async createWalkIn(input) {
      const id = (await run(
        (await db()).rpc("create_walk_in", {
          p_barber_id: input.barberId, p_service_ids: input.serviceIds, p_name: input.customer.name,
          p_phone: input.customer.phone ?? null, p_note: input.note ?? null, p_arrived_at: input.arrivedAt, p_priority: input.priority,
        }),
      )) as string;
      return (await repo.getAppointment(id))!;
    },
    async updateAppointment(id, patch) {
      const c = await db();
      const map: Row = {};
      const keys: Record<string, string> = {
        status: "status", barberId: "barber_id", note: "note", finalPrice: "final_price", totalPrice: "total_price",
        durationMinutes: "duration_minutes", startAt: "start_at", endAt: "end_at", lateCancellation: "late_cancellation",
        cancelReason: "cancel_reason", confirmedAt: "confirmed_at", arrivedAt: "arrived_at", calledAt: "called_at",
        startedAt: "started_at", completedAt: "completed_at", cancelledAt: "cancelled_at",
      };
      for (const [k, v] of Object.entries(patch)) if (keys[k]) map[keys[k]] = v;
      if (Object.keys(map).length) await run(c.from("appointments").update(map).eq("id", id));
      if (patch.services) {
        await run(c.from("appointment_services").delete().eq("appointment_id", id));
        await run(
          c.from("appointment_services").insert(
            patch.services.map((s, i) => ({ appointment_id: id, service_id: s.serviceId, name: s.name, price: s.price, duration_minutes: s.durationMinutes, position: i })),
          ),
        );
      }
      if (patch.barberId !== undefined) await run(c.from("walk_in_queue").update({ barber_id: patch.barberId }).eq("appointment_id", id));
      const a = await repo.getAppointment(id);
      if (!a) throw new DomainError("NOT_FOUND");
      return a;
    },
    async staffSaveAppointment(input) {
      const id = (await run(
        (await db()).rpc("staff_save_appointment", {
          p_id: input.id ?? null, p_barber_id: input.barberId, p_service_ids: input.serviceIds, p_start: input.startAt,
          p_name: input.name, p_phone: input.phone ?? null, p_note: input.note ?? null,
          p_extra_minutes: input.extraMinutes, p_final_price: input.finalPrice ?? null,
        }),
      )) as string;
      return (await repo.getAppointment(id))!;
    },
    async deleteAppointment(id) {
      await run((await db()).from("appointments").delete().eq("id", id));
    },
    async ensureQueueTicket(appointmentId, arrivedAt, priority = 0) {
      const r = (await run((await db()).rpc("ensure_queue_ticket", { p_appointment_id: appointmentId, p_arrived_at: arrivedAt, p_priority: priority }))) as Row;
      return toQueue(r)!;
    },
    async updateQueueTicket(appointmentId, patch) {
      await run(
        (await db())
          .from("walk_in_queue")
          .update({ priority: patch.priority, bump_minutes: patch.bumpMinutes, wait_adjust_minutes: patch.waitAdjustMinutes })
          .eq("appointment_id", appointmentId),
      );
    },

    async lookupBooking(reference, phone) {
      const r = (await run((await db()).rpc("lookup_booking", { p_reference: reference, p_phone: phone }))) as Row | null;
      return r ? toAppointment(r) : null;
    },
    async cancelByReference(reference, phone) {
      return toAppointment((await run((await db()).rpc("cancel_booking", { p_reference: reference, p_phone: phone }))) as Row);
    },
    async rescheduleByReference(reference, phone, startAt) {
      return toAppointment((await run((await db()).rpc("reschedule_booking", { p_reference: reference, p_phone: phone, p_start: startAt }))) as Row);
    },
    async updateNoteByReference(reference, phone, note) {
      return toAppointment((await run((await db()).rpc("update_booking_note", { p_reference: reference, p_phone: phone, p_note: note }))) as Row);
    },
    async submitReview(reference, phone, ratings, comment) {
      return toReview(
        (await run(
          (await db()).rpc("submit_review", {
            p_reference: reference, p_phone: phone, p_barber: ratings.barber, p_quality: ratings.quality,
            p_waiting: ratings.waiting, p_cleanliness: ratings.cleanliness, p_overall: ratings.overall, p_comment: comment,
          }),
        )) as Row,
      );
    },
    async listPublicQueue(from, to) {
      const rows = (await run((await db()).rpc("public_queue", { p_from: from.toISOString(), p_to: to.toISOString() }))) as Row[];
      return (rows ?? []).map(toAppointment);
    },

    async listCustomers(q) {
      let query = (await db()).from("customers").select("*").order("name");
      if (!q?.includeArchived) query = query.eq("archived", false);
      if (q?.ids) query = query.in("id", q.ids.length ? q.ids : ["00000000-0000-0000-0000-000000000000"]);
      return ((await run(query)) as Row[]).map(toCustomer);
    },
    async getCustomer(id) {
      const r = await run((await db()).from("customers").select("*").eq("id", id).maybeSingle());
      return r ? toCustomer(r) : null;
    },
    async updateCustomer(id, patch) {
      await run(
        (await db()).from("customers").update({ name: patch.name, email: patch.email, notes: patch.notes, archived: patch.archived, preferred_barber_id: patch.preferredBarberId }).eq("id", id),
      );
    },
    async anonymizeCustomer(id) {
      await run((await db()).rpc("anonymize_customer", { p_customer_id: id }));
    },
    async deleteCustomer(id) {
      // Appointments reference customers (on delete restrict) so history survives: anonymize instead.
      await repo.anonymizeCustomer(id);
    },

    async listPortfolio(q) {
      let query = (await db()).from("portfolio_images").select("*").order("taken_on", { ascending: false });
      if (q?.barberId) query = query.eq("barber_id", q.barberId);
      return ((await run(query)) as Row[]).map(toPortfolio);
    },
    async upsertPortfolio(p) {
      const row: Row = {
        shop_id: await shopId(), barber_id: p.barberId, category: p.category, title: p.title, description: p.description,
        instagram_url: p.instagramUrl ?? null, art: p.art ?? null,
        ...(p.imageUrl ? { image_url: p.imageUrl } : {}),
        ...(p.id ? { id: p.id } : {}),
      };
      return toPortfolio((await run((await db()).from("portfolio_images").upsert(row).select("*").single())) as Row);
    },
    async deletePortfolio(id) {
      const r = (await run((await db()).from("portfolio_images").delete().eq("id", id).select("*").maybeSingle())) as Row | null;
      if (r?.storage_path) await (await db()).storage.from("portfolio").remove([r.storage_path]);
      return r ? toPortfolio(r) : null;
    },
    async uploadImage(file, folder) {
      const c = await db();
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      const path = `${folder}/${crypto.randomUUID()}.${ext}`;
      const { error } = await c.storage.from("portfolio").upload(path, file, { contentType: file.type, upsert: false });
      if (error) fail(error as any);
      return c.storage.from("portfolio").getPublicUrl(path).data.publicUrl;
    },

    async listReviews(q) {
      let query = (await db()).from("reviews").select("*").order("created_at", { ascending: false });
      if (q?.status) query = query.eq("status", q.status);
      if (q?.featured !== undefined) query = query.eq("featured", q.featured);
      if (q?.barberId) query = query.eq("barber_id", q.barberId);
      return ((await run(query)) as Row[]).map(toReview);
    },
    async updateReview(id, patch) {
      await run((await db()).from("reviews").update(patch).eq("id", id));
    },

    async addNotification(n) {
      const r = (await run(
        (await db())
          .from("notifications")
          .insert({ shop_id: await shopId(), appointment_id: n.appointmentId, customer_id: n.customerId || null, channel: n.channel, template: n.template, recipient: n.to, body: n.body, status: n.status })
          .select("*")
          .single(),
      )) as Row;
      return { ...n, id: r.id, createdAt: r.created_at };
    },
    async listNotifications(limit = 50) {
      const rows = (await run((await db()).from("notifications").select("*").order("created_at", { ascending: false }).limit(limit))) as Row[];
      return rows.map(
        (r): NotificationRecord => ({ id: r.id, appointmentId: r.appointment_id, customerId: r.customer_id, channel: r.channel, template: r.template, to: r.recipient, body: r.body, status: r.status, createdAt: r.created_at }),
      );
    },
    async addAudit(a) {
      const c = await db();
      const { data } = await c.auth.getUser();
      await run(c.from("audit_logs").insert({ shop_id: await shopId(), actor_id: data.user?.id ?? null, actor_name: a.actorName, action: a.action, entity: a.entity, entity_id: a.entityId, details: a.details ?? null }));
    },
    async listAudit(limit = 50) {
      const rows = (await run((await db()).from("audit_logs").select("*").order("created_at", { ascending: false }).limit(limit))) as Row[];
      return rows.map(
        (r): AuditLog => ({ id: r.id, actorId: r.actor_id, actorName: r.actor_name, action: r.action, entity: r.entity, entityId: r.entity_id, details: r.details, createdAt: r.created_at }),
      );
    },
  };
  return repo;
}
