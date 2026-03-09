# scoreDisplay — Bible Produit & Technique

**Version**: 5.0.0  
**Date**: 2026-03-09  
**Statut**: Référence de travail V2 démontrable, structurée pour industrialisation SaaS

---

## 1. Vision produit

scoreDisplay est une plateforme web multi-apps de gestion, pilotage et diffusion de scores sportifs, conçue pour des usages club, gymnase, salle multisport, écran TV, écran LED et affichage stadium.

Le produit repose sur 4 applications web et un backend Supabase.

### 1.1 Applications

- **Home** (`apps/home`)  
  Point d’entrée unique. Authentification, choix de l’organisation, redirection vers Operator / Admin / Display.

- **Operator** (`apps/operator`)  
  Interface métier pour gérer les équipes, les matchs, les feuilles de match, la régie live, les QR codes, les liens Display et le broadcast temps réel.

- **Display** (`apps/display`)  
  Affichage public TV / LED / stadium. Lecture par `display_token`, `matchId`, `teamSlug` ou `teamId`, avec mode stable par équipe, thèmes d’affichage, options sportives, sponsors et synchronisation temps réel.

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

### 1.4 Edge Functions abandonnées / à archiver

- `tv-ws-relay`  
  Remplacée par Supabase Realtime Broadcast dans la trajectoire V2.

---

## 2. Principes figés

### 2.1 Convention DB désormais figée

#### Table `orgs`
Champs structurants confirmés :
- `id`
- `slug`
- `name`
- `status`
- `sport`
- `suspended_at`
- `archived_at`
- org système `master`

### Règle absolue

**Le champ sport de l’organisation est `orgs.sport`.**  
**Il ne faut plus utiliser `org_sport` dans le code.**

### 2.2 Invariants métier

- **1 organisation = 1 sport**
- **Home est le seul org picker**
- **Operator ne doit jamais reproposer la sélection d’organisation**
- **Le sport du match découle de l’organisation**
- **Une organisation archivée est en lecture seule**
- **Une organisation suspendue est restreinte / bloquée**
- **Le super admin passe par l’organisation système `master`**
- **Le Display public doit rester accessible sans session Operator**
- **L’URL Display stable par équipe devient le mode recommandé pour les écrans fixes**

---

## 3. Architecture produit V2

### 3.1 Home

#### Rôle
- Authentification Supabase
- Chargement des organisations du membre
- Affichage du hub d’accès
- Redirection vers Operator
- Accès Admin si `super_admin`
- option `?forceLogin=1`

#### Flux attendu
1. Ouverture de Home
2. Si session absente → login
3. Si session présente → liste des organisations
4. Clic sur **Ouvrir**
5. Redirection vers Operator avec :
   - `?org=<slug>`
   - handoff de session via hash `#access_token=...&refresh_token=...`

### 3.2 Operator

#### Rôle
- Lecture de l’organisation active
- Liste des équipes de l’organisation
- Liste des matchs par équipe
- Préparation d’un match
- Édition d’un match existant
- Gestion de la feuille de match
- Régie live multi-sport
- Liens Display
- QR codes régie / display
- Paramètres Display
- Branding équipe
- Gestion des joueurs

#### Règle de navigation
- Operator ne doit plus utiliser `/select-org`
- l’org vient de Home via `?org=slug` + localStorage

#### Pages V2 utiles
- `TeamsPage.tsx`
- `TeamMatchesPage.tsx`
- `NewMatchPage.tsx`
- `ControlPage.tsx`
- `DisplaySettingsPage.tsx`
- `PlayersPage.tsx`
- `TeamBrandingPage.tsx`
- `EditMatchRosterPage.tsx`

### 3.3 Display

#### Rôle
- affichage public TV / LED / stadium
- chargement du contexte initial via edge function
- réception temps réel via Supabase Realtime Broadcast
- affichage grand format lisible
- affichage détaillé conditionnel selon options du sport
- URL stable par équipe
- bascule périodique sur le match actif en mode équipe stable

#### Modes d’ouverture supportés
- `?token=<display_token>`
- `?matchId=<match_id>`
- `?teamSlug=<team_slug>`
- `?teamId=<team_id>`

### 3.4 Admin

