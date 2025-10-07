-- Correction de la récursion infinie dans les politiques RLS
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. Désactiver temporairement RLS pour nettoyer
ALTER TABLE public.org_members DISABLE ROW LEVEL SECURITY;

-- 2. Supprimer toutes les politiques existantes sur org_members
DROP POLICY IF EXISTS "org_members super admin all" ON public.org_members;
DROP POLICY IF EXISTS "org_members self read" ON public.org_members;

-- 3. Réactiver RLS
ALTER TABLE public.org_members ENABLE ROW LEVEL SECURITY;

-- 4. Créer des politiques simplifiées sans récursion
-- Politique pour les Super Admins (accès complet)
CREATE POLICY "org_members_super_admin_all" ON public.org_members
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id 
      FROM public.org_members 
      WHERE role = 'super_admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id 
      FROM public.org_members 
      WHERE role = 'super_admin'
    )
  );

-- Politique pour les utilisateurs normaux (lecture seule de leurs propres membres)
CREATE POLICY "org_members_user_read_own" ON public.org_members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- 5. Vérifier que les politiques sont créées correctement
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'org_members'
ORDER BY policyname;

-- 6. Test de création d'organisation (à exécuter après la correction)
-- INSERT INTO public.orgs (name, slug) VALUES ('Test Organisation', 'test-org');
