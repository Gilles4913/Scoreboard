# 🤖 PROMPT OFFICIEL POUR BOLT

**À copier-coller dans Bolt pour ancrer le contexte**

---

## CONTEXTE PERMANENT — SCOREBOARD

Tu travailles sur le projet **Scoreboard**, une application web multi-sports de gestion et affichage de scores en temps réel.

### 📚 Référence Absolue

La **source de vérité métier** est le fichier `BIBLE_SCOREBOARD.md` situé à la racine du projet.

**RÈGLE D'OR** : Avant toute modification, vérifie la cohérence avec la Bible.

---

## ⚖️ INVARIANTS STRUCTURELS (NON NÉGOCIABLES)

Ces règles constituent le socle de l'architecture. **Aucune exception autorisée** :

| # | Règle | Conséquence |
|---|-------|-------------|
| **I-001** | **1 Organisation = 1 Sport** | Le sport est immutable au niveau organisation |
| **I-002** | **Sport du match = Sport de l'organisation** | Le sport n'est **JAMAIS** choisi au niveau match |
| **I-003** | **Héritage paramètres** | `displayFinal = deepMerge(org.defaults, team.overrides)` |
| **I-004** | **Toujours affichés** | Score + Temps + Noms équipes sont obligatoires |
| **I-005** | **Isolation organisations** | Aucune visibilité inter-organisations (RLS strict) |

---

## 🏀 SPORTS SUPPORTÉS (UNIQUEMENT)

**Liste exhaustive** : `football` | `basket` | `volleyball` | `handball` | `rugby`

**Interdiction formelle** :
- ❌ Ajouter un sport sans mise à jour complète de la Bible
- ❌ Réintroduire `basic`, `hockey_ice`, `hockey_field`
- ❌ Créer un sport "générique" ou "custom"

**Si demande d'ajout sport** :
1. Refuser poliment
2. Expliquer : "Nécessite mise à jour Bible + migration DB + types + logique métier"
3. Rediriger vers les 5 sports existants

---

## 🛠️ RÈGLES DE MODIFICATION

### Avant toute modification :

1. **Vérifier cohérence Bible**
   - L'invariant est-il respecté ?
   - Un ADR (Architecture Decision Record) est-il impacté ?

2. **Refuser modifications contradictoires**

   **Exemples de demandes à refuser** :

   ❌ "Permettre à une org de gérer plusieurs sports"
   → **Refuse** : Viole I-001

   ❌ "Ajouter un champ `sport` au niveau match"
   → **Refuse** : Viole I-002, ADR-001

   ❌ "Créer un sport 'tennis'"
   → **Refuse** : Sport non documenté dans Bible

   ❌ "Permettre équipe sans organisation"
   → **Refuse** : Viole modèle métier

3. **Documenter décision importante**
   - Si modification structurelle → créer ADR dans Bible
   - Format : ADR-XXX avec Date, Contexte, Décision, Raison, Impact

---

## 📋 CHECKLIST MODIFICATION DB

Toute modification de schéma DB **DOIT** respecter :

- [ ] Migration SQL avec `IF EXISTS` / `IF NOT EXISTS`
- [ ] Commentaires explicatifs en tête de migration
- [ ] Compatibilité ascendante vérifiée
- [ ] RLS policies mises à jour si nouvelle table
- [ ] Types TypeScript synchronisés (`packages/types/src/index.ts`)
- [ ] Logique métier mise à jour (`packages/logic/src/index.ts`)
- [ ] Tests de non-régression

**Format migration** :
```sql
/*
  # Titre migration

  1. Contexte
    - Pourquoi cette modification

  2. Tables modifiées
    - table_name : description changement

  3. Sécurité
    - RLS policies ajoutées/modifiées
*/

-- Code SQL ici
```

---

## 🎨 CHECKLIST AJOUT PARAMÈTRE AFFICHAGE

Si demande d'ajout d'un nouveau paramètre d'affichage :

1. [ ] Identifier sport concerné (ou `common`)
2. [ ] Ajouter dans interface TypeScript (`[Sport]DisplaySettings`)
3. [ ] Définir valeur par défaut dans `@pkg/logic`
4. [ ] Documenter dans Bible (Section 4.2 ou 4.3)
5. [ ] Implémenter dans UI Display
6. [ ] Tester héritage org → team

**Exemple** :
```typescript
// 1. Type
interface FootballDisplaySettings {
  // ... existants
  showCornerKicks?: boolean;  // NOUVEAU
}

// 2. Default
export const DEFAULT_FOOTBALL_SETTINGS = {
  // ... existants
  showCornerKicks: false  // NOUVEAU
};

// 3. Bible : documenter usage
```

---

## 🏗️ ARCHITECTURE PACKAGES

```
packages/
├── types/       # Types partagés (Sport, Org, Team, Match, DisplaySettings)
├── logic/       # Logique métier (initState, applyTick, deepMerge, defaults)
└── supa/        # Client Supabase
```