#### Rôle
- vue super admin
- dashboard global
- gestion organisations
- gestion membres
- gestion sports

#### Positionnement
Admin reste secondaire dans la démonstration métier.  
Le cœur produit démontrable repose sur **Home + Operator + Display**.

---

## 4. Modèle de données V2

### 4.1 `orgs`

Table de gouvernance organisationnelle.

Champs clés :
- `id`
- `slug`
- `name`
- `status`
- `sport`
- `suspended_at`
- `archived_at`

### 4.2 `teams`

Les équipes appartiennent à une organisation.

Champs clés désormais utilisés :
- `id`
- `org_id`
- `slug`
- `name`
- `category`
- `code`
- `short_name`
- `logo_url`
- `primary_color`
- `secondary_color`

### 4.3 `players`

Référentiel des joueurs par équipe dans l’état actuel du projet.

Champs clés :
- `id`
- `org_id`
- `team_id`
- `number`
- `name`
- `position`
- `is_active`
- `created_at`
- `updated_at`

### 4.4 `matches`

Le modèle match V2 repose sur un vrai domicile / extérieur.

Champs historiques conservés :
- `id`
- `org_id`
- `team_id`
- `name`
- `status`
- `scheduled_at`
- `home_name`
- `away_name`
- `home_score`
- `away_score`
- `display_token`
- `public_display`
- `is_live`
- `archived_at`

Champs V2 ajoutés / structurants :
- `home_team_id`
- `away_team_id`
- `period_label`
- `clock_ms`
- `clock_running`
- `home_team_fouls`
- `away_team_fouls`
- `home_timeouts`
- `away_timeouts`
- `home_bonus`
- `away_bonus`
- `shot_clock_s`
- `home_sets_won`
- `away_sets_won`
- `home_yellow_cards`
- `away_yellow_cards`
- `home_red_cards`
- `away_red_cards`

### 4.5 `match_players`

Feuille de match persistée.

Champs clés :
- `id`
- `org_id`
- `match_id`
- `team_id`
- `player_id`
- `shirt_number`
- `is_starter`
- `is_selected`
- `fouls`
- `points`
- `yellow_cards`
- `red_cards`
- `created_at`
- `updated_at`

### 4.6 `team_players`

Table préparée pour la trajectoire multi-affectation joueur ↔ équipe.

Champs clés :
- `id`
- `org_id`
- `team_id`
- `player_id`
- `shirt_number`
- `is_active`
- `created_at`
- `updated_at`

### 4.7 `org_display_settings`

Paramètres d’affichage par organisation.

Champs utilisés :
- `org_id`
- `theme`
- `layout_mode`
- `show_score`
- `show_clock`
- `show_period`
- `show_status`
- `show_lower_third`
- `show_logos`
- `show_sponsors`
- `dual_language`
- `lang_primary`
- `lang_secondary`
- `sponsor_rotate_s`

### 4.8 `org_sport_settings`

Paramètres métier par sport pour l’organisation.

Champs utilisés :
- `org_id`
- `sport`
- `period_count`
- `period_duration_s`
- `extra_time_enabled`
- `penalties_enabled`
- `show_team_fouls`
- `show_player_fouls`
- `show_timeouts`
- `show_bonus`
- `show_sets`
- `show_cards`
- `show_shot_clock`
- `max_team_fouls`
- `max_player_fouls`
- `max_timeouts`
- `shot_clock_s`

---

## 5. Rôles et sécurité

### 5.1 Rôles métier

Le rôle applicatif est porté par `org_members.role`.

Rôles attendus :
- `super_admin`
- `org_admin`
- `operator`
- `viewer`

### 5.2 Super admin

Le super admin est identifié via helper SQL / RPC `is_super_admin(...)`, adossé à l’org `master`.

### 5.3 RLS

Principes retenus :
- isolation stricte par organisation
- lecture / écriture réservées aux membres autorisés
- Admin réservé au super admin
- Display public via Edge Functions et non via accès anon direct sur les tables métier
- `players`, `team_players`, `match_players`, `matches` protégés par `can_read_org` / `can_write_org`

---

## 6. État fonctionnel réellement atteint

### 6.1 Fait côté DB

