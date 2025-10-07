/*
  # Ajout de l'utilisateur gilles.guerrin49@gmail.com à l'organisation

  1. Récupération de l'UUID de l'utilisateur
  2. Association à l'organisation orgA avec le rôle operator
  3. Vérification que l'organisation existe
*/

-- Ajouter l'utilisateur à l'organisation orgA avec le rôle operator
INSERT INTO public.org_members (org_id, user_id, role)
SELECT 
  o.id as org_id,
  u.id as user_id,
  'operator'::public.member_role as role
FROM public.orgs o
CROSS JOIN auth.users u
WHERE o.slug = 'orgA' 
  AND u.email = 'gilles.guerrin49@gmail.com'
ON CONFLICT (org_id, user_id) DO NOTHING;

-- Vérifier que l'insertion a fonctionné
SELECT 
  u.email,
  o.name as org_name,
  o.slug as org_slug,
  om.role
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id
JOIN auth.users u ON u.id = om.user_id
WHERE u.email = 'gilles.guerrin49@gmail.com';