-- ═══════════════════════════════════════════════════════════════════════
-- Auth helpers + server-side business rules (SECURITY DEFINER RPCs)
-- Every RPC validates its inputs itself: the frontend is never trusted.
-- ═══════════════════════════════════════════════════════════════════════

-- ── Role helpers (used by RLS policies) ─────────────────────────────────
create or replace function public.auth_role() returns app_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_barber_id() returns uuid
language sql stable security definer set search_path = public as $$
  select barber_id from public.profiles where id = auth.uid()
$$;

create or replace function public.auth_customer_id() returns uuid
language sql stable security definer set search_path = public as $$
  select customer_id from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable as $$ select coalesce(public.auth_role() = 'owner', false) $$;

create or replace function public.is_operator() returns boolean   -- owner or receptionist
language sql stable as $$ select coalesce(public.auth_role() in ('owner', 'receptionist'), false) $$;

create or replace function public.is_staff() returns boolean
language sql stable as $$ select coalesce(public.auth_role() in ('owner', 'receptionist', 'barber'), false) $$;

-- New auth users get a 'customer' profile; staff roles are granted by the owner.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, role, shop_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', new.email), 'customer',
          (select id from public.shops order by created_at limit 1))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Helpers ─────────────────────────────────────────────────────────────
create or replace function public.normalize_phone(p text) returns text
language plpgsql immutable as $$
declare
  raw text := regexp_replace(coalesce(p, ''), '[\s.\-()]', '', 'g');
  m text[];
begin
  m := regexp_match(raw, '^(?:\+212|00212|212|0)([5-7][0-9]{8})$');
  if m is not null then return '+212' || m[1]; end if;
  m := regexp_match(raw, '^(?:\+|00)([1-9][0-9]{7,14})$');
  if m is not null then return '+' || m[1]; end if;
  return null;
end $$;

create or replace function public.new_reference() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  ref text;
begin
  loop
    ref := 'BT-';
    for i in 1..5 loop
      ref := ref || substr(alphabet, 1 + floor(random() * 32)::int, 1);
    end loop;
    exit when not exists (select 1 from public.appointments where reference = ref);
  end loop;
  return ref;
end $$;

-- ── Core rule: is [p_start, p_end) bookable for this barber? ────────────
-- Checks working hours (weekly rule or date exception), breaks, blocked periods
-- and overlaps. Raises a named exception the app maps to a friendly message.
create or replace function public.assert_slot_bookable(
  p_barber_id uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid default null
) returns void
language plpgsql stable security definer set search_path = public as $$
declare
  tz text;
  local_date date;
  local_start time;
  local_end time;
  win_start time;
  win_end time;
  brks jsonb := '[]'::jsonb;
  b jsonb;
begin
  select s.timezone into tz from public.barbers br join public.shops s on s.id = br.shop_id
   where br.id = p_barber_id and br.active;
  if tz is null then raise exception 'BARBER_UNAVAILABLE'; end if;
  if p_start < now() - interval '1 minute' then raise exception 'SLOT_IN_PAST'; end if;

  local_date  := (p_start at time zone tz)::date;
  local_start := (p_start at time zone tz)::time;
  local_end   := (p_end at time zone tz)::time;
  if (p_end at time zone tz)::date <> local_date then raise exception 'OUTSIDE_HOURS'; end if;

  select e.start_time, e.end_time into win_start, win_end
    from public.availability_exceptions e where e.barber_id = p_barber_id and e.date = local_date;
  if win_start is null then
    select a.start_time, a.end_time, a.breaks into win_start, win_end, brks
      from public.availability a
     where a.barber_id = p_barber_id and a.weekday = extract(dow from local_date);
  end if;
  if win_start is null or local_start < win_start or local_end > win_end then
    raise exception 'OUTSIDE_HOURS';
  end if;

  for b in select * from jsonb_array_elements(coalesce(brks, '[]'::jsonb)) loop
    if local_start < (b ->> 'end')::time and (b ->> 'start')::time < local_end then
      raise exception 'BARBER_UNAVAILABLE';
    end if;
  end loop;

  if exists (
    select 1 from public.blocked_periods bp
     where (bp.barber_id = p_barber_id or bp.barber_id is null)
       and bp.period && tstzrange(p_start, p_end, '[)')
  ) then raise exception 'BARBER_UNAVAILABLE'; end if;

  if exists (
    select 1 from public.appointments ap
     where ap.barber_id = p_barber_id
       and ap.id is distinct from p_exclude
       and ap.status not in ('cancelled', 'no_show')
       and (
         ap.during && tstzrange(p_start, p_end, '[)')
         or (ap.status = 'in_progress' and ap.start_at is null and ap.started_at is not null
             and tstzrange(ap.started_at, ap.started_at + make_interval(mins => ap.duration_minutes), '[)')
                 && tstzrange(p_start, p_end, '[)'))
       )
  ) then raise exception 'SLOT_TAKEN'; end if;
