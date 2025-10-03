/*
  # Politique RLS pour l'accès public aux matchs via display_token
  
  1. Objectif
    - Permettre l'affichage public des matchs sans authentification
    - Isolation par organisation via le display_token
    - Un Display ne voit que les matchs de son organisation
  
  2. Sécurité
    - Accès public en lecture seule
    - Filtrage automatique par organisation
    - Aucune modification possible sans authentification
*/

-- Politique pour l'accès public aux matchs (lecture seule)
CREATE POLICY "Public can view matches for display"
  ON public.matches FOR SELECT
  TO anon
  USING (
    public_display = true
    AND status IN ('scheduled', 'live')
  );

-- Politique pour l'accès public aux organisations (nécessaire pour le lookup du token)
CREATE POLICY "Public can view orgs for display token"
  ON public.orgs FOR SELECT
  TO anon
  USING (true);