# scoreDisplay — Bible Produit & Technique

**Version**: V3.0.0  
**Date**: 2026-03-14  
**Statut**: Référence de travail V3 — matrice sport, templates, remplacements, statistiques et bandeau live figés

---

## 1. Vision produit

scoreDisplay est une plateforme web multi-apps de gestion, pilotage et diffusion de scores sportifs, conçue pour des usages club, gymnase, salle multisport, écran TV, écran LED et affichage stadium.

Le produit repose sur 4 applications web et un backend Supabase.

### 1.1 Applications

- **Home** (`apps/home`)  
  Point d'entrée unique. Authentification, choix de l'organisation, redirection vers Operator / Admin / Display.

- **Operator** (`apps/operator`)  
  Interface métier pour gérer les équipes, les matchs, les feuilles de match, la régie live, les remplacements, les statistiques, les paramètres d'affichage et le branding équipe.

- **Display** (`apps/display`)  
  Affichage public TV / LED / stadium. Lecture par `teamSlug` ou `teamId` (URL stable par équipe), thèmes d'affichage, matrice de configuration sport, bandeau de remplacement live et synchronisation temps réel.

- **Admin** (`apps/admin`)  
  Console super admin pour gérer les organisations, membres, sports et gouvernance SaaS.

### 1.2 Backend

- **Supabase**
  - Postgres
  - Auth
  - RLS
  - Edge Functions
  - Storage possible pour logos / sponsors / médias
  - Realtime Broadcast retenu pour la diffusion live

### 1.3 Edge Functions retenues

- `get-display-context`
- `tv-broadcast`

### 1.4 Edge Functions abandonnées / archivées

- `tv-ws-relay` — Remplacée par Supabase Realtime Broadcast.

---

## 2. Principes figés (décisions définitives)

### 2.1 Mode public Display

**Le mode public officiel est l'URL stable par équipe.**

- Paramètre principal : `?teamSlug=<slug>` ou `?teamId=<uuid>`
- Le paramètre `?matchId=` est toléré pour usage technique interne uniquement
- **Le mode public par token match est supprimé définitivement**
- Les colonnes `matches.display_token` et `matches.public_display` sont supprimées
- **Ne jamais réintroduire** : `token`, `display_token`, `public_display`, ni aucun query param de type token

### 2.2 Convention DB figée

#### Table `orgs`
- **`orgs.sport` est le champ sport de référence**
- Ne plus utiliser `org_sport` dans le code

Champs structurants confirmés : `id`, `slug`, `name`, `status`, `sport`, `suspended_at`, `archived_at`

Org système : `master`

### 2.3 Invariants métier

- **1 organisation = 1 sport**
- **Home est le seul org picker**
- **Operator ne doit jamais reproposer la sélection d'organisation**
- **Le sport du match découle de l'organisation**
- **Le sport de l'Operator est en lecture seule** (champ affiché, non modifiable — paramètre org)
- **Une organisation archivée est en lecture seule**
- **Une organisation suspendue est restreinte / bloquée**
- **Le super admin passe par l'organisation système `master`**
- **Le Display public doit rester accessible sans session Operator**
- **L'URL Display stable par équipe est le seul mode recommandé pour les écrans fixes**

### 2.4 Priorité produit V3

La priorité visuelle actuelle est l'amélioration de la lisibilité LED, avec **Rugby comme sport pilote**.

---

## 3. Architecture produit V3

### 3.1 Home

#### Rôle
- Authentification Supabase
- Chargement des organisations du membre
- Affichage du hub d'accès
- Redirection vers Operator
- Accès Admin si `super_admin`
- Option `?forceLogin=1`

#### Flux attendu
1. Ouverture de Home
2. Si session absente → login
3. Si session présente → liste des organisations
4. Clic sur **Ouvrir**
5. Redirection vers Operator avec `?org=<slug>` + handoff session via hash `#access_token=...&refresh_token=...`

### 3.2 Operator

#### Rôle
- Lecture de l'organisation active (depuis Home via `?org=slug` + localStorage)
- Liste des équipes de l'organisation
- Liste des matchs par équipe
- Préparation d'un match
- Édition d'un match existant
- Gestion de la feuille de match
- Régie live multi-sport
- Remplacements Rugby / Football
- Statistiques équipe
- Liens Display
- QR codes régie / display
- Paramètres Display (sport-aware)
- Branding équipe + sélecteur de modèle d'affichage

#### Règle de navigation
- Operator n'utilise jamais `/select-org`
- L'org vient de Home via `?org=slug` + localStorage

#### Clés localStorage
- `scoreDisplay.activeOrgId` — UUID organisation active
- `scoreDisplay.activeOrgSlug` — Slug organisation active

