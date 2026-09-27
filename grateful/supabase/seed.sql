-- Seed data: the four services from the brief and sample availability.
-- Mirrors src/data/services.ts and sampleAvailability() in server/db/memory.ts.
--
-- Prices are null on purpose: none have been supplied, and the brief forbids
-- inventing them. A null price shows "Quote required" and books without
-- payment. To take payment for a service:
--   update services set price = 1500.00, deposit_amount = 500.00 where id = 'custom-design';

insert into public.services (id, slug, name, description, duration_minutes, price, deposit_amount, image, sort_order) values
  ('consultation', 'consultation', 'Consultation & Concept Development',
   'A first conversation about you, the occasion and the idea. We talk through silhouette, fabric and how you want to feel, and shape a direction for the piece.',
   60, null, null, 'whiteGarment', 1),
  ('custom-design', 'custom-design', 'Custom Fashion Design',
   'A garment designed and made around you — from sketch and pattern to cut, construction and finish, with fittings along the way.',
   90, null, null, 'styledLook', 2),
  ('fittings', 'fittings', 'Fittings & Alterations',
   'Measured fittings for pieces in progress, and considered alterations that bring an existing garment back to the body it belongs to.',
   45, null, null, 'burgundyDetail', 3),
  ('special-occasion', 'special-occasion', 'Special Occasion / Bespoke Garments',
   'For the days that matter most. A bespoke piece built for one moment, with the time and attention that moment deserves.',
   90, null, null, 'burgundyDetail', 4)
on conflict (id) do nothing;

-- SAMPLE availability for the next 90 days: Tuesday–Friday 09:00–17:00,
-- Saturday 09:00–13:00. Replace with the studio's real hours.
insert into public.availability (date, start_time, end_time)
select d::date,
       time '09:00',
       case when extract(isodow from d) = 6 then time '13:00' else time '17:00' end
  from generate_series((now() at time zone 'Africa/Johannesburg')::date,
                       (now() at time zone 'Africa/Johannesburg')::date + 89, interval '1 day') as d
 where extract(isodow from d) between 2 and 6;
