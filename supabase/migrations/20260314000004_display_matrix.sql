BEGIN;

-- ─── 1. Bibliothèque système des templates d'affichage ────────────────────────
-- Table peut exister depuis 20260313000002 — on ajoute uniquement les colonnes manquantes
CREATE TABLE IF NOT EXISTS public.display_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  sport text,
  layout_mode text NOT NULL,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Ajout des colonnes de gestion système (idempotent)
ALTER TABLE public.display_templates
  ADD COLUMN IF NOT EXISTS is_default_system boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_active         boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at        timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS sort_order        int NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_display_templates_sport  ON public.display_templates(sport);
CREATE INDEX IF NOT EXISTS idx_display_templates_active ON public.display_templates(is_active);

-- ─── 2. Matrice d'affichage par sport au niveau organisation ──────────────────
CREATE TABLE IF NOT EXISTS public.org_display_sport_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  sport text NOT NULL,
  default_display_template_id uuid REFERENCES public.display_templates(id) ON DELETE SET NULL,

  -- Blocs principaux (tronc commun)
  show_score          boolean NOT NULL DEFAULT true,
  show_clock          boolean NOT NULL DEFAULT true,
  show_period         boolean NOT NULL DEFAULT true,
  show_status         boolean NOT NULL DEFAULT true,
  show_logos          boolean NOT NULL DEFAULT true,
  show_sponsors       boolean NOT NULL DEFAULT true,
  show_lower_third    boolean NOT NULL DEFAULT true,

  -- Overlays live
  show_live_overlays  boolean NOT NULL DEFAULT true,
  overlay_position    text    NOT NULL DEFAULT 'bottom',
  overlay_duration_ms integer NOT NULL DEFAULT 5000,

  -- Lisibilité LED
  density_mode        text    NOT NULL DEFAULT 'medium',
  score_scale         numeric(6,2) NOT NULL DEFAULT 1.00,
  clock_scale         numeric(6,2) NOT NULL DEFAULT 1.00,
  team_name_mode      text    NOT NULL DEFAULT 'short',
  use_short_team_names boolean NOT NULL DEFAULT true,
  show_separator_score boolean NOT NULL DEFAULT true,

  -- Basket
  show_team_fouls      boolean NOT NULL DEFAULT false,
  show_player_fouls    boolean NOT NULL DEFAULT false,
  show_timeouts        boolean NOT NULL DEFAULT false,
  show_bonus           boolean NOT NULL DEFAULT false,
  show_shot_clock      boolean NOT NULL DEFAULT false,
  show_possession_arrow boolean NOT NULL DEFAULT false,

  -- Rugby / Football
  show_cards                    boolean NOT NULL DEFAULT false,
  show_substitutions            boolean NOT NULL DEFAULT false,
  show_sin_bin                  boolean NOT NULL DEFAULT false,
  show_rugby_score_breakdown    boolean NOT NULL DEFAULT false,
  show_rugby_tries              boolean NOT NULL DEFAULT false,
  show_rugby_conversions        boolean NOT NULL DEFAULT false,
  show_rugby_penalties          boolean NOT NULL DEFAULT false,
  show_rugby_drop_goals         boolean NOT NULL DEFAULT false,

  -- Football
  show_added_time      boolean NOT NULL DEFAULT false,
  show_penalty_shootout boolean NOT NULL DEFAULT false,
  show_match_phase     boolean NOT NULL DEFAULT false,

  -- Handball
  show_two_min_suspensions boolean NOT NULL DEFAULT false,
  show_disqualifications   boolean NOT NULL DEFAULT false,
  show_warnings            boolean NOT NULL DEFAULT false,

  -- Volleyball
  show_sets          boolean NOT NULL DEFAULT false,
  show_set_points    boolean NOT NULL DEFAULT false,
  show_service       boolean NOT NULL DEFAULT false,
  show_current_set   boolean NOT NULL DEFAULT false,
  show_tiebreak      boolean NOT NULL DEFAULT false,

  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT org_display_sport_profiles_org_sport_key UNIQUE (org_id, sport),
  CONSTRAINT chk_overlay_position CHECK (overlay_position IN ('top','bottom')),
  CONSTRAINT chk_density_mode     CHECK (density_mode IN ('low','medium','high')),
  CONSTRAINT chk_team_name_mode   CHECK (team_name_mode IN ('full','short','code'))
);

