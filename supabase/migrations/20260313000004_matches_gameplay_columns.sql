-- Migration: add all gameplay columns to matches table
-- These columns store live match state for the operator/display/realtime system.

alter table public.matches
  -- team reference
  add column if not exists team_id uuid references public.teams(id) on delete set null,

  -- basic scores & status
  add column if not exists home_score integer not null default 0,
  add column if not exists away_score integer not null default 0,

  -- clock
  add column if not exists period_label text,
  add column if not exists clock_ms bigint not null default 0,
  add column if not exists clock_running boolean not null default false,
  add column if not exists current_period_index integer not null default 1,
  add column if not exists is_overtime boolean not null default false,
  add column if not exists last_event_seq integer not null default 0,

  -- generic fouls / timeouts / bonus
  add column if not exists home_team_fouls integer not null default 0,
  add column if not exists away_team_fouls integer not null default 0,
  add column if not exists home_timeouts integer not null default 0,
  add column if not exists away_timeouts integer not null default 0,
  add column if not exists home_bonus boolean not null default false,
  add column if not exists away_bonus boolean not null default false,
  add column if not exists shot_clock_s integer,

  -- sets (volleyball / basket)
  add column if not exists home_sets_won integer not null default 0,
  add column if not exists away_sets_won integer not null default 0,

  -- generic cards
  add column if not exists home_yellow_cards integer not null default 0,
  add column if not exists away_yellow_cards integer not null default 0,
  add column if not exists home_red_cards integer not null default 0,
  add column if not exists away_red_cards integer not null default 0,

  -- possession (basket)
  add column if not exists possession_arrow text check (possession_arrow in ('home','away')),

  -- per-period fouls / timeouts tracking (basket)
  add column if not exists team_fouls_period_home integer not null default 0,
  add column if not exists team_fouls_period_away integer not null default 0,
  add column if not exists timeouts_first_half_home integer not null default 0,
  add column if not exists timeouts_first_half_away integer not null default 0,
  add column if not exists timeouts_second_half_home integer not null default 0,
  add column if not exists timeouts_second_half_away integer not null default 0,
  add column if not exists timeouts_overtime_home integer not null default 0,
  add column if not exists timeouts_overtime_away integer not null default 0,

  -- rugby
  add column if not exists rugby_home_tries integer not null default 0,
  add column if not exists rugby_away_tries integer not null default 0,
  add column if not exists rugby_home_conversions integer not null default 0,
  add column if not exists rugby_away_conversions integer not null default 0,
  add column if not exists rugby_home_penalties integer not null default 0,
  add column if not exists rugby_away_penalties integer not null default 0,
  add column if not exists rugby_home_drop_goals integer not null default 0,
  add column if not exists rugby_away_drop_goals integer not null default 0,
  add column if not exists rugby_home_yellow_sin_bin integer not null default 0,
  add column if not exists rugby_away_yellow_sin_bin integer not null default 0,
  add column if not exists rugby_home_sin_bin_active integer not null default 0,
  add column if not exists rugby_away_sin_bin_active integer not null default 0,
  add column if not exists rugby_extra_time boolean not null default false,
  add column if not exists rugby_tiebreak_mode text,

  -- handball
  add column if not exists handball_home_2min integer not null default 0,
  add column if not exists handball_away_2min integer not null default 0,
  add column if not exists handball_home_2min_active integer not null default 0,
  add column if not exists handball_away_2min_active integer not null default 0,
  add column if not exists handball_home_team_timeouts integer not null default 0,
  add column if not exists handball_away_team_timeouts integer not null default 0,
  add column if not exists handball_home_warnings integer not null default 0,
  add column if not exists handball_away_warnings integer not null default 0,
  add column if not exists handball_home_disqualifications integer not null default 0,
  add column if not exists handball_away_disqualifications integer not null default 0,
  add column if not exists handball_extra_time boolean not null default false,
  add column if not exists handball_shootout_mode text,

  -- volleyball
  add column if not exists volleyball_home_timeouts integer not null default 0,
  add column if not exists volleyball_away_timeouts integer not null default 0,
  add column if not exists volleyball_home_set_points integer not null default 0,
  add column if not exists volleyball_away_set_points integer not null default 0,
  add column if not exists volleyball_home_serving boolean not null default true,
  add column if not exists volleyball_away_serving boolean not null default false,
  add column if not exists volleyball_current_set integer not null default 1,
  add column if not exists volleyball_is_tiebreak boolean not null default false,

  -- football
  add column if not exists football_home_yellow_cards integer not null default 0,
  add column if not exists football_away_yellow_cards integer not null default 0,
  add column if not exists football_home_red_cards integer not null default 0,
  add column if not exists football_away_red_cards integer not null default 0,
  add column if not exists football_home_penalty_shootout integer not null default 0,
  add column if not exists football_away_penalty_shootout integer not null default 0,
  add column if not exists football_extra_time boolean not null default false,
  add column if not exists football_added_time_first_half integer not null default 0,
  add column if not exists football_added_time_second_half integer not null default 0,
  add column if not exists football_added_time_extra_1 integer not null default 0,
  add column if not exists football_added_time_extra_2 integer not null default 0;
