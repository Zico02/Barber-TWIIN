-- ═══════════════════════════════════════════════════════════════════════
-- Row Level Security
--   public        → barbers, services, availability, portfolio, approved reviews, shop
--   customer      → own customer row & own appointments
--   barber        → own appointments / queue / availability / portfolio,
--                   and only customers who booked with them
--   receptionist  → all operational data (no revenue settings)
--   owner         → everything
-- Public booking & lookup go through SECURITY DEFINER RPCs (see functions migration).
-- ═══════════════════════════════════════════════════════════════════════

alter table public.shops                   enable row level security;
alter table public.profiles                enable row level security;
alter table public.barbers                 enable row level security;
alter table public.customers               enable row level security;
alter table public.services                enable row level security;
alter table public.barber_services         enable row level security;
alter table public.availability            enable row level security;
alter table public.availability_exceptions enable row level security;
alter table public.blocked_periods         enable row level security;
alter table public.appointments            enable row level security;
alter table public.appointment_services    enable row level security;
alter table public.walk_in_queue           enable row level security;
alter table public.portfolio_images        enable row level security;
alter table public.reviews                 enable row level security;
alter table public.notifications           enable row level security;
alter table public.promotions              enable row level security;
alter table public.customer_loyalty        enable row level security;
alter table public.audit_logs              enable row level security;

-- ── shops ──
create policy shops_read on public.shops for select using (true);
create policy shops_admin on public.shops for update using (public.is_admin()) with check (public.is_admin());

-- ── profiles ── (nobody can change their own role)
create policy profiles_self on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy profiles_admin_write on public.profiles for all using (public.is_admin()) with check (public.is_admin());

-- ── barbers ──
create policy barbers_read on public.barbers for select using (active or public.is_staff());
create policy barbers_admin on public.barbers for all using (public.is_admin()) with check (public.is_admin());
create policy barbers_self_update on public.barbers for update
  using (id = public.auth_barber_id()) with check (id = public.auth_barber_id());

-- ── services & barber_services ──
create policy services_read on public.services for select using (active or public.is_staff());
create policy services_admin on public.services for all using (public.is_admin()) with check (public.is_admin());
create policy barber_services_read on public.barber_services for select using (true);
create policy barber_services_admin on public.barber_services for all using (public.is_admin()) with check (public.is_admin());

-- ── availability (hours are public; writes: operator or the barber himself) ──
create policy availability_read on public.availability for select using (true);
create policy availability_write on public.availability for all
  using (public.is_operator() or barber_id = public.auth_barber_id())
  with check (public.is_operator() or barber_id = public.auth_barber_id());

create policy exceptions_read on public.availability_exceptions for select using (true);
create policy exceptions_write on public.availability_exceptions for all
  using (public.is_operator() or barber_id = public.auth_barber_id())
  with check (public.is_operator() or barber_id = public.auth_barber_id());

-- Blocked periods may contain private reasons → staff only (public uses barber_busy_intervals()).
create policy blocks_read on public.blocked_periods for select
  using (public.is_operator() or barber_id = public.auth_barber_id() or (barber_id is null and public.is_staff()));
create policy blocks_write on public.blocked_periods for all
  using (public.is_operator() or barber_id = public.auth_barber_id())
  with check (public.is_operator() or (barber_id = public.auth_barber_id() and barber_id is not null));

-- ── customers (never public) ──
create policy customers_operator on public.customers for all
  using (public.is_operator()) with check (public.is_operator());
create policy customers_barber_read on public.customers for select using (
  public.auth_role() = 'barber' and exists (
    select 1 from public.appointments a
     where a.customer_id = customers.id
       and (a.barber_id = public.auth_barber_id() or (a.barber_id is null and a.source = 'walk_in'))
  )
);
create policy customers_barber_update on public.customers for update using (
  public.auth_role() = 'barber' and exists (
    select 1 from public.appointments a where a.customer_id = customers.id and a.barber_id = public.auth_barber_id()
  )
);
create policy customers_barber_insert on public.customers for insert with check (public.auth_role() = 'barber');
create policy customers_self on public.customers for select using (id = public.auth_customer_id());

-- ── appointments ──
create policy appointments_operator on public.appointments for all
  using (public.is_operator()) with check (public.is_operator());
create policy appointments_barber on public.appointments for all
  using (public.auth_role() = 'barber'
         and (barber_id = public.auth_barber_id() or (barber_id is null and source = 'walk_in')))
  with check (public.auth_role() = 'barber'
         and (barber_id = public.auth_barber_id() or (barber_id is null and source = 'walk_in')));
create policy appointments_customer_read on public.appointments for select
  using (customer_id = public.auth_customer_id());
-- Hard deletes are reserved for the owner; history is normally kept.
create policy appointments_no_delete on public.appointments as restrictive for delete using (public.is_admin());

create policy appt_services_read on public.appointment_services for select using (
  exists (select 1 from public.appointments a where a.id = appointment_id)  -- inherits appointments RLS
);
create policy appt_services_write on public.appointment_services for all using (
  public.is_staff() and exists (select 1 from public.appointments a where a.id = appointment_id)
) with check (
  public.is_staff() and exists (select 1 from public.appointments a where a.id = appointment_id)
);

-- ── walk_in_queue ──
create policy queue_staff on public.walk_in_queue for all using (
  public.is_operator() or (public.auth_role() = 'barber' and (barber_id = public.auth_barber_id() or barber_id is null))
) with check (
  public.is_operator() or (public.auth_role() = 'barber' and (barber_id = public.auth_barber_id() or barber_id is null))
);

-- ── portfolio (public read; barber manages own) ──
create policy portfolio_read on public.portfolio_images for select using (true);
create policy portfolio_write on public.portfolio_images for all
  using (public.is_admin() or barber_id = public.auth_barber_id())
  with check (public.is_admin() or barber_id = public.auth_barber_id());

-- ── reviews (approved are public; inserted only via submit_review()) ──
create policy reviews_public on public.reviews for select using (status = 'approved');
create policy reviews_staff_read on public.reviews for select
  using (public.is_operator() or barber_id = public.auth_barber_id());
create policy reviews_admin on public.reviews for update using (public.is_admin()) with check (public.is_admin());

-- ── notifications ──
create policy notifications_staff on public.notifications for select using (
  public.is_operator() or exists (
    select 1 from public.appointments a where a.id = appointment_id and a.barber_id = public.auth_barber_id()
  )
);
create policy notifications_insert on public.notifications for insert with check (public.is_staff());

-- ── future phase tables: owner only ──
create policy promotions_admin on public.promotions for all using (public.is_admin()) with check (public.is_admin());
create policy loyalty_admin on public.customer_loyalty for all using (public.is_admin()) with check (public.is_admin());
create policy loyalty_self on public.customer_loyalty for select using (customer_id = public.auth_customer_id());

-- ── audit ──
create policy audit_insert on public.audit_logs for insert with check (public.is_staff());
create policy audit_read on public.audit_logs for select using (public.is_admin());

-- ═══ Storage: portfolio images ═══
insert into storage.buckets (id, name, public) values ('portfolio', 'portfolio', true)
  on conflict (id) do nothing;

create policy "portfolio public read" on storage.objects for select using (bucket_id = 'portfolio');
create policy "portfolio staff upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'portfolio' and public.is_staff());
create policy "portfolio staff update" on storage.objects for update to authenticated
  using (bucket_id = 'portfolio' and public.is_staff());
create policy "portfolio staff delete" on storage.objects for delete to authenticated
  using (bucket_id = 'portfolio' and public.is_staff());
