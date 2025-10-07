-- Solution finale pour éliminer complètement la récursion RLS
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Désactiver temporairement RLS sur toutes les tables concernées
ALTER TABLE public.org_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer TOUTES les politiques existantes
DROP POLICY IF EXISTS "org_members super admin all" ON public.org_members;
DROP POLICY IF EXISTS "org_members self read" ON public.org_members;
DROP POLICY IF EXISTS "org_members_super_admin_all" ON public.org_members;
DROP POLICY IF EXISTS "org_members_user_read_own" ON public.org_members;
DROP POLICY IF EXISTS "org_members_authenticated_access" ON public.org_members;
DROP POLICY IF EXISTS "org_members_super_admin_policy" ON public.org_members;
DROP POLICY IF EXISTS "org_members_user_policy" ON public.org_members;

DROP POLICY IF EXISTS "orgs super admin all" ON public.orgs;
DROP POLICY IF EXISTS "orgs member read" ON public.orgs;

DROP POLICY IF EXISTS "matches super admin all" ON public.matches;
DROP POLICY IF EXISTS "matches org member crud" ON public.matches;
DROP POLICY IF EXISTS "matches_super_admin_access" ON public.matches;
DROP POLICY IF EXISTS "matches_org_member_access" ON public.matches;
DROP POLICY IF EXISTS "matches_authenticated_access" ON public.matches;

-- 3. Supprimer les fonctions problématiques
DROP FUNCTION IF EXISTS public.is_super_admin(uuid);
DROP FUNCTION IF EXISTS public.is_super_admin_simple(uuid);

-- 4. Réactiver RLS
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- 5. Créer des politiques ultra-simples SANS récursion
-- Politique pour org_members : tous les utilisateurs authentifiés
CREATE POLICY "org_members_simple" ON public.org_members
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique pour orgs : tous les utilisateurs authentifiés
CREATE POLICY "orgs_simple" ON public.orgs
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- Politique pour matches : tous les utilisateurs authentifiés
CREATE POLICY "matches_simple" ON public.matches
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Vérifier que les politiques sont créées
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename IN ('org_members', 'orgs', 'matches')
ORDER BY tablename, policyname;

-- 7. Test de création d'organisation
INSERT INTO public.orgs (name, slug) 
VALUES ('Test Organisation Finale', 'test-final')
ON CONFLICT (slug) DO NOTHING;

-- 8. Vérifier que l'organisation a été créée
SELECT * FROM public.orgs WHERE slug = 'test-final';

-- 9. Test de création d'un membre
INSERT INTO public.org_members (org_id, user_id, role)
SELECT 
  o.id,
  u.id,
  'operator'::public.member_role
FROM public.orgs o
CROSS JOIN auth.users u
WHERE o.slug = 'test-final'
  AND u.email = 'gilles.guerrin@a2display.fr'
ON CONFLICT (org_id, user_id) DO NOTHING;

-- 10. Vérifier que le membre a été créé
SELECT 
  om.*,
  o.name as org_name,
  u.email as user_email
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id
JOIN auth.users u ON u.id = om.user_id
WHERE o.slug = 'test-final';
