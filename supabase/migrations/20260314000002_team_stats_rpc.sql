begin;

create or replace function public.get_team_match_summary(p_team_id uuid)
returns table (
  matches_played integer,
  wins integer,
  draws integer,
  losses integer,
  points_scored integer,
  points_conceded integer,
  points_diff integer,
  avg_points_scored numeric,
  avg_points_conceded numeric
)
language sql
stable
as $$
with team_matches as (
  select
    m.id,
    m.status,
    case
      when m.home_team_id = p_team_id then coalesce(m.home_score, 0)
      when m.away_team_id = p_team_id then coalesce(m.away_score, 0)
      else 0
    end as scored,
    case
      when m.home_team_id = p_team_id then coalesce(m.away_score, 0)
      when m.away_team_id = p_team_id then coalesce(m.home_score, 0)
      else 0
    end as conceded
  from public.matches m
  where (m.home_team_id = p_team_id or m.away_team_id = p_team_id or m.team_id = p_team_id)
    and m.status in ('finished', 'archived')
)
select
  count(*)::integer as matches_played,
  count(*) filter (where scored > conceded)::integer as wins,
  count(*) filter (where scored = conceded)::integer as draws,
  count(*) filter (where scored < conceded)::integer as losses,
  coalesce(sum(scored), 0)::integer as points_scored,
  coalesce(sum(conceded), 0)::integer as points_conceded,
  coalesce(sum(scored - conceded), 0)::integer as points_diff,
  coalesce(round(avg(scored)::numeric, 2), 0) as avg_points_scored,
  coalesce(round(avg(conceded)::numeric, 2), 0) as avg_points_conceded
from team_matches;
$$;

create or replace function public.get_team_discipline_summary(p_team_id uuid)
returns table (
  matches_with_cards integer,
  yellow_cards integer,
  red_cards integer,
  avg_yellow_per_match numeric,
  avg_red_per_match numeric
)
language sql
stable
as $$
with team_matches as (
  select
    m.id,
    case
      when m.home_team_id = p_team_id then coalesce(m.home_yellow_cards, 0)
      when m.away_team_id = p_team_id then coalesce(m.away_yellow_cards, 0)
      else 0
    end as yellow_cards,
    case
      when m.home_team_id = p_team_id then coalesce(m.home_red_cards, 0)
      when m.away_team_id = p_team_id then coalesce(m.away_red_cards, 0)
      else 0
    end as red_cards
  from public.matches m
  where (m.home_team_id = p_team_id or m.away_team_id = p_team_id or m.team_id = p_team_id)
    and m.status in ('finished', 'archived')
)
select
  count(*) filter (where yellow_cards > 0 or red_cards > 0)::integer as matches_with_cards,
  coalesce(sum(yellow_cards), 0)::integer as yellow_cards,
  coalesce(sum(red_cards), 0)::integer as red_cards,
  coalesce(round(avg(yellow_cards)::numeric, 2), 0) as avg_yellow_per_match,
  coalesce(round(avg(red_cards)::numeric, 2), 0) as avg_red_per_match
from team_matches;
$$;

create or replace function public.get_team_player_stats(p_team_id uuid)
returns table (
  player_id uuid,
  player_name text,
  player_number text,
  match_selections integer,
  match_starts integer,
  total_points integer,
  total_fouls integer,
  total_yellow_cards integer,
  total_red_cards integer
)
language sql
stable
as $$
select
  p.id as player_id,
  p.name as player_name,
  p.number as player_number,
  count(mp.*) filter (where mp.is_selected = true)::integer as match_selections,
  count(mp.*) filter (where mp.is_starter = true)::integer as match_starts,
  coalesce(sum(mp.points), 0)::integer as total_points,
  coalesce(sum(mp.fouls), 0)::integer as total_fouls,
  coalesce(sum(mp.yellow_cards), 0)::integer as total_yellow_cards,
  coalesce(sum(mp.red_cards), 0)::integer as total_red_cards
from public.players p
left join public.match_players mp
  on mp.player_id = p.id
where p.team_id = p_team_id
group by p.id, p.name, p.number
order by p.name asc;
$$;

create or replace function public.get_team_substitution_summary(p_team_id uuid)
returns table (
  substitutions_made integer,
  players_subbed_out integer,
  players_subbed_in integer
)
language sql
stable
as $$
select
  count(*)::integer as substitutions_made,
  count(distinct player_out_id)::integer as players_subbed_out,
  count(distinct player_in_id)::integer as players_subbed_in
from public.match_substitutions
where team_id = p_team_id;
$$;

commit;
