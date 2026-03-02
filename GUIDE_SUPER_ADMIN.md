# Guide de Création du Super Admin

## Vue d'ensemble

Ce guide explique comment créer le premier utilisateur super_admin et le lier à l'organisation MASTER.

## Prérequis

L'organisation MASTER doit exister (créée automatiquement par la migration `20260302_master_organization_system`).

## Étapes de Création

### Étape 1 : Créer l'utilisateur dans Supabase Auth

1. Ouvrir le dashboard Supabase
2. Aller dans **Authentication** > **Users**
3. Cliquer sur **Add user** > **Create new user**
4. Remplir les informations :
   - **Email** : `gilles.guerrin@a2display.fr`
   - **Password** : `admin123` (⚠️ À CHANGER EN PRODUCTION)
   - **Auto Confirm User** : ✅ Coché
5. Cliquer sur **Create user**

### Étape 2 : Lier l'utilisateur à MASTER

#### Option A : Via l'éditeur SQL Supabase

1. Aller dans **SQL Editor** dans Supabase
2. Créer une nouvelle query
3. Copier/coller le contenu du fichier `create_super_admin.sql`
4. Exécuter la query

#### Option B : Via script local

```bash
# Si vous avez accès à psql
psql $DATABASE_URL -f create_super_admin.sql
```

### Étape 3 : Vérifier la création

Exécuter cette requête SQL pour vérifier :

```sql
SELECT
  p.email,
  o.name as org_name,
  o.slug as org_slug,
  om.role
FROM public.org_members om
JOIN public.profiles p ON p.id = om.user_id
JOIN public.orgs o ON o.id = om.org_id
WHERE o.is_master = true;
```

Résultat attendu :

| email | org_name | org_slug | role |
|-------|----------|----------|------|
| gilles.guerrin@a2display.fr | MASTER | master | super_admin |

## Connexion

Une fois créé, le super_admin peut se connecter à l'application operator :

1. Ouvrir l'application operator
2. Se connecter avec :
   - Email : `gilles.guerrin@a2display.fr`
   - Password : `admin123` (ou le mot de passe choisi)

## Permissions du Super Admin

Le super_admin a accès à :

- ✅ Toutes les organisations (lecture/écriture)
- ✅ Création de nouvelles organisations
- ✅ Suppression d'organisations (sauf MASTER)
- ✅ Gestion de tous les membres
- ✅ Toutes les équipes et matchs de toutes les organisations
- ✅ Interface d'administration MASTER

## Créer d'autres Super Admins

Pour créer d'autres super_admin :

1. Créer l'utilisateur dans Supabase Auth
2. Modifier le script `create_super_admin.sql` avec le nouvel email
3. Exécuter le script

Ou directement en SQL :

```sql
-- Remplacer NEW_EMAIL par l'email de l'utilisateur
INSERT INTO public.org_members (org_id, user_id, role)
SELECT
  o.id,
  u.id,
  'super_admin'
FROM public.orgs o,
     auth.users u
WHERE o.is_master = true
AND u.email = 'NEW_EMAIL@example.com'
ON CONFLICT (org_id, user_id) DO UPDATE
SET role = 'super_admin';
```

## Sécurité

⚠️ **IMPORTANT** :

- Le mot de passe par défaut `admin123` DOIT être changé immédiatement en production
- Limiter le nombre de super_admin (principe du moindre privilège)
- Chaque super_admin doit avoir une authentification forte (MFA recommandé)
- Les actions des super_admin doivent être tracées/auditées

## Dépannage

### L'utilisateur n'est pas trouvé

Vérifier que l'utilisateur existe dans auth.users :

```sql
SELECT id, email, email_confirmed_at
FROM auth.users
WHERE email = 'gilles.guerrin@a2display.fr';
```

### L'organisation MASTER n'existe pas

Vérifier que la migration a été exécutée :

```sql
SELECT id, name, slug, is_master, is_system
FROM public.orgs
WHERE is_master = true;
```

Si vide, exécuter la migration `20260302_master_organization_system`.

### L'utilisateur ne peut pas se connecter

1. Vérifier que l'email est confirmé dans Supabase Auth
2. Vérifier que le mot de passe est correct
3. Vérifier que le profil existe :

```sql
SELECT * FROM public.profiles
WHERE email = 'gilles.guerrin@a2display.fr';
```

4. Vérifier que l'appartenance existe :

```sql
SELECT om.*, o.name
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id
WHERE om.user_id = (SELECT id FROM auth.users WHERE email = 'gilles.guerrin@a2display.fr');
```
