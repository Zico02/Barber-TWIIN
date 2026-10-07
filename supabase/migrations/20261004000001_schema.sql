-- ═══════════════════════════════════════════════════════════════════════
-- Barber TWIIN — core schema
-- ═══════════════════════════════════════════════════════════════════════
create extension if not exists btree_gist;
create extension if not exists pgcrypto;

create type app_role as enum ('owner', 'barber', 'receptionist', 'customer');
create type appointment_status as enum (
  'pending', 'confirmed', 'arrived', 'waiting', 'called', 'in_progress', 'completed', 'cancelled', 'no_show'
);
create type appointment_source as enum ('online', 'walk_in', 'phone', 'dashboard');
create type block_kind as enum ('day_off', 'time_block', 'vacation', 'closure', 'break');
create type review_status as enum ('pending', 'approved', 'rejected');
create type notification_channel as enum ('email', 'whatsapp', 'sms');
create type notification_status as enum ('queued', 'sent', 'failed', 'manual');

-- ── Shops ───────────────────────────────────────────────────────────────
create table public.shops (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  tagline     text,
  address     text,
  city        text,
  phone       text,
  whatsapp    text,
  email       text,
  maps_query  text,
  lat         double precision,
  lng         double precision,
  socials     jsonb not null default '{}'::jsonb,
  hours       jsonb not null default '[]'::jsonb,
  timezone    text not null default 'Africa/Casablanca',
  settings    jsonb not null default '{
    "cancellation": {"freeUntilHours": 2},
    "slotStepMinutes": 15,
    "minLeadMinutes": 30,
    "maxDaysAhead": 30,
    "lateGraceMinutes": 15,
    "features": {"promotions": false, "loyalty": false, "referrals": false, "birthdayOffer": false, "packages": false}
  }'::jsonb,
  created_at  timestamptz not null default now()
);

-- ── Barbers ─────────────────────────────────────────────────────────────
create table public.barbers (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete cascade,
  slug             text not null unique,
  name             text not null,
  title            text not null default '',
  bio              text not null default '',
  specialties      text[] not null default '{}',
  experience_years int not null default 0 check (experience_years >= 0),
  rating           numeric(2, 1) not null default 5.0 check (rating between 0 and 5),
  review_count     int not null default 0,
  photo_url        text,
  socials          jsonb not null default '{}'::jsonb,
  active           boolean not null default true,
  delay_minutes    int not null default 0 check (delay_minutes between 0 and 240),
  sort_order       int not null default 0,
  created_at       timestamptz not null default now()
);

-- ── Customers (private) ─────────────────────────────────────────────────
create table public.customers (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references public.shops (id) on delete cascade,
  name                text not null,
  phone               text,               -- E.164, null once anonymized
  email               text,
  notes               text,
  preferred_barber_id uuid references public.barbers (id) on delete set null,
  archived            boolean not null default false,
  anonymized          boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (shop_id, phone)
);

-- ── Profiles (1-1 with auth.users) ──────────────────────────────────────
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  shop_id          uuid references public.shops (id) on delete set null,
  role             app_role not null default 'customer',
  full_name        text,
  barber_id        uuid references public.barbers (id) on delete set null,
  customer_id      uuid references public.customers (id) on delete set null,
  can_view_revenue boolean not null default false,
  created_at       timestamptz not null default now(),
  constraint barber_role_has_barber check (role <> 'barber' or barber_id is not null)
);

-- ── Services ────────────────────────────────────────────────────────────
create table public.services (
  id               uuid primary key default gen_random_uuid(),
  shop_id          uuid not null references public.shops (id) on delete cascade,
  slug             text not null,
  name             text not null,
  description      text not null default '',
  price            int not null check (price >= 0),          -- dirhams
  duration_minutes int not null check (duration_minutes between 5 and 480),
  category         text not null default 'cut'
                   check (category in ('cut', 'beard', 'combo', 'care', 'kids', 'styling')),
  icon             text not null default 'scissors',
  image_url        text,
  active           boolean not null default true,
  sort_order       int not null default 0,
  created_at       timestamptz not null default now(),
  unique (shop_id, slug)
);

