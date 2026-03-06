# scoreDisplay — Bible Produit & Technique

**Version**: 4.0.0  
**Date**: 2026-03-06  
**Statut**: Référence de travail V1 stabilisée pour démos clubs / collectivités

---

## 1. Vision produit

scoreDisplay est une plateforme web multi-apps de gestion et d’affichage de scores sportifs, conçue pour des usages club, gymnase, salle, écran TV et écran LED/stadium.

Le produit repose sur 4 applications web et un backend Supabase.

### 1.1 Applications

- **Home** (`apps/home`)  
  Point d’entrée unique. Authentification, choix de l’organisation, redirection vers Operator / Admin / Display.

- **Operator** (`apps/operator`)  
  Interface métier pour gérer les matchs, préparer les diffusions, ouvrir le Display public, lancer le broadcast temps réel.

- **Display** (`apps/display`)  
  Affichage public TV / LED / stadium. Lecture via `display_token` ou `matchId`, avec mode Stadium LED, lower-third, sponsors et broadcast temps réel.

- **Admin** (`apps/admin`)  
  Console super admin pour gérer les organisations, membres, sports et gouvernance SaaS.

### 1.2 Backend

- **Supabase**
  - Postgres
  - Auth
  - RLS
  - Edge Functions
  - Storage si besoin ultérieur

- **Edge Functions utilisées / prévues**
  - `get-display-context`
  - `tv-ws-relay`
  - `tv-broadcast`

---

## 2. Ce qui est figé et ne doit plus être remis en cause

### 2.1 Convention DB désormais figée

#### Table `orgs`
Champs confirmés côté données :
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

#### Table `matches`
Champs confirmés côté données :
- `id`
- `org_id`
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

### 2.2 Invariants métier

- **1 organisation = 1 sport**
- **Le sport d’un match découle de l’organisation**
- **Home est le seul org picker**
- **Operator ne doit plus proposer de sélection d’organisation**
- **Display public passe par `display_token` ou `matchId`**
- **Une organisation archivée doit être traitée en lecture seule**
- **Une organisation suspendue doit être traitée comme restreinte / bloquée**
- **Le super admin passe par l’organisation système `master`**

---

## 3. Architecture applicative actuelle

### 3.1 Home

#### Rôle
- Authentification Supabase
- Chargement des organisations de l’utilisateur
- Affichage d’un hub d’accès propre
- Redirection vers Operator
- Accès Admin si super_admin
- Option `?forceLogin=1`

#### Flux attendu
1. Ouverture de Home
2. Si session absente → écran login
3. Si session présente → chargement des organisations
4. L’utilisateur clique sur **Ouvrir**
5. Home redirige vers Operator avec :
   - `?org=<slug>`
   - handoff de session via hash `#access_token=...&refresh_token=...`

#### État UI V1
- thème clair / sombre
- cartes statistiques
- liste des organisations
- filtres / recherche
- mini mode d’emploi

### 3.2 Operator

#### Rôle
- Lecture de l’organisation active
- Liste des matchs de l’organisation
- Liens Display
- QR code Display
- Préparation du broadcast TV

#### Règle de navigation
- Operator ne doit plus utiliser `/select-org`
- l’org vient de Home via `?org=slug` + localStorage

#### Pages utiles V1
- `MatchPage.tsx`

#### Routes V1 attendues
- `/`
- `/matches`
- fallback vers `/`

### 3.3 Display

#### Rôle
- affichage public TV / écran LED
- chargement contexte initial via edge function
- réception temps réel via WebSocket relay
- affichage Stadium LED

#### Capacités actuellement prévues
- score LED XXL
- horloge anti-jitter
- lower-third
- sponsors rotatifs
- FR/EN
- statut match
- période / quart / set

### 3.4 Admin

#### Rôle
- vue super_admin
- dashboard global
- gestion organisations
- gestion membres
- gestion sports

#### Positionnement V1
Admin est utile pour démo avancée / gouvernance, mais la démonstration principale repose surtout sur Home + Operator + Display.

---

## 4. Rôles et sécurité

### 4.1 Rôles métier

Le rôle applicatif est porté par `org_members.role`.

Rôles attendus :
- `super_admin`
- `org_admin`
- `operator`
- `viewer`

### 4.2 Super admin

Le super admin est identifié via helper SQL / RPC `is_super_admin(...)`, adossé à l’org `master`.

### 4.3 RLS

Principes visés :
- isolation stricte par organisation
- lecture / écriture réservées aux membres autorisés
- Admin réservé au super admin
- Display public via Edge Functions plutôt que SELECT anon direct

---

## 5. État fonctionnel réellement atteint

### 5.1 Fait côté DB