#### Pages V3
- `TeamsPage.tsx`
- `TeamMatchesPage.tsx`
- `TeamStatsPage.tsx` ← nouveau V3
- `NewMatchPage.tsx`
- `ControlPage.tsx`
- `MobileControlPage.tsx`
- `DisplaySettingsPage.tsx`
- `PlayersPage.tsx`
- `TeamBrandingPage.tsx`
- `EditMatchRosterPage.tsx`

### 3.3 Display

#### Rôle
- Affichage public TV / LED / stadium
- Chargement du contexte initial via edge function `get-display-context`
- Réception temps réel via Supabase Realtime Broadcast
- Affichage grand format lisible
- Affichage conditionnel selon matrice sport + template
- URL stable par équipe
- Bascule périodique sur le match actif en mode équipe stable
- Bandeau de remplacement live temporaire

#### Modes d'ouverture supportés

| Paramètre | Usage |
|-----------|-------|
| `?teamSlug=<slug>` | Mode stable recommandé pour écrans fixes |
| `?teamId=<uuid>` | Variante par UUID |
| `?matchId=<uuid>` | Usage technique interne uniquement |

Le mode `?token=` est supprimé. Ne jamais le réintroduire.

#### Fallback de sélection de match (ordre)
1. `live`
2. `paused`
3. `scheduled`
4. dernier `finished` / `archived`

### 3.4 Admin

#### Rôle
- Vue super admin
- Dashboard global
- Gestion organisations
- Gestion membres
- Gestion sports

Admin reste secondaire dans la démonstration métier.  
Le cœur produit démontrable repose sur **Home + Operator + Display**.

---

## 4. Modèle de données V3

### 4.1 `orgs`

Table de gouvernance organisationnelle.

Champs clés : `id`, `slug`, `name`, `status`, `sport`, `suspended_at`, `archived_at`

### 4.2 `teams`

Les équipes appartiennent à une organisation.

Champs clés : `id`, `org_id`, `slug`, `name`, `category`, `code`, `short_name`, `logo_url`, `primary_color`, `secondary_color`

### 4.3 `players`

Référentiel des joueurs par équipe.

Champs clés : `id`, `org_id`, `team_id`, `number`, `name`, `position`, `is_active`, `created_at`, `updated_at`

### 4.4 `matches`

Le modèle match V2 repose sur un vrai domicile / extérieur.

Champs historiques conservés :
- `id`, `org_id`, `team_id`, `name`, `status`, `scheduled_at`
- `home_name`, `away_name`, `home_score`, `away_score`
- `is_live`, `archived_at`

Champs V2 structurants :
- `home_team_id`, `away_team_id`
- `period_label`, `clock_ms`, `clock_running`
- `home_team_fouls`, `away_team_fouls`
- `home_timeouts`, `away_timeouts`
- `home_bonus`, `away_bonus`
- `shot_clock_s`
- `home_sets_won`, `away_sets_won`
- `home_yellow_cards`, `away_yellow_cards`
- `home_red_cards`, `away_red_cards`

> **Supprimés en V3** : `display_token`, `public_display` — colonnes retirées par migration.

### 4.5 `match_players`

Feuille de match persistée.

Champs V2 : `id`, `org_id`, `match_id`, `team_id`, `player_id`, `shirt_number`, `is_starter`, `is_selected`, `fouls`, `points`, `yellow_cards`, `red_cards`, `created_at`, `updated_at`

Champs V3 ajoutés :
- `is_on_field` — présence actuelle sur le terrain (défaut : `is_starter`)
- `entered_at_clock_ms` — horloge match à l'entrée sur le terrain
- `left_at_clock_ms` — horloge match à la sortie du terrain
- `minutes_played_s` — temps de jeu cumulé en secondes

### 4.6 `team_players`

Table pour la trajectoire multi-affectation joueur ↔ équipe.

Champs clés : `id`, `org_id`, `team_id`, `player_id`, `shirt_number`, `is_active`, `created_at`, `updated_at`

### 4.7 `org_display_settings`

Tronc commun d'affichage par organisation.

Champs : `org_id`, `theme`, `layout_mode`, `show_score`, `show_clock`, `show_period`, `show_status`, `show_lower_third`, `show_logos`, `show_sponsors`, `dual_language`, `lang_primary`, `lang_secondary`, `sponsor_rotate_s`, `show_substitution_banner` (défaut `true`)

### 4.8 `org_sport_settings`

Règles métier du sport par organisation (logique sportive, pas forme visuelle).

Champs : `org_id`, `sport`, `period_count`, `period_duration_s`, `extra_time_enabled`, `penalties_enabled`, `show_team_fouls`, `show_player_fouls`, `show_timeouts`, `show_bonus`, `show_sets`, `show_cards`, `show_shot_clock`, `max_team_fouls`, `max_player_fouls`, `max_timeouts`, `shot_clock_s`

