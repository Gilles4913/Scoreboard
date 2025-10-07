/*
  # Correction des politiques RLS pour éviter stack depth limit exceeded

  1. Suppression des politiques existantes qui causent la récursion
  2. Création de nouvelles politiques simplifiées
  3. Utilisation de sous-requêtes plus efficaces
*/

-- Supprimer toutes les politiques existantes pour les matches
DROP POLICY IF EXISTS "matches super admin all" ON public.matches;
DROP POLICY IF EXISTS "matches org member crud" ON public.matches;

-- Créer de nouvelles politiques simplifiées
CREATE POLICY "matches_super_admin_access" ON public.matches
  FOR ALL TO authenticated
  USING (
    auth.uid() IN (
      SELECT user_id FROM public.org_members WHERE role = 'super_admin'
    )
  )
  WITH CHECK (
    auth.uid() IN (
      SELECT user_id FROM public.org_members WHERE role = 'super_admin'
    )
  );

CREATE POLICY "matches_org_member_access" ON public.matches
  FOR ALL TO authenticated
  USING (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    org_id IN (
      SELECT org_id FROM public.org_members WHERE user_id = auth.uid()
    )
  );

-- Vérifier que les politiques sont bien créées
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'matches';