create table public.barber_services (
  barber_id         uuid not null references public.barbers (id) on delete cascade,
  service_id        uuid not null references public.services (id) on delete cascade,
  duration_override int check (duration_override between 5 and 480),
  primary key (barber_id, service_id)
);

-- ── Availability ────────────────────────────────────────────────────────
create table public.availability (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  weekday    smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time   time not null,
  breaks     jsonb not null default '[]'::jsonb,   -- [{start:"13:00", end:"14:00", label:"Déjeuner"}]
  check (start_time < end_time),
  unique (barber_id, weekday)
);

create table public.availability_exceptions (
  id         uuid primary key default gen_random_uuid(),
  barber_id  uuid not null references public.barbers (id) on delete cascade,
  date       date not null,
  start_time time not null,
  end_time   time not null,
  note       text,
  check (start_time < end_time),
  unique (barber_id, date)
);

create table public.blocked_periods (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid not null references public.shops (id) on delete cascade,
  barber_id  uuid references public.barbers (id) on delete cascade, -- null = whole shop
  kind       block_kind not null,
  period     tstzrange not null check (not isempty(period)),
  reason     text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
create index blocked_periods_period_idx on public.blocked_periods using gist (barber_id, period);

-- ── Appointments ────────────────────────────────────────────────────────
create table public.appointments (
  id                uuid primary key default gen_random_uuid(),
  shop_id           uuid not null references public.shops (id) on delete cascade,
  reference         text not null unique,
  barber_id         uuid references public.barbers (id) on delete restrict,
  customer_id       uuid not null references public.customers (id) on delete restrict,
  customer_name     text not null,     -- snapshot (anonymized together with the customer)
  customer_phone    text,
  customer_email    text,
  start_at          timestamptz,       -- null for walk-ins; never overwritten by queue moves
  end_at            timestamptz,
  during            tstzrange generated always as (
                      case when start_at is not null then tstzrange(start_at, end_at, '[)') end
                    ) stored,
  duration_minutes  int not null check (duration_minutes between 5 and 600),
  total_price       int not null check (total_price >= 0),
  final_price       int check (final_price >= 0),
  status            appointment_status not null default 'pending',
  source            appointment_source not null default 'online',
  note              text check (char_length(note) <= 500),
  inspiration_url   text,
  late_cancellation boolean not null default false,
  cancel_reason     text,
  confirmed_at      timestamptz,
  arrived_at        timestamptz,
  called_at         timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check ((start_at is null) = (end_at is null)),
  check (end_at is null or end_at > start_at),
  check (barber_id is not null or source = 'walk_in'),
  check (start_at is not null or source = 'walk_in'),
  -- ⚑ Double booking is impossible: two active appointments of the same barber
  --   can never overlap, even under concurrent requests.
  constraint no_double_booking exclude using gist (barber_id with =, during with &&)
    where (during is not null and status not in ('cancelled', 'no_show'))
);
create index appointments_barber_start_idx on public.appointments (barber_id, start_at);
create index appointments_customer_idx on public.appointments (customer_id);
create index appointments_status_idx on public.appointments (status);

create table public.appointment_services (
  id               uuid primary key default gen_random_uuid(),
  appointment_id   uuid not null references public.appointments (id) on delete cascade,
  service_id       uuid references public.services (id) on delete set null,
  name             text not null,      -- snapshot at booking time
  price            int not null,
  duration_minutes int not null,
  position         smallint not null default 0
);
create index appointment_services_appt_idx on public.appointment_services (appointment_id);

-- ── Queue tickets (walk-ins and arrived appointment holders) ────────────
create table public.walk_in_queue (
  id                  uuid primary key default gen_random_uuid(),
  shop_id             uuid not null references public.shops (id) on delete cascade,
  appointment_id      uuid not null unique references public.appointments (id) on delete cascade,
  barber_id           uuid references public.barbers (id) on delete set null,
  customer_id         uuid references public.customers (id) on delete set null,
  queue_date          date not null,
  ticket_number       int not null,
  ticket_code         text not null,
  arrived_at          timestamptz not null,  -- original arrival, never overwritten
  priority            smallint not null default 0 check (priority between 0 and 3),
  bump_minutes        int not null default 0 check (bump_minutes >= 0),
  wait_adjust_minutes int not null default 0,
  created_at          timestamptz not null default now(),
  unique (shop_id, queue_date, ticket_number)
);

-- ── Portfolio ───────────────────────────────────────────────────────────
create table public.portfolio_images (
  id            uuid primary key default gen_random_uuid(),
  shop_id       uuid not null references public.shops (id) on delete cascade,
  barber_id     uuid not null references public.barbers (id) on delete cascade,
  category      text not null check (category in ('fade','taper','beard','classic','long','kids','before_after','facial')),
  title         text not null,
  description   text not null default '',
  image_url     text,
  storage_path  text,
  art           text,
  taken_on      date not null default current_date,
  instagram_url text,
  created_at    timestamptz not null default now()
);

-- ── Reviews ─────────────────────────────────────────────────────────────
create table public.reviews (
  id                 uuid primary key default gen_random_uuid(),
  appointment_id     uuid not null unique references public.appointments (id) on delete cascade,
  barber_id          uuid not null references public.barbers (id) on delete cascade,
  author_name        text not null,
  rating_barber      smallint not null check (rating_barber between 1 and 5),
  rating_quality     smallint not null check (rating_quality between 1 and 5),
  rating_waiting     smallint not null check (rating_waiting between 1 and 5),
  rating_cleanliness smallint not null check (rating_cleanliness between 1 and 5),
  rating_overall     smallint not null check (rating_overall between 1 and 5),
  comment            text not null check (char_length(comment) between 5 and 600),
  status             review_status not null default 'pending',
  featured           boolean not null default false,
  created_at         timestamptz not null default now()
);

-- ── Notifications outbox ────────────────────────────────────────────────
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  shop_id        uuid not null references public.shops (id) on delete cascade,
  appointment_id uuid references public.appointments (id) on delete set null,
  customer_id    uuid references public.customers (id) on delete set null,
  channel        notification_channel not null,
  template       text not null,
  recipient      text not null,
  body           text not null,
  status         notification_status not null default 'queued',
  provider_id    text,
  error          text,
  created_by     uuid references auth.users (id) on delete set null,
  created_at     timestamptz not null default now()
);

