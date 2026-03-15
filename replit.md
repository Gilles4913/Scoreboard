# scoreDisplay — Notes Techniques Replit

> Ce fichier contient les notes techniques propres à l'environnement Replit.
> **La Bible projet officielle est `BIBLE_scoreDisplay_V3_2026-03-14.md`** — c'est elle qui fait foi sur l'architecture, les décisions produit et le modèle de données.

---

## 1. Vue d'ensemble

scoreDisplay V2 est une plateforme de tableau de score live multi-sport, construite comme un monorepo pnpm avec 4 applications Vite/React connectées à Supabase.

### Applications (`apps/`)

| App | Port | Rôle |
|-----|------|------|
| **home** | 5000 | Portail d'entrée. Login, sélection organisation, redirection. Exposé dans Replit. |
| **admin** | 5173 | Super-admin : gestion organisations, membres, sports. |
| **operator** | 5173 | Régie live : scores, chrono, remplacements, paramètres d'affichage. |
| **display** | 5173 | Tableau de score public (écran LED / TV). Lecture seule. |

### Packages partagés (`packages/`)
- **types** — Types TypeScript partagés
- **logic** — Logique métier partagée
- **supa** — Client Supabase partagé

### Gestionnaire de paquets
**pnpm** workspace. Chaque app a son propre `package.json`. Lien via `pnpm-workspace.yaml` racine.

### Démarrage
```
cd apps/home && npm run dev
```
Port : **5000** (webview Replit)

