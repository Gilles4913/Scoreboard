-- Migration manuelle pour mettre à jour les rôles utilisateurs
-- À exécuter dans l'éditeur SQL de Supabase

-- 1. D'abord, récupérer les UUIDs des utilisateurs
-- Exécutez cette requête pour voir les utilisateurs et leurs UUIDs :
SELECT id, email, created_at 
FROM auth.users 
WHERE email IN ('gilles.guerrin@a2display.fr', 'gilles.guerrin49@gmail.com')
ORDER BY email;

-- 2. Une fois que vous avez les UUIDs, remplacez les placeholders ci-dessous
-- par les vrais UUIDs récupérés dans l'étape 1

-- Variables à remplacer (remplacez par les vrais UUIDs) :
-- SET @super_admin_uuid = 'UUID_DE_gilles.guerrin@a2display.fr';
-- SET @operator_uuid = 'UUID_DE_gilles.guerrin49@gmail.com';

-- 3. Supprimer les anciens rôles pour ces utilisateurs
DELETE FROM public.org_members 
WHERE user_id IN (
    SELECT id FROM auth.users 
    WHERE email IN ('gilles.guerrin@a2display.fr', 'gilles.guerrin49@gmail.com')
);

-- 4. Ajouter gilles.guerrin@a2display.fr comme super_admin dans toutes les organisations
INSERT INTO public.org_members (org_id, user_id, role)
SELECT 
    o.id as org_id,
    u.id as user_id,
    'super_admin'::public.member_role as role
FROM public.orgs o
CROSS JOIN auth.users u
WHERE u.email = 'gilles.guerrin@a2display.fr'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- 5. Ajouter gilles.guerrin49@gmail.com comme operator dans orgA seulement
INSERT INTO public.org_members (org_id, user_id, role)
SELECT 
    o.id as org_id,
    u.id as user_id,
    'operator'::public.member_role as role
FROM public.orgs o
CROSS JOIN auth.users u
WHERE o.slug = 'orgA' 
  AND u.email = 'gilles.guerrin49@gmail.com'
ON CONFLICT (org_id, user_id) DO UPDATE SET role = EXCLUDED.role;

-- 6. Vérification des rôles mis à jour
SELECT 
    u.email,
    o.name as org_name,
    o.slug as org_slug,
    om.role
FROM public.org_members om
JOIN public.orgs o ON o.id = om.org_id
JOIN auth.users u ON u.id = om.user_id
WHERE u.email IN ('gilles.guerrin@a2display.fr', 'gilles.guerrin49@gmail.com')
ORDER BY u.email, o.name;

-- 7. Vérification du nombre total de membres par organisation
SELECT 
    o.name as org_name,
    o.slug as org_slug,
    COUNT(om.user_id) as member_count,
    COUNT(CASE WHEN om.role = 'super_admin' THEN 1 END) as super_admin_count,
    COUNT(CASE WHEN om.role = 'operator' THEN 1 END) as operator_count
FROM public.orgs o
LEFT JOIN public.org_members om ON o.id = om.org_id
GROUP BY o.id, o.name, o.slug
ORDER BY o.name;
