# Démarrage Rapide - Scoreboard Pro

## 1. Configuration de la Base de Données

La base de données a été initialisée avec succès! Le schéma complet est en place avec:
- ✅ Table `profiles` (profils utilisateurs)
- ✅ Table `orgs` (organisations avec sport)
- ✅ Table `org_members` (attribution des rôles)
- ✅ Table `matches` (matchs)
- ✅ Politiques RLS (sécurité)

## 2. Créer les Utilisateurs de Test

**Ouvrez le fichier dans votre navigateur:**
```bash
open setup_initial_data.html
# ou double-cliquez sur le fichier
```

**Cliquez sur "Lancer la configuration"**

Ce script va créer:
- 👑 **Super Admin**: gilles.guerrin@a2display.fr (SuperAdmin2024!)
- 👤 **Opérateur**: gilles.guerrin49@gmail.com (Operator2024!)
- 🏢 **Organisation**: Club Sportif Test (football)
- ⚽ **Match de test**: Équipe A vs Équipe B

## 3. Lancer l'Application

L'application utilise un monorepo avec plusieurs apps. Pour lancer l'application Operator:

```bash
# Si le dev server n'est pas déjà lancé
cd apps/operator
npm run dev
```

L'application sera accessible sur: **http://localhost:5174**

## 4. Se Connecter

### En tant que Super Admin

1. Allez sur http://localhost:5174
2. Connectez-vous avec:
   - **Email**: gilles.guerrin@a2display.fr
   - **Mot de passe**: SuperAdmin2024!
3. Vous accédez à l'**interface Super Admin** où vous pouvez:
   - Créer/Modifier/Supprimer des organisations
   - Créer des utilisateurs
   - Assigner des opérateurs aux organisations
   - Gérer tous les matchs

### En tant qu'Opérateur

1. Allez sur http://localhost:5174
2. Connectez-vous avec:
   - **Email**: gilles.guerrin49@gmail.com
   - **Mot de passe**: Operator2024!
3. Vous accédez à l'**interface Opérateur** où vous pouvez:
   - Voir vos organisations assignées
   - Créer et gérer des matchs
   - Contrôler les chronomètres et scores

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Page de Login                        │
│              (AuthPage.tsx)                             │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ├─ Vérification des credentials
                  ├─ Chargement des organisations
                  └─ Détection du rôle
                  │
        ┌─────────┴──────────┐
        │                    │
        ▼                    ▼
┌──────────────────┐  ┌─────────────────────┐
│  Super Admin     │  │  Opérateur          │
│  (role='super_   │  │  (role='operator')  │
│   admin')        │  │                     │
└────────┬─────────┘  └──────────┬──────────┘
         │                       │
         ▼                       ▼
┌──────────────────┐  ┌─────────────────────┐
│ SuperAdminPage   │  │ OrganizationSelector│
│                  │  │         ↓           │
│ - Gestion orgs   │  │    SpacePage        │
│ - Gestion users  │  │         ↓           │
│ - Assignment     │  │    MatchPage        │
└──────────────────┘  └─────────────────────┘
```

## Règles Métier Importantes

1. **Super Admin Global**
   - Le Super Admin (gilles.guerrin@a2display.fr) a accès à TOUTES les organisations
   - Il peut créer des organisations et assigner des opérateurs

2. **Organisations Isolées**
   - Chaque organisation est complètement isolée
   - Les opérateurs ne voient que leurs organisations assignées

3. **1 Organisation = 1 Sport**
   - Lors de la création d'une organisation, on lui associe un sport
   - Sports disponibles: basic, football, handball, basket, hockey_ice, hockey_field, volleyball

4. **1 Match Actif à la Fois**
   - Une organisation ne peut avoir qu'un seul match avec le statut `live` (chronomètre démarré)
   - Les autres matchs doivent être en statut `scheduled`, `finished` ou `archived`

## Prochaines Actions

1. ✅ Base de données initialisée
2. ⏳ **Créer les utilisateurs** (exécuter `setup_initial_data.html`)
3. ⏳ **Se connecter** à l'application
4. ⏳ **Tester** les fonctionnalités Super Admin et Opérateur

## Besoin d'Aide?

Consultez le fichier `GUIDE_CONNEXION.md` pour plus de détails sur:
- L'architecture complète
- Les permissions de chaque rôle
- Le schéma de la base de données
- Le dépannage