- structure `orgs` confirmée avec `sport`
- structure `matches` confirmée avec `status`, `public_display`, `display_token`
- helpers SQL / fonctions `can_read_org`, `can_write_org`, `is_org_active`, `is_super_admin` ont été travaillés
- logique `master` introduite
- statuts organisations et statuts matchs présents

### 5.2 Fait côté Home

- login Supabase
- session persistée
- option `?forceLogin=1`
- liste des organisations
- filtres / recherche
- UI plus propre
- point d’entrée unique confirmé

### 5.3 Fait côté Operator

- lecture des matchs d’une organisation
- affichage des matchs
- lien Display
- QR code prêt
- base pour broadcast TV prête

### 5.4 Fait côté Display

- composant `Scoreboard.tsx` Stadium LED défini
- lower-third
- sponsors rotatifs
- mode dual-language
- anti-jitter clock
- score bump

### 5.5 Fait côté TV Broadcast

- stratégie retenue :
  - snapshot via `get-display-context`
  - WebSocket via `tv-ws-relay`
  - push via `tv-broadcast`
- helper `sendTvBroadcast()` défini côté Operator

---

## 6. Points de fragilité identifiés

### 6.1 Incohérence `sport` / `org_sport`

Erreur récurrente historique.  
Décision finale : **toujours `sport`**.

### 6.2 Handoff de session Home → Operator / Admin

Les apps étant sur des domaines Vercel différents, la session Supabase n’est pas partagée automatiquement.

La stratégie retenue est :
- Home récupère `access_token` + `refresh_token`
- Home ouvre Operator/Admin avec ces tokens dans le hash
- Operator/Admin font `supabase.auth.setSession(...)`
- nettoyage de l’URL ensuite

### 6.3 Anciennes pages obsolètes

Des fichiers legacy existent encore dans le repo, surtout côté Operator. Ils créent de la confusion et doivent être nettoyés.

---

## 7. Pages / routes utiles et pages obsolètes

### 7.1 Home

#### À garder
- `apps/home/src/App.tsx`
- `apps/home/src/supabase.ts`

#### À considérer comme obsolètes si encore présents
- anciens fichiers dans `apps/home/src/pages/*` si non routés

### 7.2 Operator

#### À garder
- `apps/operator/src/App.tsx`
- `apps/operator/src/main.tsx`
- `apps/operator/src/supabase.ts`
- `apps/operator/src/pages/MatchPage.tsx`
- `apps/operator/src/realtime.ts`
- `apps/operator/src/components/MatchDisplayModal.tsx` si utilisé
- `apps/operator/src/utils/displayLink.ts` si utilisé

#### À supprimer / archiver en `_legacy`
- `SelectOrgPage.tsx`
- `OrganizationSelector.tsx`
- `RedirectPage.tsx`
- `AuthPage.tsx`
- `LoginPage.tsx`
- `SuperAdminPage.tsx`
- `SpacePage.tsx`
- `AuthDebugPage.tsx`
- `DisplayPage.tsx`
- `OperatorPage.tsx`
- `MatchesPage.tsx` si doublon avec `MatchPage.tsx`
- `TeamsPage.tsx` si non utilisé en V1

### 7.3 Admin

#### À garder
- `App.tsx`
- `AdminLayout.tsx`
- `SuperAdminGuard.tsx`
- `DashboardPage.tsx`
- `OrgsPage.tsx`
- `MembersPage.tsx`
- `SportsPage.tsx`

### 7.4 Display

#### À garder
- `main.tsx`
- `components/Scoreboard.tsx`
- `theme.css` si utilisé

---

## 8. UX / wording V1 recommandés

### 8.1 Home

Texte de principe :
- “scoreDisplay”
- “Hub d’accès”
- “Choisissez une organisation pour ouvrir l’espace Operator.”

Mini mode d’emploi :
1. Connectez-vous
2. Choisissez une organisation
3. Cliquez sur Ouvrir
4. Gérez les matchs dans Operator
5. Ouvrez le Display public via lien ou QR code

### 8.2 Operator

Texte de principe :
- “Espace Operator”
- “Matchs à préparer”
- “Archives / matchs joués”
- “Display public”
- “QR code Display”
- “Broadcast démo”

### 8.3 Display

Texte / badges conseillés :
- sport
- statut
- période
- lower-third avec match + lieu
- mode LED / stadium

---

## 9. Déploiement Vercel

### 9.1 Monorepo

1 projet Vercel = 1 app / 1 URL.

Projets attendus :
- Home
- Operator
- Admin
- Display

### 9.2 Install command validé

```bash
corepack enable && corepack prepare pnpm@8.15.9 --activate && pnpm install --no-frozen-lockfile
```