end $$;

-- ── Public booking ──────────────────────────────────────────────────────
-- Prices and durations are always recomputed from the database.
create or replace function public.book_appointment(
  p_barber_id uuid,
  p_service_ids uuid[],
  p_start timestamptz,
  p_name text,
  p_phone text,
  p_email text default null,
  p_note text default null,
  p_inspiration_url text default null,
  p_source appointment_source default 'online'
) returns public.appointments
language plpgsql volatile security definer set search_path = public as $$
declare
  v_shop uuid;
  v_phone text := public.normalize_phone(p_phone);
  v_duration int;
  v_price int;
  v_count int;
  v_end timestamptz;
  v_customer public.customers;
  v_appt public.appointments;
begin
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_INPUT'; end if;
  if coalesce(array_length(p_service_ids, 1), 0) = 0 then raise exception 'INVALID_INPUT'; end if;
  if p_source = 'walk_in' then raise exception 'INVALID_INPUT'; end if;
  -- Only staff may create phone/dashboard bookings.
  if p_source <> 'online' and not public.is_staff() then raise exception 'FORBIDDEN'; end if;

  select shop_id into v_shop from public.barbers where id = p_barber_id and active;
  if v_shop is null then raise exception 'BARBER_UNAVAILABLE'; end if;

  select count(*), sum(coalesce(bs.duration_override, s.duration_minutes)), sum(s.price)
    into v_count, v_duration, v_price
    from public.services s
    join public.barber_services bs on bs.service_id = s.id and bs.barber_id = p_barber_id
   where s.id = any (p_service_ids) and s.active;
  if v_count <> (select count(distinct x) from unnest(p_service_ids) x) then
    raise exception 'SERVICE_UNAVAILABLE';
  end if;

  v_end := p_start + make_interval(mins => v_duration);
  perform public.assert_slot_bookable(p_barber_id, p_start, v_end, null);

  insert into public.customers (shop_id, name, phone, email)
  values (v_shop, trim(p_name), v_phone, nullif(trim(coalesce(p_email, '')), ''))
  on conflict (shop_id, phone) do update
     set email = coalesce(public.customers.email, excluded.email),
         archived = false
  returning * into v_customer;

  insert into public.appointments (
    shop_id, reference, barber_id, customer_id, customer_name, customer_phone, customer_email,
    start_at, end_at, duration_minutes, total_price, status, source, note, inspiration_url, confirmed_at
  ) values (
    v_shop, public.new_reference(), p_barber_id, v_customer.id, v_customer.name, v_phone, v_customer.email,
    p_start, v_end, v_duration, v_price, 'confirmed', p_source, nullif(trim(coalesce(p_note, '')), ''),
    p_inspiration_url, now()
  ) returning * into v_appt;          -- no_double_booking constraint guards concurrency (23P01)

  insert into public.appointment_services (appointment_id, service_id, name, price, duration_minutes, position)
  select v_appt.id, s.id, s.name, s.price, coalesce(bs.duration_override, s.duration_minutes),
         array_position(p_service_ids, s.id)
    from public.services s
    join public.barber_services bs on bs.service_id = s.id and bs.barber_id = p_barber_id
   where s.id = any (p_service_ids);

  return v_appt;
