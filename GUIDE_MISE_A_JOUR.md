# Guide de mise à jour - Système Multi-Sports

## Résumé des changements

Votre application Scoreboard Pro a été mise à jour avec une architecture multi-sports complète:

✅ **5 sports supportés**: Football, Basket, Volleyball, Handball, Rugby
✅ **Gestion d'équipes**: Créez et gérez vos équipes par organisation
✅ **Paramètres d'affichage**: Configurez l'affichage par organisation et par équipe
✅ **Base de données migrée**: Nouvelle structure avec teams et display settings
✅ **Compatibilité maintenue**: Vos données existantes fonctionnent toujours

## Ce qui a changé

### Sports supprimés
- ❌ `basic`
- ❌ `hockey_ice`
- ❌ `hockey_field`

### Sports disponibles
- ⚽ `football` (45 min par mi-temps)
- 🏀 `basket` (10 min par quart-temps)
- 🏐 `volleyball` (sans chronomètre, par points)
- 🤾 `handball` (30 min par mi-temps)
- 🏉 `rugby` (40 min par mi-temps) **NOUVEAU**

## Nouvelle structure

```
Organisation
  └── Sport (1 seul sport par organisation)
      └── Équipes
          ├── Nom, logo, couleurs
          └── Paramètres d'affichage personnalisés

Match
  ├── Équipe domicile (référence vers une équipe)
  └── Équipe extérieure (référence vers une équipe)
```

## Prochaines étapes

### 1. Vérifier votre base de données

La migration a déjà été appliquée. Vous devriez maintenant avoir:
- Une nouvelle table `teams`
- De nouvelles colonnes dans `orgs` et `matches`
- Une vue `matches_v` pour faciliter les requêtes

### 2. Configurer le sport de vos organisations

Pour chaque organisation, définissez le sport principal:

```sql
UPDATE orgs
SET sport = 'football'
WHERE slug = 'votre-org-slug';
```

Ou via l'interface Super Admin (à venir).

### 3. Créer vos équipes

Utilisez le nouveau composant `TeamsPage` pour créer vos équipes:

```typescript
import { TeamsPage } from './pages/TeamsPage';

// Dans votre router/app
<TeamsPage orgId={currentOrgId} orgSport={org.sport} />
```

Ou créez-les directement en base:

```sql
INSERT INTO teams (org_id, name, short_name, logo, colors, display_overrides)
VALUES (
  'org-uuid',
  'Paris Saint-Germain',
  'PSG',
  'https://...',
  '{"primary": "#004170", "secondary": "#DA291C"}',
  '{"common": {"showPlayerNames": true}}'
);
```

### 4. Migrer les matchs existants (optionnel)

Si vous avez des matchs existants avec `home_name`/`away_name`, vous pouvez les convertir en références d'équipes:

```sql
-- Créer des équipes à partir des noms existants
INSERT INTO teams (org_id, name)
SELECT DISTINCT org_id, home_name
FROM matches
WHERE home_team_id IS NULL
ON CONFLICT (org_id, name) DO NOTHING;

-- Lier les matchs aux équipes
UPDATE matches m
SET home_team_id = t.id
FROM teams t
WHERE m.home_name = t.name
  AND m.org_id = t.org_id
  AND m.home_team_id IS NULL;

-- Idem pour away_team
UPDATE matches m
SET away_team_id = t.id
FROM teams t
WHERE m.away_name = t.name
  AND m.org_id = t.org_id
  AND m.away_team_id IS NULL;
```

### 5. Configurer les paramètres d'affichage (optionnel)

Définissez les paramètres d'affichage par défaut pour votre organisation:

```sql
UPDATE orgs
SET display_defaults = '{
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
}'
WHERE id = 'org-uuid';
```

Pour surcharger les paramètres d'une équipe spécifique:

```sql
UPDATE teams
SET display_overrides = '{
  "common": {
    "showPlayerNames": true
  }
}'
WHERE id = 'team-uuid';
```

## Utilisation de la nouvelle API

### Lire un match avec toutes ses données

```typescript
const { data } = await supabase
  .from('matches_v')
  .select('*')
  .eq('id', matchId)
  .single();

// data contient:
// - org_sport, org_display_defaults
// - home_team_name, home_team_logo, home_display_overrides
// - away_team_name, away_team_logo, away_display_overrides
```

### Fusionner les display settings

```typescript
import { deepMergeDisplaySettings } from '@pkg/logic';

const homeSettings = deepMergeDisplaySettings(
  data.org_display_defaults,
  data.home_display_overrides
);

// homeSettings contient les paramètres finaux pour l'équipe home
// (defaults org + surcharges équipe)
```

### Créer un match avec des équipes

```typescript
const { data } = await supabase
  .from('matches')
  .insert({
    org_id: orgId,
    name: 'Finale',
    sport: org.sport, // Sport de l'organisation
    home_team_id: psgTeamId,
    away_team_id: omTeamId,
    scheduled_at: new Date().toISOString(),
    status: 'scheduled',
    public_display: true
  })
  .select()
  .single();
```

## Paramètres d'affichage disponibles

### Communs (tous sports)
- `showTeamLogos`: Afficher les logos
- `showTeamColors`: Afficher les couleurs
- `showPlayerNames`: Afficher les noms
- `showPlayerNumbers`: Afficher les numéros
- `showEventsFeed`: Bandeau événements
- `showAnimations`: Animations UI
- `showSponsorOverlay`: Overlay sponsor

### Par sport
Consultez `MIGRATION_MULTI_SPORTS.md` pour la liste complète des paramètres spécifiques à chaque sport.

## Dépannage

### Les builds échouent

Assurez-vous que toutes les dépendances sont installées:

```bash
# Root
npm install @vitejs/plugin-react vite typescript --save-dev

# Operator
cd apps/operator
npm install @vitejs/plugin-react react react-dom react-router-dom @supabase/supabase-js

# Display
cd apps/display
npm install @vitejs/plugin-react react react-dom @supabase/supabase-js
```

### Erreurs TypeScript

Les anciens sports (`basic`, `hockey_ice`, `hockey_field`) ne sont plus supportés. Remplacez-les par l'un des 5 sports disponibles.

### Matches ne s'affichent pas

Vérifiez que:
1. Le sport de l'organisation est défini (`orgs.sport`)
2. Les équipes existent et sont liées au bon `org_id`
3. Les politiques RLS permettent l'accès (voir `MIGRATION_MULTI_SPORTS.md`)

## Support

Pour plus de détails techniques, consultez:
- `MIGRATION_MULTI_SPORTS.md` - Documentation complète de la migration
- `packages/types/src/index.ts` - Tous les types TypeScript
- `packages/logic/src/index.ts` - Logique métier et defaults
- `supabase/migrations/20260226_org_sport_teams_display.sql` - Structure DB

Bonne utilisation de votre nouvelle plateforme multi-sports!