### Variables d'environnement
Définies comme variables Replit partagées :
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_OPERATOR_URL`, `VITE_ADMIN_URL`, `VITE_DISPLAY_URL`, `VITE_DISPLAY_APP_URL`
- `VITE_HOME_URL`, `VITE_EDGE_CONTEXT_URL`, `VITE_TV_BROADCAST_URL`

### Notes Replit
- Tous les vite configs : `host: "0.0.0.0"` + `allowedHosts: true` pour le proxy Replit
- Home app sur port 5000 obligatoire pour le webview
- Autres apps sur 5173 en exécution indépendante

---

## 2. Principes consolidés (décisions figées)

Les décisions suivantes sont considérées comme définitives :

- **Le mode public officiel est l'URL stable par équipe** via `?teamSlug=` ou `?teamId=`
- **Le mode public par token match est supprimé** — `display_token` et `public_display` sont supprimés de `matches`
- **Ne jamais réintroduire** : `token`, `display_token`, `public_display`, `display_token` query param
- `orgs.sport` est le champ valide pour le sport d'une organisation
- Le Display est résolu à partir de l'équipe, puis du match pertinent
- **Fallback serveur de sélection de match** (ordre) : `live` → `paused` → `scheduled` → dernier `finished`/`archived`
- **Rugby est le sport pilote prioritaire** pour les démonstrations LED club
- Les réglages du Display sont structurés par couches (voir section 4)

---

## 3. Architecture Realtime

- **Broadcast Operator** : `sendTvBroadcast(matchId, patch)` → edge function `tv-broadcast` → topic Realtime `match:${matchId}`
- **Souscription Display** : `supabase.channel('match:${matchId}')` — topic exact sans préfixe
- **Fallback** : `postgres_changes` UPDATE sur `matches` + polling 3s en mode stable équipe
- **Interpolation chrono** : côté client Display — décompte depuis `clock_ms` via `Date.now()`
- **Sync horloge MobileControlPage** : souscription canal `mobile-clock:${matchId}` (broadcast + postgres_changes), interpolation via `clock_anchor_epoch` / `clock_anchor_ms`

---

## 4. Sources de configuration du Display

Le Display repose sur la combinaison de cinq sources résolues dans l'ordre suivant :

### 4.1 `org_display_settings`
**Tronc commun d'affichage** :
- thème, logos, sponsors, lower third, langues
- overlays globaux, densité générale
- options transverses d'habillage
- `show_substitution_banner BOOLEAN DEFAULT TRUE`

### 4.2 `org_sport_settings`
**Règles métier du sport** :
- nombre et durée des périodes
- shot clock, bonus, fautes, temps morts, sets, cartes
- Décrit la logique sportive, pas la forme visuelle

### 4.3 `org_display_sport_profiles`
**Matrice d'affichage par sport au niveau organisation** :
- blocs visuels activés (show_cards, show_substitutions, show_sin_bin, show_rugby_score_breakdown…)
- densité d'affichage, stratégie de lisibilité LED
- position et durée des overlays
- template d'affichage par défaut pour ce sport
- **Requête filtrée par** `.eq("sport", orgSport)` — une ligne par org + sport

### 4.4 `display_templates`
**Bibliothèque système des modèles d'affichage** :
- `code`, `sport`, `layout_mode`, `config_json`
- `is_default_system` — template par défaut système pour le sport
- `is_active`

Templates existants : `rugby_stade`, `rugby_expert`, `rugby_club`, `football_stade`, `football_tv`, `basket_arena`, `handball_classic`, `volley_sets`

### 4.5 `team_display_settings`
**Override par équipe** :
- `team_id` FK → `teams`
- `template_id` FK → `display_templates`
- `is_active`
- Surcharge le choix par défaut de l'organisation

---

## 5. Résolution finale de la configuration Display

### 5.1 Priorité de résolution du template (haute → basse)
1. `team_display_settings.template_id` — override équipe
2. `org_display_sport_profiles.default_display_template_id` — défaut org pour ce sport
3. `display_templates WHERE is_default_system=true AND sport=orgSport AND is_active=true` — fallback système
4. Defaults hardcodés

### 5.2 Priorité de résolution des flags display (dans `buildContextFromResponse`, Display)
1. `display_settings.*` — inclut `template.config_json` fusionné + `layout_mode`
2. `sport_profile.*` — row `org_display_sport_profiles`
3. Valeur par défaut hardcodée

### 5.3 Payload de `get-display-context` — champs explicites

| Champ | Description |
|-------|-------------|
| `display_settings` | Config finale fusionnée (org defaults + template.config_json + layout_mode) |
| `config_display_resolved` | Alias de `display_settings` pour clarté frontend |
| `display_template` | `{ id, code, name, layout_mode }` du template résolu (null si aucun) |
| `resolved_display_template_id` | UUID du template résolu |
| `display_profile` | Alias de `sport_profile` (row org_display_sport_profiles) |
| `sport_profile` | Row brut org_display_sport_profiles (sans nested display_templates) |
| `org` | `{ id, slug, name, sport }` |
| `sport_settings` | Flags sport résolus |
| `team` | Données équipe (home/away) |
| `match` | Données match sélectionné |

### 5.4 Edge function `get-display-context` — logique interne
- **Étape 1** : charge `orgs` seul → extrait `orgSport`
- **Étape 2** : charge en parallèle `org_display_settings`, `org_sport_settings`, `org_display_sport_profiles` filtrée `.eq("sport", orgSport)` + join `display_templates`, et `team_display_settings`
- **Fallback système** : si `resolvedTemplate = null` après étape 2, requête `display_templates WHERE is_default_system=true AND sport=orgSport AND is_active=true`
- Utilise `SUPABASE_SERVICE_ROLE_KEY`
- Supporte `teamSlug`, `teamId`, éventuellement `matchId` interne — **jamais `token`**

---

## 6. Matrice d'affichage par sport

### 6.1 Tronc commun — tous sports
`show_score`, `show_clock`, `show_period`, `show_status`, `show_logos`, `show_sponsors`, `show_lower_third`, `show_live_overlays`, `overlay_position`, `overlay_duration_ms`, `density_mode`, `score_scale`, `clock_scale`, `team_name_mode`, `use_short_team_names`, `show_separator_score`

### 6.2 Basket
Flags : `show_team_fouls`, `show_player_fouls`, `show_timeouts`, `show_bonus`, `show_shot_clock`, `show_possession_arrow`
Templates : `basket_arena`, `basket_compact`, `basket_shotclock_focus`

### 6.3 Rugby (sport pilote)
Flags : `show_cards`, `show_substitutions`, `show_sin_bin`, `show_rugby_score_breakdown`, `show_rugby_tries`, `show_rugby_conversions`, `show_rugby_penalties`, `show_rugby_drop_goals`
Templates : `rugby_stade` (défaut recommandé), `rugby_expert`, `rugby_club`, `rugby_score_central`

### 6.4 Football
Flags : `show_cards`, `show_substitutions`, `show_added_time`, `show_penalty_shootout`, `show_match_phase`
Templates : `football_stade`, `football_tv`, `football_penalties`

### 6.5 Handball
Flags : `show_timeouts`, `show_cards`, `show_two_min_suspensions`, `show_disqualifications`, `show_warnings`
Templates : `handball_classic`, `handball_sanctions`

### 6.6 Volleyball
Flags : `show_sets`, `show_set_points`, `show_service`, `show_current_set`, `show_tiebreak`
Templates : `volley_sets`, `volley_compact`

---

## 7. Rugby — sport pilote LED club

### 7.1 Objectif produit
Sur un panneau LED paysage, un spectateur doit comprendre en moins de 2 secondes : qui joue, le score, le temps, la période, les sanctions importantes.

### 7.2 Template par défaut recommandé : `rugby_stade`
Affichage principal très lisible : équipes, score dominant, chrono, période, cartons, sin bin. Minimum d'informations secondaires.

### 7.3 Template enrichi : `rugby_expert`
Score + chrono + période + essais + transformations + pénalités + drops + cartons.

### 7.4 Règles de lisibilité LED Rugby
- Score dominant, noms courts, peu de texte
- Couleurs limitées, zones visuelles stables
- Cartons lisibles sans gêner le score
- Les détails (breakdown) ne doivent jamais masquer le score principal

### 7.5 Labels UI Rugby (Operator — `sportUiConfig`)
- "Mi-temps" au lieu de "Période"
- Masque : timeouts, fautes, shot clock
- Bonus → "Points de bonus"

---

## 8. Remplacements Rugby / Football

### 8.1 Objectifs
- Gérer les remplacements depuis l'Operator
- Journaliser ces remplacements
- Alimenter les statistiques équipe et joueur
- Afficher un bandeau Display temporaire

### 8.2 Tables concernées

#### `match_players`
- `is_on_field` — présence actuelle sur le terrain
- `entered_at_clock_ms` — horloge d'entrée
- `left_at_clock_ms` — horloge de sortie
- `minutes_played_s` — temps de jeu cumulé en secondes
- Valeur par défaut : `is_on_field = is_starter`

#### `match_substitutions`
Journal structurel des remplacements :
- équipe, joueur sortant, joueur entrant
- période, horloge match
- raison, `is_temporary`, `is_blood_substitution`

### 8.3 Journal d'événements (`match_events`)
Types : `rugby_substitution`, `football_substitution`
Payload : `{ player_out_id, player_in_id, player_out_number, player_in_number, player_out_name, player_in_name, reason, is_temporary, is_blood_substitution }`
Affichage journal : `#N1 PlayerOut → #N2 PlayerIn (reason)`