end $$;

-- ── Busy intervals (no customer data) for public slot computation ───────
create or replace function public.barber_busy_intervals(
  p_barber_id uuid, p_from timestamptz, p_to timestamptz, p_exclude uuid default null
) returns table (start_at timestamptz, end_at timestamptz)
language sql stable security definer set search_path = public as $$
  select a.start_at, a.end_at from public.appointments a
   where a.barber_id = p_barber_id and a.id is distinct from p_exclude
     and a.status not in ('cancelled', 'no_show')
     and a.during && tstzrange(p_from, p_to, '[)')
  union all
  select a.started_at, a.started_at + make_interval(mins => a.duration_minutes) from public.appointments a
   where a.barber_id = p_barber_id and a.status = 'in_progress' and a.start_at is null and a.started_at is not null
  union all
  select lower(b.period), upper(b.period) from public.blocked_periods b
   where (b.barber_id = p_barber_id or b.barber_id is null) and b.period && tstzrange(p_from, p_to, '[)')
$$;

-- ── By-reference operations (reference + phone must both match) ────────
create or replace function public.find_booking(p_reference text, p_phone text) returns public.appointments
language sql stable security definer set search_path = public as $$
  select * from public.appointments
   where reference = upper(trim(p_reference)) and customer_phone = public.normalize_phone(p_phone)
$$;

create or replace function public.lookup_booking(p_reference text, p_phone text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  a public.appointments := public.find_booking(p_reference, p_phone);
begin
  if a.id is null then return null; end if;
  return to_jsonb(a) || jsonb_build_object(
    'services', coalesce((select jsonb_agg(to_jsonb(s) order by s.position) from public.appointment_services s where s.appointment_id = a.id), '[]'::jsonb),
    'queue', (select to_jsonb(q) from public.walk_in_queue q where q.appointment_id = a.id)
  );
end $$;

create or replace function public.cancel_booking(p_reference text, p_phone text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.appointments := public.find_booking(p_reference, p_phone);
  free_hours int;
begin
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'INVALID_TRANSITION'; end if;
  select coalesce((settings -> 'cancellation' ->> 'freeUntilHours')::int, 2) into free_hours
    from public.shops where id = a.shop_id;
  update public.appointments
     set status = 'cancelled', cancelled_at = now(), cancel_reason = 'Annulée par le client',
         late_cancellation = (a.start_at - now()) < make_interval(hours => free_hours)
   where id = a.id;
  insert into public.audit_logs (shop_id, actor_name, action, entity, entity_id)
  values (a.shop_id, 'client', 'customer_cancel', 'appointment', a.id::text);
  return public.lookup_booking(p_reference, p_phone);
end $$;

create or replace function public.reschedule_booking(p_reference text, p_phone text, p_start timestamptz) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.appointments := public.find_booking(p_reference, p_phone);
  v_end timestamptz;
begin
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status not in ('pending', 'confirmed') then raise exception 'INVALID_TRANSITION'; end if;
  v_end := p_start + make_interval(mins => a.duration_minutes);
  perform public.assert_slot_bookable(a.barber_id, p_start, v_end, a.id);
  update public.appointments set start_at = p_start, end_at = v_end where id = a.id;
  insert into public.audit_logs (shop_id, actor_name, action, entity, entity_id, details)
  values (a.shop_id, 'client', 'customer_reschedule', 'appointment', a.id::text,
          jsonb_build_object('from', a.start_at, 'to', p_start));
  return public.lookup_booking(p_reference, p_phone);
end $$;

create or replace function public.update_booking_note(p_reference text, p_phone text, p_note text) returns jsonb
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.appointments := public.find_booking(p_reference, p_phone);
begin
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status in ('completed', 'cancelled', 'no_show') then raise exception 'INVALID_TRANSITION'; end if;
  update public.appointments set note = left(trim(p_note), 500) where id = a.id;
  return public.lookup_booking(p_reference, p_phone);
end $$;

create or replace function public.submit_review(
  p_reference text, p_phone text,
  p_barber smallint, p_quality smallint, p_waiting smallint, p_cleanliness smallint, p_overall smallint,
  p_comment text
) returns public.reviews
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.appointments := public.find_booking(p_reference, p_phone);
  r public.reviews;
begin
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if a.status <> 'completed' or a.barber_id is null then raise exception 'INVALID_TRANSITION'; end if;
  insert into public.reviews (appointment_id, barber_id, author_name, rating_barber, rating_quality,
                              rating_waiting, rating_cleanliness, rating_overall, comment)
  values (a.id, a.barber_id,
          split_part(a.customer_name, ' ', 1) || coalesce(' ' || nullif(left(split_part(a.customer_name, ' ', 2), 1), '') || '.', ''),
          p_barber, p_quality, p_waiting, p_cleanliness, p_overall, trim(p_comment))
  returning * into r;   -- unique(appointment_id): one review per visit
  return r;
end $$;

-- ── Public, anonymized queue (initials + ticket codes only) ─────────────
create or replace function public.public_queue(p_from timestamptz, p_to timestamptz) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', a.id, 'barber_id', a.barber_id, 'status', a.status, 'source', a.source,
    'start_at', a.start_at, 'end_at', a.end_at, 'duration_minutes', a.duration_minutes,
    'arrived_at', a.arrived_at, 'called_at', a.called_at, 'started_at', a.started_at,
    'created_at', a.created_at,
    'initials', (select string_agg(upper(left(w, 1)) || '.', ' ')
                   from (select unnest((string_to_array(trim(a.customer_name), ' '))[1:2]) w) x),
    'services', (select jsonb_agg(jsonb_build_object('name', s.name, 'duration_minutes', s.duration_minutes))
                   from public.appointment_services s where s.appointment_id = a.id),
    'queue', (select jsonb_build_object('ticket_code', q.ticket_code, 'ticket_number', q.ticket_number,
                       'arrived_at', q.arrived_at, 'priority', q.priority, 'bump_minutes', q.bump_minutes,
                       'wait_adjust_minutes', q.wait_adjust_minutes)
                from public.walk_in_queue q where q.appointment_id = a.id)
  )), '[]'::jsonb)
  from public.appointments a
  where coalesce(a.start_at, a.arrived_at, a.created_at) >= p_from
    and coalesce(a.start_at, a.arrived_at, a.created_at) < p_to
    and a.status not in ('cancelled')
