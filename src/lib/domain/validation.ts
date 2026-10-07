import { z } from "zod";
import { normalizePhone } from "./phone";
import { APPOINTMENT_STATUSES, GALLERY_CATEGORIES } from "./types";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Heure invalide");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date invalide");
const id = z.string().min(1).max(64);

export const phoneSchema = z
  .string()
  .trim()
  .min(6, "Numéro de téléphone invalide")
  .max(25)
  .transform((v, ctx) => {
    const n = normalizePhone(v);
    if (!n) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Numéro de téléphone invalide" });
      return z.NEVER;
    }
    return n;
  });

const name = z.string().trim().min(2, "Nom trop court").max(80, "Nom trop long");
const email = z
  .string()
  .trim()
  .max(120)
  .email("E-mail invalide")
  .optional()
  .or(z.literal("").transform(() => undefined));
const note = z.string().trim().max(500, "Note trop longue (500 caractères max)").optional();

export const bookingSchema = z.object({
  barberId: id,
  serviceIds: z.array(id).min(1, "Choisissez au moins un service").max(6),
  startAt: z.string().datetime({ message: "Créneau invalide" }),
  name,
  phone: phoneSchema,
  email,
  note,
  inspirationUrl: z.string().max(2_000_000).optional(), // data URL from an inspiration photo
  website: z.string().max(0).optional(), // honeypot
});
export type BookingInput = z.input<typeof bookingSchema>;

export const slotsQuerySchema = z.object({
  barberId: id,
  date: isoDate,
  serviceIds: z.array(id).min(1).max(6),
  excludeAppointmentId: id.optional(),
});

export const lookupSchema = z.object({
  reference: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^BT-[A-Z0-9]{5}$/, "Référence invalide (ex. BT-7K4Q2)"),
  phone: phoneSchema,
});

export const rescheduleSchema = lookupSchema.extend({ startAt: z.string().datetime() });
export const noteUpdateSchema = lookupSchema.extend({ note: z.string().trim().max(500) });

const rating = z.coerce.number().int().min(1).max(5);
export const reviewSchema = lookupSchema.extend({
  ratings: z.object({ barber: rating, quality: rating, waiting: rating, cleanliness: rating, overall: rating }),
  comment: z.string().trim().min(5, "Quelques mots s'il vous plaît").max(600),
});

export const walkInSchema = z.object({
  name,
  phone: phoneSchema.optional().or(z.literal("").transform(() => undefined)),
  serviceIds: z.array(id).min(1, "Choisissez un service"),
  barberId: id.nullable(), // null = any barber
  arrivedAt: z.string().datetime().optional(),
  note,
  priority: z.coerce.number().int().min(0).max(3).default(0),
});

export const statusChangeSchema = z.object({
  appointmentId: id,
  status: z.enum(APPOINTMENT_STATUSES),
  reason: z.string().max(200).optional(),
});

export const appointmentEditSchema = z.object({
  appointmentId: id,
  note: z.string().trim().max(500).optional(),
  serviceIds: z.array(id).min(1).optional(),
  finalPrice: z.coerce.number().min(0).max(100_000).nullable().optional(),
  waitAdjustMinutes: z.coerce.number().int().min(-120).max(240).optional(),
  priority: z.coerce.number().int().min(0).max(3).optional(),
});

export const weeklyAvailabilitySchema = z.object({
  barberId: id,
  days: z
    .array(
      z
        .object({
          weekday: z.number().int().min(0).max(6),
          start: hhmm,
          end: hhmm,
          breaks: z.array(z.object({ start: hhmm, end: hhmm, label: z.string().max(40).optional() })).max(6),
        })
        .refine((d) => d.start < d.end, "L'heure de fin doit suivre l'heure de début")
        .refine((d) => d.breaks.every((b) => b.start < b.end && b.start >= d.start && b.end <= d.end), {
          message: "Les pauses doivent être comprises dans les horaires",
        }),
    )
    .max(7),
});

export const blockSchema = z
  .object({
    barberId: id.nullable(),
    kind: z.enum(["day_off", "time_block", "vacation", "closure", "break"]),
    startDate: isoDate,
    endDate: isoDate,
    startTime: hhmm.optional(),
    endTime: hhmm.optional(),
    reason: z.string().trim().max(120).optional(),
    confirmCancellations: z.boolean().default(false),
  })
  .refine((b) => b.startDate <= b.endDate, "La date de fin doit suivre la date de début")
  .refine((b) => b.kind !== "time_block" || (b.startTime && b.endTime && b.startTime < b.endTime), {
    message: "Indiquez une plage horaire valide",
  });

export const exceptionSchema = z
  .object({ barberId: id, date: isoDate, start: hhmm, end: hhmm, note: z.string().max(120).optional() })
  .refine((e) => e.start < e.end, "Plage horaire invalide");

export const serviceSchema = z.object({
  id: id.optional(),
  name: z.string().trim().min(2).max(60),
  description: z.string().trim().max(300).default(""),
  price: z.coerce.number().int().min(0).max(10_000),
  durationMinutes: z.coerce.number().int().min(5).max(480),
  category: z.enum(["cut", "beard", "combo", "care", "kids", "styling", "treatment"]),
  priceFrom: z.boolean().default(false),
  icon: z.string().max(30).default("scissors"),
  active: z.boolean().default(true),
  barberIds: z.array(id).default([]),
});

export const portfolioSchema = z.object({
  id: id.optional(),
  barberId: id,
  category: z.enum(GALLERY_CATEGORIES as [string, ...string[]]),
  title: z.string().trim().min(2).max(80),
  description: z.string().trim().max(300).default(""),
  instagramUrl: z.string().url().optional().or(z.literal("").transform(() => undefined)),
});

export const loginSchema = z.object({
  email: z.string().trim().email("E-mail invalide"),
  password: z.string().min(6, "Mot de passe trop court"),
});

export function firstError(err: z.ZodError) {
  return err.issues[0]?.message ?? "Données invalides";
}
