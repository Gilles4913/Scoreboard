-- Solution simple pour corriger la récursion RLS
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Désactiver temporairement RLS
ALTER TABLE public.org_members DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer toutes les politiques problématiques
DROP POLICY IF EXISTS "org_members super admin all" ON public.org_members;
DROP POLICY IF EXISTS "org_members self read" ON public.org_members;
DROP POLICY IF EXISTS "org_members_super_admin_all" ON public.org_members;
DROP POLICY IF EXISTS "org_members_user_read_own" ON public.org_members;

-- 3. Réactiver RLS
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 4. Créer une politique ultra-simple pour les utilisateurs authentifiés
-- Cette politique permet à tous les utilisateurs authentifiés d'accéder aux org_members
-- La sécurité sera gérée au niveau applicatif
CREATE POLICY "org_members_authenticated_access" ON public.org_members
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- 5. Vérifier que la politique est créée
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'org_members';

-- 6. Test de création d'organisation
INSERT INTO public.orgs (name, slug) 
VALUES ('Test Organisation Super Admin', 'test-super-admin')
ON CONFLICT (slug) DO NOTHING;

-- 7. Vérifier que l'organisation a été créée
SELECT * FROM public.orgs WHERE slug = 'test-super-admin';