$$;

-- ── Queue ticket (staff only, sequential per day without races) ─────────
create or replace function public.ensure_queue_ticket(
  p_appointment_id uuid, p_arrived_at timestamptz default now(), p_priority smallint default 0
) returns public.walk_in_queue
language plpgsql volatile security definer set search_path = public as $$
declare
  a public.appointments;
  q public.walk_in_queue;
  tz text;
  d date;
  n int;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  select * into a from public.appointments where id = p_appointment_id;
  if a.id is null then raise exception 'NOT_FOUND'; end if;
  if public.auth_role() = 'barber' and a.barber_id is distinct from public.auth_barber_id() and a.barber_id is not null then
    raise exception 'FORBIDDEN';
  end if;
  select * into q from public.walk_in_queue where appointment_id = a.id;
  if q.id is not null then return q; end if;

  select timezone into tz from public.shops where id = a.shop_id;
  d := (p_arrived_at at time zone tz)::date;
  perform pg_advisory_xact_lock(hashtext(a.shop_id::text || d::text));
  select coalesce(max(ticket_number), 0) + 1 into n from public.walk_in_queue where shop_id = a.shop_id and queue_date = d;

  insert into public.walk_in_queue (shop_id, appointment_id, barber_id, customer_id, queue_date,
                                    ticket_number, ticket_code, arrived_at, priority)
  values (a.shop_id, a.id, a.barber_id, a.customer_id, d, n, 'B' || n, p_arrived_at, p_priority)
  returning * into q;
  return q;
end $$;

