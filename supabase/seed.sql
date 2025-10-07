\set super_admin_uid '<SUPER_ADMIN_UID>'

insert into public.orgs (slug, name) values
  ('orgA','Association A'),
  ('orgB','Association B')
on conflict (slug) do nothing;

insert into public.org_members (org_id, user_id, role)
  select id, :'super_admin_uid', 'super_admin'::public.member_role from public.orgs
on conflict do nothing;

-- Optionnel: ajouter un opérateur à orgA :
-- \set operator_uid '<OPERATOR_USER_UID>'
-- insert into public.org_members (org_id, user_id, role)
--   values ((select id from public.orgs where slug='orgA'), :'operator_uid', 'operator');

insert into public.matches (org_id, name, sport, home_name, away_name, scheduled_at, status, public_display)
values
  ((select id from public.orgs where slug='orgA'), 'Match Démo Football', 'football', 'Tigres', 'Aigles', now(), 'scheduled', true),
  ((select id from public.orgs where slug='orgA'), 'Démo Basket', 'basket', 'Bleus', 'Rouges', now(), 'scheduled', true)
returning *;