- `orgs.sport` confirmé et figé
- `teams` étendue avec `slug`, `category`, `code`
- `teams` étendue avec branding : `short_name`, `logo_url`, `primary_color`, `secondary_color`
- `matches` étendue en V2 avec `home_team_id` / `away_team_id`
- `matches` étendue avec persistance de l’état live
- `players` créée et sécurisée
- `team_players` créée
- `match_players` créée et sécurisée
- helpers SQL / fonctions `can_read_org`, `can_write_org`, `is_org_active`, `is_super_admin` restent la base de sécurité
- jeu de données multi-sport recréé plus proprement

### 6.2 Fait côté Home

- login Supabase
- session persistée
- option `?forceLogin=1`
- liste des organisations
- filtres / recherche
- hub d’entrée confirmé
- redirection vers Operator stabilisée

### 6.3 Fait côté Operator

- navigation par organisation héritée de Home
- liste des équipes
- liste des matchs par équipe
- préparation d’un match V2
- sélection des joueurs pour la feuille de match
- édition de la feuille de match existante
- suppression d’un match `scheduled`
- archivage d’un match `finished`
- régie live multi-sport
- sauvegarde visible
- QR code régie
- QR code display
- page Branding équipe
- page Joueurs équipe
- page Paramètres Display

### 6.4 Fait côté Display

- chargement contexte par edge function
- support `token`, `matchId`, `teamSlug`, `teamId`
- mode stable par équipe
- auto-refresh périodique en mode équipe stable
- score bump
- horloge anti-jitter
- lower-third
- sponsors rotatifs
- mode dual-language
- thèmes / layouts
- branding équipe exploitable
- affichage détaillé conditionné par options sportives

### 6.5 Fait côté temps réel

- stratégie retenue :
  - snapshot initial via `get-display-context`
  - realtime via Supabase Broadcast
  - push via `tv-broadcast`
- helper `sendTvBroadcast()` exploité côté Operator

---

## 7. Flux métier V2

### 7.1 Flux principal

1. Home
2. Choix organisation
3. Operator
4. Sélection équipe
5. Liste matchs équipe
6. Préparer un match
7. Constituer feuille de match
8. Ouvrir régie live
9. Ouvrir Display public
10. Diffuser / piloter en live

### 7.2 Création de match V2

Depuis une équipe :
- l’équipe courante devient **domicile par défaut**
- l’équipe extérieure peut être :
  - une équipe interne
  - un adversaire externe en texte
- la feuille de match domicile est sélectionnée
- la feuille de match extérieure est sélectionnée si équipe interne
- `match_players` est alimentée à la création

### 7.3 Régie live

La régie permet :
- score
- période / quart / set
- chrono
- shot clock
- fautes équipe
- temps morts
- bonus
- sets gagnés
- cartons équipe
- statistiques joueurs
- sauvegarde base
- push Display live

### 7.4 Feuille de match

Une page dédiée permet de :
- rouvrir la feuille d’un match existant
- modifier les joueurs sélectionnés
- changer les titulaires
- changer le numéro porté sur le match

### 7.5 Display stable par équipe

URL recommandée pour un écran LED fixe :
- `?teamSlug=<slug>`

Comportement :
- cherche un match `live`
- sinon `paused`
- sinon prochain `scheduled`
- recharge périodiquement le contexte
- rebascule sur un autre match si besoin

---

## 8. UX / wording V2

### 8.1 Home

Texte de principe :
- “scoreDisplay”
- “Hub d’accès”
- “Choisissez une organisation pour ouvrir l’espace Operator.”

### 8.2 Operator

Texte de principe :
- “Équipes”
- “Préparer un match”
- “Feuille de match”
- “Régie live”
- “Écran public”
- “Écran stable équipe”
- “Paramètres Display”
- “Branding équipe”

### 8.3 Display

Texte / badges conseillés :
- sport
- statut
- période
- lower-third avec match + lieu
- theme / layout implicites

---

## 9. Display détaillé

### 9.1 Principe

Le Display détaillé n’est pas un second produit.  
C’est un mode d’affichage conditionnel du Display principal, piloté par :
- `org_display_settings`
- `org_sport_settings`
- l’état live poussé depuis Operator

### 9.2 Ce qui est déjà activable

Selon le sport et les options :
- score
- horloge
- période
- statut
- logos
- sponsors
- fautes équipe
- fautes joueurs
- temps morts
- bonus
- sets
- cartons
- shot clock

