// ─── Core domain types shared by server, client and both repositories ───

export type Role = "owner" | "barber" | "receptionist" | "customer";

export const APPOINTMENT_STATUSES = [
  "pending",
  "confirmed",
  "late",
  "arrived",
  "waiting",
  "called",
  "in_progress",
  "completed",
  "cancelled",
  "no_show",
] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/** Statuses that occupy the barber's calendar (used for double-booking prevention). */
export const ACTIVE_STATUSES: AppointmentStatus[] = [
  "pending",
  "confirmed",
  "late",
  "arrived",
  "waiting",
  "called",
  "in_progress",
  "completed",
];
/** Physically present in the shop and waiting for a chair. */
export const PRESENT_WAITING: AppointmentStatus[] = ["arrived", "waiting"];

export type AppointmentSource = "online" | "walk_in" | "phone" | "dashboard";

export type ServiceCategory = "cut" | "beard" | "combo" | "care" | "kids" | "styling" | "treatment";

export type GalleryCategory =
  | "fade"
  | "taper"
  | "beard"
  | "classic"
  | "long"
  | "kids"
  | "before_after"
  | "facial";

export const GALLERY_CATEGORIES: GalleryCategory[] = [
  "fade",
  "taper",
  "beard",
  "classic",
  "long",
  "kids",
  "before_after",
  "facial",
];

export interface OpeningHours {
  /** 0 = Sunday … 6 = Saturday */
  day: number;
  open: string | null; // "09:00" or null when closed
  close: string | null;
}

export interface ShopSettings {
  cancellation: { freeUntilHours: number };
  slotStepMinutes: number;
  minLeadMinutes: number;
  maxDaysAhead: number;
  /** Appointment holders arriving later than this lose their priority. */
  lateGraceMinutes: number;
  features: {
    promotions: boolean;
    loyalty: boolean;
    referrals: boolean;
    birthdayOffer: boolean;
    packages: boolean;
  };
}

export interface Shop {
  id: string;
  name: string;
  tagline: string;
  address: string;
  city: string;
  phone: string;
  whatsapp: string;
  email: string;
  mapsQuery: string;
  lat: number;
  lng: number;
  socials: { instagram: string; tiktok: string; facebook: string };
  hours: OpeningHours[];
  timezone: string;
  settings: ShopSettings;
}

export interface Barber {
  id: string;
  slug: string;
  name: string;
  title: string;
  bio: string;
  specialties: string[];
  experienceYears: number;
  rating: number;
  reviewCount: number;
  photoUrl: string | null;
  /** Optional "arms relaxed" photo: shown first in the lineup animation, then crossfades to photoUrl (arms crossed). */
  introPhotoUrl: string | null;
  /** Optional framing for the homepage lineup (e.g. a waist-level crop of a full-length photo). */
  lineupPhotoUrl: string | null;
  /** Personal phone (E.164) — call / WhatsApp buttons on the profile. */
  phone: string | null;
  socials: { instagram?: string; tiktok?: string };
  serviceIds: string[];
  /** Optional per-barber duration (minutes) for a service. */
  durationOverrides: Record<string, number>;
  active: boolean;
  /** Live delay announced by the barber, added to waiting estimates. */
  delayMinutes: number;
  sortOrder: number;
}

export interface Service {
  id: string;
  slug: string;
  name: string;
  description: string;
  price: number; // Moroccan dirhams
  /** "À partir de" price (final price depends on hair length…). */
  priceFrom: boolean;
  durationMinutes: number;
  category: ServiceCategory;
  icon: string;
  imageUrl: string | null;
  active: boolean;
  sortOrder: number;
}

export interface BreakPeriod {
  start: string; // "13:00"
  end: string;
  label?: string; // "Déjeuner", "Prière"
}

export interface AvailabilityRule {
  id: string;
  barberId: string;
  weekday: number; // 0-6
  start: string;
  end: string;
  breaks: BreakPeriod[];
}

export interface AvailabilityException {
  id: string;
  barberId: string;
  date: string; // YYYY-MM-DD (shop timezone)
  start: string;
  end: string;
  note?: string | null;
}

export type BlockKind = "day_off" | "time_block" | "vacation" | "closure" | "break";

export interface BlockedPeriod {
  id: string;
  /** null → applies to the whole shop (exceptional closure). */
  barberId: string | null;
  kind: BlockKind;
  startAt: string; // ISO
  endAt: string;
  reason?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  notes?: string | null;
  preferredBarberId?: string | null;
  archived: boolean;
  anonymized: boolean;
  createdAt: string;
}

export interface AppointmentServiceLine {
  serviceId: string;
  name: string;
  price: number;
  durationMinutes: number;
}

export interface QueueTicket {
  id: string;
  appointmentId: string;
  ticketNumber: number;
  ticketCode: string; // "B12"
  arrivedAt: string; // original arrival — never overwritten
  priority: number; // 0 normal, 1+ higher
  bumpMinutes: number; // grows when moved lower in the queue
  waitAdjustMinutes: number; // manual estimate correction
}

export interface Appointment {
  id: string;
  reference: string;
  barberId: string | null; // null only for walk-ins with "any barber"
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string | null;
  services: AppointmentServiceLine[];
  /** Scheduled start (null for walk-ins). Never overwritten by queue moves. */
  startAt: string | null;
  endAt: string | null;
  durationMinutes: number;
  totalPrice: number;
  finalPrice: number | null;
  status: AppointmentStatus;
  source: AppointmentSource;
  note?: string | null;
  inspirationUrl?: string | null;
  lateCancellation: boolean;
  cancelReason?: string | null;
  createdAt: string;
  updatedAt: string;
  confirmedAt?: string | null;
  arrivedAt?: string | null;
  calledAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  queue?: QueueTicket | null;
}

export type ReviewStatus = "pending" | "approved" | "rejected";

export interface ReviewRatings {
  barber: number;
  quality: number;
  waiting: number;
  cleanliness: number;
  overall: number;
}

export interface Review {
  id: string;
  appointmentId: string;
  barberId: string;
  authorName: string; // first name + initial only
  ratings: ReviewRatings;
  comment: string;
  status: ReviewStatus;
  featured: boolean;
  createdAt: string;
}

export interface PortfolioImage {
  id: string;
  barberId: string;
  category: GalleryCategory;
  title: string;
  description: string;
  imageUrl: string | null;
  /** Placeholder art key used until a real photo is uploaded. */
  art?: string | null;
  date: string;
  instagramUrl?: string | null;
}

export type NotificationChannel = "email" | "whatsapp" | "sms";
export type NotificationTemplate =
  | "booking_confirmation"
  | "appointment_reminder"
  | "appointment_modified"
  | "cancellation"
  | "barber_delay"
  | "barber_ready"
  | "review_request";

export interface NotificationRecord {
  id: string;
  appointmentId?: string | null;
  customerId?: string | null;
  channel: NotificationChannel;
  template: NotificationTemplate;
  to: string;
  body: string;
  status: "queued" | "sent" | "failed" | "manual";
  createdAt: string;
}

export interface AuditLog {
  id: string;
  actorId: string | null;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  details?: Record<string, unknown> | null;
  createdAt: string;
}

export interface Session {
  userId: string;
  name: string;
  email?: string;
  role: Role;
  barberId: string | null;
  customerId: string | null;
  canViewRevenue: boolean;
}

export interface Slot {
  start: string; // ISO
  end: string;
  available: boolean;
  reason?: "past" | "break" | "blocked" | "booked" | "closing";
}