### 4.9 `org_display_sport_profiles` ← nouveau V3

Matrice d'affichage par sport au niveau organisation.

Colonnes principales :
- `org_id`, `sport`
- Blocs visuels activés : `show_cards`, `show_substitutions`, `show_sin_bin`, `show_rugby_score_breakdown`, `show_rugby_tries`, `show_rugby_conversions`, `show_rugby_penalties`, `show_rugby_drop_goals`, `show_added_time`, `show_penalty_shootout`, `show_match_phase`, `show_two_min_suspensions`, `show_disqualifications`, `show_warnings`, `show_live_overlays`
- Lisibilité LED : `density_mode`, `score_scale`, `clock_scale`, `team_name_mode`, `use_short_team_names`
- Overlay : `overlay_position`, `overlay_duration_ms`
- Template : `default_display_template_id` FK → `display_templates`

> Requête toujours filtrée par `.eq("sport", orgSport)` — une ligne par org + sport.

### 4.10 `display_templates` ← nouveau V3

Bibliothèque système des modèles d'affichage.

Colonnes : `id`, `code`, `name`, `sport`, `layout_mode`, `config_json`, `is_default_system`, `is_active`

Templates système seeded :

| Code | Sport | Description |
|------|-------|-------------|
| `rugby_stade` | rugby | Score dominant, chrono, période, cartons, sin bin |
| `rugby_expert` | rugby | Enrichi : breakdown essais/transfo/péna/drops |
| `rugby_club` | rugby | Intermédiaire club |
| `football_stade` | football | Stade sombre football |
| `football_tv` | football | TV éditorial football |
| `basket_arena` | basket | Arena premium |
| `handball_classic` | handball | Handball classique |
| `volley_sets` | volleyball | Focus sets |

### 4.11 `team_display_settings` ← nouveau V3

Override de modèle d'affichage par équipe.

Colonnes : `id`, `team_id` (FK → `teams`), `template_id` (FK → `display_templates`), `is_active`

Upsert sur `team_id` (conflict key). Permet de surcharger le défaut organisation.

### 4.12 `match_substitutions` ← nouveau V3

Journal structurel des remplacements.

Colonnes : `id`, `match_id`, `org_id`, `team_id`, `player_out_id`, `player_in_id`, `player_out_number`, `player_in_number`, `period`, `clock_ms`, `reason`, `is_temporary`, `is_blood_substitution`, `created_at`

---

## 5. Configuration Display — résolution multi-couches

Le Display ne dépend plus d'une seule source. Il repose sur la combinaison de cinq couches, résolues dans l'ordre suivant :

```
1. org_display_settings       → tronc commun (thème, logos, sponsors, lower third)
2. org_sport_settings         → règles métier du sport
3. org_display_sport_profiles → matrice visuelle par sport (blocs, densité, overlay)
4. display_templates          → config_json du template résolu
5. team_display_settings      → override template par équipe
```

### 5.1 Priorité de résolution du template (haute → basse)

1. `team_display_settings.template_id` — override équipe
2. `org_display_sport_profiles.default_display_template_id` — défaut org pour ce sport
3. `display_templates WHERE is_default_system=true AND sport=orgSport AND is_active=true` — fallback système
4. Defaults hardcodés

### 5.2 Priorité de résolution des flags display (dans `buildContextFromResponse`)

1. `display_settings.*` — inclut `template.config_json` fusionné + `layout_mode`
2. `sport_profile.*` — row `org_display_sport_profiles`
3. Valeur par défaut hardcodée

---

## 6. Matrice d'affichage par sport

### 6.1 Tronc commun — tous sports

`show_score`, `show_clock`, `show_period`, `show_status`, `show_logos`, `show_sponsors`, `show_lower_third`, `show_live_overlays`, `show_live_badge`, `overlay_position`, `overlay_duration_ms`, `density_mode`, `score_scale`, `clock_scale`, `team_name_mode`, `use_short_team_names`, `show_separator_score`

#### `show_live_badge` — badge LIVE paramétrable

Contrôle l'affichage du badge "EN COURS" / "PAUSE" sur l'écran Display.

**Défaut : `false`** — badge masqué pour tous les écrans LED (rugby, football).

Résolution 3 niveaux (haute → basse) :
1. `display_templates.config_json.show_live_badge` — override template
2. `org_display_sport_profiles.show_live_badge` — défaut par sport
3. `org_display_settings.show_live_badge` — défaut global org

| Contexte | Valeur recommandée |
|----------|--------------------|
| Rugby LED | `false` |
| Football LED | `false` |
| Tous sports (défaut) | `false` |
| Template debug / technique | `true` |