### 9.3 Ce qui est déjà persisté

#### Dans `matches`
- période
- horloge
- statut
- score
- fautes équipe
- temps morts
- bonus
- shot clock
- sets
- cartons équipe

#### Dans `match_players`
- fautes joueur
- points joueur
- cartons joueur

### 9.4 Ce qui reste à industrialiser

- thème “display détaillé joueurs” dédié
- choix du niveau de détail par template d’écran
- affichage public des points joueurs selon sport
- affichage public des cartons joueurs selon sport
- top joueurs / leaders
- affichage différencié TV vs LED vs pupitre

### 9.5 Recommandation produit

Le mode par défaut doit rester **lisible, grand public, peu chargé**.  
Le mode détaillé doit être **piloté par option**, jamais imposé.

---

## 10. Pages / routes utiles

### 10.1 Home

À garder :
- `apps/home/src/App.tsx`
- `apps/home/src/supabase.ts`

### 10.2 Operator

À garder :
- `apps/operator/src/App.tsx`
- `apps/operator/src/main.tsx`
- `apps/operator/src/supabase.ts`
- `apps/operator/src/pages/TeamsPage.tsx`
- `apps/operator/src/pages/TeamMatchesPage.tsx`
- `apps/operator/src/pages/NewMatchPage.tsx`
- `apps/operator/src/pages/ControlPage.tsx`
- `apps/operator/src/pages/DisplaySettingsPage.tsx`
- `apps/operator/src/pages/PlayersPage.tsx`
- `apps/operator/src/pages/TeamBrandingPage.tsx`
- `apps/operator/src/pages/EditMatchRosterPage.tsx`
- `apps/operator/src/realtime.ts`

À archiver / supprimer si encore présents :
- `SelectOrgPage.tsx`
- `OrganizationSelector.tsx`
- `RedirectPage.tsx`
- `AuthPage.tsx`
- `LoginPage.tsx`
- `SuperAdminPage.tsx`
- `SpacePage.tsx`
- `AuthDebugPage.tsx`
- anciennes pages doublon `MatchesPage.tsx` / `OperatorPage.tsx` / `DisplayPage.tsx` si non routées

### 10.3 Display

À garder :
- `apps/display/src/main.tsx`
- `apps/display/src/components/Scoreboard.tsx`
- `theme.css` si utilisé

### 10.4 Admin

À garder :
- `App.tsx`
- `AdminLayout.tsx`
- `SuperAdminGuard.tsx`
- `DashboardPage.tsx`
- `OrgsPage.tsx`
- `MembersPage.tsx`
- `SportsPage.tsx`

---

## 11. Déploiement Vercel

### 11.1 Monorepo

1 projet Vercel = 1 app / 1 URL.

Projets attendus :
- Home
- Operator
- Admin
- Display

### 11.2 Install command validé

```bash
corepack enable && corepack prepare pnpm@8.15.9 --activate && pnpm install --no-frozen-lockfile
```

### 11.3 Variable Vercel importante

- `ENABLE_EXPERIMENTAL_COREPACK=1`

### 11.4 Operator rewrite SPA

`apps/operator/vercel.json` :

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 12. Variables d’environnement par app

### 12.1 Home
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPERATOR_URL`
- `VITE_ADMIN_URL`
- `VITE_DISPLAY_URL`

### 12.2 Operator
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_HOME_URL`
- `VITE_DISPLAY_URL`
- `VITE_TV_BROADCAST_URL`

### 12.3 Display
- `VITE_EDGE_CONTEXT_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### 12.4 Admin
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_HOME_URL`
- `VITE_OPERATOR_URL`
- `VITE_DISPLAY_URL`

---

## 13. Sécurité et diffusion live

### 13.1 Principe

- Home → Operator
- Operator prépare ou pilote un match
- Operator pousse un patch live via `tv-broadcast`
- Display reçoit via Supabase Broadcast

### 13.2 Contexte initial

`get-display-context` doit fournir :
- `match`
- `org`
- `display_settings`
- `sport_settings`
- équipes enrichies domicile / extérieur si disponibles
- `channel`

### 13.3 Patches temps réel attendus

