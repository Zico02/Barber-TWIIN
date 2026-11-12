-- Credit fixes: these two cuts are Reda's, not Nasro's.
update public.portfolio_images set barber_id = 'aaaaaaaa-0000-4000-8000-000000000001'
 where image_url in ('/images/cuts/cut-10.webp', '/images/cuts/cut-12.webp');
