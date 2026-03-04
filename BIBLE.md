# Scoreboard2 (SB2) — Bible de Fonctionnement (Référence Fonctionnelle & Technique)
Version: **3.2.0 (PRO + TV Broadcast Edge WS)**  
Date: **2026-03-04**  
Statut: **Référence unique pour Bolt / Dev / Ops**

---

## 1. Objectif du produit

SB2 est une plateforme **SaaS** de scoreboard multi-sports destinée aux clubs/organisations sportives, avec 3 applications front et une base Supabase:

- **Operator**: préparation et pilotage en temps réel des matchs (staff / opérateurs)
- **Display**: écran public (stade / gymnase / TV / LED wall) via URL + token
- **Admin Console**: **super_admin uniquement** (création organisations & membres)
- **Home**: point d’entrée unique (login + redirection vers Admin/Operator, et redirection Display optionnelle)

**Invariants:**
- **1 organisation = 1 sport** (football, basket, volleyball, handball, rugby)
- Une organisation possède **plusieurs équipes**
- Chaque sport a un **affichage spécifique**
- Paramètres d’affichage **par organisation**, hérités par les équipes, surcharge possible par équipe
- Affichage minimum: **score + temps + noms des équipes** (+ logo optionnel)

---

## 2. Architecture SaaS (apps)

### 2.1 Applications
- `apps/home` : login + routing (redirige selon `profiles.role`)
- `apps/admin` : Super Admin Console (CRUD org, members, tests RLS)
- `apps/operator` : gestion matchs/équipes + pilotage live
- `apps/display` : rendu public, **lecture uniquement** via Edge Function et token

### 2.2 Liens
- Home (SaaS entry): `https://scoreboard-home.vercel.app/`
- Display: `https://scoreboard-display-pi.vercel.app/` (ex: `/?token=...`)
- Operator: URL Vercel dédiée
- Admin: URL Vercel dédiée

---

## 3. Rôles & sécurité

### 3.1 Rôles applicatifs
Les rôles sont portés par `profiles.role`:
- `super_admin` : accès Admin Console, accès Master Org
- `org_admin` : admin d’organisation (membres, équipes, matchs)
- `operator` : opérateur de match (score/chrono/événements)
- `viewer` : lecture interne (optionnel)

### 3.2 Organisation Master
- Une organisation `master` **existe toujours** et **ne peut pas être supprimée**
- Seuls les `super_admin` y accèdent
- Le `super_admin` crée les organisations utilisatrices

### 3.3 Display sécurisé (Edge only)
- Le Display ne lit **pas** directement les tables sensibles via policies `anon`
- L’accès se fait via **Edge Function** + `display_token`
- Les policies `anon` sur `matches` sont **désactivées** (objectif)

---

## 4. Données (modèle conceptuel)

### 4.1 Organisations
- `orgs`: `id`, `slug`, `name`, `sport`, `is_master`, config d’affichage
- `org_members`: `org_id`, `user_id`, `role`

### 4.2 Équipes
- `teams`: `id`, `org_id`, `name`, `logo_url?`, paramètres d’affichage (override)

### 4.3 Matchs
- `matches`: `id`, `org_id`, `name`, `scheduled_at`, `status`, `home_team_id`, `away_team_id`, `home_score`, `away_score`, etc.
- `public_display` + `display_token` (accès Display)
- Statut minimal actuel observé: `scheduled`
- **PRO**: ajout recommandé: `archived_at` (date d’archivage) + statuts étendus si/plus tard (voir ADR)

---

## 5. Flux fonctionnels

### 5.1 Home
- Si non connecté → page login
- Si connecté:
  - `super_admin` → Admin Console
  - `org_admin/operator/viewer` → Operator
- `/display?token=...` → redirection vers Display (conserve querystring)

### 5.2 Operator
- Liste des matchs:
  - **À venir / préparation** (scheduled)
  - **Archivés** (si `archived_at` présent ou status finished/archived)
- Page match:
  - configuration display (QR code + lien)
  - pilotage score/chrono/événements (selon sport)
  - diffusion temps réel vers Display (mode PRO)

### 5.3 Display
- Accès via URL + token
- Récupère snapshot initial via Edge Function `get-display-context`
- Se connecte au canal TV Broadcast (WS) pour updates ultra faibles latences

---

## 6. Mode PRO — TV Broadcast Ultra Fluide