- score
- horloge
- statut
- période / quart / set
- sponsors
- options d’affichage
- stats équipes
- stats joueurs si activées

---

## 14. Règles sportives fines

### 14.1 Football
- 1MT / 2MT
- cartons équipe / joueurs
- prolongation / TAB plus tard

### 14.2 Basket
- Q1 / Q2 / Q3 / Q4
- fautes équipe
- fautes joueur
- points joueur
- timeouts
- bonus
- shot clock
- OT plus tard si besoin avancé

### 14.3 Handball
- 1MT / 2MT
- points joueur possibles
- exclusions avancées plus tard

### 14.4 Rugby
- 1MT / 2MT
- points joueur
- cartons

### 14.5 Volleyball
- Set 1 à Set 5
- sets gagnés
- score set détaillé plus tard

---

## 15. Dette technique / fragilités restantes

### 15.1 Transition historique `team_id` → `home_team_id` / `away_team_id`

`team_id` reste encore un champ de compatibilité, mais la vérité métier doit migrer progressivement vers :
- `home_team_id`
- `away_team_id`

### 15.2 Modèle joueur encore intermédiaire

La cible long terme reste :
- `players`
- `team_players`
- `match_players`

Le projet est déjà partiellement engagé dans cette direction, mais `players.team_id` existe encore comme ancrage pratique.

### 15.3 Display détaillé

Le socle existe, mais il faut encore :
- mieux segmenter les templates
- mieux piloter la densité d’information
- prévoir un mode public détaillé et un mode opérateur local plus riche

### 15.4 Nettoyage legacy

Des pages et composants obsolètes peuvent encore exister dans le repo et doivent être déplacés en `_legacy` ou supprimés.

---

## 16. Ce qu’il reste à faire pour une V2 vraiment propre

1. stabiliser définitivement tous les écrans Operator sur les routes V2
2. finir le nettoyage des pages legacy
3. améliorer les logos / assets via Storage
4. ajouter édition d’un match existant hors régie
5. améliorer les templates Display détaillés
6. introduire la vraie multi-affectation joueur ↔ équipe si nécessaire
7. enrichir les statistiques sportives par discipline

---

## 17. Roadmap de passage vers SaaS commercial

### 17.1 SaaS Foundation
- onboarding self-service
- création organisation autonome
- billing / abonnements
- plans / quotas
- invitation utilisateurs
- audit log
- paramètres organisation

### 17.2 Multi-tenant robuste
- vues admin globales consolidées
- monitoring par org
- suspension / archivage industrialisés
- export de données
- sauvegardes / recovery formalisés

### 17.3 Produit métier
- compétitions / championnats
- classement / calendrier
- événements de jeu structurés
- historiques détaillés
- modèles d’affichage par sport
- statistiques avancées équipe / joueur / saison

### 17.4 Display / médias
- sponsors par org / équipe / match
- assets via Storage
- overlays streaming / OBS
- templates TV / LED / pupitre / mobile
- branding plus poussé

### 17.5 Sécurité / conformité
- audit sécurité RLS final
- durcissement Edge Functions
- rotation secrets
- journalisation erreurs
- conformité RGPD / rétention données

---

## 18. Décisions de produit à garder en tête

- la priorité reste la **démonstration terrain convaincante**
- il faut privilégier :
  - stabilité
  - clarté du flux
  - UX convaincante
  - cohérence métier
- chaque nouvelle fonction doit répondre à :  
  **“Est-ce que cela améliore la démonstration et prépare le futur produit, sans dégrader la robustesse ?”**

---

## 19. Référence courte pour ouvrir un nouveau chat

### Résumé ultra-court
scoreDisplay est un produit multi-apps (Home, Operator, Display, Admin) basé sur Supabase.  
Le champ sport de référence est `orgs.sport`.  
Home est le seul org picker.  
Operator gère désormais équipes, matchs, feuilles de match, branding, joueurs et régie live.  
Le modèle match V2 repose sur `home_team_id` / `away_team_id`.  
Display fonctionne via `display_token`, `matchId` ou URL stable par équipe (`teamSlug`).  
Le temps réel passe par `tv-broadcast` + Supabase Broadcast.  
Le Display détaillé existe en logique optionnelle et doit continuer à être industrialisé par templates.
