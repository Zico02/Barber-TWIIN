-- Weekly rest days (a missing weekday = barber off that day):
-- Nasro Monday (1), Reda Tuesday (2), Ziko Thursday (4).
delete from public.availability a
 using public.barbers b
 where a.barber_id = b.id
   and ((b.slug = 'nasro' and a.weekday = 1)
     or (b.slug = 'reda'  and a.weekday = 2)
     or (b.slug = 'ziko'  and a.weekday = 4));
