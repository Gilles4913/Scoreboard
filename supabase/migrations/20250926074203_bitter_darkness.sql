/*
  # Suppression du rôle admin avec gestion de la vue

  1. Modifications
    - Suppression temporaire de la vue org_members_with_org
    - Suppression du rôle 'admin' de l'enum member_role
    - Conservation de 'super_admin' et 'operator' uniquement
    - Recréation de la vue
  
  2. Simplification
    - Plus besoin de distinction entre admin et operator
    - Structure plus simple : super_admin (système) + operator (organisation)
*/

-- Mettre à jour tous les utilisateurs 'admin' vers 'operator'
UPDATE public.org_members 
SET role = 'operator'::public.member_role 
WHERE role = 'admin'::public.member_role;

-- Supprimer temporairement la vue qui dépend de la colonne role
DROP VIEW IF EXISTS public.org_members_with_org;

-- Supprimer temporairement la valeur par défaut
ALTER TABLE public.org_members ALTER COLUMN role DROP DEFAULT;

-- Créer le nouvel enum sans 'admin'
CREATE TYPE public.member_role_new AS ENUM ('super_admin', 'operator');

-- Mettre à jour la colonne pour utiliser le nouveau type
ALTER TABLE public.org_members 
ALTER COLUMN role TYPE public.member_role_new 
USING role::text::public.member_role_new;

-- Remettre la valeur par défaut avec le nouveau type
ALTER TABLE public.org_members ALTER COLUMN role SET DEFAULT 'operator'::public.member_role_new;

-- Supprimer l'ancien enum et renommer le nouveau
DROP TYPE public.member_role;
ALTER TYPE public.member_role_new RENAME TO member_role;

-- Recréer la vue org_members_with_org
CREATE OR REPLACE VIEW public.org_members_with_org AS
SELECT om.*, o.slug as org_slug, o.name as org_name
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id;

-- Vérifier que la migration a fonctionné
SELECT DISTINCT role FROM public.org_members;