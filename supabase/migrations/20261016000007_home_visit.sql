-- Home visits (coupe à domicile) for clients with reduced mobility.
-- The appointment's start/end cover the whole trip: the barber leaves `travel_minutes` before the
-- arrival time and is back `travel_minutes` after the service, so nothing else can be booked then.
-- The request arrives as « pending »: the shop calls the client to confirm the price and the time.

alter table public.appointments
  add column if not exists at_home boolean not null default false,
  add column if not exists home_address text,
  add column if not exists travel_minutes smallint not null default 0;

alter table public.appointments
  drop constraint if exists appointments_home_address_check;
alter table public.appointments
  add constraint appointments_home_address_check
  check (not at_home or char_length(coalesce(home_address, '')) between 8 and 300);

drop function if exists public.book_appointment(uuid, uuid[], timestamptz, text, text, text, text, text, appointment_source);

create function public.book_appointment(
  p_barber_id uuid,
  p_service_ids uuid[],
  p_start timestamptz,          -- arrival time chosen by the client
  p_name text,
  p_phone text,
  p_email text default null,
  p_note text default null,
  p_inspiration_url text default null,
  p_source appointment_source default 'online',
  p_home_address text default null
) returns public.appointments
language plpgsql volatile security definer set search_path = public as $$
declare
  v_shop uuid;
  v_phone text := public.normalize_phone(p_phone);
  v_address text := nullif(trim(coalesce(p_home_address, '')), '');
  v_home boolean := v_address is not null;
  v_travel int;
  v_duration int;
  v_price int;
  v_count int;
  v_start timestamptz;
  v_end timestamptz;
  v_customer public.customers;
  v_appt public.appointments;
begin
  if v_phone is null then raise exception 'INVALID_PHONE'; end if;
  if char_length(trim(coalesce(p_name, ''))) < 2 then raise exception 'INVALID_INPUT'; end if;
  if coalesce(array_length(p_service_ids, 1), 0) = 0 then raise exception 'INVALID_INPUT'; end if;
  if p_source = 'walk_in' then raise exception 'INVALID_INPUT'; end if;
  if p_source <> 'online' and not public.is_staff() then raise exception 'FORBIDDEN'; end if;
  if v_home and char_length(v_address) not between 8 and 300 then raise exception 'INVALID_INPUT'; end if;
  v_travel := case when v_home then 30 else 0 end;

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

  v_start := p_start - make_interval(mins => v_travel);
  v_end := p_start + make_interval(mins => v_duration + v_travel);
  perform public.assert_slot_bookable(p_barber_id, v_start, v_end, null);

  insert into public.customers (shop_id, name, phone, email)
  values (v_shop, trim(p_name), v_phone, nullif(trim(coalesce(p_email, '')), ''))
  on conflict (shop_id, phone) do update
     set email = coalesce(public.customers.email, excluded.email),
         archived = false
  returning * into v_customer;

  insert into public.appointments (
    shop_id, reference, barber_id, customer_id, customer_name, customer_phone, customer_email,
    start_at, end_at, duration_minutes, total_price, status, source, note, inspiration_url, confirmed_at,
    at_home, home_address, travel_minutes
  ) values (
    v_shop, public.new_reference(), p_barber_id, v_customer.id, v_customer.name, v_phone, v_customer.email,
    v_start, v_end, v_duration + 2 * v_travel, v_price,
    case when v_home then 'pending'::appointment_status else 'confirmed'::appointment_status end,
    p_source, nullif(trim(coalesce(p_note, '')), ''), p_inspiration_url,
    case when v_home then null else now() end,
    v_home, v_address, v_travel
  ) returning * into v_appt;          -- no_double_booking constraint guards concurrency (23P01)

  insert into public.appointment_services (appointment_id, service_id, name, price, duration_minutes, position)
  select v_appt.id, s.id, s.name, s.price, coalesce(bs.duration_override, s.duration_minutes),
         array_position(p_service_ids, s.id)
    from public.services s
    join public.barber_services bs on bs.service_id = s.id and bs.barber_id = p_barber_id
   where s.id = any (p_service_ids);

  return v_appt;
end $$;

revoke execute on function public.book_appointment(uuid, uuid[], timestamptz, text, text, text, text, text, appointment_source, text) from public;
grant execute on function public.book_appointment(uuid, uuid[], timestamptz, text, text, text, text, text, appointment_source, text) to anon, authenticated;

-- A home visit can't be moved online (the trip must be re-planned): the client calls the shop.
create or replace function public.reschedule_guard_home() returns trigger
language plpgsql as $$
begin
  if old.at_home and new.start_at is distinct from old.start_at and not public.is_staff() then
    raise exception 'INVALID_TRANSITION';
  end if;
  return new;
end $$;
drop trigger if exists appointments_home_reschedule on public.appointments;
create trigger appointments_home_reschedule before update on public.appointments
  for each row execute function public.reschedule_guard_home();
