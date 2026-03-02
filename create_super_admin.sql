-- Script pour créer le super_admin initial et le lier à l'organisation MASTER
--
-- PRÉREQUIS :
-- 1. Créer l'utilisateur dans Supabase Auth UI d'abord :
--    - Email: gilles.guerrin@a2display.fr
--    - Password: admin123 (à changer en production)
--
-- 2. Exécuter ce script ensuite pour lier l'utilisateur à MASTER

-- Vérifier que l'organisation MASTER existe
DO $$
DECLARE
  v_master_id uuid;
  v_user_id uuid;
BEGIN
  -- Récupérer l'ID de MASTER
  SELECT id INTO v_master_id
  FROM public.orgs
  WHERE is_master = true
  LIMIT 1;

  IF v_master_id IS NULL THEN
    RAISE EXCEPTION 'Organisation MASTER not found. Run migration first.';
  END IF;

  RAISE NOTICE 'Organisation MASTER found: %', v_master_id;

  -- Récupérer l'ID de l'utilisateur par email
  SELECT id INTO v_user_id
  FROM auth.users
  WHERE email = 'gilles.guerrin@a2display.fr'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User with email gilles.guerrin@a2display.fr not found. Create user in Auth UI first.';
  END IF;

  RAISE NOTICE 'User found: %', v_user_id;

  -- Créer le profil si nécessaire
  INSERT INTO public.profiles (id, email, created_at, updated_at)
  VALUES (v_user_id, 'gilles.guerrin@a2display.fr', now(), now())
  ON CONFLICT (id) DO NOTHING;

  RAISE NOTICE 'Profile created or already exists';

  -- Lier l'utilisateur à MASTER avec le rôle super_admin
  INSERT INTO public.org_members (org_id, user_id, role, created_at)
  VALUES (v_master_id, v_user_id, 'super_admin', now())
  ON CONFLICT (org_id, user_id) DO UPDATE
  SET role = 'super_admin';

  RAISE NOTICE 'User linked to MASTER organization with super_admin role';

  -- Afficher le résultat
  RAISE NOTICE '✅ Super admin created successfully!';
  RAISE NOTICE 'Email: gilles.guerrin@a2display.fr';
  RAISE NOTICE 'Organization: MASTER';
  RAISE NOTICE 'Role: super_admin';

END $$;

-- Vérifier le résultat
SELECT
  p.email,
  o.name as org_name,
  o.slug as org_slug,
  om.role
FROM public.org_members om
JOIN public.profiles p ON p.id = om.user_id
JOIN public.orgs o ON o.id = om.org_id
WHERE o.is_master = true;
