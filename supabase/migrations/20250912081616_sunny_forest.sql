/*
  # Politique publique pour l'affichage des matchs

  1. Nouvelle politique
    - Permet l'accès en lecture aux matchs avec public_display = true
    - Accessible sans authentification (rôle anon)
  
  2. Sécurité
    - Seuls les matchs marqués comme publics sont accessibles
    - Pas d'accès en écriture pour les utilisateurs anonymes
*/

-- Créer une politique pour permettre l'accès public aux matchs avec public_display = true
CREATE POLICY "matches_public_display_access" ON public.matches
  FOR SELECT TO anon
  USING (public_display = true);

-- Vérifier que la politique est créée
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'matches' AND policyname = 'matches_public_display_access';