-- Nasro's first portfolio photos (images are served from /public/images/cuts).
insert into public.portfolio_images (shop_id, barber_id, category, title, description, image_url, taken_on)
select '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-0000-4000-8000-000000000002', v.category, v.title, 'Réalisation Barber TWIIN.', v.url, current_date
  from (values
    ('long'::text,  'Locks & low fade'::text,  '/images/cuts/cut-9.webp'::text),
    ('taper',       'Mullet taper',            '/images/cuts/cut-10.webp'),
    ('fade',        'Burst fade bouclé',       '/images/cuts/cut-11.webp')
  ) as v(category, title, url)
 where not exists (select 1 from public.portfolio_images p where p.image_url = v.url);