### 6.1 Objectif
Remplacer les updates “DB-first” pour le live par un transport événementiel:
- Latence très faible
- Peu d’écritures DB (pas un tick par seconde)
- Résilience par resync snapshot

### 6.2 Composants
- `get-display-context` (Edge HTTP): **snapshot initial** par `display_token`
- `tv-ws-relay` (Edge WS): canal WebSocket pour Displays
  - **JWT OFF** (validation par token display)
- `tv-broadcast` (Edge HTTP): endpoint Operator pour émettre events
  - **JWT ON** (auth user + vérif membership sur org du match)
  - transmet l’event vers `tv-ws-relay`

### 6.3 Contrat d’événements
Envelope standard:
```json
{
  "match_id": "uuid",
  "type": "score.set | timer.set | timer.start | timer.pause | period.set | event.add | state.patch",
  "ts": 1710000000000,
  "seq": 42,
  "payload": {}
}
```

Règles:
- `seq` monotone par match (géré côté Operator)
- Display ignore `seq <= lastSeq`
- À reconnexion WS: Display resync via `get-display-context` (snapshot)

### 6.4 Resilience
- Reconnect automatique WS
- Heartbeat (ping/pong optionnel)
- Fallback: si WS indisponible → polling `get-display-context` toutes X secondes

---

## 7. Déploiement

### 7.1 Vercel (monorepo)
Créer 4 projets Vercel distincts (recommandé):
- `scoreboard-home` (Root Directory: `apps/home`)
- `scoreboard-operator` (Root Directory: `apps/operator`)
- `scoreboard-display` (Root Directory: `apps/display`)
- `scoreboard-admin` (Root Directory: `apps/admin`)

Règle: **1 projet Vercel = 1 URL**.  
Chaque projet pointe vers **le même repo GitHub**, mais avec un **Root Directory différent**.

### 7.2 Commandes Vercel (install/build)
**Install Command (recommandé):**
```bash
corepack enable && corepack prepare pnpm@8.15.9 --activate && pnpm install --no-frozen-lockfile
```

**Build Command:**
```bash
pnpm build
```

**Output Directory (Vite):**
- `dist`

### 7.3 Variable obligatoire
- `ENABLE_EXPERIMENTAL_COREPACK=1`

### 7.4 Fix ESM Vite (IMPORTANT)
Sur Vercel, certains environnements chargent `vite.config.ts` en CJS → crash avec `@vitejs/plugin-react` ESM-only.

**Solution standard** (par app):
- renommer `vite.config.ts` → `vite.config.mts`

---

## 8. Variables d’environnement

### 8.1 Home
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_OPERATOR_URL`
- `VITE_ADMIN_URL`
- `VITE_DISPLAY_URL`

### 8.2 Operator
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TV_BROADCAST_URL` = `https://<ref>.functions.supabase.co/tv-broadcast`

### 8.3 Display
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_TV_WS_URL` = `wss://<ref>.functions.supabase.co/tv-ws-relay`
- `VITE_EDGE_CONTEXT_URL` = `https://<ref>.functions.supabase.co/get-display-context`

### 8.4 Supabase Edge Functions env
- `TV_WS_RELAY_URL` (pour `tv-broadcast`) = `https://<ref>.functions.supabase.co/tv-ws-relay`
- `SUPABASE_SERVICE_ROLE_KEY` (sécurisé, côté Supabase uniquement)

---

## 9. ADR (décisions)

### ADR-006 — TV Broadcast Edge WS Relay (PRO)
**Décision**: adopter un transport événementiel Edge (WS + HTTP) pour le live.  
**Justification**: latence faible, moins d’écritures DB, Display edge-only.  
**Tradeoffs**: reconnexion WS obligatoire, état live éphémère (resync via snapshot).

### ADR-007 — Display Edge-only (suppression policies anon sur matches)
**Décision**: Display ne lit pas Postgres en direct (anon).  
**Justification**: sécurité, contrôle, compatibilité SaaS.

---

## 10. Checklist “PRO Ready”
- [ ] Home affiche login et redirige selon rôle
- [ ] Admin CRUD org/members OK (super_admin)
- [ ] Operator pilotage match OK
- [ ] Display token OK (snapshot)
- [ ] TV Broadcast: WS connect + events OK
- [ ] Policies `anon` sur matches désactivées
- [ ] Vercel: 4 projets, root dir corrects, vite config en `.mts`

---
