-- Script pour créer des données de test
-- Exécuter ce script dans Supabase SQL Editor ou via mcp__supabase__execute_sql

-- 1. Créer une organisation de test (Football)
INSERT INTO orgs (slug, name, sport, display_defaults)
VALUES (
  'fc-test',
  'FC Test',
  'football',
  '{
    "common": {
      "showTeamLogos": true,
      "showPlayerNames": false,
      "showEventsFeed": true,
      "showAnimations": true
    },
    "football": {
      "showCards": true,
      "showGoalScorers": true,
      "showExtraTime": true
    }
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING
RETURNING id;

-- 2. Créer une organisation de test (Basketball)
INSERT INTO orgs (slug, name, sport, display_defaults)
VALUES (
  'basket-club',
  'Basketball Club',
  'basket',
  '{
    "common": {
      "showTeamLogos": true,
      "showPlayerNumbers": true,
      "showEventsFeed": true
    },
    "basket": {
      "showQuarter": true,
      "showShotClock": true,
      "showTeamFouls": true,
      "showTimeouts": true
    }
  }'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- 3. Créer des équipes pour FC Test
DO $$
DECLARE
  org_id_football uuid;
  team_psg_id uuid;
  team_om_id uuid;
BEGIN
  -- Récupérer l'ID de l'organisation football
  SELECT id INTO org_id_football FROM orgs WHERE slug = 'fc-test';

  IF org_id_football IS NOT NULL THEN
    -- Créer PSG
    INSERT INTO teams (org_id, name, short_name, logo, colors, display_overrides)
    VALUES (
      org_id_football,
      'Paris Saint-Germain',
      'PSG',
      'https://upload.wikimedia.org/wikipedia/fr/thumb/8/86/Paris_Saint-Germain_Logo.svg/150px-Paris_Saint-Germain_Logo.svg.png',
      '{"primary": "#004170", "secondary": "#DA291C"}'::jsonb,
      '{"common": {"showPlayerNames": true}}'::jsonb
    )
    ON CONFLICT (org_id, name) DO NOTHING
    RETURNING id INTO team_psg_id;

    -- Créer OM
    INSERT INTO teams (org_id, name, short_name, logo, colors, display_overrides)
    VALUES (
      org_id_football,
      'Olympique de Marseille',
      'OM',
      'https://upload.wikimedia.org/wikipedia/fr/thumb/4/43/Logo_Olympique_de_Marseille.svg/150px-Logo_Olympique_de_Marseille.svg.png',
      '{"primary": "#2FAEE0", "secondary": "#FFFFFF"}'::jsonb,
      '{}'::jsonb
    )
    ON CONFLICT (org_id, name) DO NOTHING
    RETURNING id INTO team_om_id;

    -- Créer un match test PSG vs OM
    IF team_psg_id IS NOT NULL AND team_om_id IS NOT NULL THEN
      INSERT INTO matches (
        org_id,
        name,
        sport,
        home_name,
        away_name,
        home_team_id,
        away_team_id,
        scheduled_at,
        status,
        public_display
      )
      VALUES (
        org_id_football,
        'Classique - PSG vs OM',
        'football',
        'Paris Saint-Germain',
        'Olympique de Marseille',
        team_psg_id,
        team_om_id,
        NOW() + INTERVAL '2 hours',
        'scheduled',
        true
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END IF;
END $$;

-- 4. Créer des équipes pour Basketball Club
DO $$
DECLARE
  org_id_basket uuid;
  team_lakers_id uuid;
  team_celtics_id uuid;
BEGIN
  SELECT id INTO org_id_basket FROM orgs WHERE slug = 'basket-club';

  IF org_id_basket IS NOT NULL THEN
    INSERT INTO teams (org_id, name, short_name, colors, display_overrides)
    VALUES (
      org_id_basket,
      'Lakers',
      'LAL',
      '{"primary": "#552583", "secondary": "#FDB927"}'::jsonb,
      '{}'::jsonb
    )
    ON CONFLICT (org_id, name) DO NOTHING
    RETURNING id INTO team_lakers_id;

    INSERT INTO teams (org_id, name, short_name, colors, display_overrides)
    VALUES (
      org_id_basket,
      'Celtics',
      'BOS',
      '{"primary": "#007A33", "secondary": "#FFFFFF"}'::jsonb,
      '{"basket": {"showPlayerFouls": true}}'::jsonb
    )
    ON CONFLICT (org_id, name) DO NOTHING
    RETURNING id INTO team_celtics_id;

    IF team_lakers_id IS NOT NULL AND team_celtics_id IS NOT NULL THEN
      INSERT INTO matches (
        org_id,
        name,
        sport,
        home_name,
        away_name,
        home_team_id,
        away_team_id,
        scheduled_at,
        status,
        public_display
      )
      VALUES (
        org_id_basket,
        'Lakers vs Celtics',
        'basket',
        'Lakers',
        'Celtics',
        team_lakers_id,
        team_celtics_id,
        NOW() + INTERVAL '3 hours',
        'scheduled',
        true
      );
    END IF;
  END IF;
END $$;

-- 5. Vérifications
SELECT 'Organisations créées:' as info;
SELECT slug, name, sport FROM orgs ORDER BY created_at DESC;

SELECT 'Équipes créées:' as info;
SELECT t.name, t.short_name, o.name as org_name
FROM teams t
JOIN orgs o ON o.id = t.org_id
ORDER BY t.created_at DESC;

SELECT 'Matchs créés:' as info;
SELECT m.name, m.sport, m.status, o.name as org_name
FROM matches m
JOIN orgs o ON o.id = m.org_id
ORDER BY m.created_at DESC;
