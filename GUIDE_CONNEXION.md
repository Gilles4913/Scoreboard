# Guide de Connexion - Scoreboard Pro

## Configuration Initiale

La base de données a été initialisée avec le schéma complet. Voici comment procéder pour créer vos utilisateurs et vous connecter.

## Étape 1: Créer les utilisateurs de test

1. **Ouvrez le fichier de configuration dans votre navigateur:**
   ```
   setup_initial_data.html
   ```

2. **Cliquez sur le bouton "Lancer la configuration"**

   Ce script va créer automatiquement:
   - **Super Admin**: gilles.guerrin@a2display.fr (mot de passe: SuperAdmin2024!)
   - **Opérateur**: gilles.guerrin49@gmail.com (mot de passe: Operator2024!)
   - **Organisation de test**: Club Sportif Test (sport: football)
   - **Match de test**: Équipe A vs Équipe B

## Étape 2: Se connecter à l'application

### Option A: Connexion en tant que Super Admin

1. Accédez à l'application operator (http://localhost:5174)
2. Entrez les identifiants:
   - Email: **gilles.guerrin@a2display.fr**
   - Mot de passe: **SuperAdmin2024!**
3. Cliquez sur "Se connecter"
4. Vous serez automatiquement redirigé vers l'**interface Super Admin**

### Option B: Connexion en tant qu'Opérateur

1. Accédez à l'application operator (http://localhost:5174)
2. Entrez les identifiants:
   - Email: **gilles.guerrin49@gmail.com**
   - Mot de passe: **Operator2024!**
3. Cliquez sur "Se connecter"
4. Vous serez automatiquement redirigé vers l'**interface Opérateur**

## Architecture de l'Application

### Flux d'Authentification

```
AuthPage (Login)
     ↓
Vérification des credentials
     ↓
Chargement des organisations de l'utilisateur
     ↓
Détection du rôle (Super Admin ou Opérateur)
     ↓
     ├─→ Super Admin → SuperAdminPage
     └─→ Opérateur → OrganizationSelector (si plusieurs orgs) → SpacePage
```

### Rôles et Permissions

#### Super Admin (`super_admin`)
- **Accès**: Toutes les organisations
- **Permissions**:
  - Créer, modifier, archiver et supprimer des organisations
  - Créer des utilisateurs (opérateurs)
  - Assigner des opérateurs aux organisations
  - Gérer tous les matchs de toutes les organisations
- **Interface**: SuperAdminPage avec gestion complète

#### Opérateur (`operator`)
- **Accès**: Uniquement les organisations assignées
- **Permissions**:
  - Voir les organisations assignées
  - Créer, modifier et gérer les matchs de ses organisations
  - Contrôler le chronomètre et les scores des matchs
- **Interface**: SpacePage avec liste des matchs et MatchPage pour contrôle

### Règles Métier

1. **Organisations Disjointes**: Chaque organisation est complètement isolée des autres
2. **1 Organisation = 1 Sport**: Lors de la création d'une organisation, on lui associe un sport unique
3. **1 Match Actif à la Fois**: Une organisation ne peut avoir qu'un seul match avec le statut `live` à la fois

### Schéma de la Base de Données

#### Table `profiles`
- Synchronisée automatiquement avec `auth.users`
- Contient les profils utilisateurs

#### Table `orgs`
- Contient les organisations
- Champs: `id`, `slug`, `name`, `sport`, `created_at`
- Contrainte: `sport` doit être l'un de: `basic`, `football`, `handball`, `basket`, `hockey_ice`, `hockey_field`, `volleyball`

#### Table `org_members`
- Lie les utilisateurs aux organisations
- Champs: `org_id`, `user_id`, `role`
- Rôles possibles: `super_admin`, `admin`, `operator`

#### Table `matches`
- Contient les matchs
- Champs: `id`, `org_id`, `name`, `sport`, `home_name`, `away_name`, `scheduled_at`, `status`, etc.
- Statuts possibles: `scheduled`, `live`, `finished`, `archived`

### Sécurité (RLS)

Toutes les tables ont Row Level Security (RLS) activé:

- **Super Admins**: Accès complet à toutes les données
- **Opérateurs**: Accès uniquement aux données de leurs organisations assignées
- **Isolation**: Les opérateurs ne peuvent pas voir les données des autres organisations

## Prochaines Étapes

1. **Exécutez `setup_initial_data.html`** pour créer les données de test
2. **Lancez l'application** avec `npm run dev` (port 3000 pour home, 5174 pour operator)
3. **Connectez-vous** avec l'un des comptes créés
4. **Explorez les fonctionnalités**:
   - En tant que Super Admin: créez des organisations et assignez des opérateurs
   - En tant qu'Opérateur: créez des matchs et gérez les scores

## Dépannage

### Erreur "Aucune organisation trouvée"
- Vérifiez que l'utilisateur est bien assigné à au moins une organisation dans la table `org_members`
- Le Super Admin doit avoir le rôle `super_admin`

### Erreur de connexion
- Vérifiez que les identifiants sont corrects
- Vérifiez que les utilisateurs ont bien été créés dans `auth.users`

### Problème de permissions
- Vérifiez les politiques RLS dans Supabase
- Vérifiez que le rôle de l'utilisateur est correct dans `org_members`
