-- Migration : Création définitive de match_events + colonnes clock_anchor sur matches
-- Résout le 400 sur GET /rest/v1/match_events?select=id,seq,...
-- car la table n'existait dans aucune migration précédente.

begin;

-- ============================================================
-- 1. Créer match_events si elle n'existe pas
-- ============================================================
create table if not exists public.match_events (
  id             uuid primary key default uuid_generate_v4(),
  org_id         uuid not null references public.orgs(id) on delete cascade,
  match_id       uuid not null references public.matches(id) on delete cascade,
  seq            bigint not null default 0,
  event_type     text not null,
  team_side      text check (team_side in ('home','away')),
  player_id      uuid,
  period_index   integer not null default 1,
  game_clock_ms  bigint not null default 0,
  shot_clock_s   integer,
  payload        jsonb not null default '{}',
  created_at     timestamptz not null default now()
);

-- Ajouter seq si la table existait déjà sans cette colonne
alter table public.match_events
  add column if not exists seq bigint not null default 0;

-- ============================================================
-- 2. Index utiles sur match_events
-- ============================================================
create index if not exists idx_match_events_match_id_seq
  on public.match_events (match_id, seq);

create index if not exists idx_match_events_match_id_created
  on public.match_events (match_id, created_at desc);

-- ============================================================
-- 3. RLS sur match_events
-- ============================================================
alter table public.match_events enable row level security;

drop policy if exists "match_events_authenticated_access" on public.match_events;
create policy "match_events_authenticated_access"
  on public.match_events
  for all
  to authenticated
  using (true)
  with check (true);

drop policy if exists "match_events_anon_read" on public.match_events;
create policy "match_events_anon_read"
  on public.match_events
  for select
  to anon
  using (true);

-- ============================================================
-- 4. clock_anchor columns sur matches (depuis migration 20260315000001)
--    Idempotent : add column if not exists
-- ============================================================
alter table public.matches
  add column if not exists clock_anchor_epoch_ms bigint null,
  add column if not exists clock_anchor_clock_ms integer null;

create index if not exists idx_matches_clock_anchor_epoch_ms
  on public.matches(clock_anchor_epoch_ms);

-- ============================================================
-- 5. seq sur match_substitutions (depuis migration 20260315000002)
-- ============================================================
alter table public.match_substitutions
  add column if not exists seq bigint null;

create index if not exists idx_match_substitutions_match_id_seq
  on public.match_substitutions (match_id, seq);

commit;
