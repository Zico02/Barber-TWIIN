# Barber TWIIN — Architecture

> Premium barbering, organized service and no unnecessary waiting.

## 1. Architecture proposal

```
┌───────────────────────────── Next.js 15 (App Router, Vercel) ─────────────────────────────┐
│                                                                                            │
│  Public pages (RSC)        Booking wizard (client)      Dashboard (RSC + client islands)    │
│  /, /barbiers, /services   /reservation                 /dashboard/*  (role-guarded)        │
│  /realisations, /contact   /ma-reservation              Queue board (dnd-kit)               │
│  /file-attente, /affichage                                                                  │
│            │                         │                              │                       │
│            └──────────── Server Actions (src/actions/*) ────────────┘                       │
│                         zod validation → permission check → domain logic                    │
│                                         │                                                   │
│              src/lib/domain/*  (pure TypeScript, unit-testable, no I/O)                     │
│              slots · queue priority · waiting estimate · pricing · permissions · notifs     │
│                                         │                                                   │
│              src/lib/repo/  Repository interface                                            │
│                 ├── supabase.ts  → Supabase Postgres (+ RLS, RPC, Realtime, Storage)         │
│                 └── memory.ts    → in-memory demo store (used when no Supabase env vars)    │
└────────────────────────────────────────────────────────────────────────────────────────────┘
```

* **Single source of business rules**: slot generation, double-booking checks, queue ordering
  and waiting-time estimation live in `src/lib/domain` and run **on the server**.
* **Defense in depth**: the database also enforces the critical invariants:
  * a `btree_gist` **exclusion constraint** makes overlapping appointments for the same barber
    impossible, even with two simultaneous requests;
  * the `book_appointment` RPC re-validates working hours, breaks, blocked periods and
    service/barber compatibility inside one transaction;
  * **Row Level Security** restricts every table by role.
* **Demo mode**: without `NEXT_PUBLIC_SUPABASE_URL`, the app runs against a seeded in-memory
  store so the whole product (booking, queue, dashboards) can be tried locally immediately.
  Demo mode is refused in production unless `ALLOW_DEMO_MODE=true`.

## 2. Database schema (summary — see `supabase/migrations`)

| Table | Purpose |
|---|---|
| `shops` | Shop info, address, hours text, socials, cancellation policy, settings JSON |
| `profiles` | 1-1 with `auth.users`: role (`owner`/`barber`/`receptionist`/`customer`), `barber_id`, `customer_id` |
| `barbers` | Public profile: slug, bio, specialties, experience, rating, socials, `delay_minutes` |
| `customers` | Private customer record: name, phone, email, notes, preferred barber, archived/anonymized |
| `services` | Name, description, price (DH), duration, category, icon, active |
| `barber_services` | M-N barbers ↔ services (+ optional per-barber duration override) |
| `availability` | Weekly recurring hours per barber (weekday, start, end, breaks JSON) |
| `availability_exceptions` | Exceptional open hours on a given date |
| `blocked_periods` | Day off / time block / vacation / closure / break (tstzrange) |
| `appointments` | One customer × one barber; status, time range (`during` tstzrange), totals, note, reference, source |
| `appointment_services` | Snapshot of services booked (name, price, duration at booking time) |
| `walk_in_queue` | Queue ticket for anyone physically in the shop (walk-in or arrived appointment): ticket code, arrival time, priority, bump, manual wait adjustment |
| `portfolio_images` | Gallery entries (barber, category, title, description, storage path, Instagram) |
| `reviews` | Linked to a **completed** appointment; 5 rating axes; `pending/approved/rejected`, `featured` |
| `notifications` | Outbox: channel, template, rendered body, status — ready for email/WhatsApp/SMS providers |
| `promotions`, `customer_loyalty` | Future phase (feature-flagged off) |
| `audit_logs` | Who changed what (status changes, cancellations, price adjustments) |

Relationships: barber → shop; barber ⟷ service (M-N); appointment → customer & barber;
appointment → many appointment_services; availability/blocked_periods → barber;
walk_in_queue → appointment, barber, customer; portfolio → barber; review → appointment.

## 3. User roles

| Role | Can do |
|---|---|
| **Owner / Admin** | Everything: all barbers, prices, services, analytics & revenue, reviews moderation, settings |
| **Barber** | Own calendar, availability, blocked periods, reservations, queue, customers (only those who booked them), portfolio, performance |
| **Receptionist** | Bookings, walk-ins, customers and queues for **all** barbers; no revenue/settings unless `can_view_revenue` |
| **Customer** | Own reservations (via account or reference + phone), reviews of own completed visits |
| **Public** | Public barber profiles, active services, gallery, approved reviews, shop info, anonymized queue |

