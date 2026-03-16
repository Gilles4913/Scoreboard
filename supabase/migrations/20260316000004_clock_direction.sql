begin;

-- =========================================================
-- Sens du chronomètre par sport (org_display_sport_profiles)
-- =========================================================
alter table public.org_display_sport_profiles
  add column if not exists clock_direction text not null default 'count_down',
  add column if not exists clock_limit_s integer null,
  add column if not exists clock_overrun_mode text not null default 'stop_at_limit';

alter table public.org_display_sport_profiles
  drop constraint if exists org_display_sport_profiles_clock_direction_check;

alter table public.org_display_sport_profiles
  add constraint org_display_sport_profiles_clock_direction_check
  check (clock_direction in ('count_down', 'count_up'));

alter table public.org_display_sport_profiles
  drop constraint if exists org_display_sport_profiles_clock_overrun_mode_check;

alter table public.org_display_sport_profiles
  add constraint org_display_sport_profiles_clock_overrun_mode_check
  check (clock_overrun_mode in ('stop_at_limit', 'continue_red', 'continue_with_plus'));

-- Valeurs par défaut métier par sport
update public.org_display_sport_profiles
set
  clock_direction = case
    when sport in ('rugby', 'football') then 'count_up'
    else 'count_down'
  end,
  clock_limit_s = case
    when sport = 'rugby'    then 2400
    when sport = 'football' then 2700
    when sport = 'basket'   then 600
    when sport = 'handball' then 1800
    else null
  end,
  clock_overrun_mode = case
    when sport in ('rugby', 'football') then 'continue_red'
    when sport in ('basket', 'handball') then 'stop_at_limit'
    else 'stop_at_limit'
  end
where true;

commit;
