// In-memory repository for DEMO MODE (no Supabase configured).
// Mirrors the guarantees of the Supabase implementation (atomic overlap check,
// phone verification on by-reference operations) so behaviour is identical.
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
import { ACTIVE_STATUSES } from "@/lib/domain/types";
import { DomainError } from "@/lib/domain/errors";
import { addMinutes, overlaps, zonedParts, minutesBetween } from "@/lib/domain/time";
import { busyIntervals, checkRange } from "@/lib/domain/slots";
import { buildServiceLines, totals } from "@/lib/domain/pricing";
import { initials, ticketCode } from "@/lib/domain/queue";
import { newId, newReference } from "@/lib/domain/reference";
import type { AppointmentQuery, Repo } from "./types";
import {
  buildDemoData,
  seedAvailability,
  seedBarbers,
  seedPortfolio,
  seedServices,
  seedShop,
} from "./seed";

interface Store {
  shop: Shop;
  barbers: Barber[];
  services: Service[];
  availability: AvailabilityRule[];
  exceptions: AvailabilityException[];
  blocks: BlockedPeriod[];
  customers: Customer[];
  appointments: Appointment[];
  portfolio: PortfolioImage[];
  reviews: Review[];
  notifications: NotificationRecord[];
  audit: AuditLog[];
  ticketCounter: Record<string, number>;
}

const g = globalThis as unknown as { __btStore?: Store };

function store(): Store {
  if (!g.__btStore) {
    const demo = buildDemoData();
    g.__btStore = {
      shop: structuredClone(seedShop),
      barbers: structuredClone(seedBarbers),
      services: structuredClone(seedServices),
      availability: structuredClone(seedAvailability),
      exceptions: demo.exceptions,
      blocks: [],
      customers: demo.customers,
      appointments: demo.appointments,
      portfolio: structuredClone(seedPortfolio),
      reviews: demo.reviews,
      notifications: [],
      audit: [],
      ticketCounter: demo.ticketCounter,
    };
  }
  return g.__btStore;
}

const clone = <T,>(v: T): T => structuredClone(v);
/** Drops undefined keys so partial patches never erase fields. */
const defined = <T extends object>(o: T) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
const nowIso = () => new Date().toISOString();
const refTime = (a: Appointment) => new Date(a.startAt ?? a.queue?.arrivedAt ?? a.arrivedAt ?? a.createdAt);

function findByRef(reference: string, phone: string) {
  const a = store().appointments.find((x) => x.reference === reference.toUpperCase());
  // Same "not found" for wrong phone — never reveal that a reference exists.
  if (!a || a.customerPhone !== phone) throw new DomainError("NOT_FOUND", "Réservation introuvable");
  return a;
}

function upsertCustomer(name: string, phone: string | null, email?: string | null): Customer {
  const s = store();
  if (phone) {
    const existing = s.customers.find((c) => c.phone === phone && !c.anonymized);
    if (existing) {
      if (email && !existing.email) existing.email = email;
      if (existing.archived) existing.archived = false;
      return existing;
    }
  }
  const c: Customer = {
    id: newId(),
    name,
    phone: phone ?? "",
    email: email ?? null,
    notes: null,
    preferredBarberId: null,
    archived: false,
    anonymized: false,
    createdAt: nowIso(),
  };
  s.customers.push(c);
  return c;
}

function assertBookable(barberId: string, startAt: Date, duration: number, excludeId?: string, allowPast = false) {
  const s = store();
  const date = zonedParts(startAt, s.shop.timezone).date;
  const res = checkRange(
    {
      date,
      tz: s.shop.timezone,
      rules: s.availability.filter((r) => r.barberId === barberId),
      exceptions: s.exceptions.filter((e) => e.barberId === barberId),
      blocks: s.blocks.filter((b) => b.barberId === barberId || b.barberId === null),
      busy: busyIntervals(s.appointments.filter((a) => a.barberId === barberId && a.id !== excludeId)),
      durationMinutes: duration,
      stepMinutes: s.shop.settings.slotStepMinutes,
      minLeadMinutes: 0,
      // Staff may (re)place a client earlier today (e.g. a walk-in already in the chair).
      now: allowPast ? new Date(0) : new Date(),
    },
    startAt,
  );
  if (!res.ok) {
    if (res.reason === "booked") throw new DomainError("SLOT_TAKEN", "Ce créneau vient d'être réservé");
    if (res.reason === "past") throw new DomainError("INVALID_INPUT", "Ce créneau est déjà passé");
    throw new DomainError("BARBER_UNAVAILABLE", "Le barbier n'est pas disponible à cette heure");
  }
}

