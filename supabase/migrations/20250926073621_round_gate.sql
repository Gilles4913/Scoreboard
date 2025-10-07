/*
  # Suppression du rôle admin non nécessaire

  1. Modifications
    - Suppression du rôle 'admin' de l'enum member_role
    - Conservation de 'super_admin' et 'operator' uniquement
    - Mise à jour des utilisateurs admin existants vers operator
  
  2. Simplification
    - Plus besoin de distinction entre admin et operator
    - Structure plus simple : super_admin (système) + operator (organisation)
*/

-- Mettre à jour tous les utilisateurs 'admin' vers 'operator'
UPDATE public.org_members 
SET role = 'operator'::public.member_role 
WHERE role = 'admin'::public.member_role;

-- Supprimer le rôle 'admin' de l'enum (nécessite de recréer l'enum)
-- 1. Créer le nouvel enum sans 'admin'
CREATE TYPE public.member_role_new AS ENUM ('super_admin', 'operator');

-- 2. Mettre à jour la colonne pour utiliser le nouveau type
ALTER TABLE public.org_members 
ALTER COLUMN role TYPE public.member_role_new 
USING role::text::public.member_role_new;

-- 3. Supprimer l'ancien enum et renommer le nouveau
DROP TYPE public.member_role;
ALTER TYPE public.member_role_new RENAME TO member_role;

-- Vérifier que la migration a fonctionné
SELECT DISTINCT role FROM public.org_members;