-- ── Walk-in creation (staff only; barbers limited to themselves / "any") ─
create or replace function public.create_walk_in(
  p_barber_id uuid, p_service_ids uuid[], p_name text, p_phone text default null,
  p_note text default null, p_arrived_at timestamptz default now(), p_priority smallint default 0
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_shop uuid := (select id from public.shops order by created_at limit 1);
  v_phone text := public.normalize_phone(p_phone);
  v_duration int;
  v_price int;
  v_customer uuid;
  v_appt uuid;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if public.auth_role() = 'barber' and p_barber_id is distinct from public.auth_barber_id() and p_barber_id is not null then
    raise exception 'FORBIDDEN';
  end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_INPUT'; end if;

  select sum(coalesce(bs.duration_override, s.duration_minutes)), sum(s.price) into v_duration, v_price
    from public.services s
    left join public.barber_services bs on bs.service_id = s.id and bs.barber_id = p_barber_id
   where s.id = any (p_service_ids);
  if v_duration is null then raise exception 'INVALID_INPUT'; end if;

  if v_phone is not null then
    insert into public.customers (shop_id, name, phone) values (v_shop, trim(p_name), v_phone)
    on conflict (shop_id, phone) do update set archived = false
    returning id into v_customer;
  else
    insert into public.customers (shop_id, name) values (v_shop, trim(p_name)) returning id into v_customer;
  end if;

  insert into public.appointments (shop_id, reference, barber_id, customer_id, customer_name, customer_phone,
                                   duration_minutes, total_price, status, source, note, arrived_at)
  values (v_shop, public.new_reference(), p_barber_id, v_customer, trim(p_name), v_phone,
          v_duration, v_price, 'waiting', 'walk_in', nullif(trim(coalesce(p_note, '')), ''), p_arrived_at)
  returning id into v_appt;

  insert into public.appointment_services (appointment_id, service_id, name, price, duration_minutes, position)
  select v_appt, s.id, s.name, s.price, coalesce(bs.duration_override, s.duration_minutes), array_position(p_service_ids, s.id)
    from public.services s
    left join public.barber_services bs on bs.service_id = s.id and bs.barber_id = p_barber_id
   where s.id = any (p_service_ids);

  perform public.ensure_queue_ticket(v_appt, p_arrived_at, p_priority);
  return v_appt;
end $$;

-- ── Anonymize a customer everywhere (history kept for analytics) ────────
create or replace function public.anonymize_customer(p_customer_id uuid) returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'FORBIDDEN'; end if;
  update public.customers set name = 'Client anonyme', phone = null, email = null, notes = null,
         anonymized = true, archived = true where id = p_customer_id;
  update public.appointments set customer_name = 'Client anonyme', customer_phone = null,
         customer_email = null, note = null, inspiration_url = null where customer_id = p_customer_id;
end $$;

-- ── Grants ──────────────────────────────────────────────────────────────
revoke execute on all functions in schema public from public;
grant execute on function
  public.auth_role(), public.auth_barber_id(), public.auth_customer_id(),
  public.is_admin(), public.is_operator(), public.is_staff(), public.normalize_phone(text)
  to anon, authenticated;
grant execute on function
  public.book_appointment(uuid, uuid[], timestamptz, text, text, text, text, text, appointment_source),
  public.barber_busy_intervals(uuid, timestamptz, timestamptz, uuid),
  public.lookup_booking(text, text),
  public.cancel_booking(text, text),
  public.reschedule_booking(text, text, timestamptz),
  public.update_booking_note(text, text, text),
  public.submit_review(text, text, smallint, smallint, smallint, smallint, smallint, text),
  public.public_queue(timestamptz, timestamptz)
  to anon, authenticated;
grant execute on function
  public.ensure_queue_ticket(uuid, timestamptz, smallint),
  public.create_walk_in(uuid, uuid[], text, text, text, timestamptz, smallint),
  public.anonymize_customer(uuid),
  public.assert_slot_bookable(uuid, timestamptz, timestamptz, uuid)
  to authenticated;
