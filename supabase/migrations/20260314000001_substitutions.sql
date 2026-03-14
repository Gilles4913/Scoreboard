begin;

alter table public.match_players
  add column if not exists is_on_field boolean not null default false,
  add column if not exists entered_at_clock_ms integer null,
  add column if not exists left_at_clock_ms integer null,
  add column if not exists minutes_played_s integer not null default 0;

create table if not exists public.match_substitutions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  match_id uuid not null references public.matches(id) on delete cascade,
  sport text not null,
  team_side text not null check (team_side in ('home', 'away')),
  team_id uuid null references public.teams(id) on delete set null,
  player_out_id uuid null references public.players(id) on delete set null,
  player_in_id uuid null references public.players(id) on delete set null,
  player_out_name_snapshot text null,
  player_in_name_snapshot text null,
  player_out_number_snapshot text null,
  player_in_number_snapshot text null,
  period_index integer null,
  game_clock_ms integer null,
  reason text null,
  is_temporary boolean not null default false,
  is_blood_substitution boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_match_substitutions_match_id
  on public.match_substitutions(match_id);

create index if not exists idx_match_substitutions_match_team_side
  on public.match_substitutions(match_id, team_side);

create index if not exists idx_match_substitutions_player_out_id
  on public.match_substitutions(player_out_id);

create index if not exists idx_match_substitutions_player_in_id
  on public.match_substitutions(player_in_id);

create index if not exists idx_match_players_match_team
  on public.match_players(match_id, team_id);

create index if not exists idx_match_players_match_selected
  on public.match_players(match_id, is_selected);

commit;