-- ── Future phase: promotions & loyalty (feature-flagged off) ────────────
create table public.promotions (
  id          uuid primary key default gen_random_uuid(),
  shop_id     uuid not null references public.shops (id) on delete cascade,
  code        text,
  kind        text not null check (kind in ('code', 'first_visit', 'birthday', 'package', 'referral')),
  percent_off int check (percent_off between 1 and 100),
  amount_off  int check (amount_off > 0),
  service_ids uuid[] not null default '{}',
  starts_at   timestamptz,
  ends_at     timestamptz,
  max_uses    int,
  uses        int not null default 0,
  active      boolean not null default false,
  created_at  timestamptz not null default now(),
  unique (shop_id, code)
);

create table public.customer_loyalty (
  customer_id   uuid primary key references public.customers (id) on delete cascade,
  points        int not null default 0,
  visits        int not null default 0,
  tier          text not null default 'bronze' check (tier in ('bronze', 'silver', 'gold', 'black')),
  referral_code text unique,
  referred_by   uuid references public.customers (id) on delete set null,
  birthday      date,
  updated_at    timestamptz not null default now()
);

-- ── Audit log ───────────────────────────────────────────────────────────
create table public.audit_logs (
  id         uuid primary key default gen_random_uuid(),
  shop_id    uuid references public.shops (id) on delete cascade,
  actor_id   uuid references auth.users (id) on delete set null,
  actor_name text not null,
  action     text not null,
  entity     text not null,
  entity_id  text not null,
  details    jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on public.audit_logs (created_at desc);

-- ── updated_at trigger ──────────────────────────────────────────────────
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger appointments_touch before update on public.appointments
  for each row execute function public.touch_updated_at();

-- Realtime for live queue screens
alter publication supabase_realtime add table public.appointments, public.walk_in_queue, public.barbers;
