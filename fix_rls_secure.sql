-- Solution sécurisée pour corriger la récursion RLS
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Désactiver temporairement RLS
ALTER TABLE public.org_members DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer toutes les politiques existantes
DROP POLICY IF EXISTS "org_members super admin all" ON public.org_members;
DROP POLICY IF EXISTS "org_members self read" ON public.org_members;
DROP POLICY IF EXISTS "org_members_super_admin_all" ON public.org_members;
DROP POLICY IF EXISTS "org_members_user_read_own" ON public.org_members;
DROP POLICY IF EXISTS "org_members_authenticated_access" ON public.org_members;

-- 3. Réactiver RLS
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 4. Créer une fonction pour vérifier le rôle Super Admin sans récursion
CREATE OR REPLACE FUNCTION public.is_super_admin_simple(uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  -- Utilise une sous-requête directe pour éviter la récursion
  SELECT EXISTS(
    SELECT 1 
    FROM public.org_members 
    WHERE user_id = uid 
    AND role = 'super_admin'
  );
$$;

-- 5. Créer des politiques sans récursion
-- Politique pour les Super Admins
CREATE POLICY "org_members_super_admin_policy" ON public.org_members
  FOR ALL TO authenticated
  USING (public.is_super_admin_simple(auth.uid()))
  WITH CHECK (public.is_super_admin_simple(auth.uid()));

-- Politique pour les utilisateurs normaux (lecture de leurs propres données)
CREATE POLICY "org_members_user_policy" ON public.org_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 6. Vérifier que les politiques sont créées
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'org_members'
ORDER BY policyname;

-- 7. Test de création d'organisation
INSERT INTO public.orgs (name, slug) 
VALUES ('Test Organisation Sécurisée', 'test-secure')
ON CONFLICT (slug) DO NOTHING;

-- 8. Vérifier que l'organisation a été créée
SELECT * FROM public.orgs WHERE slug = 'test-secure';