### 8.4 UI Operator
- `SubstitutionDialog.tsx` : sélection joueur sortant / joueur entrant, raison, flags temporaire/blessure
- `handleSubstitution()` dans `ControlPage.tsx` : écrit `match_substitutions`, met à jour `match_players.is_on_field`, logue dans `match_events`, broadcast overlay via `sendTvBroadcast`
- Boutons dans les sections "Mode rugby" et "Mode football" du ControlPage

---

## 9. Bandeau de remplacement sur Display

### 9.1 Objectif UX
Rendre visible l'événement au public sans gêner la lecture du score principal.

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

### 9.4 Déclenchement
- `patch.overlay.type === "substitution"` reçu via Realtime broadcast
- Payload broadcast : `{ overlay: { type, sport, team_side, team_name, player_out_name, player_out_number, player_in_name, player_in_number, duration_ms, event_id, emitted_at } }`

---

## 10. Statistiques équipe

### 10.1 Page
`apps/operator/src/pages/TeamStatsPage.tsx` — route `/teams/:teamId/stats`
Accès : bouton "Statistiques" dans `TeamMatchesPage`

### 10.2 Sources — 4 RPC SQL
- `get_team_match_summary` — bilan global
- `get_team_discipline_summary` — discipline
- `get_team_player_stats` — stats joueurs
- `get_team_substitution_summary` — remplacements

### 10.3 Statistiques fiables (données réellement présentes)

**Bilan global** : matchs joués, victoires, nuls, défaites, points marqués/encaissés, différence, moyennes

**Discipline** : total cartons jaunes/rouges, moyenne/match, matchs avec au moins un carton

**Joueurs** : sélections, titularisations, total points, fautes, cartons

**Remplacements** : nombre total, joueurs les plus souvent remplacés, entrants les plus fréquents

### 10.4 Statistiques non garanties à ce stade
Temps de jeu réel précis, joueur du match, composition type robuste, efficacité individuelle avancée — nécessitent un niveau d'instrumentation supplémentaire.