CREATE INDEX IF NOT EXISTS idx_odsp_org   ON public.org_display_sport_profiles(org_id);
CREATE INDEX IF NOT EXISTS idx_odsp_sport ON public.org_display_sport_profiles(sport);

-- ─── 3. Paramètres d'affichage au niveau équipe (s'il n'existe pas) ──────────
CREATE TABLE IF NOT EXISTS public.team_display_settings (
  team_id    uuid PRIMARY KEY REFERENCES public.teams(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.display_templates(id) ON DELETE SET NULL,
  is_active  boolean NOT NULL DEFAULT true,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ajout de colonnes si la table existait déjà avec d'autres colonnes
ALTER TABLE public.team_display_settings
  ADD COLUMN IF NOT EXISTS template_id uuid REFERENCES public.display_templates(id) ON DELETE SET NULL;
ALTER TABLE public.team_display_settings
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
ALTER TABLE public.team_display_settings
  ADD COLUMN IF NOT EXISTS config_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- ─── 4. Templates système initiaux ───────────────────────────────────────────
-- ON CONFLICT: met à jour config_json + is_default_system pour enrichir les templates existants
INSERT INTO public.display_templates (code, name, sport, layout_mode, config_json, is_default_system, is_active)
VALUES
  ('rugby_stade',      'Rugby LED Stade',   'rugby',      'rugby_stade',
   '{"density":"low","show_rugby_score_breakdown":false,"show_live_overlays":true,"show_substitutions":true,"show_sin_bin":true,"show_cards":true}',
   true, true),
  ('rugby_expert',     'Rugby Expert',      'rugby',      'rugby_expert',
   '{"density":"medium","show_rugby_score_breakdown":true,"show_live_overlays":true,"show_substitutions":true,"show_sin_bin":true,"show_cards":true}',
   false, true),
  ('rugby_club',       'Rugby Club',        'rugby',      'rugby_stade',
   '{"density":"low","show_rugby_score_breakdown":false,"show_live_overlays":true,"show_substitutions":false,"show_sin_bin":true,"show_cards":true}',
   false, true),
  ('football_stade',   'Football Stade',    'football',   'stadium',
   '{"density":"low","show_live_overlays":true,"show_substitutions":true,"show_added_time":true,"show_cards":true}',
   true, true),
  ('football_tv',      'Football TV',       'football',   'compact',
   '{"density":"medium","show_live_overlays":true,"show_substitutions":true,"show_cards":true}',
   false, true),
  ('basket_arena',     'Basket Arena',      'basket',     'arena',
   '{"density":"medium","show_live_overlays":true,"show_team_fouls":true,"show_timeouts":true,"show_shot_clock":true}',
   true, true),
  ('basket_compact',   'Basket Compact',    'basket',     'compact',
   '{"density":"high","show_live_overlays":true}',
   false, true),
  ('handball_classic', 'Handball Classic',  'handball',   'stadium',
   '{"density":"medium","show_live_overlays":true,"show_cards":true,"show_timeouts":true}',
   true, true),
  ('volley_sets',      'Volley Sets',       'volleyball', 'stadium',
   '{"density":"medium","show_live_overlays":true,"show_sets":true,"show_service":true}',
   true, true)
ON CONFLICT (code) DO UPDATE SET
  config_json       = EXCLUDED.config_json,
  is_default_system = EXCLUDED.is_default_system,
  is_active         = EXCLUDED.is_active,
  updated_at        = now();

-- ─── 5. Pré-remplissage org_display_sport_profiles ───────────────────────────
INSERT INTO public.org_display_sport_profiles (
  org_id, sport, default_display_template_id,
  show_score, show_clock, show_period, show_status, show_logos, show_sponsors, show_lower_third,
  show_live_overlays, overlay_position, overlay_duration_ms,
  density_mode, score_scale, clock_scale, team_name_mode, use_short_team_names, show_separator_score,
  show_team_fouls, show_player_fouls, show_timeouts, show_bonus, show_shot_clock, show_possession_arrow,
  show_cards, show_substitutions, show_sin_bin, show_rugby_score_breakdown,
  show_rugby_tries, show_rugby_conversions, show_rugby_penalties, show_rugby_drop_goals,
  show_added_time, show_penalty_shootout, show_match_phase,
  show_two_min_suspensions, show_disqualifications, show_warnings,
  show_sets, show_set_points, show_service, show_current_set, show_tiebreak,
  config_json
)
SELECT
  o.id, o.sport, dt.id,
  true, true, true, true, true, true, true,
  true, 'bottom', 5000,
  CASE WHEN o.sport IN ('rugby','football') THEN 'low' ELSE 'medium' END,
  CASE WHEN o.sport IN ('rugby','football') THEN 1.20 ELSE 1.00 END,
  1.00, 'short', true, true,
  CASE WHEN o.sport IN ('basket','handball') THEN true ELSE false END,
  CASE WHEN o.sport = 'basket' THEN true ELSE false END,
  CASE WHEN o.sport IN ('basket','handball','volleyball') THEN true ELSE false END,
  CASE WHEN o.sport = 'basket' THEN true ELSE false END,
  CASE WHEN o.sport = 'basket' THEN true ELSE false END,
  CASE WHEN o.sport = 'basket' THEN true ELSE false END,
  CASE WHEN o.sport IN ('rugby','football','handball') THEN true ELSE false END,
  CASE WHEN o.sport IN ('rugby','football') THEN true ELSE false END,
  CASE WHEN o.sport = 'rugby' THEN true ELSE false END,
  false,
  CASE WHEN o.sport = 'rugby' THEN true ELSE false END,
  CASE WHEN o.sport = 'rugby' THEN true ELSE false END,
  CASE WHEN o.sport = 'rugby' THEN true ELSE false END,
  CASE WHEN o.sport = 'rugby' THEN true ELSE false END,
  CASE WHEN o.sport = 'football' THEN true ELSE false END,
  CASE WHEN o.sport = 'football' THEN true ELSE false END,
  CASE WHEN o.sport = 'football' THEN true ELSE false END,
  CASE WHEN o.sport = 'handball' THEN true ELSE false END,
  CASE WHEN o.sport = 'handball' THEN true ELSE false END,
  CASE WHEN o.sport = 'handball' THEN true ELSE false END,
  CASE WHEN o.sport = 'volleyball' THEN true ELSE false END,
  CASE WHEN o.sport = 'volleyball' THEN true ELSE false END,
  CASE WHEN o.sport = 'volleyball' THEN true ELSE false END,
  CASE WHEN o.sport = 'volleyball' THEN true ELSE false END,
  CASE WHEN o.sport = 'volleyball' THEN true ELSE false END,
  '{}'::jsonb
FROM public.orgs o
LEFT JOIN public.display_templates dt ON dt.sport = o.sport AND dt.is_default_system = true
WHERE o.sport IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.org_display_sport_profiles p
    WHERE p.org_id = o.id AND p.sport = o.sport
  );

-- ─── 6. Pré-remplissage team_display_settings ────────────────────────────────
INSERT INTO public.team_display_settings (team_id, template_id)
SELECT t.id, p.default_display_template_id
FROM public.teams t
JOIN public.org_display_sport_profiles p ON p.org_id = t.org_id
WHERE p.default_display_template_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.team_display_settings s WHERE s.team_id = t.id)
ON CONFLICT (team_id) DO NOTHING;

-- Mise à jour teams qui n'ont pas encore de template_id
UPDATE public.team_display_settings tds
SET template_id = p.default_display_template_id
FROM public.teams t
JOIN public.org_display_sport_profiles p ON p.org_id = t.org_id
WHERE tds.team_id = t.id
  AND tds.template_id IS NULL
  AND p.default_display_template_id IS NOT NULL;

COMMIT;
