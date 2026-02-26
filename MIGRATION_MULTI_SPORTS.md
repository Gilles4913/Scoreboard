# Migration Multi-Sports - Documentation

## Vue d'ensemble

Cette migration transforme Scoreboard Pro en une plateforme multi-sports robuste avec une architecture Organisation → Équipes → Display Settings.

## Modifications principales

### 1. Base de données

**Migration appliquée**: `20260226_org_sport_teams_display.sql`

#### Nouvelles structures:

- **Table `teams`**: Gestion centralisée des équipes
  - `id`, `org_id`, `name`, `short_name`, `logo`, `colors`, `display_overrides`
  - Chaque organisation peut créer et gérer ses équipes
  - Les équipes peuvent avoir des paramètres d'affichage personnalisés

- **Colonne `orgs.sport`**: Un sport par organisation (football, basket, volleyball, handball, rugby)

- **Colonne `orgs.display_defaults`**: Paramètres d'affichage par défaut de l'organisation (JSONB)

- **Colonnes `matches.home_team_id` et `away_team_id`**: Références vers les équipes (avec compatibilité ascendante via `home_name`/`away_name`)

- **Vue `matches_v`**: Vue enrichie incluant:
  - Données de l'organisation (sport, display_defaults)
  - Données des équipes home/away (noms, logos, colors, display_overrides)

#### Contraintes de sport mises à jour:

Anciens sports supprimés: `basic`, `hockey_ice`, `hockey_field`
Nouveaux sports supportés: `football`, `basket`, `volleyball`, `handball`, `rugby`

### 2. Types TypeScript

**Fichier**: `packages/types/src/index.ts`

#### Nouveaux types:

```typescript
// Sports supportés
export type Sport = 'football' | 'basket' | 'volleyball' | 'handball' | 'rugby';

// Paramètres d'affichage communs
export interface CommonDisplaySettings {
  showTeamLogos?: boolean;
  showTeamColors?: boolean;
  showPlayerNames?: boolean;
  showPlayerNumbers?: boolean;
  showEventsFeed?: boolean;
  showAnimations?: boolean;
  showSponsorOverlay?: boolean;
}

// Paramètres spécifiques par sport
export interface FootballDisplaySettings { ... }
export interface BasketDisplaySettings { ... }
export interface VolleyballDisplaySettings { ... }
export interface HandballDisplaySettings { ... }
export interface RugbyDisplaySettings { ... }

// Paramètres de l'organisation (défauts)
export interface OrgDisplayDefaults {
  common: CommonDisplaySettings;
  football?: FootballDisplaySettings;
  basket?: BasketDisplaySettings;
  // ...
}

// Surcharges d'équipe (optionnelles/partielles)
export interface TeamDisplayOverrides {
  common?: Partial<CommonDisplaySettings>;
  football?: Partial<FootballDisplaySettings>;
  // ...
}

// Équipe
export interface Team {
  id: string;
  org_id: string;
  name: string;
  short_name?: string;
  logo?: string;
  colors?: { primary?: string; secondary?: string };
  display_overrides: TeamDisplayOverrides;
  created_at: string;
  updated_at: string;
}

// Organisation (mise à jour)
export interface Org {
  id: string;
  slug: string;
  name: string;
  sport: Sport;
  display_defaults: OrgDisplayDefaults;
  created_at: string;
}
```

### 3. Logique métier

**Fichier**: `packages/logic/src/index.ts`

#### Nouveautés:

- **Fonctions mises à jour**:
  - `defaultClockForSport()`: Support du rugby (40 min)
  - `initStateForSport()`: Meta données pour le rugby
  - `applyTick()`: Gestion du sin bin (banc de touche) pour le rugby