Tables DB concernées :
- `org_display_settings.show_live_badge BOOLEAN NOT NULL DEFAULT false`
- `org_display_sport_profiles.show_live_badge BOOLEAN NULL`

Migration : `20260314000005_show_live_badge.sql`

### 6.2 Basket

Flags spécifiques : `show_team_fouls`, `show_player_fouls`, `show_timeouts`, `show_bonus`, `show_shot_clock`, `show_possession_arrow`

Templates conseillés : `basket_arena`, `basket_compact`, `basket_shotclock_focus`

Labels UI : affiche tout (timeouts, fautes, shot clock, bonus)

### 6.3 Rugby (sport pilote)

Flags spécifiques : `show_cards`, `show_substitutions`, `show_sin_bin`, `show_rugby_score_breakdown`, `show_rugby_tries`, `show_rugby_conversions`, `show_rugby_penalties`, `show_rugby_drop_goals`, `show_live_badge`

Templates conseillés : `rugby_stade` (défaut recommandé), `rugby_expert`, `rugby_club`, `rugby_score_central`

Labels UI : "mi-temps", masque timeouts / fautes / shot clock, bonus → "Points de bonus"

### 6.4 Football

Flags spécifiques : `show_cards`, `show_substitutions`, `show_added_time`, `show_penalty_shootout`, `show_match_phase`

Templates conseillés : `football_stade`, `football_tv`, `football_penalties`

Labels UI : masque timeouts, fautes, shot clock, bonus

### 6.5 Handball

Flags spécifiques : `show_timeouts`, `show_cards`, `show_two_min_suspensions`, `show_disqualifications`, `show_warnings`

Templates conseillés : `handball_classic`, `handball_sanctions`

Labels UI : affiche timeouts, masque shot clock et bonus

### 6.6 Volleyball

Flags spécifiques : `show_sets`, `show_set_points`, `show_service`, `show_current_set`, `show_tiebreak`

Templates conseillés : `volley_sets`, `volley_compact`

Labels UI : affiche sets uniquement

---

## 7. Rugby — sport pilote LED club

### 7.1 Objectif produit

Sur un panneau LED paysage, un spectateur doit comprendre en moins de 2 secondes :
- qui joue
- le score
- le temps
- la période
- les sanctions importantes

### 7.2 Template par défaut recommandé : `rugby_stade`

Affichage principal très lisible : équipes, score dominant, chrono, période, cartons, sin bin éventuel. Peu d'informations secondaires.

### 7.3 Template enrichi : `rugby_expert`

Score + chrono + période + essais + transformations + pénalités + drops + cartons.

### 7.4 Règles de lisibilité LED Rugby

- Score dominant, noms courts, peu de texte
- Couleurs limitées, zones visuelles stables
- Cartons affichés de manière compréhensible sans masquer le score
- Les détails du breakdown ne doivent jamais gêner la lecture principale

### 7.5 Règles sportives Rugby

- 1MT / 2MT (libellé : "mi-temps")
- Points joueur
- Cartons jaunes / rouges / sin bin
- Score breakdown : essais, transformations, pénalités, drops

---

## 8. Remplacements Rugby / Football

### 8.1 Objectifs

- Gérer les remplacements depuis l'Operator
- Journaliser ces remplacements
- Alimenter les statistiques équipe et joueur
- Afficher un bandeau Display temporaire

### 8.2 Tables concernées

#### `match_players` (champs V3)
- `is_on_field` — présence actuelle (défaut : `is_starter`)
- `entered_at_clock_ms` — horloge d'entrée sur le terrain
- `left_at_clock_ms` — horloge de sortie
- `minutes_played_s` — temps de jeu cumulé en secondes

#### `match_substitutions`
Journal structurel : `team_id`, `player_out_id`, `player_in_id`, numéros, `period`, `clock_ms`, `reason`, `is_temporary`, `is_blood_substitution`

### 8.3 Journal d'événements (`match_events`)

Types : `rugby_substitution`, `football_substitution`

Payload : `{ player_out_id, player_in_id, player_out_number, player_in_number, player_out_name, player_in_name, reason, is_temporary, is_blood_substitution }`

Affichage dans le journal : `#N1 NomSortant → #N2 NomEntrant (raison)`

### 8.4 UI Operator

- `SubstitutionDialog.tsx` — sélection joueur sortant / joueur entrant, raison, `is_temporary`, `is_blood_substitution`
- `handleSubstitution()` dans `ControlPage.tsx` — écrit `match_substitutions`, met à jour `match_players.is_on_field`, logue dans `match_events`, broadcast overlay via `sendTvBroadcast`
- Boutons dans les sections "Mode rugby" et "Mode football" du `ControlPage`

---

