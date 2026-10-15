-- Friday prayer: every barber is unavailable 12:00–13:00 on Fridays (weekday 5).
-- Safe to run twice: rows that already have the break are left untouched.
update public.availability
   set breaks = '[{"start":"12:00","end":"13:00","label":"Prière du vendredi"}]'::jsonb || breaks
 where weekday = 5
   and not (breaks @> '[{"label":"Prière du vendredi"}]'::jsonb);