- **Valeurs par défaut d'affichage**:
  ```typescript
  export const DEFAULT_COMMON_SETTINGS: CommonDisplaySettings
  export const DEFAULT_FOOTBALL_SETTINGS: FootballDisplaySettings
  export const DEFAULT_BASKET_SETTINGS: BasketDisplaySettings
  export const DEFAULT_VOLLEYBALL_SETTINGS: VolleyballDisplaySettings
  export const DEFAULT_HANDBALL_SETTINGS: HandballDisplaySettings
  export const DEFAULT_RUGBY_SETTINGS: RugbyDisplaySettings

  export function getDefaultDisplaySettings(sport: Sport): OrgDisplayDefaults
  ```

- **Utilitaire de fusion**: `deepMergeDisplaySettings()`
  - Fichier: `packages/logic/src/displaySettings.ts`
  - Fusionne les defaults d'organisation avec les overrides d'équipe
  - Logique: `resolved = deepMerge(org.display_defaults, team.display_overrides)`

### 4. Interface Operator

**Nouveau composant**: `apps/operator/src/pages/TeamsPage.tsx`

Fonctionnalités:
- Liste des équipes de l'organisation
- Création/Édition/Suppression d'équipes
- Gestion des logos et noms courts
- Interface simple et intuitive

**SpacePage mis à jour**:
- Utilisation de la nouvelle liste de sports (sans basic/hockey)
- Sport par défaut: `football` au lieu de `basic`

### 5. Application Display

**Fichiers mis à jour**:
- `apps/display/src/main.tsx`: Support du rugby dans les fonctions utilitaires
- Durée par défaut pour rugby: 40 minutes
- Meta données rugby: cartes, sin bin, tries, conversions, penalties, drop goals

## Paramètres d'affichage par sport

### Paramètres communs (tous sports)

| Paramètre | Type | Description |
|-----------|------|-------------|
| `showTeamLogos` | boolean | Afficher les logos des équipes |
| `showTeamColors` | boolean | Afficher les couleurs/maillots |
| `showPlayerNames` | boolean | Afficher les noms des joueurs |
| `showPlayerNumbers` | boolean | Afficher les numéros des joueurs |
| `showEventsFeed` | boolean | Bandeau d'événements (buts, fautes) |
| `showAnimations` | boolean | Animations UI |
| `showSponsorOverlay` | boolean | Overlay sponsor/publicité |

### Football

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `showCards` | true | Cartons jaunes/rouges |
| `showSubstitutions` | false | Remplacements |
| `showGoalScorers` | true | Buteurs |
| `showExtraTime` | true | Temps additionnel |
| `showPenaltyShootout` | false | Séance de tirs au but |

### Basket

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `showQuarter` | true | Période en cours |
| `showShotClock` | true | Chronomètre des 24 secondes |
| `showTeamFouls` | true | Fautes d'équipe |
| `showPlayerFouls` | false | Fautes individuelles |
| `showTimeouts` | true | Temps-morts |
| `showPossessionArrow` | false | Flèche de possession |

### Volleyball

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `showSets` | true | Score des sets |
| `showCurrentSet` | true | Set en cours |
| `showServerIndicator` | true | Indicateur de service |
| `showTimeouts` | true | Temps-morts |
| `showRotation` | false | Rotation des joueurs |
| `showSetPointMatchPoint` | true | Set/Match point |

### Handball

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `showCards` | true | Cartons |
| `showExclusions` | true | Exclusions temporaires (2 min) |
| `showTimeouts` | true | Temps-morts |
| `show7m` | false | Tirs à 7 mètres |

### Rugby

| Paramètre | Défaut | Description |
|-----------|--------|-------------|
| `showScoreBreakdown` | true | Détail du score (essais, pénalités, etc.) |
| `showCards` | true | Cartons jaunes/rouges |
| `showSinBinTimer` | true | Chronomètre banc de touche |
| `showTriesScorers` | true | Marqueurs d'essais |
| `showBonusPoints` | false | Points de bonus |

## Architecture de données