## 9. Bandeau de remplacement sur Display

### 9.1 Objectif UX

Rendre visible l'événement de remplacement au public sans gêner la lecture du score principal.

### 9.2 Composant : `LiveOverlayBanner.tsx`

- `position: fixed; bottom: 0` — score et chrono restent visibles
- Bandeau bas d'écran contrasté, lisible LED
- Affichage : badge équipe (bleu) + `SORTIE #N Nom ↓ | ENTRÉE #N Nom ↑` en grand texte blanc

### 9.3 Règles

- Affichage temporaire court, non bloquant
- Durée : `overlay.duration_ms` (défaut 5000 ms)
- Timer auto-clear avec remplacement propre si rafale d'événements
- Sports : rugby et football uniquement
- Guard Display : `overlay` extrait du patch **avant** `mergeContext` — n'altère jamais le contexte score

### 9.4 Déclenchement et payload broadcast

Condition : `patch.overlay.type === "substitution"` reçu via Realtime broadcast

```json
{
  "overlay": {
    "type": "substitution",
    "sport": "rugby",
    "team_side": "home",
    "team_name": "US Dax",
    "player_out_name": "Dupont",
    "player_out_number": 9,
    "player_in_name": "Martin",
    "player_in_number": 21,
    "duration_ms": 5000,
    "event_id": "...",
    "emitted_at": 1710000000000
  }
}
```

---

## 10. Statistiques équipe

### 10.1 Page

`apps/operator/src/pages/TeamStatsPage.tsx` — route `/teams/:teamId/stats`

Accès via bouton "Statistiques" dans `TeamMatchesPage`.

### 10.2 Sources — 4 RPC SQL

- `get_team_match_summary` — bilan global (W/D/L, points)
- `get_team_discipline_summary` — cartons
- `get_team_player_stats` — stats joueurs
- `get_team_substitution_summary` — remplacements

### 10.3 Statistiques fiables (données réellement présentes)

**Bilan global** : matchs joués, victoires, nuls, défaites, points marqués / encaissés, différence, moyennes par match

**Discipline** : total cartons jaunes / rouges, moyenne par match, matchs avec au moins un carton

**Joueurs** : sélections, titularisations, total points, fautes, cartons jaunes / rouges

**Remplacements** : nombre total, joueurs les plus souvent remplacés, entrants les plus fréquents

### 10.4 Statistiques non garanties à ce stade

Temps de jeu réel précis, joueur du match, composition type robuste, efficacité individuelle avancée, impact exact des remplacements — nécessitent un niveau d'instrumentation supplémentaire.

---

## 11. Edge Functions

### 11.1 `get-display-context`

Source principale du contexte public Display.

#### Paramètres supportés
- `teamSlug` — mode stable recommandé
- `teamId` — variante UUID
- `matchId` — usage technique interne
- **Jamais `token`**

#### Logique interne
1. **Étape 1** — charge `orgs` seul → extrait `orgSport`
2. **Étape 2** — en parallèle :
   - `org_display_settings`
   - `org_sport_settings`
   - `org_display_sport_profiles` filtrée `.eq("sport", orgSport)` + join `display_templates`
   - `team_display_settings`
3. **Fallback système** — si aucun template résolu : `display_templates WHERE is_default_system=true AND sport=orgSport AND is_active=true`

#### Payload retourné

| Champ | Description |
|-------|-------------|
| `match` | Match sélectionné |
| `org` | `{ id, slug, name, sport }` |
| `team` | Données équipes (home/away) |
| `display_settings` | Config finale fusionnée |
| `config_display_resolved` | Alias de `display_settings` |
| `display_template` | `{ id, code, name, layout_mode }` du template résolu |
| `resolved_display_template_id` | UUID du template résolu |
| `sport_settings` | Flags sport résolus |
| `sport_profile` / `display_profile` | Row `org_display_sport_profiles` |
| `channel` | Nom du canal Realtime |

#### Utilise
- `SUPABASE_SERVICE_ROLE_KEY`
- Anon pour les accès publics (matches, teams)

### 11.2 `tv-broadcast`

Push d'un patch temps réel vers le topic `match:${matchId}`.

Déclenché par `sendTvBroadcast(matchId, patch)` côté Operator.

---

## 12. Architecture Realtime

- **Broadcast Operator** : `sendTvBroadcast(matchId, patch)` → `tv-broadcast` → topic `match:${matchId}`
- **Souscription Display** : `supabase.channel('match:${matchId}')` — topic exact, sans préfixe
- **Fallback** : `postgres_changes` UPDATE sur `matches` + polling 3s en mode stable équipe
- **Interpolation chrono** : côté client Display — décompte depuis `clock_ms` via `Date.now()`
- **Sync horloge MobileControlPage** : souscription `mobile-clock:${matchId}` (broadcast + postgres_changes), interpolation via `clock_anchor_epoch` / `clock_anchor_ms`
- **Guard overlay** : `overlay` extrait du patch avant `mergeContext` — n'altère jamais le contexte score

