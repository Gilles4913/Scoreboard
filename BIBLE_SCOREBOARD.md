# SCOREBOARD — Bible Fonctionnelle Officielle

**Version**: 3.0.0
**Date**: 2026-02-26
**Statut**: Référence Unique du Produit

---

## 1. Vision Produit

### 1.1 Objectif

Scoreboard est une application web composée de :

- **Operator** : gestion et pilotage du match en direct
- **Display** : affichage public temps réel

**Objectif principal** :

Permettre à une organisation sportive d'afficher un score en direct, configurable et cohérent avec son sport, tout en conservant une architecture simple, robuste et évolutive.

---

## 2. Invariants Fonctionnels

**Ces règles ne peuvent être violées sans mise à jour explicite de cette Bible.**

| # | Invariant | Signification |
|---|-----------|---------------|
| **I-001** | **1 Organisation = 1 Sport** | Une organisation ne gère qu'un seul sport |
| **I-002** | **Sport du Match = Sport de l'Organisation** | Le sport n'est jamais choisi au niveau match |
| **I-003** | **Toujours affiché** | Score + Temps + Noms équipes sont obligatoires |
| **I-004** | **Logo optionnel** | Les logos équipes peuvent être null |
| **I-005** | **Héritage Org → Équipe** | `deepMerge(org.defaults, team.overrides)` |
| **I-006** | **Isolation organisations** | Aucune visibilité inter-organisations (RLS) |
| **I-007** | **1 Org = N Équipes** | Une organisation peut créer plusieurs équipes |

---

## 3. Modèle Métier

### 3.1 Organisation

```typescript
interface Org {
  id: uuid;
  name: string;
  slug: string;
  sport: 'football' | 'basket' | 'volleyball' | 'handball' | 'rugby';
  display_defaults: OrgDisplayDefaults;  // JSON
  is_master: boolean;  // true pour l'organisation MASTER système
  is_system: boolean;  // flag système additionnel
  created_at: timestamptz;
}
```

**Rôle** : Définit les règles globales d'affichage pour toutes ses équipes.

**Règle** : `sport` est **immutable** après création (ou migration manuelle uniquement).

---

### 3.1.1 Organisation MASTER (SB2)

**Concept** : Organisation spéciale servant de racine d'administration globale.

**Caractéristiques** :
- **Non supprimable** — Protégée par trigger DB
- **Non modifiable** (sauf nom/logo)
- **Non visible** par les utilisateurs standards
- **Accessible uniquement** aux super_admin
- **Ne contient pas de matchs** opérationnels
- **Slug fixe** : `master`
- **Unique** : Une seule organisation MASTER existe

**Utilité** :
- Créer les organisations clientes
- Superviser globalement la plateforme
- Gérer les super_admin

**Règles** :
- `is_master = true` et `is_system = true`
- Ne peut pas être supprimée (trigger `prevent_master_delete`)
- Les super_admin sont membres de cette organisation
- Sert de point d'entrée pour l'administration globale

---

### 3.2 Équipe

```typescript
interface Team {
  id: uuid;
  org_id: uuid;
  name: string;
  short_name?: string;
  logo?: string;
  colors?: { primary?: string; secondary?: string };
  display_overrides: TeamDisplayOverrides;  // JSON partiel
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**Rôle** : Peut surcharger les paramètres d'affichage de son organisation.

**Règle** : Unique par `(org_id, name)`.

---

### 3.3 Match

```typescript
interface Match {
  id: uuid;
  org_id: uuid;
  name: string;
  sport: Sport;  // Hérité de l'organisation

  home_team_id?: uuid;  // FK → teams.id
  away_team_id?: uuid;  // FK → teams.id

  // Legacy (compatibilité ascendante)
  home_name: string;
  away_name: string;

  status: 'scheduled' | 'live' | 'finished' | 'archived';
  public_display: boolean;
  display_token: string;

