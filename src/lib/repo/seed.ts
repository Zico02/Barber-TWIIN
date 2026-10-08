// Seed data — used by the demo store and mirrored in supabase/seed.sql
// (regenerate with: npx tsx scripts/generate-seed-sql.ts).
import type {
  Appointment,
  AvailabilityException,
  AvailabilityRule,
  Barber,
  Customer,
  PortfolioImage,
  Review,
  Service,
  Session,
  Shop,
} from "@/lib/domain/types";
import { addDays, addMinutes, zonedParts, SHOP_TZ } from "@/lib/domain/time";
import { getWorkingWindow } from "@/lib/domain/slots";
import { ticketCode } from "@/lib/domain/queue";

export const SHOP_ID = "11111111-1111-4111-8111-111111111111";
const B = (n: number) => `aaaaaaaa-0000-4000-8000-00000000000${n}`;
const S = (n: number) => `cccccccc-0000-4000-8000-0000000000${String(n).padStart(2, "0")}`;

export const OPEN = "11:00";
export const CLOSE = "22:00";
export const LUNCH = { start: "15:00", end: "16:00", label: "Pause déjeuner" };

export const seedShop: Shop = {
  id: SHOP_ID,
  name: "Barber TWIIN",
  tagline: "Coupe • Style • Confiance",
  address: "Rabat",
  city: "Maroc",
  // Shop contact = Reda's number until a dedicated shop line exists.
  phone: "+212626941854",
  whatsapp: "+212626941854",
  email: "",
  mapsQuery: "33.982906,-6.882686",
  lat: 33.982906,
  lng: -6.882686,
  socials: { instagram: "", tiktok: "", facebook: "" },
  hours: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: OPEN, close: CLOSE })),
  timezone: SHOP_TZ,
  settings: {
    cancellation: { freeUntilHours: 2 },
    slotStepMinutes: 30, // clients choose hh:00 or hh:30 only
    minLeadMinutes: 15,
    maxDaysAhead: 30,
    lateGraceMinutes: 15,
    features: { promotions: false, loyalty: false, referrals: false, birthdayOffer: false, packages: false },
  },
};

// Prices from the shop menu. Durations are estimates — adjust them in /dashboard/services.
const svc = (n: number, slug: string, name: string, price: number, durationMinutes: number, category: Service["category"], icon: string, description: string, priceFrom = false): Service => ({
  id: S(n), slug, name, description, price, priceFrom, durationMinutes, category, icon, imageUrl: null, active: true, sortOrder: n,
});

export const seedServices: Service[] = [
  svc(1, "coupe", "Coupe", 30, 30, "cut", "scissors", "Coupe sur mesure aux ciseaux et à la tondeuse, finitions nettes."),
  svc(2, "coupe-barbe", "Coupe + Barbe", 50, 30, "combo", "crown", "La formule complète : coupe et barbe taillée."),
  svc(3, "enfants", "Coupe enfant", 25, 30, "kids", "child", "Pour les plus jeunes, dans le calme et la bonne humeur."),
  svc(4, "brushing", "Brushing", 15, 15, "styling", "brush", "Mise en forme et coiffage."),
  svc(5, "barbe", "Barbe", 20, 15, "beard", "beard", "Taille et mise en forme de la barbe."),
  svc(6, "contour", "Contour", 20, 15, "beard", "razor", "Contours précis au rasoir."),
  svc(7, "lavage", "Lavage des cheveux", 10, 10, "styling", "bottle", "Shampooing et soin rapide."),
  svc(8, "coloration-barbe", "Coloration barbe", 15, 15, "beard", "bowl", "Coloration pour une barbe uniforme."),
  svc(9, "soin-visage", "Soin visage", 100, 30, "care", "sparkles", "Nettoyage, gommage et masque pour une peau nette."),
  svc(10, "defrisage", "Défrisage", 100, 60, "treatment", "iron", "Lissage des cheveux — prix selon la longueur.", true),
  svc(11, "meches-silver", "Mèches silver", 250, 90, "treatment", "highlight", "Mèches silver — prix selon la longueur.", true),
  svc(12, "proteine", "Protéine", 250, 90, "treatment", "bottle", "Soin protéiné réparateur — prix selon la longueur.", true),
];

