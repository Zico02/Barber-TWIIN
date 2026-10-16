-- Morocco has been on permanent GMT+0 since 2026-09-20 (IANA tzdata 2026c). Postgres and Node
-- builds with older tz data still apply GMT+1 to 'Africa/Casablanca', so the shop uses plain UTC.
alter table public.shops alter column timezone set default 'UTC';
update public.shops set timezone = 'UTC' where timezone = 'Africa/Casablanca';