```
Organization (1 sport)
  ├── sport: Sport (football, basket, volleyball, handball, rugby)
  ├── display_defaults: OrgDisplayDefaults
  │     ├── common: CommonDisplaySettings
  │     └── [sport]: SportSpecificSettings
  └── Teams[]
        ├── name, logo, colors
        └── display_overrides: TeamDisplayOverrides (partial)
              ├── common?: Partial<CommonDisplaySettings>
              └── [sport]?: Partial<SportSpecificSettings>

Match
  ├── org_id → Organization
  ├── home_team_id → Team (optionnel, rétro-compatible)
  ├── away_team_id → Team (optionnel, rétro-compatible)
  ├── home_name (fallback si pas de team_id)
  └── away_name (fallback si pas de team_id)
```

## Sécurité RLS

### Policies pour `teams`

1. **Membres d'organisation** (authenticated):
   - Accès complet (CRUD) aux équipes de leur organisation
   - `org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())`

2. **Accès public** (anon):
   - Lecture seule pour les équipes utilisées dans des matchs publics
   - Seulement si `matches.public_display = true`

## Compatibilité ascendante

La migration maintient la compatibilité avec l'existant:

1. **Colonnes `home_name`/`away_name`** conservées dans `matches`
2. **Sport de l'organisation** optionnel durant la transition
3. **Fallback automatique**: Si `team_id` est null, utilise `home_name`/`away_name`
4. **Vue `matches_v`**: Fournit toutes les données (anciennes et nouvelles)

## Prochaines étapes recommandées

### 1. Interface Teams dans Operator
- Intégrer `TeamsPage` dans le routeur principal
- Ajouter un onglet "Équipes" dans l'interface operator
- Permettre la sélection d'équipes lors de la création de matchs

### 2. Formulaire de création de match
- Remplacer les champs texte `home_name`/`away_name` par des sélecteurs d'équipes
- Pré-remplir les logos depuis les équipes sélectionnées
- Appliquer automatiquement le sport de l'organisation

### 3. Display Settings UI
- Créer une interface graphique pour éditer `display_defaults` (organisation)
- Créer une interface pour éditer `display_overrides` (équipe)
- Afficher un aperçu en temps réel des paramètres

### 4. Migration des données existantes
```sql
-- Créer des équipes à partir des matchs existants
INSERT INTO teams (org_id, name)
SELECT DISTINCT org_id, home_name FROM matches
WHERE home_team_id IS NULL
UNION
SELECT DISTINCT org_id, away_name FROM matches
WHERE away_team_id IS NULL;

-- Lier les matchs aux équipes créées
UPDATE matches m
SET home_team_id = t.id
FROM teams t
WHERE m.home_name = t.name AND m.org_id = t.org_id AND m.home_team_id IS NULL;

UPDATE matches m
SET away_team_id = t.id
FROM teams t
WHERE m.away_name = t.name AND m.org_id = t.org_id AND m.away_team_id IS NULL;
```

### 5. Edge Functions (optionnelles mais recommandées)

#### `get-display-context`
Retourne le contexte complet pour l'affichage public:
- Match avec token validation
- Organisation avec sport et display_defaults
- Équipes home/away avec display settings résolus
- Évite d'exposer trop de tables en accès anon

#### `resolve-display-settings`
Utilitaire serveur pour fusionner org defaults + team overrides:
```typescript
{
  "home": deepMerge(org.display_defaults, homeTeam.display_overrides),
  "away": deepMerge(org.display_defaults, awayTeam.display_overrides)
}
```

## Tests recommandés

1. **Création d'équipe**: Vérifier que les équipes sont bien créées et associées à l'org
2. **RLS**: Tester que les équipes ne sont visibles que pour les membres de l'org
3. **Accès public**: Vérifier que les équipes dans un match public sont accessibles en anon
4. **Display settings merge**: Tester la fusion org defaults + team overrides
5. **Compatibilité**: Créer un match avec team_id et un autre sans (legacy)

## Build et déploiement

Tous les builds passent:
- ✅ Root project
- ✅ Operator app
- ✅ Display app
- ✅ Packages (types, logic, supa)

Commandes:
```bash
npm run build                     # Root
cd apps/operator && npm run build
cd apps/display && npm run build
```
