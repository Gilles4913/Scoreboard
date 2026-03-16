begin;

-- =========================================================
-- A. Paramètre d'affichage rugby : afficher le chrono d'exclusion temporaire
-- =========================================================
alter table public.org_display_sport_profiles
  add column if not exists show_sin_bin_timer boolean not null default false;

-- =========================================================
-- B. Paramètre sport rugby : durée par défaut d'une exclusion temporaire
--    10 minutes (600 secondes) pour le rugby à XV
-- =========================================================
alter table public.org_sport_settings
  add column if not exists rugby_sin_bin_duration_s integer not null default 600;

-- =========================================================
-- C. Table match_sin_bins (créée si absente)
--    Stocke les exclusions temporaires rugby par match
-- =========================================================
create table if not exists public.match_sin_bins (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  match_id uuid not null references public.matches(id) on delete cascade,
  team_side text not null check (team_side in ('home', 'away')),
  team_id uuid references public.teams(id) on delete set null,
  player_id uuid references public.players(id) on delete set null,
  player_name_snapshot text,
  shirt_number_snapshot text,
  started_game_clock_ms integer not null default 0,
  duration_s integer not null default 600,
  ended_game_clock_ms integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists match_sin_bins_match_id_idx on public.match_sin_bins(match_id);
create index if not exists match_sin_bins_active_idx on public.match_sin_bins(match_id, is_active) where is_active = true;

-- =========================================================
-- D. Normalisation des organisations rugby existantes
-- =========================================================
update public.org_sport_settings
set rugby_sin_bin_duration_s = 600
where coalesce(sport, '') = 'rugby'
  and (rugby_sin_bin_duration_s is null or rugby_sin_bin_duration_s <= 0);

commit;
