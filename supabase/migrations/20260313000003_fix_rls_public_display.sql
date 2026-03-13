-- Migration 3 : Correction des politiques RLS qui dépendaient de public_display
-- La colonne public_display a été supprimée en migration 20260313000001.
-- Le mode public repose désormais uniquement sur les URLs stables d'équipe (?teamSlug= / ?teamId=).
-- Le Display utilise SERVICE_ROLE côté edge function, et ANON pour les souscriptions realtime.

-- ============================================================
-- 1. Remplacer la politique matches_public_display_access
--    qui référençait public_display = true (colonne supprimée).
--    Nouveau comportement : accès anon en lecture sur tous les matchs.
--    La confidentialité est gérée au niveau applicatif (edge function).
-- ============================================================

DROP POLICY IF EXISTS matches_public_display_access ON public.matches;
DROP POLICY IF EXISTS "matches_public_display_access" ON public.matches;

CREATE POLICY matches_anon_read
  ON public.matches
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- 2. Remplacer la politique teams_public_read_used_in_public_match
--    qui référençait m.public_display = true (colonne supprimée).
--    Nouveau comportement : accès anon en lecture sur toutes les équipes.
--    Les données d'équipe (nom, logo, couleurs) sont publiques par nature.
-- ============================================================

DROP POLICY IF EXISTS teams_public_read_used_in_public_match ON public.teams;

CREATE POLICY teams_anon_read
  ON public.teams
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================
-- 3. Recréer la vue matches_v sans référence à public_display
--    et avec org_sport renommé en org_sport_code pour clarté.
--    On garde la compatibilité max en laissant les noms de colonnes.
-- ============================================================

CREATE OR REPLACE VIEW public.matches_v AS
SELECT
  m.*,
  o.slug  AS org_slug,
  o.name  AS org_name,
  o.sport AS org_sport,
  th.id          AS home_team_full_id,
  th.name        AS home_team_name,
  th.short_name  AS home_team_short_name,
  th.logo_url    AS home_team_logo_url,
  th.primary_color   AS home_primary_color,
  th.secondary_color AS home_secondary_color,
  ta.id          AS away_team_full_id,
  ta.name        AS away_team_name,
  ta.short_name  AS away_team_short_name,
  ta.logo_url    AS away_team_logo_url,
  ta.primary_color   AS away_primary_color,
  ta.secondary_color AS away_secondary_color
FROM public.matches m
JOIN  public.orgs o  ON o.id = m.org_id
LEFT JOIN public.teams th ON th.id = m.home_team_id
LEFT JOIN public.teams ta ON ta.id = m.away_team_id;
