# Scoreboard Supabase Pro
Monorepo Vite (Operator + Display) utilisant Supabase (Auth + Realtime + Postgres).
- Auth par association (espaces) via `orgs` / `org_members` (+ super admin)
- Création de match → URL Display publique (token)
- Tous les contrôles sports opérationnels
- SQL: voir `supabase/`

## Lancer
pnpm install
cp .env.example .env
pnpm run dev
