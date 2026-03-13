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
  team_id uuid,
  home_team_id uuid,
  away_team_id uuid,
  name text not null,
  sport text not null check (sport in ('basic','football','handball','basket','hockey_ice','hockey_field','volleyball','rugby')),
  home_name text not null,
  away_name text not null,
  scheduled_at timestamptz not null default now(),
  status public.match_status not null default 'scheduled',
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- scores
  home_score integer not null default 0,
  away_score integer not null default 0,

  -- clock
  period_label text,
  clock_ms bigint not null default 0,
  clock_running boolean not null default false,
  current_period_index integer not null default 1,
  is_overtime boolean not null default false,
  last_event_seq integer not null default 0,

  -- generic fouls / timeouts / bonus
  home_team_fouls integer not null default 0,
  away_team_fouls integer not null default 0,
  home_timeouts integer not null default 0,
  away_timeouts integer not null default 0,
  home_bonus boolean not null default false,
  away_bonus boolean not null default false,
  shot_clock_s integer,
  home_sets_won integer not null default 0,
  away_sets_won integer not null default 0,
  home_yellow_cards integer not null default 0,
  away_yellow_cards integer not null default 0,
  home_red_cards integer not null default 0,
  away_red_cards integer not null default 0,
  possession_arrow text check (possession_arrow in ('home','away')),

  -- per-period fouls / timeouts (basket)
  team_fouls_period_home integer not null default 0,
  team_fouls_period_away integer not null default 0,
  timeouts_first_half_home integer not null default 0,
  timeouts_first_half_away integer not null default 0,
  timeouts_second_half_home integer not null default 0,
  timeouts_second_half_away integer not null default 0,
  timeouts_overtime_home integer not null default 0,
  timeouts_overtime_away integer not null default 0,

  -- rugby
  rugby_home_tries integer not null default 0,
  rugby_away_tries integer not null default 0,
  rugby_home_conversions integer not null default 0,
  rugby_away_conversions integer not null default 0,
  rugby_home_penalties integer not null default 0,
  rugby_away_penalties integer not null default 0,
  rugby_home_drop_goals integer not null default 0,
  rugby_away_drop_goals integer not null default 0,
  rugby_home_yellow_sin_bin integer not null default 0,
  rugby_away_yellow_sin_bin integer not null default 0,
  rugby_home_sin_bin_active integer not null default 0,
  rugby_away_sin_bin_active integer not null default 0,
  rugby_extra_time boolean not null default false,
  rugby_tiebreak_mode text,

  -- handball
  handball_home_2min integer not null default 0,
  handball_away_2min integer not null default 0,
  handball_home_2min_active integer not null default 0,
  handball_away_2min_active integer not null default 0,
  handball_home_team_timeouts integer not null default 0,
  handball_away_team_timeouts integer not null default 0,
  handball_home_warnings integer not null default 0,
  handball_away_warnings integer not null default 0,
  handball_home_disqualifications integer not null default 0,
  handball_away_disqualifications integer not null default 0,
  handball_extra_time boolean not null default false,
  handball_shootout_mode text,

  -- volleyball
  volleyball_home_timeouts integer not null default 0,
  volleyball_away_timeouts integer not null default 0,
  volleyball_home_set_points integer not null default 0,
  volleyball_away_set_points integer not null default 0,
  volleyball_home_serving boolean not null default true,
  volleyball_away_serving boolean not null default false,
  volleyball_current_set integer not null default 1,
  volleyball_is_tiebreak boolean not null default false,

  -- football
  football_home_yellow_cards integer not null default 0,
  football_away_yellow_cards integer not null default 0,
  football_home_red_cards integer not null default 0,
  football_away_red_cards integer not null default 0,
  football_home_penalty_shootout integer not null default 0,
  football_away_penalty_shootout integer not null default 0,
  football_extra_time boolean not null default false,
  football_added_time_first_half integer not null default 0,
  football_added_time_second_half integer not null default 0,
  football_added_time_extra_1 integer not null default 0,
  football_added_time_extra_2 integer not null default 0
);

create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
drop trigger if exists trg_matches_updated on public.matches;
create trigger trg_matches_updated before update on public.matches for each row execute function public.set_updated_at();
