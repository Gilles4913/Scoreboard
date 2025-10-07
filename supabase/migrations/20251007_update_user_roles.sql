/*
  # Mise à jour des rôles utilisateurs
  
  1. gilles.guerrin@a2display.fr = Super_Admin (dans toutes les organisations)
  2. gilles.guerrin49@gmail.com = operator (dans orgA seulement)
  
  Cette migration met à jour les rôles des utilisateurs existants
  en supprimant leurs anciens rôles et en ajoutant les nouveaux.
*/

-- Récupérer les UUIDs des utilisateurs depuis auth.users
-- Note: Ces UUIDs doivent être récupérés depuis l'interface Supabase Auth
-- ou via l'API REST

-- Supprimer les anciens rôles pour les utilisateurs concernés
-- (Les UUIDs seront remplacés par les vrais UUIDs des utilisateurs)

-- Pour gilles.guerrin@a2display.fr (Super Admin)
-- DELETE FROM public.org_members 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'gilles.guerrin@a2display.fr');

-- Pour gilles.guerrin49@gmail.com (Operator)  
-- DELETE FROM public.org_members 
-- WHERE user_id = (SELECT id FROM auth.users WHERE email = 'gilles.guerrin49@gmail.com');

-- Ajouter gilles.guerrin@a2display.fr comme super_admin dans toutes les organisations
-- INSERT INTO public.org_members (org_id, user_id, role)
-- SELECT 
--   o.id as org_id,
--   u.id as user_id,
--   'super_admin'::public.member_role as role
-- FROM public.orgs o
-- CROSS JOIN auth.users u
-- WHERE u.email = 'gilles.guerrin@a2display.fr'
-- ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- Ajouter gilles.guerrin49@gmail.com comme operator dans orgA seulement
-- INSERT INTO public.org_members (org_id, user_id, role)
-- SELECT 
--   o.id as org_id,
--   u.id as user_id,
--   'operator'::public.member_role as role
-- FROM public.orgs o
-- CROSS JOIN auth.users u
-- WHERE o.slug = 'orgA' 
--   AND u.email = 'gilles.guerrin49@gmail.com'
-- ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- Vérification des rôles mis à jour
-- SELECT 
--   u.email,
--   o.name as org_name,
--   o.slug as org_slug,
--   om.role
-- FROM public.org_members om
-- JOIN public.orgs o ON o.id = om.org_id
-- JOIN auth.users u ON u.id = om.user_id
-- WHERE u.email IN ('gilles.guerrin@a2display.fr', 'gilles.guerrin49@gmail.com')
-- ORDER BY u.email, o.name;