const allServices = seedServices.map((s) => s.id);

const barber = (n: number, slug: string, name: string, phone: string, specialties: string[]): Barber => ({
  id: B(n),
  slug,
  name,
  title: "Barbier",
  bio: `${name} vous reçoit chez Barber TWIIN pour une coupe précise et soignée, adaptée à votre style.`,
  specialties,
  experienceYears: 0,
  rating: 0,
  reviewCount: 0,
  photoUrl: `/images/barbers/${slug}.webp`,
  lineupPhotoUrl: null,
  introPhotoUrl: null, // add /images/barbers/<slug>-intro.webp (arms relaxed) to animate the arm cross
  phone,
  socials: {},
  serviceIds: allServices,
  durationOverrides: {},
  active: true,
  delayMinutes: 0,
  sortOrder: n,
});

export const seedBarbers: Barber[] = [
  barber(1, "reda", "Reda", "+212626941854", ["Taper", "Mullet", "Dégradé"]),
  barber(2, "nasro", "Nasro", "+212771357199", ["Coupe", "Barbe", "Contour"]),
  // Lineup animation uses a waist-level crop so Ziko matches Reda and Nasro; cards show the full photo.
  { ...barber(3, "ziko", "Ziko", "+212771539075", ["Fade", "Burst fade", "Coupe texturée"]), lineupPhotoUrl: "/images/barbers/ziko-lineup.webp" },
];

/**
 * Example reviews shown on the homepage only while the shop has no real approved reviews yet.
 * Always displayed with an "example" label; never stored in the database.
 */
export const SAMPLE_REVIEWS: Review[] = [
  ["Othmane F.", "reda", "Dégradé parfait, ambiance classe et surtout aucune attente grâce à la réservation. Je recommande."],
  ["Marwane N.", "ziko", "Enfin un barbier qui écoute. Résultat impeccable et le soin du visage est un vrai moment de détente."],
  ["Badr B.", "nasro", "Le système de file d'attente en direct est génial, je suis arrivé pile à l'heure. Coupe au top."],
  ["Ismail A.", "reda", "Contours au rasoir d'une précision rare. Le meilleur salon du quartier."],
].map(([authorName, slug, comment], i) => ({
  id: `rv-sample-${i + 1}`,
  appointmentId: "",
  barberId: seedBarbers.find((b) => b.slug === slug)!.id,
  authorName: authorName!,
  ratings: { barber: 5, quality: 5, waiting: 5, cleanliness: 5, overall: 5 },
  comment: comment!,
  status: "approved",
  featured: true,
  createdAt: "2026-10-01T12:00:00Z",
}));

export const seedAvailability: AvailabilityRule[] = seedBarbers.flatMap((b) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ id: `r-${b.slug}-${weekday}`, barberId: b.id, weekday, start: OPEN, end: CLOSE, breaks: [LUNCH] })),
);

// Real work from the team (Reda / Ziko alternate, in the order provided).
export const seedPortfolio: PortfolioImage[] = (
  [
    ["taper", "Low taper & design", "reda"],
    ["fade", "Low fade", "ziko"],
    ["taper", "Taper bouclé", "reda"],
    ["fade", "Burst fade & mèches rouges", "ziko"],
    ["long", "Mullet ondulé", "reda"],
    ["fade", "Burst fade mohawk", "ziko"],
    ["long", "Mullet taper", "reda"],
    ["fade", "Mid fade", "ziko"],
  ] as const
).map(([category, title, slug], i) => ({
  id: `p-${i + 1}`,
  barberId: seedBarbers.find((b) => b.slug === slug)!.id,
  category,
  title,
  description: "Réalisation Barber TWIIN.",
  imageUrl: `/images/cuts/cut-${i + 1}.webp`,
  art: null,
  date: addDays("2026-10-06", -i * 2),
  instagramUrl: null,
}));

