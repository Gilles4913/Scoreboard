
# PROJECT_BOOTSTRAP_CONTEXT.md
## scoreDisplay — Contexte complet pour ouvrir un nouveau chat

Version: 1.0
Date: 2026-03-06

Ce document permet de redémarrer un nouveau chat avec **tout le contexte technique et produit du projet scoreDisplay**.

---

# 1. Vision du projet

scoreDisplay est une plateforme web permettant :

- la gestion de matchs sportifs
- l'affichage de scores en temps réel
- la diffusion publique sur écrans TV ou LED
- la gestion d'organisations sportives

Le produit cible :

- clubs sportifs
- gymnases
- collectivités
- salles multisports
- écrans de stade

Objectif actuel :
stabiliser une **V1 démontrable**.

Objectif futur :
évoluer vers un **produit SaaS commercial multi-tenant**.

---

# 2. Stack technique

Frontend
- React
- TypeScript
- Vite

Backend
- Supabase
- PostgreSQL
- Auth
- RLS
- Edge Functions

Infrastructure
- Vercel
- monorepo

Structure :

apps/
home
operator
display
admin

---

# 3. Applications

## Home

Hub d'accès principal.

Fonctions :
- login
- sélection organisation
- accès operator
- accès admin
- accès display

Important :
Home est **le seul org picker**.

Operator ne doit jamais demander l'organisation.

---

## Operator

Interface métier.

Fonctions :
- liste matchs
- préparation match
- lien display
- QR code display
- broadcast TV

Page principale :

MatchPage.tsx

---

## Display

Affichage public.

Utilisé pour :

- TV
- écran LED
- scoreboard stade

Fonctions :

- score
- horloge
- sponsors
- lower-third
- diffusion temps réel

---

## Admin

Console super admin.

Fonctions :

- gestion organisations
- gestion membres
- gestion sports

---

# 4. Base de données

Supabase PostgreSQL

## Table orgs

Champs :

id
slug
name
status
sport
suspended_at
archived_at

IMPORTANT :

le champ sport est **sport**

NE PAS utiliser org_sport.

---

## Table matches

Champs :

id
org_id
name
status
scheduled_at
home_name
away_name
home_score
away_score
public_display
display_token
is_live
archived_at

---

# 5. Règles produit

1 organisation = 1 sport

le sport d'un match = sport organisation

organisation archivée :
lecture seule

organisation suspendue :
restreinte

---

# 6. Flux principal

Home
→ login
→ liste organisations

Home
→ Ouvrir organisation

Operator
→ liste matchs

Operator
→ ouvrir display

Display
→ affichage public

---

# 7. Broadcast temps réel

Architecture :

Operator
→ tv-broadcast
→ websocket relay
→ Display

Edge Functions :

get-display-context
tv-ws-relay
tv-broadcast

---

# 8. Variables d'environnement

Home

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_OPERATOR_URL
VITE_ADMIN_URL
VITE_DISPLAY_URL

Operator

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_HOME_URL
VITE_DISPLAY_URL
VITE_TV_BROADCAST_URL

Display

VITE_EDGE_CONTEXT_URL
VITE_TV_WS_RELAY_URL

Admin

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_HOME_URL
VITE_OPERATOR_URL
VITE_DISPLAY_URL

---

# 9. Problèmes historiques

3 sources principales de bugs :

1 confusion sport / org_sport
2 session supabase entre domaines Vercel
3 pages legacy dans operator

---

# 10. Direction projet

Priorité :

stabilité
simplicité
démo

pas priorité :

SaaS complet

---

# 11. Roadmap logique

1 stabiliser Home
2 stabiliser Operator
3 stabiliser Display
4 stabiliser broadcast
5 nettoyer repo
6 construire SaaS

---

# 12. Règles pour futur développement

Toujours respecter :

Home = hub
Operator = métier
Display = affichage
Admin = gouvernance

Ne jamais :

réintroduire org_sport
réintroduire org picker Operator
modifier DB sans raison
complexifier flux démo