---

## 11. Templates d'affichage (layout_mode)

Layouts supportés dans `apps/display/src/components/Scoreboard.tsx` :

| Code | Description |
|------|-------------|
| `rugby_stade` | Rugby LED : score géant, couleurs équipes, chrono, période, cartons/sin bin |
| `rugby_expert` | Rugby enrichi : breakdown + essais/transfo/péna/drops |
| `rugby_club` | Rugby club : version intermédiaire |
| `football_stade` | Football stade sombre |
| `football_tv` | Football TV éditorial |
| `basket_arena` | Basket/handball arena premium |
| `handball_classic` | Handball classique |
| `volley_sets` | Volleyball focus sets |
| `stadium` | Générique stade sombre |
| `compact` | Compact petits écrans |
| `tv-light` | TV light éditorial |

Sélecteur de template pour une équipe : `TeamBrandingPage.tsx` → section "Modèle d'affichage" — upsert sur `team_display_settings` (conflict `team_id`).

---

## 12. Labels sport-aware (Operator)

`DisplaySettingsPage.tsx` — helper `sportUiConfig(sport)` :

| Sport | Période | Timeouts | Fautes | Shot clock | Bonus |
|-------|---------|----------|--------|------------|-------|
| rugby | mi-temps | masqué | masqué | masqué | Points de bonus |
| basket | période | visible | visible | visible | visible |
| volleyball | set | masqué | masqué | masqué | masqué |
| handball | période | visible | visible | masqué | masqué |
| football | période | masqué | masqué | masqué | masqué |

---

## 13. Migrations base de données

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

> **Actions manuelles requises** : exécuter `20260314000003` et `20260314000004` dans l'éditeur SQL Supabase, puis redéployer `get-display-context`.

---

## 14. ScoreboardContext — champs V2

Nouveaux champs dans `ScoreboardContext` :
`show_live_overlays`, `show_substitutions`, `show_sin_bin`, `show_rugby_score_breakdown`, `show_rugby_tries`, `show_rugby_conversions`, `show_rugby_penalties`, `show_rugby_drop_goals`, `show_added_time`, `show_penalty_shootout`, `show_match_phase`, `show_two_min_suspensions`, `show_disqualifications`, `show_warnings`, `overlay_position`, `overlay_duration_ms`, `density_mode`, `score_scale`, `clock_scale`, `team_name_mode`, `use_short_team_names`

---

## 15. Fichiers clés

| Fichier | Rôle |
|---------|------|
| `apps/home/src/App.tsx` | Portail d'entrée (login + sélection org) |
| `apps/admin/src/App.tsx` | Routes admin |
| `apps/operator/src/App.tsx` | Routes operator |
| `apps/operator/src/pages/ControlPage.tsx` | Régie live (2900+ lignes) — CRLF : utiliser `node`/`sed` pour éditions larges |
| `apps/operator/src/pages/MobileControlPage.tsx` | Régie mobile — sync horloge via `mobile-clock:${matchId}` |
| `apps/operator/src/pages/DisplaySettingsPage.tsx` | Paramètres affichage + `sportUiConfig` helper |
| `apps/operator/src/pages/TeamBrandingPage.tsx` | Branding équipe + sélecteur modèle d'affichage |
| `apps/operator/src/pages/TeamStatsPage.tsx` | Statistiques équipe |
| `apps/operator/src/components/SubstitutionDialog.tsx` | Dialog remplacement rugby/football |
| `apps/display/src/main.tsx` | Orchestrateur Display (teamSlug/teamId, realtime, chrono, buildContextFromResponse) |
| `apps/display/src/components/Scoreboard.tsx` | Scoreboard tous sports |
| `apps/display/src/components/LiveOverlayBanner.tsx` | Bandeau remplacement temporaire |
| `apps/display/src/api.ts` | Types `DisplayContext` + `SportProfile` |
| `supabase/functions/get-display-context/index.ts` | Edge Function contexte Display public |
| `supabase/functions/tv-broadcast/index.ts` | Edge Function broadcast Realtime |
| `supabase/schema.sql` | Schéma base complet |

---

## 16. Clés localStorage Operator

| Clé | Valeur |
|-----|--------|
| `scoreDisplay.activeOrgId` | UUID organisation active |
| `scoreDisplay.activeOrgSlug` | Slug organisation active |
