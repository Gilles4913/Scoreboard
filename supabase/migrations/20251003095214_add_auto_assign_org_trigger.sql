/*
  # Attribution automatique d'organisation aux nouveaux utilisateurs
  
  1. Fonction
    - Assigne automatiquement la première organisation disponible à un nouvel utilisateur
    - Rôle par défaut : 'operator'
    - Permet de tester rapidement le système
  
  2. Note
    - En production, cette fonction devrait être remplacée par un processus d'invitation
    - Un super_admin devrait créer les comptes et assigner les organisations manuellement
*/

-- Fonction pour assigner automatiquement une organisation à un nouvel utilisateur
CREATE OR REPLACE FUNCTION public.auto_assign_org_to_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  first_org_id uuid;
BEGIN
  -- Récupérer la première organisation disponible
  SELECT id INTO first_org_id
  FROM public.orgs
  ORDER BY created_at ASC
  LIMIT 1;

  -- Si une organisation existe, l'assigner à l'utilisateur
  IF first_org_id IS NOT NULL THEN
    INSERT INTO public.org_members (org_id, user_id, role)
    VALUES (first_org_id, NEW.id, 'operator')
    ON CONFLICT (org_id, user_id) DO NOTHING;
    
    RAISE NOTICE 'Organisation % assignée à l''utilisateur %', first_org_id, NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger pour assigner automatiquement une organisation lors de la création du profil
DROP TRIGGER IF EXISTS on_profile_created_assign_org ON public.profiles;
CREATE TRIGGER on_profile_created_assign_org
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_assign_org_to_new_user();