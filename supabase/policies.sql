alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.matches enable row level security;

create or replace function public.is_super_admin(uid uuid) returns boolean language sql stable as $$
  select exists(select 1 from public.org_members where user_id = uid and role = 'super_admin');
$$;

drop policy if exists "orgs super admin all" on public.orgs;
create policy "orgs super admin all" on public.orgs
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

drop policy if exists "orgs member read" on public.orgs;
create policy "orgs member read" on public.orgs
  for select to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = id and m.user_id = auth.uid()));

drop policy if exists "org_members super admin all" on public.org_members;
create policy "org_members super admin all" on public.org_members
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

drop policy if exists "org_members self read" on public.org_members;
create policy "org_members self read" on public.org_members
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists "matches super admin all" on public.matches;
create policy "matches super admin all" on public.matches
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

drop policy if exists "matches org member crud" on public.matches;
create policy "matches org member crud" on public.matches
  for select, insert, update, delete to authenticated
  using (exists (select 1 from public.org_members m where m.org_id = matches.org_id and m.user_id = auth.uid()))
  with check (exists (select 1 from public.org_members m where m.org_id = matches.org_id and m.user_id = auth.uid()));
