-- Migration rattrapage : couvre toutes les migrations 20260313-20260314 potentiellement manquantes.
-- Idempotente (IF NOT EXISTS / IF NOT EXISTS partout).
-- ATTENTION : les ALTER TYPE ADD VALUE doivent être exécutés HORS transaction.
--             Lancer ce fichier en 2 passes si nécessaire (voir commentaires).

-- ============================================================
-- PASSE 1 : enum match_status (hors transaction si Postgres < 14)
-- Exécuter séparément si erreur "unsafe use of new value"
-- ============================================================
ALTER TYPE public.match_status ADD VALUE IF NOT EXISTS 'paused';
ALTER TYPE public.match_status ADD VALUE IF NOT EXISTS 'cancelled';

-- ============================================================
-- PASSE 2 : colonnes et tables (transaction normale)
-- ============================================================
BEGIN;

-- ─── match_players : colonnes substitution (20260314000001) ─────────────────
ALTER TABLE public.match_players
  ADD COLUMN IF NOT EXISTS is_on_field         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entered_at_clock_ms integer NULL,
  ADD COLUMN IF NOT EXISTS left_at_clock_ms    integer NULL,
  ADD COLUMN IF NOT EXISTS minutes_played_s    integer NOT NULL DEFAULT 0;

-- ─── match_substitutions : table (20260314000001) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.match_substitutions (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    uuid NOT NULL,
  match_id                  uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  sport                     text NOT NULL,
  team_side                 text NOT NULL CHECK (team_side IN ('home','away')),
  team_id                   uuid NULL REFERENCES public.teams(id) ON DELETE SET NULL,
  player_out_id             uuid NULL REFERENCES public.players(id) ON DELETE SET NULL,
  player_in_id              uuid NULL REFERENCES public.players(id) ON DELETE SET NULL,
  player_out_name_snapshot  text NULL,
  player_in_name_snapshot   text NULL,
  player_out_number_snapshot text NULL,
  player_in_number_snapshot  text NULL,
  period_index              integer NULL,
  game_clock_ms             integer NULL,
  reason                    text NULL,
  is_temporary              boolean NOT NULL DEFAULT false,
  is_blood_substitution     boolean NOT NULL DEFAULT false,
  seq                       bigint NULL,
  created_at                timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_match_substitutions_match_id
  ON public.match_substitutions(match_id);
CREATE INDEX IF NOT EXISTS idx_match_substitutions_match_team_side
  ON public.match_substitutions(match_id, team_side);
CREATE INDEX IF NOT EXISTS idx_match_substitutions_player_out_id
  ON public.match_substitutions(player_out_id);
CREATE INDEX IF NOT EXISTS idx_match_substitutions_player_in_id
  ON public.match_substitutions(player_in_id);
CREATE INDEX IF NOT EXISTS idx_match_substitutions_match_id_seq
  ON public.match_substitutions(match_id, seq);

-- RLS match_substitutions
ALTER TABLE public.match_substitutions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "match_substitutions_authenticated_access" ON public.match_substitutions;
CREATE POLICY "match_substitutions_authenticated_access"
  ON public.match_substitutions FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "match_substitutions_anon_read" ON public.match_substitutions;
CREATE POLICY "match_substitutions_anon_read"
  ON public.match_substitutions FOR SELECT TO anon
  USING (true);

-- ─── match_players : index (20260314000001) ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_match_players_match_team
  ON public.match_players(match_id, team_id);
CREATE INDEX IF NOT EXISTS idx_match_players_match_selected
  ON public.match_players(match_id, is_selected);

-- ─── org_display_settings : show_substitution_banner (20260314000003) ────────
ALTER TABLE public.org_display_settings
  ADD COLUMN IF NOT EXISTS show_substitution_banner boolean NOT NULL DEFAULT true;

-- ─── org_display_settings : show_live_badge (20260314000005) ─────────────────
ALTER TABLE public.org_display_settings
  ADD COLUMN IF NOT EXISTS show_live_badge boolean NOT NULL DEFAULT false;

-- ─── org_display_sport_profiles : show_live_badge (20260314000005) ───────────
ALTER TABLE public.org_display_sport_profiles
  ADD COLUMN IF NOT EXISTS show_live_badge boolean NULL;

-- ─── display_templates : table + colonnes complètes (20260313000002 + 20260314000004) ──
CREATE TABLE IF NOT EXISTS public.display_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code            text NOT NULL UNIQUE,
  name            text NOT NULL,
  sport           text,
  layout_mode     text NOT NULL,
  config_json     jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order      int  NOT NULL DEFAULT 0,
  is_default_system boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.display_templates
  ADD COLUMN IF NOT EXISTS is_default_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sort_order        int NOT NULL DEFAULT 0;

ALTER TABLE public.display_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "display_templates_anon_read" ON public.display_templates;
CREATE POLICY "display_templates_anon_read"
  ON public.display_templates FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "display_templates_authenticated_read" ON public.display_templates;
CREATE POLICY "display_templates_authenticated_read"
  ON public.display_templates FOR SELECT TO authenticated USING (true);

-- ─── team_display_settings : table (20260313000002) ──────────────────────────
CREATE TABLE IF NOT EXISTS public.team_display_settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  template_id uuid NULL REFERENCES public.display_templates(id) ON DELETE SET NULL,
  config_override jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (team_id)
);

ALTER TABLE public.team_display_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "team_display_settings_authenticated_access" ON public.team_display_settings;
CREATE POLICY "team_display_settings_authenticated_access"
  ON public.team_display_settings FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

COMMIT;
