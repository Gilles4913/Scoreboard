/*
  # Organization Sport & Teams Architecture

  1. Overview
    - Organizations now have a single sport type (football, basket, volleyball, handball, rugby)
    - Each organization defines default display settings
    - Teams belong to organizations and can override display settings
    - Matches reference teams with backward compatibility for legacy data

  2. New Tables
    - `teams`
      - `id` (uuid, primary key)
      - `org_id` (uuid, references orgs)
      - `name` (text, team name)
      - `short_name` (text, optional abbreviation)
      - `logo` (text, optional logo URL)
      - `colors` (jsonb, primary/secondary colors)
      - `display_overrides` (jsonb, team-specific display settings)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  3. Modified Tables
    - `orgs`
      - Modified `sport` constraint to support new sports (football, basket, volleyball, handball, rugby)
      - Added `display_defaults` (jsonb, organization-wide display settings)
    - `matches`
      - Added `home_team_id` (uuid, references teams)
      - Added `away_team_id` (uuid, references teams)
      - Modified `sport` constraint to support new sports

  4. Views
    - `matches_v`: Enriched match view with org sport, team data, and display settings

  5. Security
    - RLS enabled on teams table
    - Org members can manage their organization's teams
    - Public read access for teams used in public matches
*/

-- 1) Drop old sport constraints and recreate with new sports
ALTER TABLE public.orgs DROP CONSTRAINT IF EXISTS orgs_sport_check;
ALTER TABLE public.orgs 
  ADD CONSTRAINT orgs_sport_check 
  CHECK (sport IN ('football','basket','volleyball','handball','rugby'));

ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_sport_check;
ALTER TABLE public.matches 
  ADD CONSTRAINT matches_sport_check 
  CHECK (sport IN ('football','basket','volleyball','handball','rugby'));

-- 2) Add display_defaults to organizations
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS display_defaults jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 3) Create teams table
CREATE TABLE IF NOT EXISTS public.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  short_name text,
  logo text,
  colors jsonb,
  display_overrides jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(org_id, name)
);

-- Add updated_at trigger for teams
DROP TRIGGER IF EXISTS trg_teams_updated ON public.teams;
CREATE TRIGGER trg_teams_updated BEFORE UPDATE ON public.teams
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) Add team references to matches (backward compatible)
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS home_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS away_team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- 5) Create enriched matches view
CREATE OR REPLACE VIEW public.matches_v AS
SELECT
  m.*,
  o.slug as org_slug,
  o.name as org_name,
  o.sport as org_sport,
  o.display_defaults as org_display_defaults,
  th.id as home_team_full_id,
  th.display_overrides as home_display_overrides,
  th.name as home_team_name,
  th.short_name as home_team_short_name,
  th.logo as home_team_logo,
  th.colors as home_team_colors,
  ta.id as away_team_full_id,
  ta.display_overrides as away_display_overrides,
  ta.name as away_team_name,
  ta.short_name as away_team_short_name,
  ta.logo as away_team_logo,
  ta.colors as away_team_colors
FROM public.matches m
JOIN public.orgs o ON o.id = m.org_id
LEFT JOIN public.teams th ON th.id = m.home_team_id
LEFT JOIN public.teams ta ON ta.id = m.away_team_id;

-- 6) RLS for teams
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- Org members can manage their teams
DROP POLICY IF EXISTS teams_org_member_access ON public.teams;
CREATE POLICY teams_org_member_access ON public.teams
FOR ALL TO authenticated
USING (
  org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
)
WITH CHECK (
  org_id IN (SELECT org_id FROM public.org_members WHERE user_id = auth.uid())
);

-- Public read access for teams used in public matches
DROP POLICY IF EXISTS teams_public_read_used_in_public_match ON public.teams;
CREATE POLICY teams_public_read_used_in_public_match ON public.teams
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM public.matches m
    WHERE m.public_display = true
      AND (m.home_team_id = teams.id OR m.away_team_id = teams.id)
  )
);