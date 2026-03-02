# 📄 SCOREBOARD — BIBLE FONCTIONNELLE OFFICIELLE

**Version**: 3.0.0
**Date**: 2026-02-26
**Statut**: Source de vérité métier

---

## 1. Vision Produit

### 1.1 Objectif

Scoreboard est une application web multi-sports composée de deux applications distinctes :

- **Operator** : Interface de gestion et pilotage en temps réel des matchs
- **Display** : Affichage public temps réel pour les spectateurs

**Mission** : Permettre à une organisation sportive de gérer et afficher des scores en direct avec des paramètres d'affichage entièrement configurables, adaptés à chaque sport et personnalisables par équipe.

### 1.2 Périmètre

- Gestion multi-organisations isolées
- Support natif de 5 sports professionnels
- Affichage public sécurisé par token
- Configuration granulaire de l'affichage
- Temps réel via WebSocket (Supabase Realtime)

### 1.3 Non-objectifs

- ❌ Gestion des joueurs individuels (roster détaillé)
- ❌ Statistiques avancées et analytics
- ❌ Replay vidéo
- ❌ Multi-sport par organisation (1 org = 1 sport)

---

## 2. Modèle Métier

### 2.1 Invariants Structurels

Ces règles sont **NON NÉGOCIABLES** et constituent le socle de l'architecture :

| # | Règle | Impact |
|---|-------|--------|
| **I-001** | **1 Organisation = 1 Sport** | Une organisation ne peut gérer qu'un seul sport |
| **I-002** | **1 Organisation = N Équipes** | Une organisation peut créer plusieurs équipes |
| **I-003** | **Sport du match = Sport de l'organisation** | Le sport n'est jamais choisi au niveau match |
| **I-004** | **Toujours affichés** | Score + Temps + Noms équipes sont obligatoires |
| **I-005** | **Logo équipe optionnel** | Peut être null, l'affichage s'adapte |
| **I-006** | **Héritage paramètres** | Org defaults → Team overrides (merge profond) |
| **I-007** | **Isolation organisations** | Aucune visibilité inter-organisations |

### 2.2 Entités

#### Organisation

```typescript
interface Org {
  id: uuid;
  slug: string;              // Identifiant URL-friendly unique
  name: string;              // Nom affiché
  sport: Sport;              // football | basket | volleyball | handball | rugby
  display_defaults: OrgDisplayDefaults;  // Paramètres par défaut (JSONB)
  created_at: timestamptz;
}
```

**Règles** :
- `sport` est **immutable** après création (ou migration manuelle uniquement)
- `slug` doit être unique globalement
- `display_defaults` définit le comportement par défaut pour toutes les équipes

#### Équipe (Team)

```typescript
interface Team {
  id: uuid;
  org_id: uuid;              // FK → orgs.id
  name: string;              // Nom complet
  short_name?: string;       // Abréviation (ex: PSG, OM)
  logo?: string;             // URL du logo
  colors?: {                 // Couleurs officielles
    primary?: string;        // Hex color
    secondary?: string;
  };
  display_overrides: TeamDisplayOverrides;  // Surcharges (JSONB)
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**Règles** :
- Unique par `(org_id, name)`
- `display_overrides` est **partiel** : seules les clés présentes surchargent
- Logo recommandé mais optionnel

#### Match

```typescript
interface Match {
  id: uuid;
  org_id: uuid;              // FK → orgs.id
  name: string;              // Ex: "Finale Championnat"
  sport: Sport;              // Hérité de l'organisation (redondant pour perfs)

  // Références équipes (nouveau modèle)
  home_team_id?: uuid;       // FK → teams.id
  away_team_id?: uuid;       // FK → teams.id

  // Legacy (compatibilité ascendante)
  home_name: string;         // Fallback si home_team_id null
  away_name: string;         // Fallback si away_team_id null
  home_logo?: string;        // Utilisé si pas de team
  away_logo?: string;