  scheduled_at: timestamptz;
  created_at: timestamptz;
  updated_at: timestamptz;
}
```

**État live** :
- Géré via Realtime Broadcast (éphémère)
- Le serveur n'est pas la source d'autorité du score en temps réel
- Évolution future : snapshots persistants

---

## 4. Sports Supportés

### 4.1 Football

- **Durée** : 2 × 45 minutes
- **Features** :
  - Temps additionnel
  - Cartons (jaune, rouge)
  - Remplacements
  - Tirs au but (optionnel)

**Paramètres spécifiques** :
- `showCards` (défaut: true)
- `showSubstitutions` (défaut: false)
- `showGoalScorers` (défaut: true)
- `showExtraTime` (défaut: true)
- `showPenaltyShootout` (défaut: false)

---

### 4.2 Basketball

- **Durée** : 4 × 10 minutes
- **Features** :
  - Shot clock (24 secondes)
  - Fautes équipe / joueur
  - Timeouts

**Paramètres spécifiques** :
- `showQuarter` (défaut: true)
- `showShotClock` (défaut: true)
- `showTeamFouls` (défaut: true)
- `showPlayerFouls` (défaut: false)
- `showTimeouts` (défaut: true)
- `showPossessionArrow` (défaut: false)

---

### 4.3 Volleyball

- **Durée** : Pas de chronomètre (jeu par points)
- **Features** :
  - Sets gagnants (best of 5)
  - Indicateur service
  - Set point / match point

**Paramètres spécifiques** :
- `showSets` (défaut: true)
- `showCurrentSet` (défaut: true)
- `showServerIndicator` (défaut: true)
- `showTimeouts` (défaut: true)
- `showRotation` (défaut: false)
- `showSetPointMatchPoint` (défaut: true)

---

### 4.4 Handball

- **Durée** : 2 × 30 minutes
- **Features** :
  - Exclusions 2 minutes
  - Cartons
  - Tirs à 7 mètres

**Paramètres spécifiques** :
- `showCards` (défaut: true)
- `showExclusions` (défaut: true)
- `showTimeouts` (défaut: true)
- `show7m` (défaut: false)

---

### 4.5 Rugby (Union)

- **Durée** : 2 × 40 minutes
- **Features** :
  - Cartons jaunes (sin bin 10 min)
  - Score détaillé (essais, transformations, pénalités, drops)

**Paramètres spécifiques** :
- `showScoreBreakdown` (défaut: true)
- `showCards` (défaut: true)
- `showSinBinTimer` (défaut: true)
- `showTriesScorers` (défaut: true)
- `showBonusPoints` (défaut: false)

---

## 5. Paramètres d'Affichage

### 5.1 Paramètres Communs (Tous Sports)

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `showTeamLogos` | boolean | `true` | Afficher logos équipes |
| `showTeamColors` | boolean | `false` | Utiliser couleurs équipes |
| `showPlayerNames` | boolean | `false` | Afficher noms joueurs |
| `showPlayerNumbers` | boolean | `false` | Afficher numéros joueurs |
| `showEventsFeed` | boolean | `true` | Bandeau événements |
| `showAnimations` | boolean | `true` | Animations UI |
| `showSponsorOverlay` | boolean | `false` | Overlay sponsors |

### 5.2 Structure JSON

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

---

## 6. Règle d'Héritage

### Résolution finale :

```typescript
displayFinal = deepMerge(org.display_defaults, team.display_overrides)
```

### Algorithme :

1. Partir des `org.display_defaults` (complets)
2. Appliquer `team.display_overrides` clé par clé
3. Si clé présente dans overrides → **remplace** la valeur
4. Si clé absente dans overrides → **héritage** de l'org
5. Pas de suppression possible (seulement remplacement)

### Exemple :

```json
// Organisation
{
  "common": { "showTeamLogos": true, "showPlayerNames": false },
  "football": { "showCards": true, "showGoalScorers": true }
}

// Équipe PSG (overrides)
{
  "common": { "showPlayerNames": true }
}

