\set super_admin_uid '<SUPER_ADMIN_UID>'

insert into public.orgs (slug, name, sport) values
  ('orgA','Association A', 'football'),
  ('orgB','Association B', 'rugby')
on conflict (slug) do nothing;

insert into public.org_members (org_id, user_id, role)
  select id, :'super_admin_uid', 'super_admin'::public.member_role from public.orgs
on conflict do nothing;

-- Optionnel: ajouter un opérateur à orgA :
-- \set operator_uid '<OPERATOR_USER_UID>'
-- insert into public.org_members (org_id, user_id, role)
--   values ((select id from public.orgs where slug='orgA'), :'operator_uid', 'operator');

insert into public.matches (org_id, name, sport, home_name, away_name, scheduled_at, status)
values
  ((select id from public.orgs where slug='orgA'), 'Match Demo Football', 'football', 'Tigres', 'Aigles', now(), 'scheduled'),
  ((select id from public.orgs where slug='orgA'), 'Demo Basket', 'basket', 'Bleus', 'Rouges', now(), 'scheduled')
returning *;