export const DEMO_USERS: (Session & { password: string; label: string })[] = [
  { userId: "u-owner", name: "Propriétaire", email: "owner@barbertwiin.ma", role: "owner", barberId: null, customerId: null, canViewRevenue: true, password: "demo", label: "Propriétaire / Admin" },
  { userId: "u-reda", name: "Reda", email: "reda@barbertwiin.ma", role: "barber", barberId: B(1), customerId: null, canViewRevenue: false, password: "demo", label: "Barbier — Reda" },
  { userId: "u-nasro", name: "Nasro", email: "nasro@barbertwiin.ma", role: "barber", barberId: B(2), customerId: null, canViewRevenue: false, password: "demo", label: "Barbier — Nasro" },
  { userId: "u-ziko", name: "Ziko", email: "ziko@barbertwiin.ma", role: "barber", barberId: B(3), customerId: null, canViewRevenue: false, password: "demo", label: "Barbier — Ziko" },
  { userId: "u-accueil", name: "Accueil", email: "accueil@barbertwiin.ma", role: "receptionist", barberId: null, customerId: null, canViewRevenue: false, password: "demo", label: "Réception" },
];

// ─── Dynamic demo data (fictional clients, appointments relative to "now") ───

const FIRST = ["Youssef", "Omar", "Hamza", "Anas", "Ayoub", "Ilyas", "Reda", "Amine", "Zakaria", "Soufiane", "Hicham", "Othmane", "Nabil", "Karim", "Rayan", "Ismail", "Walid", "Badr", "Saad", "Adil", "Taha", "Marwane", "Imran", "Jad"];
const LAST = ["Amrani", "Bennani", "El Idrissi", "Alaoui", "Tazi", "Berrada", "Chraibi", "Fassi", "Lahlou", "Naciri", "Ouazzani", "Sqalli"];

function prng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoData {
  customers: Customer[];
  appointments: Appointment[];
  exceptions: AvailabilityException[];
  reviews: Review[];
  ticketCounter: Record<string, number>;
}

const HALF_HOUR = 30 * 60_000;
const alignUp = (d: Date) => new Date(Math.ceil(d.getTime() / HALF_HOUR) * HALF_HOUR);

