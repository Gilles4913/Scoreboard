# 🚀 START HERE — Scoreboard Pro v3.0

**Vous venez d'ouvrir ce projet ?** Lisez ceci en 2 minutes.

---

## ✅ Projet Livré

Scoreboard Pro est une **application multi-sports** complète avec :
- ⚽ 5 sports (Football, Basket, Volley, Handball, Rugby)
- 🏢 Multi-organisations isolées
- 👥 Gestion équipes centralisée
- ⚙️ Paramètres d'affichage configurables
- 🔴 Temps réel (WebSocket)
- 🔒 Sécurité RLS stricte

**État** : Production-ready ✅

---

## 📚 Documentation (7 fichiers)

### 🔥 Documents Essentiels

1. **[`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md)** ⭐⭐⭐
   - **C'est LA source de vérité**
   - 200+ lignes, 10 sections, 4 ADRs
   - Invariants, règles, sports, display settings
   - **À lire absolument avant toute modification**

2. **[`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md)** ⭐⭐⭐
   - Prompt pour Bolt (300+ lignes)
   - Copier-coller au début de chaque session
   - Garantit respect des invariants
   - Checklists complètes

3. **[`README.md`](./README.md)** ⭐⭐
   - Vue d'ensemble + Quick Start
   - Architecture + Stack
   - Pour découvrir le projet

### 📖 Documents Complémentaires

4. **[`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md)** ⭐⭐
   - Détails techniques migration
   - Structure DB, types, logique
   - Pour développeurs backend

5. **[`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md)** ⭐⭐
   - Guide utilisateur
   - Étapes migration, exemples
   - Pour utilisateurs finaux

6. **[`RECAP_IMPLEMENTATION.md`](./RECAP_IMPLEMENTATION.md)** ⭐
   - Récapitulatif ce qui a été fait
   - Métriques, checklist validation
   - Pour chef de projet

7. **[`INDEX_DOCUMENTATION.md`](./INDEX_DOCUMENTATION.md)** ⭐
   - Index complet de la doc
   - Recherche par sujet
   - Parcours recommandés

---

## 🎯 Selon Votre Profil

**👨‍💼 Chef de projet**
→ [`RECAP_IMPLEMENTATION.md`](./RECAP_IMPLEMENTATION.md) puis [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 1

**👨‍💻 Développeur nouveau**
→ [`README.md`](./README.md) puis [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Sections 1-2

**🔧 Développeur modifiant**
→ [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 8 (Règles) + ADRs (Section 6)

**🤖 Utilisant Bolt**
→ Copier [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) dans Bolt

**🗄️ DBA / Backend**
→ [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md)

**👥 Utilisateur**
→ [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md)

---

## ⚡ Quick Start (5 min)

```bash
# 1. Install
npm install
cd apps/operator && npm install
cd ../display && npm install

# 2. Configure .env
cp .env.example .env
# Ajouter vos clés Supabase

# 3. Run
npm run dev  # Operator sur :3000
```

**Base de données** : Déjà configurée sur Supabase ✅

---

## 🏀 Sports Disponibles

| Sport | Durée |
|-------|-------|
| ⚽ Football | 2×45 min |
| 🏀 Basketball | 4×10 min |
| 🏐 Volleyball | 5 sets |
| 🤾 Handball | 2×30 min |
| 🏉 Rugby | 2×40 min |

**Chaque sport a** : Paramètres d'affichage dédiés + Meta données complètes

---

## 🔑 Invariants (NON NÉGOCIABLES)

| # | Règle |
|---|-------|
| **I-001** | **1 Organisation = 1 Sport** |
| **I-002** | **Sport match = Sport org** |
| **I-003** | **Héritage : Org defaults → Team overrides** |
| **I-004** | **Score + Temps toujours visibles** |
| **I-005** | **Isolation stricte organisations** |

→ Détails complets dans [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 2.1

---

## 📂 Structure Clé

```
/
├── BIBLE_SCOREBOARD.md           ⭐ Source de vérité
├── PROMPT_BOLT_OFFICIEL.md       ⭐ Prompt Bolt
├── README.md                      Vue d'ensemble
├── apps/
│   ├── operator/                  Interface gestion
│   └── display/                   Affichage public
├── packages/
│   ├── types/                     Types TypeScript
│   └── logic/                     Logique métier
└── supabase/
    └── migrations/                Migrations DB
```

---

## 🗄️ Base de Données

**Tables** :
- `orgs` — Organisations (1 sport chacune)
- `teams` — Équipes (logos, colors, display_overrides)
- `matches` — Matchs (avec team_ids)
- `org_members` — Membres + rôles
- `profiles` — Utilisateurs

**Vue enrichie** :
- `matches_v` — Match + org + teams + display settings

**Sécurité** : RLS activé partout ✅

---

## ⚙️ Display Settings

**Architecture** :

```
Org Display Defaults (complets)
       ↓ deepMerge
Team Display Overrides (partiels)
       ↓
Display Settings Finaux
```

**7 paramètres communs** + **26 paramètres sport-spécifiques**

→ Liste complète dans [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 4

---

## 🚫 Interdictions Formelles

1. ❌ Modifier sport d'une organisation
2. ❌ Créer match avec sport ≠ org.sport
3. ❌ Ajouter sport sans mise à jour Bible
4. ❌ Désactiver RLS
5. ❌ Exposer données org A à org B

→ Pourquoi ? Voir ADRs dans [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Section 6

---

## 🤖 Utilisation avec Bolt

**IMPORTANT** : Copier [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) dans Bolt avant toute modification.

**Effet** :
- ✅ Bolt connaît les invariants
- ✅ Refuse modifications non conformes
- ✅ Suit les checklists automatiquement
- ✅ Documente les ADRs

---

## 📞 Besoin d'Aide ?

**Question architecture** → [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md)
**Question technique** → [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md)
**Question usage** → [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md)
**Recherche** → [`INDEX_DOCUMENTATION.md`](./INDEX_DOCUMENTATION.md)

---

## 🎯 3 Règles d'Or

1. **Bible = Source de vérité** — Toujours consulter avant modification
2. **Invariants = Non négociables** — Jamais d'exception
3. **Bolt = Avec prompt** — Copier prompt officiel systématiquement

---

## ✅ Checklist Premier Jour

- [ ] Lire [`README.md`](./README.md) (10 min)
- [ ] Lire [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) Sections 1-2 (20 min)
- [ ] Consulter [`INDEX_DOCUMENTATION.md`](./INDEX_DOCUMENTATION.md) (5 min)
- [ ] Si Bolt : copier [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md)
- [ ] Lancer `npm run dev` pour tester

**Temps total** : 35 minutes

---

## 🏆 Résultat

Après lecture :
- ✅ Vous connaissez les 5 sports supportés
- ✅ Vous connaissez les 7 invariants
- ✅ Vous savez où chercher l'info
- ✅ Vous pouvez modifier en toute sécurité

---

**Version** : 3.0.0
**Date** : 2026-02-26
**Statut** : Production-ready ✅

**Prochaine étape** → Lire [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) 📖