// Résultat fusionné
{
  "common": { "showTeamLogos": true, "showPlayerNames": true },
  "football": { "showCards": true, "showGoalScorers": true }
}
```

**Règles strictes** :
- Override remplace la valeur héritée
- Clé absente = héritage
- Aucun paramètre ne peut être supprimé via override
- Le système doit rester déterministe

**Implémentation** : `deepMergeDisplaySettings()` dans `@pkg/logic`

---

## 7. Architecture Technique

### 7.1 Stack

**Frontend** :
- Vite monorepo
- Apps : `operator` / `display`
- Packages : `logic` / `types` / `supa`

**Backend** :
- Supabase (Postgres + RLS + Realtime)
- Auth + Row Level Security

**État temps réel** :
- Realtime Broadcast (WebSocket)
- Éphémère (non persisté)

### 7.2 Base de Données

**Tables** :
- `orgs` — Organisations
- `teams` — Équipes
- `matches` — Matchs
- `org_members` — Membres + rôles
- `profiles` — Utilisateurs

**Vues** :
- `org_members_with_org`
- `matches_v` — Match enrichi avec org + teams + display settings

**Fonctions** :
- `set_updated_at()` — Trigger updated_at
- `rand_token()` — Génération tokens
- `handle_new_user()` — Auto-création profile

---

## 8. Sécurité

### Principes :

- **RLS activé** sur toutes les tables
- **Isolation stricte** par organisation
- **Accès public** : uniquement si `public_display = true`
- **Display** : accès via `display_token` (anonymous)

### Rôles (SB2) :

| Rôle | Accès | Permissions |
|------|-------|-------------|
| **super_admin** | Toutes organisations + MASTER | Créer/supprimer organisations, voir toutes les données, gérer tous les membres |
| **admin** | Son organisation uniquement | Gérer organisation, équipes, membres, matchs de son org |
| **operator** | Son organisation uniquement | Gérer matchs de son organisation |
| **viewer** | Son organisation uniquement | Lecture seule |

**Règles** :
- Seuls les **super_admin** peuvent :
  - Voir toutes les organisations
  - Créer des organisations
  - Supprimer des organisations (sauf MASTER)
  - Accéder à l'organisation MASTER
- Les membres standards ne voient que leur organisation
- Un utilisateur peut avoir des rôles différents dans différentes organisations

### Policies clés :

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

## 9. Décisions Structurantes (ADR)

### ADR-001 — 1 Organisation = 1 Sport

**Date** : 2026-02-26
**Statut** : Accepté

**Raison** :
- Simplifie la logique UI
- Évite incohérences multi-sport
- Cohérence métier (une organisation = un sport)

**Impact** :
- ✅ Cohérence données
- ✅ Simplification UI
- ⚠️ Multi-sport nécessite plusieurs organisations

---

### ADR-002 — Héritage JSON pour Display Settings

**Date** : 2026-02-26
**Statut** : Accepté

**Raison** :
- Flexibilité maximale
- DRY (Don't Repeat Yourself)
- Évite explosion de colonnes DB

**Impact** :
- ✅ Personnalisation granulaire
- ✅ Maintenance simplifiée
- ⚠️ Validation JSON nécessaire

---

### ADR-003 — Score et Temps Toujours Affichés

**Date** : 2026-02-26
**Statut** : Accepté

**Raison** :
- Invariant fondamental du produit
- Score + temps = essence d'un scoreboard

**Impact** :
- ✅ Clarté pour l'utilisateur
- ✅ Simplicité logique
- ⚠️ Pas de désactivation possible

---

### ADR-004 — Realtime Broadcast Non Persisté

**Date** : 2026-02-26
**Statut** : Accepté

**Raison** :
- État live change très fréquemment
- Pas de besoin historique tick-par-tick
- Performances optimales

**Impact** :
- ✅ Latence minimale
- ✅ Pas d'overhead DB
- ⚠️ État perdu si tous clients déconnectés

**Évolution future** : Snapshots périodiques optionnels

---

### ADR-005 — Organisation MASTER Système

**Date** : 2026-03-02
**Statut** : Accepté (SB2)

**Raison** :
- Besoin d'un point d'entrée pour l'administration globale
- Permettre aux super_admin de gérer toutes les organisations
- Séparer l'administration système des organisations clientes

**Décision** :
- Introduction d'une organisation MASTER spéciale
- Flags `is_master` et `is_system` sur table `orgs`
- Trigger DB empêchant suppression MASTER
- Nouveau rôle `super_admin` avec accès global
- RLS policies adaptées pour super_admin

**Impact** :
- ✅ Administration centralisée
- ✅ Isolation claire admin vs clients
- ✅ Sécurité renforcée (super_admin explicite)
- ⚠️ Complexité RLS accrue
- ⚠️ Nouveaux rôles à gérer

**Évolution** : Interface super_admin dédiée

---

## 10. Roadmap Structurelle

### Phase Actuelle ✅ (Terminé)

- [x] Migration DB multi-sports
- [x] Table teams + display_overrides
- [x] Vue matches_v enrichie
- [x] Types TypeScript complets
- [x] Support rugby

### Phase 2 (Prochaine)

- [ ] Interface Teams dans operator
- [ ] Sélecteur équipes création match
- [ ] Migration données legacy (`home_name` → `home_team_id`)

### Phase 3 (Future)

- [ ] Interface graphique display settings
- [ ] Edge Function `get-display-context`
- [ ] Snapshots persistants état match

### Phase 4 (Long terme)

- [ ] Suppression colonnes legacy
- [ ] `orgs.sport` NOT NULL
- [ ] Hardening RLS avancé

---

## 11. Règles de Contribution

### Avant toute modification :

1. **Vérifier cohérence avec cette Bible**
   - L'invariant est-il respecté ?
   - Un ADR est-il impacté ?

2. **Refuser modifications contradictoires**
   - Exemple : "Permettre multi-sport par org" → ❌ Refuse (ADR-001)

3. **Documenter décision structurante**
   - Si modification impacte architecture → créer ADR (Section 9)

### Checklist modification DB :

- [ ] Migration SQL avec `IF EXISTS` / `IF NOT EXISTS`
- [ ] Commentaires explicatifs en tête
- [ ] Compatibilité ascendante vérifiée
- [ ] RLS policies mises à jour
- [ ] Types TypeScript synchronisés

### Checklist ajout sport :

1. Mettre à jour enum `Sport` dans types
2. Ajouter contrainte CHECK en DB
3. Créer `[Sport]DisplaySettings` interface
4. Ajouter defaults dans `@pkg/logic`
5. Implémenter `initStateForSport()`
6. Implémenter `applyTick()` si meta spécifique
7. **Mettre à jour cette Bible (Section 4)**

---

## 12. Glossaire

| Terme | Définition |
|-------|------------|
| **Org** | Organisation gérant 1 sport + N équipes |
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

## 13. Documentation Complémentaire

**Fichiers de référence** :

- `PROMPT_BOLT_OFFICIEL.md` — Prompt pour Bolt (checklists, réponses types)
- `MIGRATION_MULTI_SPORTS.md` — Détails techniques migration
- `GUIDE_MISE_A_JOUR.md` — Guide utilisateur
- `README.md` — Vue d'ensemble + Quick Start
- `INDEX_DOCUMENTATION.md` — Navigation par sujet

**Code source** :

- `packages/types/src/index.ts` — Types TypeScript
- `packages/logic/src/index.ts` — Logique métier
- `packages/logic/src/displaySettings.ts` — Fonction merge
- `apps/operator/src/pages/TeamsPage.tsx` — CRUD équipes
- `supabase/migrations/20260226_org_sport_teams_display.sql` — Migration DB

---

## 🎯 Points Clés à Retenir

1. **Cette Bible est la source de vérité** — Toute modification doit être cohérente avec elle
2. **7 Invariants sont non négociables** — Aucune exception sans mise à jour Bible
3. **5 Sports uniquement** — football, basket, volleyball, handball, rugby
4. **1 Org = 1 Sport** — Règle fondamentale (ADR-001)
5. **Héritage Org → Team** — deepMerge pour résolution finale
6. **RLS strict** — Isolation complète par organisation
7. **Toute décision structurelle = ADR** — Documenter le pourquoi

---

**⚠️ IMPORTANT** : Ce document est la **référence unique du produit**. Toute modification doit être validée et documentée ici avant implémentation.

---

**Version** : 3.0.0
**Dernière mise à jour** : 2026-02-26
**Mainteneur** : Équipe Scoreboard
**Statut** : ✅ Production-ready
