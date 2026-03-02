# 📚 Index de la Documentation — Scoreboard Pro

**Version**: 3.0.0
**Dernière mise à jour**: 2026-02-26

---

## 🎯 Par où commencer ?

### Vous êtes...

**👨‍💼 Chef de projet / Product Owner**
→ Commencez par [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 1 (Vision Produit)

**👨‍💻 Développeur découvrant le projet**
→ Lisez [`README.md`](./README.md) puis [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 2 (Modèle Métier)

**🔧 Développeur faisant une modification**
→ Consultez [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 8 (Règles de Contribution)

**🤖 Utilisant Bolt**
→ Copiez-collez [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) dans Bolt

**📊 Analyste de données**
→ Consultez [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) Section "Architecture de données"

**👥 Utilisateur final**
→ Lisez [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md)

---

## 📖 Documents par Type

### 🏛️ Référence Métier

| Document | Description | Audience | Priorité |
|----------|-------------|----------|----------|
| [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) | **Source de vérité officielle**<br/>Vision, modèle métier, invariants, ADRs | Tous | ⭐⭐⭐ |
| [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) | Contexte permanent pour Bolt<br/>Invariants, checklists, réponses types | Dev + Bolt | ⭐⭐⭐ |

### 🔧 Documentation Technique

| Document | Description | Audience | Priorité |
|----------|-------------|----------|----------|
| [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) | Détails migration DB<br/>Types, logique, paramètres display | Dev backend | ⭐⭐ |
| [`README.md`](./README.md) | Vue d'ensemble projet<br/>Quick start, stack, structure | Tous | ⭐⭐ |
| [`RECAP_IMPLEMENTATION.md`](./RECAP_IMPLEMENTATION.md) | Récapitulatif implémentation<br/>Ce qui a été fait, métriques | Chef projet | ⭐ |

### 📝 Guides Utilisateur

| Document | Description | Audience | Priorité |
|----------|-------------|----------|----------|
| [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md) | Guide migration utilisateur<br/>Étapes, exemples, dépannage | Utilisateurs | ⭐⭐ |

### 🗄️ Scripts & Data

| Document | Description | Audience | Priorité |
|----------|-------------|----------|----------|
| [`seed_sample_data.sql`](./seed_sample_data.sql) | Données de test<br/>2 orgs, 4 équipes, 2 matchs | Dev | ⭐ |

---

## 🔍 Recherche par Sujet

### Architecture

**Modèle de données**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 2 (Modèle Métier)
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section "Architecture de données"

**Invariants structurels**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 2.1
- [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) → Section "Invariants Structurels"

**ADRs (décisions architecturales)**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 6
- 4 ADRs documentés : Sport par org, Héritage JSON, Teams centraux, Realtime non persisté

### Sports

**Liste des sports**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 3
- [`README.md`](./README.md) → Section "Supported Sports"

**Détails par sport**
- Football → [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 3.2
- Basketball → [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 3.3
- Volleyball → [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 3.4
- Handball → [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 3.5
- Rugby → [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 3.6

**Ajouter un sport**
- [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) → Section "Checklist Ajout Sport"
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 8.3

### Display Settings

**Paramètres disponibles**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 4
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section "Paramètres d'affichage par sport"

**Héritage Org → Team**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 4.4 (Règles d'Héritage)
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section 2.1 (JSON de config)

**Defaults par sport**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 4.3
- Code : `packages/logic/src/index.ts`

### Base de Données

**Structure tables**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 2.2 (Entités)
- [`README.md`](./README.md) → Section "Database Schema"
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section 1 (Migration DB)

**Sécurité RLS**
- [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) → Section 5.4
- [`README.md`](./README.md) → Section "Security"
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section "Sécurité RLS"

**Migrations**
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section "Migrations"
- Fichier : `supabase/migrations/20260226_org_sport_teams_display.sql`

### Code

**Types TypeScript**
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section 2 (Types)
- Fichier : `packages/types/src/index.ts`

**Logique métier**
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section 3 (Logique)
- Fichier : `packages/logic/src/index.ts`

**Composants React**
- TeamsPage : `apps/operator/src/pages/TeamsPage.tsx`
- SpacePage : `apps/operator/src/pages/SpacePage.tsx`
- Display : `apps/display/src/main.tsx`

### Utilisation

**Quick Start**
- [`README.md`](./README.md) → Section "Quick Start"

**Configuration**
- [`README.md`](./README.md) → Section "Configuration"
- [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md) → Section 2 (Configurer)

**Migration données existantes**
- [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md) → Section 4 (Migrer matchs)
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) → Section "Prochaines étapes"

**Créer équipes**
- [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md) → Section 3
- Code : `apps/operator/src/pages/TeamsPage.tsx`

---

## 🚀 Parcours Recommandés

### Parcours "Découverte" (30 min)

1. [`README.md`](./README.md) — Vue d'ensemble (10 min)
2. [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Sections 1-2 — Vision + Modèle (15 min)
3. [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md) — Quick tour utilisateur (5 min)

### Parcours "Développeur Frontend" (1h)

1. [`README.md`](./README.md) — Quick Start
2. [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Sections 2-4 — Modèle + Display Settings
3. `packages/types/src/index.ts` — Types
4. `apps/operator/src/pages/TeamsPage.tsx` — Exemple composant

### Parcours "Développeur Backend" (1h)

1. [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) — Migration complète
2. `supabase/migrations/20260226_org_sport_teams_display.sql` — Structure DB
3. [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 5.4 — RLS
4. `packages/logic/src/index.ts` — Logique métier

### Parcours "Modification Architecture" (2h)

1. [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Sections 2.1 + 6 — Invariants + ADRs
2. [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) — Règles + Checklists
3. [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 8 — Règles de contribution
4. Créer ADR si modification structurelle

### Parcours "Utilisation Bolt" (15 min)

1. [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) — Copier-coller dans Bolt
2. [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 2.1 — Connaître invariants
3. Utiliser Bolt normalement (il refusera modifications non conformes)

---

## 📊 Statistiques Documentation

**Total pages** : 7 documents principaux
**Mots** : ~15,000 mots
**Sections Bible** : 10 chapitres
**ADRs** : 4 documentés
**Exemples code** : 25+
**Checklists** : 7
**Tableaux** : 15+

---

## 🔗 Liens Rapides

### Fichiers Clés (par ordre de priorité)

1. [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) ⭐⭐⭐
2. [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) ⭐⭐⭐
3. [`README.md`](./README.md) ⭐⭐
4. [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) ⭐⭐
5. [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md) ⭐⭐
6. [`RECAP_IMPLEMENTATION.md`](./RECAP_IMPLEMENTATION.md) ⭐
7. [`seed_sample_data.sql`](./seed_sample_data.sql) ⭐

### Sections Bible Importantes

- [Vision Produit](./BIBLE_SCOREBOARD.md#1-vision-produit)
- [Invariants Structurels](./BIBLE_SCOREBOARD.md#21-invariants-structurels)
- [Entités](./BIBLE_SCOREBOARD.md#22-entités)
- [Sports Supportés](./BIBLE_SCOREBOARD.md#3-sports-supportés)
- [Paramètres Affichage](./BIBLE_SCOREBOARD.md#4-paramètres-daffichage)
- [ADRs](./BIBLE_SCOREBOARD.md#6-décisions-structurantes-adr)
- [Règles Contribution](./BIBLE_SCOREBOARD.md#8-règles-de-contribution)

### Code Source Principal

- Types : [`packages/types/src/index.ts`](./packages/types/src/index.ts)
- Logic : [`packages/logic/src/index.ts`](./packages/logic/src/index.ts)
- Display Settings : [`packages/logic/src/displaySettings.ts`](./packages/logic/src/displaySettings.ts)
- Teams UI : [`apps/operator/src/pages/TeamsPage.tsx`](./apps/operator/src/pages/TeamsPage.tsx)
- Migration : [`supabase/migrations/20260226_org_sport_teams_display.sql`](./supabase/migrations/20260226_org_sport_teams_display.sql)

---

## ❓ FAQ Documentation

**Q: Quel document lire en premier ?**
A: [`README.md`](./README.md) pour vue d'ensemble, puis [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) pour approfondir.

**Q: Où trouver les règles à respecter ?**
A: [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 2.1 (Invariants) et Section 8 (Règles).

**Q: Comment utiliser avec Bolt ?**
A: Copier [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) dans Bolt au début de chaque session.

**Q: Où sont les détails techniques migration ?**
A: [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) (complet) ou [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 2 (résumé).

**Q: Comment ajouter un paramètre d'affichage ?**
A: [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) Section "Checklist Ajout Paramètre".

**Q: Pourquoi certaines décisions ont été prises ?**
A: [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 6 (ADRs).

**Q: Où trouver des données de test ?**
A: [`seed_sample_data.sql`](./seed_sample_data.sql).

---

## 🎓 Glossaire

Pour le glossaire complet, voir [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 9.

**Termes clés** :
- **Bible** : [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) — Source de vérité
- **ADR** : Architecture Decision Record — Décision importante documentée
- **Invariant** : Règle non négociable de l'architecture
- **Display Settings** : Paramètres d'affichage configurables
- **Defaults** : Paramètres par défaut (organisation)
- **Overrides** : Surcharges partielles (équipe)
- **Merge** : Fusion defaults + overrides
- **RLS** : Row Level Security (Postgres)

---

**Version** : 3.0.0
**Dernière mise à jour** : 2026-02-26

---

**💡 Conseil** : Marquez ce fichier comme favori pour accéder rapidement à toute la documentation !
