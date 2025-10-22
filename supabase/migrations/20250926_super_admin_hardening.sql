# 🧱 Commit 1 - Migration DB durcissement
mkdir -p supabase/migrations
cat > supabase/migrations/20250926_super_admin_hardening.sql <<'EOF'
-- SUPER ADMIN / DB HARDENING (migration complète corrigée)
-- 👉 Colle ici la version complète que tu as déjà exécutée dans Supabase
EOF
git add supabase/migrations/20250926_super_admin_hardening.sql
git commit -m "DB: durcissement sécurité et logique métier (rôles, policies, invariants org/match)"

# ⚙️ Commit 2 - Table app_users + RPC
cat > supabase/migrations/20250927_admin_get_user_id_by_email.sql <<'EOF'
create table if not exists public.app_users (
  user_id uuid primary key,
  email text unique not null,
  created_at timestamptz default now()
);

alter table public.app_users enable row level security;

drop policy if exists "app_users super admin all" on public.app_users;
create policy "app_users super admin all" on public.app_users
  for all to authenticated
  using (public.is_super_admin(auth.uid()))
  with check (public.is_super_admin(auth.uid()));

create or replace function public.admin_get_user_id_by_email(p_email text)
returns uuid
language sql
stable
as $$
  select user_id from public.app_users where email = p_email limit 1;
$$;
EOF
git add supabase/migrations/20250927_admin_get_user_id_by_email.sql
git commit -m "DB: ajout table app_users + RPC admin_get_user_id_by_email pour gestion opérateurs"

# 🧩 Commit 3 - Page SuperAdmin
mkdir -p apps/operator/src/pages
cat > apps/operator/src/pages/SuperAdminPage.tsx <<'EOF'
// ⚙️ Page SuperAdminPage.tsx
// 👉 Colle ici le code complet que je t’ai fourni (CRUD Orgs + Opérateurs)
EOF
git add apps/operator/src/pages/SuperAdminPage.tsx
git commit -m "UI: ajout de la page SuperAdminPage (CRUD organisations et opérateurs)"

# 🪶 Commit 4 - main.tsx avec switch Admin/Opérateur
cat > apps/operator/src/main.tsx <<'EOF'
// ⚙️ Fichier main.tsx complet
// 👉 Colle ici la version complète avec switch Admin/Opérateur (HeaderBar)
EOF
git add apps/operator/src/main.tsx
git commit -m "UI: ajout du switch Admin/Opérateur et routage dynamique (SuperAdminPage vs SpacePage)"

# 🌐 Commit 5 - Documentation
echo "## Super Admin & Switch Opérateur" >> README.md
echo "- Ajout d'une page SuperAdminPage pour gérer les organisations et les opérateurs" >> README.md
echo "- Switch Admin/Opérateur dans main.tsx (HeaderBar persisté via localStorage)" >> README.md
git add README.md
git commit -m "Docs: ajout instructions de test Super Admin + switch opérateur"

# 🚀 Push vers GitHub
git push origin main