---

## 13. Rôles et sécurité

### 13.1 Rôles métier

Rôle applicatif porté par `org_members.role` :
- `super_admin`
- `org_admin`
- `operator`
- `viewer`

### 13.2 Super admin

Identifié via helper SQL / RPC `is_super_admin(...)`, adossé à l'org `master`.

### 13.3 RLS

- Isolation stricte par organisation
- Lecture / écriture réservées aux membres autorisés via `can_read_org` / `can_write_org`
- Admin réservé au super admin
- Display public via Edge Functions — **pas d'accès anon direct sur les tables métier**
- Lecture anon autorisée sur `matches` et `teams` via RLS dédiée (migration `20260313000003`)

---

## 14. État fonctionnel réellement atteint (V3)

### 14.1 DB

- `orgs.sport` confirmé et figé
- `teams` étendue : slug, category, code, branding (short_name, logo_url, primary_color, secondary_color)
- `matches` en V2 avec home_team_id / away_team_id ; `display_token` et `public_display` supprimés
- `match_players` étendue avec is_on_field, entered_at_clock_ms, left_at_clock_ms, minutes_played_s
- `match_substitutions` créée
- `display_templates` créée et seedée
- `org_display_sport_profiles` créée et pré-remplie depuis `orgs.sport`
- `team_display_settings` créée
- 4 RPC statistiques équipe créées
- Helpers SQL : `can_read_org`, `can_write_org`, `is_org_active`, `is_super_admin`

### 14.2 Home
- Login Supabase, session persistée, `?forceLogin=1`
- Liste organisations avec filtres / recherche
- Redirection Operator stabilisée

