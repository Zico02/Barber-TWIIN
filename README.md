# Barber TWIIN

Premium barbershop website **and** operations system: online booking without double-booking,
live waiting list, walk-in queue, barber dashboards, owner analytics.

Black-marble & gold identity · French first (EN / AR + RTL ready) · Next.js 15 · TypeScript ·
Tailwind · Supabase (Postgres, Auth, RLS, Storage, Realtime) · Vercel.

> Architecture, schema, roles, routes, reservation & queue-priority logic → **[ARCHITECTURE.md](ARCHITECTURE.md)**

---

## 1. Quick start (demo mode — no setup)

```bash
npm install
npm run dev
```

Open http://localhost:3000. Without Supabase variables the app runs on a **seeded in-memory
store**: everything works (booking, lookup, queue, dashboards). Data resets when the server restarts.

Staff area: http://localhost:3000/connexion → pick a demo profile
(Propriétaire, Reda, Nasro, Ziko, Réception). Barbers land on **Ma journée**.

```bash
npm test          # domain unit tests (slots, double booking, queue priority, waiting time…)
npm run typecheck
npm run build
```

## 2. Pages

| Public | Staff (`/dashboard`) |
|---|---|
| `/` Accueil · `/barbiers` · `/barbiers/[slug]` · `/services` · `/realisations` | Vue d'ensemble & analytics |
| `/reservation` (7-step booking) · `/ma-reservation` (lookup / cancel / reschedule / review) | `/file` queue board (drag & drop, call next, walk-ins) |
| `/file-attente` live waiting list · `/affichage` TV / tablet screen | `/journee` **Ma journée**: clients by time (hh:00 / hh:30), call & WhatsApp, Terminé / Retard / Annulé, total du jour, drag & drop, + temps, bloquer une heure ou la journée |
| | `/agenda` · `/disponibilites` · `/clients` |
| `/a-propos` · `/contact` · `/connexion` | `/services` · `/portfolio` · `/avis` · `/notifications` |

## 3. Production setup with Supabase

1. **Create a project** on https://supabase.com (region close to Morocco, e.g. `eu-west`).
2. **Apply the migrations** (SQL editor, in order, or the CLI):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push            # runs supabase/migrations/*
   psql "$DATABASE_URL" -f supabase/seed.sql   # or paste seed.sql in the SQL editor
   ```
   Migrations create: tables, the `no_double_booking` exclusion constraint, RPCs
   (`book_appointment`, `lookup_booking`, `cancel_booking`, `reschedule_booking`, `submit_review`,
   `public_queue`, `create_walk_in`…), Row Level Security policies, the `portfolio` storage bucket
   and Realtime publication.
3. **Edit the shop**: replace the placeholder address, phone, socials, barbers and services in
   `src/lib/repo/seed.ts`, then `npx tsx scripts/generate-seed-sql.ts` to regenerate `seed.sql`
   (or edit rows in the Supabase table editor — prices can be changed later from `/dashboard/services`).
4. **Create staff accounts**: Authentication → Users → *Add user* (email + password) for the owner,
   each barber and the receptionist. Then run the role grants at the bottom of `supabase/seed.sql`
   (owner → `owner`, each barber → `barber` + `barber_id`, receptionist → `receptionist`).
   Set `can_view_revenue = true` on a receptionist profile to give revenue access.
5. **Environment variables** (`.env.local`, see `.env.example`):
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   NEXT_PUBLIC_SITE_URL=https://barbertwiin.ma
   ```
   The app only uses the **anon key**: every query runs as the visitor and is filtered by RLS;
   public operations go through SECURITY DEFINER RPCs that validate everything server-side.
   `SUPABASE_SERVICE_ROLE_KEY` is not needed at runtime (keep it out of the browser).

## 4. Deploy on Vercel

1. Push the repository to GitHub and import it in Vercel (framework auto-detected: Next.js).
2. Add the environment variables above (Production + Preview).
3. Deploy. Add your domain, then set `NEXT_PUBLIC_SITE_URL` to it.
4. Supabase → Authentication → URL configuration: add the Vercel/production URL.

Demo mode is **refused in production** unless `ALLOW_DEMO_MODE=true` (useful for a staging preview).

## 5. How the critical rules are enforced

| Rule | Where |
|---|---|
| A slot shows as free only if the **whole** multi-service period is free | `src/lib/domain/slots.ts` (`checkRange`) |
| No double booking, even with simultaneous requests | `no_double_booking` exclusion constraint + `book_appointment()` re-check |
| Prices / durations never trusted from the browser | recomputed in `book_appointment()` from `services` / `barber_services` |
| Cancelling / no-show frees the slot | constraint ignores `cancelled` & `no_show` |
| Barber sees only his own data | RLS policies + `resolveBarberScope()` in every page/action |
| Booking lookup requires reference **and** phone | `find_booking()` RPC — same "not found" for wrong phone |
| Public queue never exposes names/phones | `public_queue()` returns initials + ticket codes only |
| History kept for analytics | no hard deletes; customers are archived / anonymized |
| Queue moves keep original times | `walk_in_queue.arrived_at` & `appointments.start_at` never overwritten; `bump_minutes` instead |

## 6. Notifications

Templates (FR/EN/AR) live in `src/lib/domain/notifications.ts`: booking confirmation, reminder,
modification, cancellation, barber delay, barber ready, review request. Every message is stored in
the `notifications` outbox. In this release staff send them in one click via **WhatsApp / SMS /
e-mail links** from the queue board and agenda.

To automate: implement a `NotificationProvider` (e.g. Resend for e-mail, Twilio or Meta WhatsApp
Cloud API) in `configuredProviders()`, and add a scheduled job (Vercel Cron or Supabase Edge
Function + `pg_cron`) that sends `queued` messages and reminders ~2 h before appointments.

## 7. Languages

French is the default. EN is complete, AR covers the public interface (falls back to FR) and the
layout switches to RTL (`dir="rtl"`, logical `ms-/me-/start/end` utilities, Tajawal font).
Dictionaries: `src/lib/i18n/{fr,en,ar}.ts`. The language switcher stores a cookie.

## 8. Future phase (prepared, disabled)

`promotions` and `customer_loyalty` tables, `src/lib/domain/loyalty.ts` (tiers, "10 visits → 1
free", promo application) and `shop.settings.features` flags: promo codes, first-visit discount,
loyalty points, referrals, birthday offer, packages, membership levels.

## 9. Before launch checklist

- [ ] Street address, shop phone (currently Reda's number), e-mail and social links (`shops` row)
- [ ] Service durations (estimates — prices come from the shop menu)
- [ ] Barber bios and specialties (photos and first cuts are in place)
- [ ] Final prices & durations (`/dashboard/services`)
- [ ] Cancellation policy hours (`shops.settings.cancellation.freeUntilHours`)
- [ ] Add rate limiting on the public booking/lookup endpoints (e.g. Vercel Firewall or Upstash)

## Project structure

```
src/
  app/(site)/…            public pages (Navbar, Footer, sticky mobile Book Now)
  app/dashboard/…         staff pages (role-guarded)
  app/affichage           TV display     app/api/queue   public anonymized queue JSON
  actions/                server actions (zod validation → permission check → domain → repo)
  components/             ui · brand · site · booking · queue · dashboard
  lib/domain/             pure business rules + unit tests
  lib/repo/               Repository interface · supabase.ts · memory.ts (demo) · seed.ts
  lib/i18n/               dictionaries + server/client helpers
supabase/migrations/      schema · functions (RPC) · RLS          supabase/seed.sql
```
