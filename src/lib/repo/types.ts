import type {
  Appointment,
  AppointmentStatus,
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
  ReviewRatings,
  Service,
  Shop,
} from "@/lib/domain/types";
import type { Interval } from "@/lib/domain/slots";

export interface AppointmentQuery {
  barberId?: string | "all";
  /** Range applied to startAt, or arrival time for walk-ins. */
  from?: Date;
  to?: Date;
  statuses?: AppointmentStatus[];
  customerId?: string;
  customerIds?: string[];
}

export interface NewAppointmentInput {
  barberId: string;
  serviceIds: string[];
  startAt: string;
  customer: { name: string; phone: string; email?: string | null };
  note?: string | null;
  inspirationUrl?: string | null;
  source: "online" | "phone" | "dashboard";
}

export interface NewWalkInInput {
  barberId: string | null;
  serviceIds: string[];
  customer: { name: string; phone?: string | null };
  note?: string | null;
  arrivedAt: string;
  priority: number;
}

/** Barber / reception creates or edits an entry of the day (phone optional, extra time allowed). */
export interface StaffAppointmentInput {
  id?: string;
  barberId: string;
  serviceIds: string[];
  startAt: string;
  name: string;
  phone?: string | null;
  note?: string | null;
  /** Added on top of the services duration (e.g. +30 min, +1 h). */
  extraMinutes: number;
  finalPrice?: number | null;
}

export type AppointmentPatch = Partial<
  Pick<
    Appointment,
    | "status"
    | "barberId"
    | "note"
    | "finalPrice"
    | "services"
    | "totalPrice"
    | "durationMinutes"
    | "startAt"
    | "endAt"
    | "lateCancellation"
    | "cancelReason"
    | "confirmedAt"
    | "arrivedAt"
    | "calledAt"
    | "startedAt"
    | "completedAt"
    | "cancelledAt"
  >
>;

export type QueuePatch = Partial<Pick<QueueTicket, "priority" | "bumpMinutes" | "waitAdjustMinutes">>;

export interface Repo {
  readonly mode: "demo" | "supabase";

  // ── Public catalogue ──
  getShop(): Promise<Shop>;
  listBarbers(opts?: { includeInactive?: boolean }): Promise<Barber[]>;
  getBarber(id: string): Promise<Barber | null>;
  getBarberBySlug(slug: string): Promise<Barber | null>;
  updateBarber(id: string, patch: Partial<Pick<Barber, "delayMinutes" | "bio" | "specialties">>): Promise<void>;
  listServices(opts?: { includeInactive?: boolean }): Promise<Service[]>;
  upsertService(input: Omit<Service, "id" | "slug" | "sortOrder" | "imageUrl"> & { id?: string }, barberIds: string[]): Promise<Service>;

  // ── Availability ──
  listAvailability(barberId?: string): Promise<AvailabilityRule[]>;
  replaceWeeklyAvailability(barberId: string, rules: Omit<AvailabilityRule, "id" | "barberId">[]): Promise<void>;
  listExceptions(barberId?: string): Promise<AvailabilityException[]>;
  addException(e: Omit<AvailabilityException, "id">): Promise<AvailabilityException>;
  deleteException(id: string): Promise<void>;
  listBlocks(q: { barberId?: string | "all"; from: Date; to: Date }): Promise<BlockedPeriod[]>;
  addBlock(b: Omit<BlockedPeriod, "id">): Promise<BlockedPeriod>;
  deleteBlock(id: string): Promise<BlockedPeriod | null>;
  /** Busy intervals of a barber (no customer data) — safe for public slot computation. */
  getBusyIntervals(barberId: string, from: Date, to: Date, excludeAppointmentId?: string): Promise<Interval[]>;

  // ── Appointments (staff, RLS-scoped in Supabase mode) ──
  listAppointments(q: AppointmentQuery): Promise<Appointment[]>;
  getAppointment(id: string): Promise<Appointment | null>;
  /** Atomic: throws DomainError("SLOT_TAKEN") if the full period overlaps. */
  createAppointment(input: NewAppointmentInput): Promise<Appointment>;
  createWalkIn(input: NewWalkInInput): Promise<Appointment>;
  updateAppointment(id: string, patch: AppointmentPatch): Promise<Appointment>;
  /** Atomic create/update for the barber day view. Validates hours, breaks, blocks and overlaps (past times of the day allowed). */
  staffSaveAppointment(input: StaffAppointmentInput): Promise<Appointment>;
  deleteAppointment(id: string): Promise<void>;
  /** Creates the queue ticket when a client physically arrives. Idempotent. */
  ensureQueueTicket(appointmentId: string, arrivedAt: string, priority?: number): Promise<QueueTicket>;
  updateQueueTicket(appointmentId: string, patch: QueuePatch): Promise<void>;

  // ── Public, by reference + phone (SECURITY DEFINER RPCs in Supabase mode) ──
  lookupBooking(reference: string, phone: string): Promise<Appointment | null>;
  cancelByReference(reference: string, phone: string, freeUntilHours: number): Promise<Appointment>;
  rescheduleByReference(reference: string, phone: string, startAt: string): Promise<Appointment>;
  updateNoteByReference(reference: string, phone: string, note: string): Promise<Appointment>;
  submitReview(reference: string, phone: string, ratings: ReviewRatings, comment: string): Promise<Review>;
  /** Today's queue with customer names reduced to initials and no phone numbers. */
  listPublicQueue(from: Date, to: Date): Promise<Appointment[]>;

  // ── Customers ──
  listCustomers(q?: { ids?: string[]; includeArchived?: boolean }): Promise<Customer[]>;
  getCustomer(id: string): Promise<Customer | null>;
  updateCustomer(id: string, patch: Partial<Pick<Customer, "name" | "email" | "notes" | "archived" | "preferredBarberId">>): Promise<void>;
  anonymizeCustomer(id: string): Promise<void>;
  deleteCustomer(id: string): Promise<void>;

  // ── Portfolio ──
  listPortfolio(q?: { barberId?: string }): Promise<PortfolioImage[]>;
  upsertPortfolio(p: Omit<PortfolioImage, "id" | "date"> & { id?: string }): Promise<PortfolioImage>;
  deletePortfolio(id: string): Promise<PortfolioImage | null>;
  uploadImage(file: File, folder: string): Promise<string>;

  // ── Reviews ──
  listReviews(q?: { status?: Review["status"]; featured?: boolean; barberId?: string }): Promise<Review[]>;
  updateReview(id: string, patch: Partial<Pick<Review, "status" | "featured">>): Promise<void>;

  // ── Outbox & audit ──
  addNotification(n: Omit<NotificationRecord, "id" | "createdAt">): Promise<NotificationRecord>;
  listNotifications(limit?: number): Promise<NotificationRecord[]>;
  addAudit(a: Omit<AuditLog, "id" | "createdAt">): Promise<void>;
  listAudit(limit?: number): Promise<AuditLog[]>;
}
