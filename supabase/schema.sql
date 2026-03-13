create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

create table if not exists public.orgs (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  sport text,
  created_at timestamptz not null default now()
);

create type public.member_role as enum ('super_admin','admin','operator');
create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null,
  role public.member_role not null default 'operator',
  primary key (org_id, user_id)
);

create or replace view public.org_members_with_org as
select om.*, o.slug as org_slug, o.name as org_name
from public.org_members om
join public.orgs o on o.id = om.org_id;

create type public.match_status as enum ('scheduled','live','paused','finished','archived');

create table if not exists public.matches (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  sport text not null check (sport in ('basic','football','handball','basket','hockey_ice','hockey_field','volleyball','rugby')),
  home_name text not null,
  away_name text not null,
  scheduled_at timestamptz not null default now(),
  status public.match_status not null default 'scheduled',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_matches_updated on public.matches;
create trigger trg_matches_updated before update on public.matches for each row execute function public.set_updated_at();