### 9.3 Variable Vercel importante

- `ENABLE_EXPERIMENTAL_COREPACK=1`

### 9.4 Operator rewrite SPA

`apps/operator/vercel.json` doit contenir :

```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

## 10. Variables d’environnement par app

### 10.1 Home

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPERATOR_URL`
- `VITE_ADMIN_URL`
- `VITE_DISPLAY_URL`

### 10.2 Operator

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_HOME_URL`
- `VITE_DISPLAY_URL`
- `VITE_TV_BROADCAST_URL`

### 10.3 Display

- `VITE_EDGE_CONTEXT_URL`
- `VITE_TV_WS_RELAY_URL`

### 10.4 Admin

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_HOME_URL`
- `VITE_OPERATOR_URL`
- `VITE_DISPLAY_URL`

---

## 11. TV Broadcast — design retenu

### 11.1 Principe

- Home → Operator
- Operator prépare ou pilote un match
- Operator pousse un patch temps réel via `tv-broadcast`
- Display reçoit le flux via `tv-ws-relay`

### 11.2 Contexte initial

`get-display-context` doit fournir :
- match
- org
- channel / identifiant de flux
- paramètres d’affichage utiles

### 11.3 Patches temps réel

Exemples :
- score
- horloge
- statut
- période / quart / set
- sponsors

---

## 12. Règles sport fines à implémenter / finaliser

### 12.1 Football
- 1MT / 2MT
- éventuellement prolongation / TAB plus tard

### 12.2 Basket
- Q1 / Q2 / Q3 / Q4
- éventuellement prolongation

### 12.3 Handball
- 1MT / 2MT

### 12.4 Rugby
- 1MT / 2MT

### 12.5 Volleyball
- Set 1 à Set 5
- score set par set si produit complet

---

## 13. Ce qu’il reste à faire pour finaliser totalement la V1 démo

1. **Stabiliser définitivement le flux Home → Operator**
   - vérifier handoff de session
   - éliminer les erreurs `Invalid Refresh Token`

2. **Valider le flux Operator → Display**
   - lien direct
   - QR code
   - ouverture sur TV / mobile

3. **Valider le broadcast temps réel**
   - test `sendTvBroadcast()`
   - test `tv-ws-relay`
   - affichage Display mis à jour en live

4. **Nettoyer le repo**
   - supprimer les pages legacy
   - éviter les routes mortes

5. **Verrouiller une démonstration standard**
   - 1 org
   - 1 match scheduled
   - 1 display public
   - 1 scénario live simple

---

## 14. Roadmap pour passer de V1 démo à vrai produit SaaS commercial

### 14.1 SaaS Foundation
- onboarding self-service
- création d’organisation autonome
- billing / abonnements
- gestion plans / quotas
- invitation utilisateurs
- audit log
- page paramètres organisation

### 14.2 Multi-tenant robuste
- vues admin globales consolidées
- monitoring par org
- suspension / archivage industrialisés
- export de données
- sauvegardes / recovery formalisés

### 14.3 Produit métier
- gestion équipes complète
- gestion compétitions / championnats
- stats avancées par sport
- événements de jeu structurés (cartons, exclusions, essais, etc.)
- historiques détaillés
- modèles d’affichage par sport

### 14.4 Display / médias
- playlists sponsors par org
- assets logos / sponsors via Storage
- templates d’écrans
- thèmes LED / salle / gymnase / streaming
- overlays streaming / OBS

### 14.5 Commercial / ops
- site vitrine marketing
- pricing clair
- CRM / pipeline démo
- support client
- analytics d’usage
- centre d’aide / documentation

### 14.6 Sécurité / conformité
- audit sécurité RLS final
- durcissement Edge Functions
- rotation secrets
- journalisation erreurs
- conformité RGPD / rétention données

---

## 15. Décisions de produit à garder en tête

- La priorité actuelle est **la démonstration terrain**, pas le SaaS self-service complet.
- Il faut donc privilégier :
  - stabilité
  - flux simple
  - peu de surface fonctionnelle
  - UX convaincante
- Toute nouvelle fonction doit être jugée selon ce critère :  
  **“Est-ce que cela aide la démo ou est-ce que cela ajoute du risque ?”**

---

## 16. Référence courte pour tout nouveau chat

### Résumé ultra-court
scoreDisplay est un produit multi-apps (Home, Operator, Display, Admin) basé sur Supabase.  
La DB est figée sur `orgs.sport` et `matches.status`.  
Home est le seul org picker.  
Operator ne doit plus gérer de sélection d’org.  
Display fonctionne via `display_token` / `matchId` + TV broadcast temps réel.  
L’objectif immédiat est une V1 stable pour démonstrations clubs / collectivités.