export const memoryRepo: Repo = {
  mode: "demo",

  async getShop() {
    return clone(store().shop);
  },
  async listBarbers(opts) {
    return clone(store().barbers.filter((b) => opts?.includeInactive || b.active).sort((a, b) => a.sortOrder - b.sortOrder));
  },
  async getBarber(id) {
    return clone(store().barbers.find((b) => b.id === id) ?? null);
  },
  async getBarberBySlug(slug) {
    return clone(store().barbers.find((b) => b.slug === slug && b.active) ?? null);
  },
  async updateBarber(id, patch) {
    const b = store().barbers.find((x) => x.id === id);
    if (!b) throw new DomainError("NOT_FOUND");
    Object.assign(b, defined(patch));
  },
  async listServices(opts) {
    return clone(store().services.filter((s) => opts?.includeInactive || s.active).sort((a, b) => a.sortOrder - b.sortOrder));
  },
  async upsertService(input, barberIds) {
    const s = store();
    let svc = input.id ? s.services.find((x) => x.id === input.id) : undefined;
    if (svc) Object.assign(svc, defined(input));
    else {
      svc = {
        ...input,
        id: newId(),
        slug: input.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-"),
        imageUrl: null,
        sortOrder: s.services.length + 1,
      };
      s.services.push(svc);
    }
    for (const b of s.barbers) {
      const has = b.serviceIds.includes(svc.id);
      if (barberIds.includes(b.id) && !has) b.serviceIds.push(svc.id);
      if (!barberIds.includes(b.id) && has) b.serviceIds = b.serviceIds.filter((x) => x !== svc!.id);
    }
    return clone(svc);
  },

  async listAvailability(barberId) {
    return clone(store().availability.filter((r) => !barberId || r.barberId === barberId));
  },
  async replaceWeeklyAvailability(barberId, rules) {
    const s = store();
    s.availability = s.availability.filter((r) => r.barberId !== barberId).concat(rules.map((r) => ({ ...r, id: newId(), barberId })));
  },
  async listExceptions(barberId) {
    return clone(store().exceptions.filter((e) => !barberId || e.barberId === barberId));
  },
  async addException(e) {
    const x = { ...e, id: newId() };
    store().exceptions.push(x);
    return clone(x);
  },
  async deleteException(id) {
    const s = store();
    s.exceptions = s.exceptions.filter((e) => e.id !== id);
  },
  async listBlocks({ barberId, from, to }) {
    return clone(
      store().blocks.filter(
        (b) =>
          (!barberId || barberId === "all" || b.barberId === barberId || b.barberId === null) &&
          overlaps(new Date(b.startAt), new Date(b.endAt), from, to),
      ),
    );
  },
  async addBlock(b) {
    const x = { ...b, id: newId() };
    store().blocks.push(x);
    return clone(x);
  },
  async deleteBlock(id) {
    const s = store();
    const b = s.blocks.find((x) => x.id === id) ?? null;
    s.blocks = s.blocks.filter((x) => x.id !== id);
    return clone(b);
  },
  async getBusyIntervals(barberId, from, to, excludeAppointmentId) {
    return busyIntervals(
      store().appointments.filter((a) => a.barberId === barberId && a.id !== excludeAppointmentId),
    ).filter((i) => overlaps(i.start, i.end, from, to));
  },

  async listAppointments(q: AppointmentQuery) {
    return clone(
      store()
        .appointments.filter((a) => {
          if (q.barberId && q.barberId !== "all" && a.barberId !== q.barberId && a.barberId !== null) return false;
          if (q.statuses && !q.statuses.includes(a.status)) return false;
          if (q.customerId && a.customerId !== q.customerId) return false;
          if (q.customerIds && !q.customerIds.includes(a.customerId)) return false;
          const t = refTime(a);
          if (q.from && t < q.from) return false;
          if (q.to && t >= q.to) return false;
          return true;
        })
        .sort((x, y) => +refTime(x) - +refTime(y)),
    );
  },
  async getAppointment(id) {
    return clone(store().appointments.find((a) => a.id === id) ?? null);
  },
  async createAppointment(input) {
    const s = store();
    const barber = s.barbers.find((b) => b.id === input.barberId && b.active);
    if (!barber) throw new DomainError("BARBER_UNAVAILABLE");
    const services = input.serviceIds.map((id) => s.services.find((x) => x.id === id && x.active));
    if (services.some((x) => !x) || input.serviceIds.some((id) => !barber.serviceIds.includes(id)))
      throw new DomainError("INVALID_INPUT", "Service indisponible avec ce barbier");
    const lines = buildServiceLines(services as Service[], barber);
    const t = totals(lines);
    const start = new Date(input.startAt);
    // Check + insert happen synchronously → atomic within this process.
    assertBookable(barber.id, start, t.duration);
    const customer = upsertCustomer(input.customer.name, input.customer.phone, input.customer.email);
    const now = nowIso();
    const a: Appointment = {
      id: newId(),
      reference: newReference(),
      barberId: barber.id,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      customerEmail: customer.email,
      services: lines,
      startAt: start.toISOString(),
      endAt: addMinutes(start, t.duration).toISOString(),
      durationMinutes: t.duration,
      totalPrice: t.price,
      finalPrice: null,
      status: "confirmed",
      source: input.source,
      note: input.note ?? null,
      inspirationUrl: input.inspirationUrl ?? null,
      lateCancellation: false,
      createdAt: now,
      updatedAt: now,
      confirmedAt: now,
      queue: null,
    };
    s.appointments.push(a);
    return clone(a);
  },
  async createWalkIn(input) {
    const s = store();
    const barber = input.barberId ? s.barbers.find((b) => b.id === input.barberId) : null;
    if (input.barberId && !barber) throw new DomainError("BARBER_UNAVAILABLE");
    const services = input.serviceIds.map((id) => s.services.find((x) => x.id === id));
    if (services.some((x) => !x)) throw new DomainError("INVALID_INPUT", "Service inconnu");
    const lines = buildServiceLines(services as Service[], barber);
    const t = totals(lines);
    const customer = upsertCustomer(input.customer.name, input.customer.phone ?? null);
    const now = nowIso();
    const a: Appointment = {
      id: newId(),
      reference: newReference(),
      barberId: input.barberId,
      customerId: customer.id,
      customerName: customer.name,
      customerPhone: customer.phone,
      services: lines,
      startAt: null,
      endAt: null,
      durationMinutes: t.duration,
      totalPrice: t.price,
      finalPrice: null,
      status: "waiting",
      source: "walk_in",
      note: input.note ?? null,
      lateCancellation: false,
      createdAt: now,
      updatedAt: now,
      arrivedAt: input.arrivedAt,
      queue: null,
    };
    s.appointments.push(a);
    a.queue = clone(await memoryRepo.ensureQueueTicket(a.id, input.arrivedAt, input.priority));
    return clone(a);
  },
  async updateAppointment(id, patch) {
    const a = store().appointments.find((x) => x.id === id);
    if (!a) throw new DomainError("NOT_FOUND");
    const next = { ...a, ...defined(patch) };
    // Re-validate the calendar (like the DB exclusion constraint) when a future
    // booking is restored, moved, or gets longer.
    const restored = !ACTIVE_STATUSES.includes(a.status) && ACTIVE_STATUSES.includes(next.status);
    const moved = patch.startAt !== undefined && patch.startAt !== a.startAt;
    const longer = (patch.durationMinutes ?? 0) > a.durationMinutes && ["pending", "confirmed"].includes(next.status);
    if (next.startAt && next.barberId && (restored || moved || longer) && ["pending", "confirmed"].includes(next.status)) {
      assertBookable(next.barberId, new Date(next.startAt), next.durationMinutes, a.id, true);
    }
    Object.assign(a, defined(patch), { updatedAt: nowIso() });
    return clone(a);
  },
  async staffSaveAppointment(input) {
    const s = store();
    const barber = s.barbers.find((b) => b.id === input.barberId);
    if (!barber) throw new DomainError("BARBER_UNAVAILABLE");
    const services = input.serviceIds.map((id) => s.services.find((x) => x.id === id));
    if (!services.length || services.some((x) => !x)) throw new DomainError("INVALID_INPUT", "Choisissez au moins un service");
    const lines = buildServiceLines(services as Service[], barber);
    const t = totals(lines);
    const duration = t.duration + Math.max(0, input.extraMinutes);
    const start = new Date(input.startAt);
    const existing = input.id ? s.appointments.find((a) => a.id === input.id) : undefined;
    if (input.id && !existing) throw new DomainError("NOT_FOUND");
    const freesSlot = existing && ["cancelled", "no_show"].includes(existing.status);
    if (!freesSlot) assertBookable(barber.id, start, duration, existing?.id, true);
    const phone = input.phone || null;
    const customer =
      existing && (existing.customerPhone || null) === phone && !phone ? s.customers.find((c) => c.id === existing.customerId) ?? upsertCustomer(input.name, null) : upsertCustomer(input.name, phone);
    if (customer.name !== input.name && !customer.anonymized && !phone) customer.name = input.name;
    const now = nowIso();
    const data = {
      barberId: barber.id,
      customerId: customer.id,
      customerName: input.name,
      customerPhone: phone ?? "",
      services: lines,
      startAt: start.toISOString(),
      endAt: addMinutes(start, duration).toISOString(),
      durationMinutes: duration,
      totalPrice: t.price,
      finalPrice: input.finalPrice ?? null,
      note: input.note || null,
      updatedAt: now,
    };
    if (existing) {
      Object.assign(existing, data);
      return clone(existing);
    }
    const a: Appointment = {
      ...data,
      id: newId(),
      reference: newReference(),
      status: "confirmed",
      source: "dashboard",
      lateCancellation: false,
      createdAt: now,
      confirmedAt: now,
      queue: null,
    };
    s.appointments.push(a);
    return clone(a);
  },
  async deleteAppointment(id) {
    const s = store();
    if (!s.appointments.some((a) => a.id === id)) throw new DomainError("NOT_FOUND");
    s.appointments = s.appointments.filter((a) => a.id !== id);
  },
  async ensureQueueTicket(appointmentId, arrivedAt, priority = 0) {
    const s = store();
    const a = s.appointments.find((x) => x.id === appointmentId);
    if (!a) throw new DomainError("NOT_FOUND");
    if (a.queue) return clone(a.queue);
    const day = zonedParts(new Date(arrivedAt), s.shop.timezone).date;
    const n = (s.ticketCounter[day] = (s.ticketCounter[day] ?? 0) + 1);
    const q: QueueTicket = {
      id: newId(),
      appointmentId,
      ticketNumber: n,
      ticketCode: ticketCode(n),
      arrivedAt,
      priority,
      bumpMinutes: 0,
      waitAdjustMinutes: 0,
    };
    a.queue = q;
    return clone(q);
  },
  async updateQueueTicket(appointmentId, patch) {
    const a = store().appointments.find((x) => x.id === appointmentId);
    if (!a?.queue) throw new DomainError("NOT_FOUND");
    Object.assign(a.queue, defined(patch));
  },

  async lookupBooking(reference, phone) {
    try {
      return clone(findByRef(reference, phone));
    } catch {
      return null;
    }
  },
  async cancelByReference(reference, phone, freeUntilHours) {
    const a = findByRef(reference, phone);
    if (!["pending", "confirmed"].includes(a.status) || !a.startAt)
      throw new DomainError("INVALID_TRANSITION", "Cette réservation ne peut plus être annulée en ligne");
    const late = minutesBetween(new Date(), new Date(a.startAt)) < freeUntilHours * 60;
    Object.assign(a, { status: "cancelled", cancelledAt: nowIso(), lateCancellation: late, cancelReason: "Annulée par le client", updatedAt: nowIso() });
    return clone(a);
  },
  async rescheduleByReference(reference, phone, startAt) {
    const a = findByRef(reference, phone);
    if (!["pending", "confirmed"].includes(a.status) || !a.barberId)
      throw new DomainError("INVALID_TRANSITION", "Cette réservation ne peut plus être modifiée");
    const start = new Date(startAt);
    if (start < new Date()) throw new DomainError("INVALID_INPUT", "Ce créneau est déjà passé");
    assertBookable(a.barberId, start, a.durationMinutes, a.id);
    Object.assign(a, { startAt: start.toISOString(), endAt: addMinutes(start, a.durationMinutes).toISOString(), updatedAt: nowIso() });
    return clone(a);
  },
  async updateNoteByReference(reference, phone, note) {
    const a = findByRef(reference, phone);
    if (["completed", "cancelled", "no_show"].includes(a.status)) throw new DomainError("INVALID_TRANSITION");
    a.note = note;
    a.updatedAt = nowIso();
    return clone(a);
  },
  async submitReview(reference, phone, ratings, comment) {
    const s = store();
    const a = findByRef(reference, phone);
    if (a.status !== "completed" || !a.barberId) throw new DomainError("INVALID_TRANSITION", "Seules les visites terminées peuvent être évaluées");
    if (s.reviews.some((r) => r.appointmentId === a.id)) throw new DomainError("INVALID_INPUT", "Vous avez déjà laissé un avis pour cette visite");
    const [first, last] = a.customerName.split(" ");
    const r: Review = {
      id: newId(),
      appointmentId: a.id,
      barberId: a.barberId,
      authorName: `${first} ${last?.[0] ? `${last[0]}.` : ""}`.trim(),
      ratings,
      comment,
      status: "pending",
      featured: false,
      createdAt: nowIso(),
    };
    s.reviews.push(r);
    return clone(r);
  },
  async listPublicQueue(from, to) {
    const list = await memoryRepo.listAppointments({ from, to });
    return list.map((a) => ({
      ...a,
      customerName: initials(a.customerName),
      customerPhone: "",
      customerEmail: null,
      customerId: "",
      note: null,
      inspirationUrl: null,
      reference: "",
    }));
  },

  async listCustomers(q) {
    return clone(
      store().customers.filter((c) => (q?.includeArchived || !c.archived) && (!q?.ids || q.ids.includes(c.id))),
    );
  },
  async getCustomer(id) {
    return clone(store().customers.find((c) => c.id === id) ?? null);
  },
  async updateCustomer(id, patch) {
    const c = store().customers.find((x) => x.id === id);
    if (!c) throw new DomainError("NOT_FOUND");
    Object.assign(c, defined(patch));
  },
  async anonymizeCustomer(id) {
    const s = store();
    const c = s.customers.find((x) => x.id === id);
    if (!c) throw new DomainError("NOT_FOUND");
    Object.assign(c, { name: "Client anonyme", phone: "", email: null, notes: null, anonymized: true, archived: true });
    for (const a of s.appointments.filter((x) => x.customerId === id))
      Object.assign(a, { customerName: "Client anonyme", customerPhone: "", customerEmail: null, note: null, inspirationUrl: null });
  },
  async deleteCustomer(id) {
    const s = store();
    // History is kept for analytics: appointments are anonymized, not deleted.
    await memoryRepo.anonymizeCustomer(id);
    s.customers = s.customers.filter((c) => c.id !== id);
  },

  async listPortfolio(q) {
    return clone(
      store()
        .portfolio.filter((p) => !q?.barberId || p.barberId === q.barberId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  },
  async upsertPortfolio(p) {
    const s = store();
    const existing = p.id ? s.portfolio.find((x) => x.id === p.id) : undefined;
    if (existing) {
      Object.assign(existing, defined({ ...p, imageUrl: p.imageUrl ?? existing.imageUrl }));
      return clone(existing);
    }
    const x: PortfolioImage = { ...p, id: newId(), date: nowIso().slice(0, 10) };
    s.portfolio.push(x);
    return clone(x);
  },
  async deletePortfolio(id) {
    const s = store();
    const p = s.portfolio.find((x) => x.id === id) ?? null;
    s.portfolio = s.portfolio.filter((x) => x.id !== id);
    return clone(p);
  },
  async uploadImage(file) {
    // Demo: keep the image in memory as a data URL.
    const buf = Buffer.from(await file.arrayBuffer());
    return `data:${file.type || "image/jpeg"};base64,${buf.toString("base64")}`;
  },

  async listReviews(q) {
    return clone(
      store()
        .reviews.filter(
          (r) =>
            (!q?.status || r.status === q.status) &&
            (q?.featured === undefined || r.featured === q.featured) &&
            (!q?.barberId || r.barberId === q.barberId),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  },
  async updateReview(id, patch) {
    const r = store().reviews.find((x) => x.id === id);
    if (!r) throw new DomainError("NOT_FOUND");
    Object.assign(r, defined(patch));
  },

  async addNotification(n) {
    const x: NotificationRecord = { ...n, id: newId(), createdAt: nowIso() };
    store().notifications.unshift(x);
    return clone(x);
  },
  async listNotifications(limit = 50) {
    return clone(store().notifications.slice(0, limit));
  },
  async addAudit(a) {
    store().audit.unshift({ ...a, id: newId(), createdAt: nowIso() });
  },
  async listAudit(limit = 50) {
    return clone(store().audit.slice(0, limit));
  },
};