## 4. Main routes

Public: `/` · `/barbiers` · `/barbiers/[slug]` · `/services` · `/realisations` · `/reservation` ·
`/file-attente` · `/affichage` (TV mode) · `/a-propos` · `/contact` · `/ma-reservation` · `/connexion`

Dashboard: `/dashboard` (overview + analytics) · `/dashboard/file` (queue board) ·
`/dashboard/agenda` · `/dashboard/disponibilites` · `/dashboard/clients` ·
`/dashboard/services` · `/dashboard/portfolio` · `/dashboard/avis` · `/dashboard/notifications`

API: `/api/queue` (public anonymized queue JSON, used by `/file-attente` and `/affichage`) ·
`/api/slots` (available slots for barber/date/services)

## 5. Component structure

```
src/components
├── ui/          Button, Card, Badge (StatusBadge), Input/Select/Textarea, Dialog/Confirm, Empty, Spinner
├── layout/      Navbar, Footer, MobileBookBar, Logo (wordmark), LanguageSwitcher, MarbleSection
├── home/        Hero, QuickBooking, FeaturedServices, FeaturedBarbers, GalleryPreview,
│                HowItWorks, LiveWaitPreview, Reviews, ShopInfo
├── booking/     BookingWizard (8 steps), ServicePicker, BarberPicker, DatePicker, SlotGrid, Summary
├── queue/       PublicQueue, ShopDisplay
├── gallery/     GalleryGrid (filterable), GalleryArt (placeholder art)
└── dashboard/   Sidebar, QueueBoard (dnd), WalkInDialog, AvailabilityEditor, BlockForm,
                 CustomersTable, ServicesManager, PortfolioManager, ReviewsModeration, Charts
```

## 6. Reservation logic

1. Customer picks services → total **price** = Σ prices, total **duration** = Σ durations
   (per-barber override if defined).
2. Barber list is filtered to barbers who provide **all** selected services.
3. For a date, `generateSlots()` builds candidate starts every 15 min inside the barber's
   working window (weekly rule, or exception for that date), then rejects any start where
   `[start, start + totalDuration)` overlaps: a break, a blocked period, an existing
   non-cancelled appointment, the end of the working window, or `now + lead time`.
   ⇒ The **whole** 80-minute period is checked, not only the starting slot.
4. On confirmation the server action re-validates input (zod) and re-runs the check;
   in Supabase mode `book_appointment()` re-checks inside a transaction and the
   exclusion constraint guarantees no overlap under concurrency ("créneau déjà réservé").
5. A human-friendly reference (`BT-7K4Q2`) is returned; lookup requires **reference + phone**.
6. Cancelling / no-show frees the range (the constraint only covers active statuses).
7. Cancellation policy (`shops.settings.cancellation`): free until N hours before; later is
   recorded as `late_cancellation = true`; no-shows counted on the customer.

## 7. Queue-priority logic ("Appeler le suivant")

Candidates: today's entries for this barber (or "any barber") with status `arrived` / `waiting`.

1. **Due appointments first** — appointment holders present whose start time ≤ now + 5 min,
   ordered by appointment time. A holder more than 15 min late loses this priority and is
   treated like a walk-in from their arrival time.
2. **Then everyone else** by *effective arrival* = `arrived_at + bump_minutes`
   (`bump` grows when a barber moves a client lower).
3. Within the same class, a higher manual `priority` (child, elderly, VIP) goes first.
4. **Fit check**: a walk-in is skipped if their service would overrun the barber's next
   booked appointment (that hasn't arrived yet) by more than 5 min — unless nobody else fits.
5. The barber must be free (no `in_progress` client) — otherwise the action refuses.

Original `arrived_at` and appointment `start_at` are never overwritten; moves only touch
`bump_minutes` / status timestamps, all recorded in `audit_logs`.

## 8. Waiting-time estimation

Per barber, starting from *now*:
`t = now + remaining(in_progress) + barber.delay_minutes`, then walking the ordered queue,
interleaving upcoming booked appointments that would start before the next client
finishes, skipping break periods. Each client's estimate is `t − now + manual_adjust`,
rounded to 5 min and displayed as **"environ 25 min"** — never a guarantee.
The barber can set a delay or adjust an individual estimate from the queue board.
