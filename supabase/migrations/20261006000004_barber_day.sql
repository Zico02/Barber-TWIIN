-- ═══════════════════════════════════════════════════════════════════════
-- Barber day view: "late" status, "from" prices, barber phones,
-- staff create/edit RPC with extra time, and delete for the barber's own entries.
-- ═══════════════════════════════════════════════════════════════════════

alter type appointment_status add value if not exists 'late' after 'confirmed';

alter table public.services add column if not exists price_from boolean not null default false;
alter table public.services drop constraint if exists services_category_check;
alter table public.services add constraint services_category_check
  check (category in ('cut', 'beard', 'combo', 'care', 'kids', 'styling', 'treatment'));

alter table public.barbers add column if not exists phone text;
alter table public.barbers add column if not exists lineup_photo_url text; -- optional framing for the homepage lineup
alter table public.barbers add column if not exists intro_photo_url text; -- arms-relaxed photo for the lineup animation

-- Allow staff to (re)place a client earlier today (walk-in already in the chair).
drop function if exists public.assert_slot_bookable(uuid, timestamptz, timestamptz, uuid);
create or replace function public.assert_slot_bookable(
  p_barber_id uuid, p_start timestamptz, p_end timestamptz, p_exclude uuid default null, p_allow_past boolean default false
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
  if not p_allow_past and p_start < now() - interval '1 minute' then raise exception 'SLOT_IN_PAST'; end if;

  local_date  := (p_start at time zone tz)::date;
  local_start := (p_start at time zone tz)::time;
  local_end   := (p_end at time zone tz)::time;
  if (p_end at time zone tz)::date <> local_date and local_end <> '00:00' then raise exception 'OUTSIDE_HOURS'; end if;

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
       and ap.during && tstzrange(p_start, p_end, '[)')
  ) then raise exception 'SLOT_TAKEN'; end if;
end $$;

-- ── Create or edit an entry from the barber day view ────────────────────
create or replace function public.staff_save_appointment(
  p_id uuid,
  p_barber_id uuid,
  p_service_ids uuid[],
  p_start timestamptz,
  p_name text,
  p_phone text default null,
  p_note text default null,
  p_extra_minutes int default 0,
  p_final_price int default null
) returns uuid
language plpgsql volatile security definer set search_path = public as $$
declare
  v_shop uuid;
  v_phone text := public.normalize_phone(p_phone);
  v_duration int;
  v_price int;
  v_end timestamptz;
  v_customer uuid;
  v_existing public.appointments;
  v_id uuid;
begin
  if not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if public.auth_role() = 'barber' and p_barber_id is distinct from public.auth_barber_id() then raise exception 'FORBIDDEN'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_INPUT'; end if;
  if coalesce(array_length(p_service_ids, 1), 0) = 0 then raise exception 'INVALID_INPUT'; end if;
  if p_extra_minutes < 0 or p_extra_minutes > 240 then raise exception 'INVALID_INPUT'; end if;

  if p_id is not null then
    select * into v_existing from public.appointments where id = p_id;
    if v_existing.id is null then raise exception 'NOT_FOUND'; end if;
    if public.auth_role() = 'barber' and v_existing.barber_id is distinct from public.auth_barber_id() then raise exception 'FORBIDDEN'; end if;
  end if;

  select shop_id into v_shop from public.barbers where id = p_barber_id;
  select sum(coalesce(bs.duration_override, s.duration_minutes)), sum(s.price) into v_duration, v_price
    from public.services s
    left join public.barber_services bs on bs.service_id = s.id and bs.barber_id = p_barber_id
   where s.id = any (p_service_ids);
  if v_duration is null then raise exception 'INVALID_INPUT'; end if;
  v_duration := v_duration + p_extra_minutes;
  v_end := p_start + make_interval(mins => v_duration);

  if v_existing.id is null or v_existing.status not in ('cancelled', 'no_show') then
    perform public.assert_slot_bookable(p_barber_id, p_start, v_end, p_id, true);
  end if;

  if v_phone is not null then
    insert into public.customers (shop_id, name, phone) values (v_shop, trim(p_name), v_phone)
    on conflict (shop_id, phone) do update set archived = false
    returning id into v_customer;
  elsif v_existing.id is not null and v_existing.customer_phone is null then
    v_customer := v_existing.customer_id;
  else
    insert into public.customers (shop_id, name) values (v_shop, trim(p_name)) returning id into v_customer;
  end if;

  if v_existing.id is not null then
    update public.appointments
       set barber_id = p_barber_id, customer_id = v_customer, customer_name = trim(p_name), customer_phone = v_phone,
           start_at = p_start, end_at = v_end, duration_minutes = v_duration, total_price = v_price,
           final_price = p_final_price, note = nullif(trim(coalesce(p_note, '')), '')
     where id = p_id;
    v_id := p_id;
    delete from public.appointment_services where appointment_id = v_id;
  else
    insert into public.appointments (shop_id, reference, barber_id, customer_id, customer_name, customer_phone,
                                     start_at, end_at, duration_minutes, total_price, final_price, status, source, note, confirmed_at)
    values (v_shop, public.new_reference(), p_barber_id, v_customer, trim(p_name), v_phone,
            p_start, v_end, v_duration, v_price, p_final_price, 'confirmed', 'dashboard',
            nullif(trim(coalesce(p_note, '')), ''), now())
    returning id into v_id;
  end if;

  insert into public.appointment_services (appointment_id, service_id, name, price, duration_minutes, position)
  select v_id, s.id, s.name, s.price, coalesce(bs.duration_override, s.duration_minutes), array_position(p_service_ids, s.id)
    from public.services s
    left join public.barber_services bs on bs.service_id = s.id and bs.barber_id = p_barber_id
   where s.id = any (p_service_ids);

  insert into public.audit_logs (shop_id, actor_id, actor_name, action, entity, entity_id)
  values (v_shop, auth.uid(), coalesce((select full_name from public.profiles where id = auth.uid()), 'staff'),
          case when p_id is null then 'day_entry_created' else 'day_entry_updated' end, 'appointment', v_id::text);
  return v_id;
end $$;

grant execute on function public.assert_slot_bookable(uuid, timestamptz, timestamptz, uuid, boolean) to authenticated;
grant execute on function public.staff_save_appointment(uuid, uuid, uuid[], timestamptz, text, text, text, int, int) to authenticated;

-- Barbers may delete their own entries (owner / reception: all).
drop policy if exists appointments_no_delete on public.appointments;
create policy appointments_delete on public.appointments as restrictive for delete
  using (public.is_operator() or (public.auth_role() = 'barber' and barber_id = public.auth_barber_id()));