export function buildDemoData(now = new Date()): DemoData {
  const rand = prng(20261006);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)]!;
  const tz = SHOP_TZ;
  const today = zonedParts(now, tz).date;

  const customers: Customer[] = Array.from({ length: 28 }, (_, i) => ({
    id: `c-${i + 1}`,
    name: `${FIRST[i % FIRST.length]} ${LAST[(i * 5) % LAST.length]}`,
    phone: `+21261${String(2000000 + i * 7919).slice(0, 7)}`,
    email: null,
    notes: i === 2 ? "Peau sensible." : i === 5 ? "Préfère un dégradé bas, garder du volume." : null,
    preferredBarberId: null,
    archived: false,
    anonymized: false,
    createdAt: addMinutes(now, -60 * 24 * (40 - i)).toISOString(),
  }));

  const lines = (ids: string[]) =>
    ids.map((id) => {
      const s = seedServices.find((x) => x.id === id)!;
      return { serviceId: id, name: s.name, price: s.price, durationMinutes: s.durationMinutes };
    });

  const appointments: Appointment[] = [];
  let idN = 0;
  const ref = () => {
    const A = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let r = "";
    for (let i = 0; i < 5; i++) r += A[Math.floor(rand() * A.length)];
    return `BT-${r}`;
  };
  const make = (p: {
    barber: Barber;
    customer: Customer;
    serviceIds: string[];
    start: Date | null;
    status: Appointment["status"];
    source?: Appointment["source"];
    arrivedAt?: Date | null;
    startedAt?: Date | null;
    note?: string;
    anyBarber?: boolean;
  }): Appointment => {
    const l = lines(p.serviceIds);
    const duration = l.reduce((s, x) => s + x.durationMinutes, 0);
    const price = l.reduce((s, x) => s + x.price, 0);
    const created = p.start ? addMinutes(p.start, -60 * 24 * 2) : (p.arrivedAt ?? now);
    const done = p.status === "completed";
    const startedAt = p.startedAt ?? (done && p.start ? p.start : null);
    return {
      id: `a-${++idN}`,
      reference: ref(),
      barberId: p.anyBarber ? null : p.barber.id,
      customerId: p.customer.id,
      customerName: p.customer.name,
      customerPhone: p.customer.phone,
      customerEmail: p.customer.email,
      services: l,
      startAt: p.start?.toISOString() ?? null,
      endAt: p.start ? addMinutes(p.start, duration).toISOString() : null,
      durationMinutes: duration,
      totalPrice: price,
      finalPrice: null,
      status: p.status,
      source: p.source ?? (p.start ? "online" : "walk_in"),
      note: p.note ?? null,
      lateCancellation: false,
      createdAt: created.toISOString(),
      updatedAt: created.toISOString(),
      confirmedAt: p.status !== "pending" && p.start ? created.toISOString() : null,
      arrivedAt: p.arrivedAt?.toISOString() ?? (done && p.start ? addMinutes(p.start, -6).toISOString() : null),
      startedAt: startedAt?.toISOString() ?? null,
      completedAt: done && startedAt ? addMinutes(startedAt, duration).toISOString() : null,
      cancelledAt: p.status === "cancelled" ? created.toISOString() : null,
      queue: null,
    };
  };

  // History: last 21 days, for analytics & customer history.
  const combos = [[S(1)], [S(2)], [S(2)], [S(1), S(5)], [S(3)], [S(1), S(6)], [S(9)], [S(2), S(4)], [S(1)], [S(10)]];
  for (let d = 21; d >= 1; d--) {
    const date = addDays(today, -d);
    for (const b of seedBarbers) {
      const w = getWorkingWindow(date, seedAvailability.filter((r) => r.barberId === b.id), [], tz);
      if (!w) continue;
      let t = addMinutes(w.start, Math.floor(rand() * 3) * 30);
      const count = 6 + Math.floor(rand() * 6);
      for (let i = 0; i < count && t < w.end; i++) {
        const a = make({ barber: b, customer: pick(customers), serviceIds: pick(combos), start: t, status: "completed" });
        if (new Date(a.endAt!) > w.end) break;
        if (w.breaks.some((br) => t < br.end && new Date(a.endAt!) > br.start)) {
          t = w.breaks[0]!.end;
          continue;
        }
        const roll = rand();
        if (roll < 0.06) {
          a.status = "cancelled";
          a.startedAt = a.completedAt = a.arrivedAt = null;
          a.cancelledAt = addMinutes(t, -300).toISOString();
        } else if (roll < 0.1) {
          a.status = "no_show";
          a.startedAt = a.completedAt = a.arrivedAt = null;
        } else if (roll < 0.3) {
          a.source = "walk_in";
          a.arrivedAt = addMinutes(t, -Math.floor(rand() * 25)).toISOString();
        }
        appointments.push(a);
        t = addMinutes(alignUp(new Date(a.endAt!)), Math.floor(rand() * 2) * 30);
      }
    }
  }

  // Today: keep the demo "alive" whatever the time (exceptional opening when closed).
  const exceptions: AvailabilityException[] = [];
  const nowMin = zonedParts(now, tz).minutes;
  const base = new Date(Math.floor(now.getTime() / HALF_HOUR) * HALF_HOUR);
  for (const b of seedBarbers) {
    const w = getWorkingWindow(today, seedAvailability.filter((r) => r.barberId === b.id), [], tz);
    const inside = w && now >= addMinutes(w.start, 30) && now <= addMinutes(w.end, -150);
    if (!inside) {
      const s = Math.max(0, Math.floor((nowMin - 150) / 30) * 30);
      const e = Math.min(23 * 60 + 30, Math.ceil((nowMin + 210) / 30) * 30);
      const hm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      exceptions.push({ id: `x-${b.id}`, barberId: b.id, date: today, start: hm(s), end: hm(e), note: "Ouverture exceptionnelle (démo)" });
    }
  }

  const [reda, nasro, ziko] = seedBarbers as [Barber, Barber, Barber];
  const c = (i: number) => customers[i]!;
  const at = (m: number) => addMinutes(base, m);
  const todayAppts = [
    make({ barber: reda, customer: c(0), serviceIds: [S(1)], start: at(-120), status: "completed" }),
    make({ barber: reda, customer: c(1), serviceIds: [S(2)], start: at(-60), status: "completed" }),
    make({ barber: reda, customer: c(2), serviceIds: [S(1), S(6)], start: at(0), status: "confirmed", note: "Dégradé bas, garder la longueur sur le dessus." }),
    make({ barber: reda, customer: c(3), serviceIds: [S(5)], start: null, status: "waiting", arrivedAt: at(-10) }),
    make({ barber: reda, customer: c(4), serviceIds: [S(1)], start: at(60), status: "late" }),
    make({ barber: reda, customer: c(5), serviceIds: [S(2), S(9)], start: at(90), status: "confirmed", note: "Soin visage si le temps le permet." }),
    make({ barber: nasro, customer: c(7), serviceIds: [S(1)], start: at(-90), status: "completed" }),
    make({ barber: nasro, customer: c(8), serviceIds: [S(2)], start: null, status: "in_progress", arrivedAt: at(-25), startedAt: at(-10) }),
    make({ barber: nasro, customer: c(9), serviceIds: [S(1)], start: null, status: "waiting", arrivedAt: at(-6) }),
    make({ barber: nasro, customer: c(10), serviceIds: [S(4)], start: at(60), status: "confirmed" }),
    make({ barber: nasro, customer: c(14), serviceIds: [S(3)], start: at(120), status: "cancelled" }),
    make({ barber: ziko, customer: c(11), serviceIds: [S(2)], start: at(-90), status: "completed" }),
    make({ barber: ziko, customer: c(12), serviceIds: [S(1)], start: at(-30), status: "no_show" }),
    make({ barber: ziko, customer: c(13), serviceIds: [S(9)], start: at(30), status: "confirmed", note: "Peau sensible." }),
    make({ barber: ziko, customer: c(16), serviceIds: [S(11)], start: at(90), status: "confirmed" }),
    make({ barber: reda, customer: c(15), serviceIds: [S(1)], start: null, status: "waiting", arrivedAt: at(-3), anyBarber: true }),
  ];
  appointments.push(...todayAppts);

  // Queue tickets for everyone who arrived today.
  const counter: Record<string, number> = { [today]: 0 };
  appointments
    .filter((a) => a.arrivedAt && zonedParts(new Date(a.arrivedAt), tz).date === today)
    .sort((x, y) => +new Date(x.arrivedAt!) - +new Date(y.arrivedAt!))
    .forEach((a) => {
      const n = ++counter[today]!;
      a.queue = { id: `q-${a.id}`, appointmentId: a.id, ticketNumber: n, ticketCode: ticketCode(n), arrivedAt: a.arrivedAt!, priority: 0, bumpMinutes: 0, waitAdjustMinutes: 0 };
    });

  // Sample reviews — DEMO MODE ONLY (in-memory store). They are not in supabase/seed.sql,
  // so production only ever shows real, approved client reviews.
  const comments = [
    "Contours au rasoir d'une précision rare. Le meilleur salon du quartier.",
    "Le système de file d'attente en direct est génial, je suis arrivé pile à l'heure. Coupe au top.",
    "Enfin un barbier qui écoute. Résultat impeccable et le soin du visage est un vrai moment de détente.",
    "Dégradé parfait, ambiance classe et surtout aucune attente grâce à la réservation. Je recommande.",
  ];
  const completed = appointments.filter((a) => a.status === "completed" && a.barberId);
  const reviews: Review[] = comments.map((comment, i) => {
    const a = completed[(i * 17) % completed.length]!;
    const [first, last] = a.customerName.split(" ");
    return {
      id: `rv-demo-${i + 1}`,
      appointmentId: a.id,
      barberId: seedBarbers[i % seedBarbers.length]!.id,
      authorName: `${first} ${last?.[0] ?? ""}.`,
      ratings: { barber: 5, quality: 5, waiting: 5, cleanliness: 5, overall: 5 },
      comment,
      status: "approved",
      featured: true,
      createdAt: a.completedAt ?? a.createdAt,
    };
  });

  return { customers, appointments, exceptions, reviews, ticketCounter: counter };
}