**Règle** :
- Types = source de vérité TypeScript
- Logic = pur (pas de side-effects, pas d'accès DB)
- Supa = wrapper client uniquement

---

## 🔒 SÉCURITÉ (RLS)

**Principes non négociables** :

1. **Toujours activer RLS** sur nouvelles tables
2. **Isolation stricte** par organisation
3. **Super admin** : accès global via `org_members.role = 'super_admin'`
4. **Operators** : accès limité à `org_members.org_id`
5. **Accès public** : uniquement `matches.public_display = true` + token

**Pattern politique** :
```sql
-- Membres org
CREATE POLICY "policy_name" ON table_name
FOR operation TO authenticated
USING (
  org_id IN (
    SELECT org_id FROM org_members
    WHERE user_id = auth.uid()
  )
);

-- Public (lecture seule)
CREATE POLICY "policy_name" ON table_name
FOR SELECT TO anon
USING (/* condition stricte */);
```

---

## 🚫 INTERDICTIONS FORMELLES

### Ne JAMAIS faire :

1. ❌ Modifier le sport d'une organisation sans migration manuelle
2. ❌ Créer un match avec sport ≠ org.sport
3. ❌ Exposer données organisation A à organisation B
4. ❌ Désactiver RLS sur une table
5. ❌ Ajouter sport sans mise à jour complète (types + logic + defaults + Bible)
6. ❌ Supprimer colonnes legacy sans plan migration
7. ❌ Hardcoder valeurs affichage (toujours passer par display_defaults/overrides)

### Demandes à refuser systématiquement :

- "Ajouter sport X" → Nécessite validation Bible
- "Multi-sport par org" → Viole ADR-001
- "Désactiver RLS pour simplifier" → Faille sécurité
- "Changer sport au niveau match" → Viole I-002

---

## 📖 DOCUMENTATION DE RÉFÉRENCE

**Fichiers clés** (par ordre de priorité) :

1. `BIBLE_SCOREBOARD.md` — Source de vérité métier (CE FICHIER)
2. `MIGRATION_MULTI_SPORTS.md` — Détails techniques migration DB
3. `GUIDE_MISE_A_JOUR.md` — Guide utilisateur
4. `packages/types/src/index.ts` — Référence types
5. `packages/logic/src/index.ts` — Logique métier
6. `supabase/migrations/20260226_org_sport_teams_display.sql` — Structure DB actuelle

**Ordre de consultation** :
1. Bible → Vision métier
2. Types → Contrats techniques
3. Logic → Implémentation

---

## 💬 RÉPONSES TYPES

### Si demande non conforme :

> "Cette modification n'est pas compatible avec l'architecture actuelle de Scoreboard.
>
> **Raison** : [Invariant violé / ADR concerné]
>
> **Alternative** : [Proposition conforme si possible]
>
> Pour plus de contexte, consulte `BIBLE_SCOREBOARD.md` section [X]."

### Si demande d'ajout sport :

> "L'ajout d'un nouveau sport nécessite :
>
> 1. Mise à jour de la Bible (Section 3)
> 2. Migration DB (contrainte CHECK + defaults)
> 3. Types TypeScript complets
> 4. Logique métier (initState + applyTick)
> 5. Paramètres d'affichage spécifiques
> 6. UI Scoreboard Display
>
> Actuellement supportés : football, basket, volleyball, handball, rugby.
>
> Souhaites-tu que je détaille les étapes pour [sport demandé] ?"

### Si demande modification structure :

> "Cette modification impacte l'architecture.
>
> **Vérifications nécessaires** :
> - Cohérence avec invariants (BIBLE Section 2.1)
> - Impact sur ADRs existants (BIBLE Section 6)
> - Migration DB avec compatibilité ascendante
> - Mise à jour types + logic
>
> Confirmes-tu vouloir procéder ?"

---

## ✅ WORKFLOW IDÉAL

1. **Analyse demande**
   - Est-ce compatible avec Bible ?
   - Quel(s) invariant(s) concerné(s) ?

2. **Si compatible** :
   - Planifier modifications (DB → Types → Logic → UI)
   - Appliquer checklist(s) pertinente(s)
   - Documenter si structurel

3. **Si incompatible** :
   - Refuser poliment avec raison précise
   - Proposer alternative conforme
   - Rediriger vers Bible

4. **Si doute** :
   - Demander clarification
   - Citer section Bible pertinente
   - Proposer compromis

---

## 🎯 OBJECTIF FINAL

Maintenir la **cohérence architecturale** de Scoreboard en respectant :

- ✅ Les invariants structurels
- ✅ Les ADRs validés
- ✅ La sécurité (RLS strict)
- ✅ La maintenabilité (code propre, documenté)
- ✅ L'expérience utilisateur (UX fluide, performante)

**En cas de conflit** : **La Bible prime toujours**.

---

## 📌 VERSION

**Bible** : 3.0.0
**Prompt** : 1.0.0
**Date** : 2026-02-26

---

**⚠️ RAPPEL** : Copie ce prompt dans Bolt pour garantir le respect de l'architecture Scoreboard.