### 14.3 Operator
- Navigation org héritée de Home
- Liste équipes / matchs
- Préparation match V2 (home_team_id / away_team_id)
- Feuille de match (sélection + édition + réouverture)
- Suppression match `scheduled` / archivage match `finished`
- Régie live multi-sport (sport lu en lecture seule, hérité de l'org)
- Remplacements Rugby / Football (dialog + journal + broadcast overlay)
- Statistiques équipe (4 RPC)
- Sélecteur de modèle d'affichage par équipe (TeamBrandingPage)
- Paramètres Display sport-aware (sportUiConfig)
- QR code régie / display
- Page branding équipe (nom, logo, couleurs, modèle d'affichage)

### 14.4 Display
- Chargement contexte par edge function (teamSlug / teamId)
- Résolution template 3 niveaux (team override → org profile → fallback système)
- Mode stable par équipe + auto-refresh périodique
- Layouts rugby : rugby_stade (RugbyStade), rugby_expert (RugbyExpert)
- Affichage conditionnel selon flags sport (blocs activés / désactivés)
- Bandeau remplacement live (LiveOverlayBanner)
- Score bump, horloge anti-jitter, lower-third, sponsors rotatifs, dual-language
- Branding équipe (logo, couleurs)

### 14.5 Temps réel
- Snapshot initial via `get-display-context`
- Realtime via Supabase Broadcast + `tv-broadcast`
- Overlay remplacement isolé du contexte score

---

## 15. Flux métier V3

### 15.1 Flux principal
1. Home → choix organisation
2. Operator → sélection équipe
3. Liste matchs équipe
4. Préparer un match
5. Constituer feuille de match
6. Ouvrir régie live
7. Gérer remplacements en cours de match
8. Ouvrir Display public (URL stable équipe)
9. Diffuser / piloter en live

### 15.2 Création de match V2
- L'équipe courante devient domicile par défaut
- Équipe extérieure : interne ou adversaire texte
- `match_players` alimentée à la création

### 15.3 Régie live
Score, période, chrono, shot clock, fautes équipe, temps morts, bonus, sets gagnés, cartons équipe, statistiques joueurs, remplacements rugby / football, sauvegarde base, push Display live.

### 15.4 Display stable par équipe
URL : `?teamSlug=<slug>` — cherche `live` → `paused` → `scheduled` → dernier `finished`.  
Recharge périodiquement le contexte. Rebascule sur un autre match si besoin.

---

## 16. Règles sportives fines

### 16.1 Football
- 1MT / 2MT
- Cartons équipe / joueurs
- Remplacements journalisés
- Prolongation / TAB : à venir

### 16.2 Basket
- Q1 / Q2 / Q3 / Q4
- Fautes équipe / joueur
- Points joueur
- Timeouts, bonus, shot clock
- OT : à venir si besoin

### 16.3 Handball
- 1MT / 2MT
- Exclusions 2 minutes, disqualifications, avertissements
- Timeouts
- Points joueur possibles

### 16.4 Rugby
- 1MT / 2MT ("mi-temps")
- Points joueur
- Cartons jaunes / rouges / sin bin
- Score breakdown : essais, transformations, pénalités, drops
- Remplacements journalisés

### 16.5 Volleyball
- Set 1 à Set 5
- Sets gagnés
- Score set détaillé : à venir

---

## 17. Labels UI sport-aware (Operator)

`DisplaySettingsPage.tsx` — helper `sportUiConfig(sport)` :

| Sport | Libellé période | Timeouts | Fautes | Shot clock | Bonus |
|-------|----------------|----------|--------|------------|-------|
| rugby | Mi-temps | Masqué | Masqué | Masqué | Points de bonus |
| basket | Période | Visible | Visible | Visible | Visible |
| volleyball | Set | Masqué | Masqué | Masqué | Masqué |
| handball | Période | Visible | Visible | Masqué | Masqué |
| football | Période | Masqué | Masqué | Masqué | Masqué |

---

## 18. Migrations base de données

Migrations dans `supabase/migrations/` :

| Fichier | Description |
|---------|-------------|
| `20260313000001_cleanup_legacy_token.sql` | Supprime `public_display` et `display_token` de `matches` |
| `20260313000002_display_templates.sql` | Crée `display_templates` et `team_display_settings` avec seed |
| `20260313000003_fix_rls_public_display.sql` | Corrige les RLS qui dépendaient de `public_display` ; anon read matches + teams ; vue `matches_v` |
| `20260314000001_substitutions.sql` | Ajoute `is_on_field/entered_at/left_at/minutes_played_s` à `match_players` ; crée `match_substitutions` |
| `20260314000002_team_stats_rpc.sql` | Crée 4 RPC pour statistiques équipe |
| `20260314000003_substitution_banner_setting.sql` | Ajoute `show_substitution_banner BOOLEAN DEFAULT TRUE` à `org_display_settings` |
| `20260314000004_display_matrix.sql` | Crée `org_display_sport_profiles` ; seed templates système ; pré-remplit profils depuis `orgs.sport` |
| `20260314000005_show_live_badge.sql` | Ajoute `show_live_badge BOOLEAN DEFAULT false` à `org_display_settings` et `org_display_sport_profiles` |

> **Actions manuelles requises Supabase** : exécuter `20260314000003` et `20260314000004` dans l'éditeur SQL, puis redéployer `supabase functions deploy get-display-context`.

---

## 19. Déploiement Vercel

### 19.1 Monorepo
1 projet Vercel = 1 app / 1 URL.

Projets : Home, Operator, Admin, Display

### 19.2 Install command validé
```bash
corepack enable && corepack prepare pnpm@8.15.9 --activate && pnpm install --no-frozen-lockfile
```

### 19.3 Variable Vercel importante
- `ENABLE_EXPERIMENTAL_COREPACK=1`

### 19.4 Operator rewrite SPA

`apps/operator/vercel.json` :
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 20. Variables d'environnement par app

### 20.1 Home
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_OPERATOR_URL`, `VITE_ADMIN_URL`, `VITE_DISPLAY_URL`

### 20.2 Operator
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_HOME_URL`, `VITE_DISPLAY_URL`, `VITE_TV_BROADCAST_URL`

### 20.3 Display
`VITE_EDGE_CONTEXT_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

### 20.4 Admin
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_HOME_URL`, `VITE_OPERATOR_URL`, `VITE_DISPLAY_URL`

---

## 21. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/home/src/App.tsx` | Portail d'entrée |
| `apps/operator/src/App.tsx` | Routes operator |
| `apps/operator/src/pages/ControlPage.tsx` | Régie live (2900+ lignes) — CRLF : utiliser `node`/`sed` pour éditions larges |
| `apps/operator/src/pages/MobileControlPage.tsx` | Régie mobile — sync horloge `mobile-clock:${matchId}` |
| `apps/operator/src/pages/DisplaySettingsPage.tsx` | Paramètres affichage + `sportUiConfig` |
| `apps/operator/src/pages/TeamBrandingPage.tsx` | Branding + sélecteur modèle d'affichage équipe |
| `apps/operator/src/pages/TeamStatsPage.tsx` | Statistiques équipe (4 RPC) |
| `apps/operator/src/components/SubstitutionDialog.tsx` | Dialog remplacement rugby/football |
| `apps/display/src/main.tsx` | Orchestrateur Display (teamSlug/teamId, realtime, `buildContextFromResponse`) |
| `apps/display/src/components/Scoreboard.tsx` | Scoreboard tous sports |
| `apps/display/src/components/LiveOverlayBanner.tsx` | Bandeau remplacement temporaire |
| `apps/display/src/api.ts` | Types `DisplayContext` + `SportProfile` |
| `supabase/functions/get-display-context/index.ts` | Edge Function contexte Display public |
| `supabase/functions/tv-broadcast/index.ts` | Edge Function broadcast Realtime |
| `supabase/schema.sql` | Schéma base complet |

### Pages à archiver / supprimer si encore présentes
`SelectOrgPage.tsx`, `OrganizationSelector.tsx`, `RedirectPage.tsx`, `AuthPage.tsx`, `LoginPage.tsx`, `SuperAdminPage.tsx`, `SpacePage.tsx`, `AuthDebugPage.tsx`, anciennes pages doublon `MatchesPage.tsx` / `OperatorPage.tsx` / `DisplayPage.tsx`

---

## 22. Dette technique / fragilités restantes

### 22.1 Transition `team_id` → `home_team_id` / `away_team_id`
`team_id` reste encore un champ de compatibilité dans `matches`. La vérité métier est dans `home_team_id` / `away_team_id`.

### 22.2 Modèle joueur intermédiaire
La cible long terme : `players` → `team_players` → `match_players`.  
`players.team_id` existe encore comme ancrage pratique.

### 22.3 Statistiques avancées
Temps de jeu réel, joueur du match, efficacité individuelle — nécessitent un niveau d'instrumentation supplémentaire.

### 22.4 Nettoyage legacy
Des pages et composants obsolètes peuvent encore exister. Les déplacer en `_legacy` ou supprimer.

---

## 23. Ce qu'il reste à faire pour une V3 propre

1. Exécuter les migrations `20260314000003` et `20260314000004` en production
2. Redéployer `get-display-context`
3. Finir le nettoyage des pages legacy
4. Améliorer logos / assets via Storage
5. Enrichir les statistiques sportives par discipline
6. Introduire la vraie multi-affectation joueur ↔ équipe si nécessaire
7. Améliorer les templates Display détaillés (densité, zoom, responsive LED)

---

## 24. Roadmap de passage vers SaaS commercial

### 24.1 SaaS Foundation
- Onboarding self-service, création organisation autonome
- Billing / abonnements, plans / quotas
- Invitation utilisateurs, audit log, paramètres organisation

### 24.2 Multi-tenant robuste
- Vues admin consolidées, monitoring par org
- Suspension / archivage industrialisés, export données, sauvegardes formalisées

### 24.3 Produit métier
- Compétitions / championnats, classement / calendrier
- Événements de jeu structurés, historiques détaillés
- Statistiques avancées équipe / joueur / saison

### 24.4 Display / médias
- Sponsors par org / équipe / match, assets via Storage
- Overlays streaming / OBS
- Templates TV / LED / pupitre / mobile différenciés
- Branding plus poussé

### 24.5 Sécurité / conformité
- Audit sécurité RLS final
- Durcissement Edge Functions, rotation secrets
- Journalisation erreurs, conformité RGPD / rétention données

---

## 25. Décisions de produit à garder en tête

- La priorité reste la **démonstration terrain convaincante**
- Privilégier : stabilité, clarté du flux, UX convaincante, cohérence métier
- Chaque nouvelle fonction doit répondre à :  
  **"Est-ce que cela améliore la démonstration et prépare le futur produit, sans dégrader la robustesse ?"**
- La priorité visuelle actuelle : **lisibilité LED, Rugby comme sport pilote**

---

## 26. Référence courte pour ouvrir un nouveau chat

### Résumé ultra-court

scoreDisplay est un produit multi-apps (Home, Operator, Display, Admin) basé sur Supabase.

- Le champ sport de référence est `orgs.sport` — lecture seule dans Operator
- Home est le seul org picker
- Operator gère : équipes, matchs, feuilles de match, branding, joueurs, régie live, remplacements (rugby/football), statistiques équipe
- Le modèle match V2 repose sur `home_team_id` / `away_team_id`
- Display fonctionne uniquement via URL stable par équipe : `?teamSlug=` ou `?teamId=` — **le mode token est supprimé**
- Le Display résout sa configuration en 5 couches : `org_display_settings` → `org_sport_settings` → `org_display_sport_profiles` → `display_templates` → `team_display_settings`
- Le template d'affichage est résolu en 3 niveaux : team override → org sport profile → fallback système
- Rugby est le sport pilote LED club — template recommandé : `rugby_stade`
- Rugby et Football supportent les remplacements (journalisés + bandeau Display live)
- Le temps réel passe par `tv-broadcast` + Supabase Broadcast
- Les statistiques équipe reposent sur 4 RPC SQL depuis des données réellement disponibles