  scheduled_at: timestamptz;
  status: MatchStatus;       // scheduled | live | finished | archived
  public_display: boolean;   // Visible publiquement ?
  display_token: string;     // Token sécurité pour Display

  created_by?: uuid;
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**Règles** :
- `sport` **DOIT** correspondre à `orgs.sport` (contrainte applicative)
- Si `home_team_id` présent → utiliser données de `teams`
- Sinon → fallback sur `home_name`, `home_logo`
- `display_token` généré automatiquement, non modifiable

#### État Live (Realtime)

```typescript
interface MatchState {
  matchId: string;
  sport: Sport;
  clock: ClockState;         // Chronomètre principal
  score: ScoreState;         // Score home/away
  meta: any;                 // Métadonnées sport-spécifiques
}

interface ClockState {
  durationSec: number;       // Durée période en secondes
  remainingMs: number;       // Temps restant en ms
  running: boolean;          // Chrono en cours ?
  period: number;            // Période/Quart-temps/Set
}

interface ScoreState {
  home: number;
  away: number;
}
```

**Règles** :
- État éphémère (Realtime broadcast, pas persisté en DB)
- Tick toutes les 100ms
- Broadcast uniquement par l'opérateur actif

---

## 3. Sports Supportés

### 3.1 Vue d'ensemble

| Sport | Code | Durée Période | Périodes | Chrono | Meta Clés |
|-------|------|---------------|----------|--------|-----------|
| ⚽ Football | `football` | 45 min | 2 | Décomptant | Cartons, temps add., tirs au but |
| 🏀 Basket | `basket` | 10 min | 4 | Décomptant | Shot clock, fautes, timeouts |
| 🏐 Volleyball | `volleyball` | - | 5 sets | Aucun | Sets, service, rotations |
| 🤾 Handball | `handball` | 30 min | 2 | Décomptant | Exclusions 2 min, timeouts |
| 🏉 Rugby | `rugby` | 40 min | 2 | Décomptant | Sin bin 10 min, détail score |

### 3.2 Football

**Durée** : 2 × 45 minutes

**État initial** :
```typescript
{
  clock: { durationSec: 2700, remainingMs: 2700000, running: false, period: 1 },
  score: { home: 0, away: 0 },
  meta: {
    stoppageMin: 0,          // Temps additionnel
    cards: {
      home: { yellow: 0, red: 0 },
      away: { yellow: 0, red: 0 }
    },
    shootout: {
      inProgress: false,
      home: [],              // [true, false, true] = résultats tirs
      away: []
    }
  }
}
```

**Paramètres d'affichage spécifiques** :
- `showCards` (défaut: true) — Afficher cartons
- `showSubstitutions` (défaut: false) — Afficher remplacements
- `showGoalScorers` (défaut: true) — Afficher buteurs
- `showExtraTime` (défaut: true) — Afficher temps additionnel
- `showPenaltyShootout` (défaut: false) — Afficher séance tirs au but

### 3.3 Basket

**Durée** : 4 × 10 minutes

**État initial** :
```typescript
{
  clock: { durationSec: 600, remainingMs: 600000, running: false, period: 1 },
  score: { home: 0, away: 0 },
  meta: {
    foulLimitPerPlayer: 5,
    teamFouls: { home: 0, away: 0 },
    bonusThreshold: 5,
    timeoutsLeft: { home: 5, away: 5 },
    shotClockMs: 24000,
    shotRunning: false,
    roster: {
      home: [{ num: 4, fouls: 0 }, ...],
      away: [{ num: 9, fouls: 0 }, ...]
    }
  }
}
```

**Paramètres d'affichage spécifiques** :
- `showQuarter` (défaut: true) — Afficher quart-temps
- `showShotClock` (défaut: true) — Afficher shot clock 24s
- `showTeamFouls` (défaut: true) — Afficher fautes équipe
- `showPlayerFouls` (défaut: false) — Afficher fautes joueurs
- `showTimeouts` (défaut: true) — Afficher temps-morts restants
- `showPossessionArrow` (défaut: false) — Flèche de possession

### 3.4 Volleyball

**Durée** : Pas de chronomètre (jeu par points)

**État initial** :
```typescript
{
  clock: { durationSec: 0, remainingMs: 0, running: false, period: 1 },
  score: { home: 0, away: 0 },
  meta: {
    currentSet: 1,
    bestOf: 5,
    setsWon: { home: 0, away: 0 },
    pointsToWin: 25,
    tieBreakPoints: 15,
    winBy: 2,
    serve: 'home',           // 'home' | 'away'
    timeouts: { home: 0, away: 0 },
    maxTimeoutsPerSet: 2,
    technicalTO: {
      enabled: false,
      atPoints: [8, 16]
    }
  }
}
```

**Paramètres d'affichage spécifiques** :
- `showSets` (défaut: true) — Afficher score sets
- `showCurrentSet` (défaut: true) — Afficher set en cours
- `showServerIndicator` (défaut: true) — Indicateur de service
- `showTimeouts` (défaut: true) — Temps-morts utilisés
- `showRotation` (défaut: false) — Afficher rotation joueurs
- `showSetPointMatchPoint` (défaut: true) — Indicateurs set/match point

### 3.5 Handball

**Durée** : 2 × 30 minutes

**État initial** :
```typescript
{
  clock: { durationSec: 1800, remainingMs: 1800000, running: false, period: 1 },
  score: { home: 0, away: 0 },
  meta: {
    timeouts: { home: 0, away: 0, maxPerTeam: 3 },
    suspensions: {
      home: [],              // [{ player: 7, remainingMs: 120000 }]
      away: []
    }
  }
}
```

**Paramètres d'affichage spécifiques** :
- `showCards` (défaut: true) — Afficher cartons
- `showExclusions` (défaut: true) — Afficher exclusions 2 min
- `showTimeouts` (défaut: true) — Afficher temps-morts
- `show7m` (défaut: false) — Afficher tirs à 7 mètres

### 3.6 Rugby (Union)

**Durée** : 2 × 40 minutes

**État initial** :
```typescript
{
  clock: { durationSec: 2400, remainingMs: 2400000, running: false, period: 1 },
  score: { home: 0, away: 0 },
  meta: {
    cards: {
      home: { yellow: 0, red: 0 },
      away: { yellow: 0, red: 0 }
    },
    sinBin: {
      home: [],              // [{ player: 10, remainingMs: 600000 }]
      away: []
    },
    tries: { home: 0, away: 0 },
    conversions: { home: 0, away: 0 },
    penalties: { home: 0, away: 0 },
    dropGoals: { home: 0, away: 0 }
  }
}
```

**Paramètres d'affichage spécifiques** :
- `showScoreBreakdown` (défaut: true) — Détail score (essais, transformations...)
- `showCards` (défaut: true) — Afficher cartons
- `showSinBinTimer` (défaut: true) — Chrono banc de touche (10 min)
- `showTriesScorers` (défaut: true) — Afficher marqueurs d'essais
- `showBonusPoints` (défaut: false) — Points de bonus

---

## 4. Paramètres d'Affichage

### 4.1 Architecture JSON

```typescript
// Organisation : Defaults complets
interface OrgDisplayDefaults {
  common: CommonDisplaySettings;
  football?: FootballDisplaySettings;
  basket?: BasketDisplaySettings;
  volleyball?: VolleyballDisplaySettings;
  handball?: HandballDisplaySettings;
  rugby?: RugbyDisplaySettings;
}

// Équipe : Overrides partiels
interface TeamDisplayOverrides {
  common?: Partial<CommonDisplaySettings>;
  football?: Partial<FootballDisplaySettings>;
  // ... idem pour autres sports
}
```

### 4.2 Paramètres Communs (Tous Sports)

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `showTeamLogos` | boolean | `true` | Afficher logos équipes |
| `showTeamColors` | boolean | `false` | Utiliser couleurs équipes (fond, bordures) |
| `showPlayerNames` | boolean | `false` | Afficher noms joueurs (roster) |
| `showPlayerNumbers` | boolean | `false` | Afficher numéros joueurs |
| `showEventsFeed` | boolean | `true` | Bandeau événements (buts, fautes, etc.) |
| `showAnimations` | boolean | `true` | Animations UI (transitions, célébrations) |
| `showSponsorOverlay` | boolean | `false` | Overlay sponsors/publicité |

### 4.3 Defaults Recommandés par Sport

**Football** :
```json
{
  "showCards": true,
  "showSubstitutions": false,
  "showGoalScorers": true,
  "showExtraTime": true,
  "showPenaltyShootout": false
}
```

**Basket** :
```json
{
  "showQuarter": true,
  "showShotClock": true,
  "showTeamFouls": true,
  "showPlayerFouls": false,
  "showTimeouts": true,
  "showPossessionArrow": false
}
```

**Volleyball** :
```json
{
  "showSets": true,
  "showCurrentSet": true,
  "showServerIndicator": true,
  "showTimeouts": true,
  "showRotation": false,
  "showSetPointMatchPoint": true
}
```

**Handball** :
```json
{
  "showCards": true,
  "showExclusions": true,
  "showTimeouts": true,
  "show7m": false
}
```

**Rugby** :
```json
{
  "showScoreBreakdown": true,
  "showCards": true,
  "showSinBinTimer": true,
  "showTriesScorers": true,
  "showBonusPoints": false
}
```

### 4.4 Règles d'Héritage

**Principe** : `displayFinal = deepMerge(org.display_defaults, team.display_overrides)`

**Algorithme** :
1. Partir des `org.display_defaults` (complets)
2. Appliquer `team.display_overrides` clé par clé
3. Si clé présente dans overrides → **remplace** la valeur
4. Si clé absente dans overrides → **héritage** de l'org
5. Pas de suppression possible (seulement remplacement)

**Exemple** :

```typescript
// Organisation (defaults)
{
  common: { showTeamLogos: true, showPlayerNames: false },
  football: { showCards: true, showGoalScorers: true }
}

// Équipe PSG (overrides)
{
  common: { showPlayerNames: true }
}

// Résultat fusionné pour PSG
{
  common: { showTeamLogos: true, showPlayerNames: true },  // ← showPlayerNames surchargé
  football: { showCards: true, showGoalScorers: true }     // ← hérité tel quel
}
```

**Implémentation** : Fonction `deepMergeDisplaySettings()` dans `@pkg/logic`

---

## 5. Architecture Technique

### 5.1 Stack

- **Frontend** : Vite 5 + React 18 + TypeScript
- **Backend** : Supabase (Postgres + Realtime + Auth + RLS)
- **Monorepo** : Workspaces npm
- **État temps réel** : Supabase Realtime Broadcast (WebSocket)

### 5.2 Structure du projet

```
/
├── apps/
│   ├── operator/       # Interface gestion (authentifiée)
│   └── display/        # Affichage public (anon + token)
├── packages/
│   ├── types/          # Types TypeScript partagés
│   ├── logic/          # Logique métier (ticks, defaults, merge)
│   └── supa/           # Client Supabase
└── supabase/
    └── migrations/     # Migrations SQL versionnées
```

### 5.3 Base de données

**Tables principales** :
- `profiles` — Utilisateurs (sync avec auth.users)
- `orgs` — Organisations
- `org_members` — Membres avec rôles (super_admin, admin, operator)
- `teams` — Équipes
- `matches` — Matchs

**Vues** :
- `org_members_with_org` — Jointure membres/orgs
- `matches_v` — Match enrichi avec org + teams + display settings

**Fonctions** :
- `set_updated_at()` — Trigger updated_at
- `rand_token()` — Génération tokens display
- `handle_new_user()` — Auto-création profile

### 5.4 Sécurité (RLS)

**Principes** :
- RLS activé sur **toutes** les tables
- Isolation stricte par organisation
- Super admins : accès global
- Operators : accès limité à leur(s) organisation(s)
- Accès public : uniquement `matches.public_display = true` + token valide

**Policies clés** :

```sql
-- Équipes : membres org uniquement
CREATE POLICY teams_org_member_access ON teams
FOR ALL TO authenticated
USING (org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid()));

-- Équipes : lecture publique si match public
CREATE POLICY teams_public_read ON teams
FOR SELECT TO anon
USING (
  EXISTS (
    SELECT 1 FROM matches m
    WHERE m.public_display = true
      AND (m.home_team_id = teams.id OR m.away_team_id = teams.id)
  )
);
```

---

## 6. Décisions Structurantes (ADR)

### ADR-001 — 1 Organisation = 1 Sport

**Date** : 2026-02-26
**Statut** : Accepté

**Contexte** :
- Initialement, le sport était choisi au niveau match
- Créait incohérence : une org foot pouvait avoir un match basket

**Décision** :
Le sport est désormais une propriété **immutable** de l'organisation.

**Raison** :
- Cohérence métier : une organisation gère un seul sport
- Simplifie la gestion des équipes (toutes du même sport)
- Facilite les defaults d'affichage (1 seul sport à configurer)

**Impact** :
- ✅ Cohérence données
- ✅ Simplification UI (pas de choix sport au match)
- ⚠️ Migration existante nécessaire
- ⚠️ Multi-sport nécessite plusieurs organisations

**Alternatives rejetées** :
- Sport au niveau match → incohérence équipes
- Multi-sport par org → complexité démesurée

---

### ADR-002 — Héritage JSON pour Display Settings

**Date** : 2026-02-26
**Statut** : Accepté

**Contexte** :
- Besoin de personnalisation par équipe
- Éviter duplication complète des paramètres

**Décision** :
Système d'héritage avec merge profond :
- Organisation : defaults complets
- Équipe : overrides partiels
- Résolution : deepMerge à l'affichage

**Raison** :
- Flexibilité maximale
- DRY (Don't Repeat Yourself)
- Maintenabilité (changer org → impact toutes équipes)

**Impact** :
- ✅ Personnalisation granulaire
- ✅ Maintenance simplifiée
- ⚠️ Complexité merge côté code
- ⚠️ Validation JSON nécessaire

**Alternatives rejetées** :
- Copie complète par équipe → duplication
- Pas de personnalisation équipe → manque flexibilité

---

### ADR-003 — Teams comme Entité Centrale

**Date** : 2026-02-26
**Statut** : Accepté

**Contexte** :
- Anciennement : `home_name` / `away_name` en texte libre
- Redondance, pas de centralisation logos/couleurs

**Décision** :
Créer table `teams` avec références FK dans `matches`.

**Raison** :
- Centralisation données équipes
- Logos/couleurs réutilisables
- Display settings par équipe
- Cohérence nommage

**Impact** :
- ✅ Normalisation données
- ✅ Réutilisabilité
- ✅ Personnalisation avancée
- ⚠️ Compatibilité ascendante (fallback home_name)

**Migration** :
- Conservation colonnes legacy
- FK optionnelles (nullable)
- Fallback automatique

---

### ADR-004 — Realtime Broadcast Non Persisté

**Date** : 2026-02-26
**Statut** : Accepté

**Contexte** :
- État live du match (score, chrono) change très fréquemment
- Persister chaque changement → overhead DB

**Décision** :
État live via Realtime Broadcast (éphémère), pas de persistance.

**Raison** :
- Performances (pas de write DB toutes les 100ms)
- Temps réel natif WebSocket
- Pas de besoin historique tick-par-tick

**Impact** :
- ✅ Performances optimales
- ✅ Latence minimale
- ⚠️ État perdu si tous clients déconnectés
- ⚠️ Pas d'historique granulaire

**Évolution future** :
- Snapshots périodiques (optionnel)
- Replay basé sur événements (pas sur ticks)

---

## 7. Roadmap Structurelle

### Phase 1 — Fondations (✅ Terminé)

- [x] Migration DB multi-sports
- [x] Table teams + display_overrides
- [x] Vue matches_v enrichie
- [x] Types TypeScript complets
- [x] Logique rugby + defaults

### Phase 2 — UI Teams (🚧 En cours)

- [ ] Intégrer TeamsPage dans router operator
- [ ] Formulaire création match avec sélecteur équipes
- [ ] Auto-remplissage logos depuis équipe
- [ ] Validation sport match = sport org

### Phase 3 — Display Settings UI

- [ ] Interface graphique org.display_defaults
- [ ] Interface graphique team.display_overrides
- [ ] Prévisualisation live des paramètres
- [ ] Validation JSON schema

### Phase 4 — Edge Functions (Optionnel)

- [ ] `get-display-context` : context complet pour display
- [ ] `resolve-display-settings` : merge serveur
- [ ] Sécurisation accès anon via EF

### Phase 5 — Migration Données Legacy

- [ ] Script migration home_name → home_team_id
- [ ] Suppression colonnes legacy (après transition)
- [ ] Rendre orgs.sport NOT NULL

### Phase 6 — Fonctionnalités Avancées

- [ ] Snapshots état match (persistance optionnelle)
- [ ] Historique événements structuré
- [ ] Export statistiques
- [ ] Multi-langue paramètres affichage

---

## 8. Règles de Contribution

### 8.1 Avant toute modification

1. **Vérifier cohérence avec la Bible**
   - L'invariant est-il respecté ?
   - La modification casse-t-elle un ADR ?

2. **Refuser modifications contradictoires**
   - Exemple : "Ajouter sport au niveau match" → ❌ Refuse (ADR-001)

3. **Documenter décision structurante**
   - Si modification impacte architecture → créer ADR

### 8.2 Checklist modification DB

- [ ] Migration SQL avec IF EXISTS/IF NOT EXISTS
- [ ] Commentaires explicatifs détaillés
- [ ] Compatibilité ascendante vérifiée
- [ ] RLS policies mises à jour
- [ ] Types TypeScript synchronisés

### 8.3 Checklist ajout sport

1. Mettre à jour enum `Sport` dans types
2. Ajouter contrainte CHECK en DB
3. Créer `[Sport]DisplaySettings` interface
4. Ajouter defaults dans `@pkg/logic`
5. Implémenter `initStateForSport()`
6. Implémenter `applyTick()` si méta spécifique
7. Mettre à jour UI scoreboard display
8. **Mettre à jour cette Bible (Section 3)**

---

## 9. Glossaire

| Terme | Définition |
|-------|------------|
| **Org** | Organisation = structure gérant 1 sport + N équipes |
| **Team** | Équipe appartenant à 1 org |
| **Match** | Rencontre entre 2 équipes d'une même org |
| **Display** | App publique affichage temps réel |
| **Operator** | App gestion/pilotage pour opérateurs |
| **RLS** | Row Level Security (Postgres) |
| **ADR** | Architecture Decision Record |
| **Defaults** | Paramètres par défaut (org) |
| **Overrides** | Surcharges partielles (équipe) |
| **Merge** | Fusion defaults + overrides |
| **Broadcast** | Canal WebSocket Realtime |
| **Tick** | Cycle 100ms mise à jour état live |

---

## 10. Support & Contact

**Documentation technique** :
- `MIGRATION_MULTI_SPORTS.md` — Détails migration DB
- `GUIDE_MISE_A_JOUR.md` — Guide utilisateur
- `packages/types/src/index.ts` — Référence types
- `packages/logic/src/index.ts` — Logique métier

**Migrations DB** :
- `supabase/migrations/20260226_org_sport_teams_display.sql`

---

**⚠️ IMPORTANT** : Ce document est la **source de vérité métier**. Toute modification doit être validée ici avant implémentation.

**Version** : 3.0.0
**Dernière mise à jour** : 2026-02-26
**Mainteneur** : Équipe Scoreboard
