-- Table miroir (user_id, email)
create table if not exists public.app_users (
  user_id uuid primary key,
  email text unique not null,
  created_at timestamptz default now()
);

alter table public.app_users enable row level security;

drop policy if exists "app_users super admin all" on public.app_users;
create policy "app_users super admin all" on public.app_users
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

-- RPC pour résoudre l’email en user_id
create or replace function public.admin_get_user_id_by_email(p_email text)
returns uuid
language sql
stable
as $$
  select user_id from public.app_users where email = p_email limit 1;
$$;
