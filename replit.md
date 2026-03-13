# scoreDisplay — Replit Project

## Overview
A multi-app scoreboard platform ("scoreDisplay") built as a pnpm monorepo with 4 Vite/React apps, all connected to Supabase for backend data.

## Architecture

### Apps (in `apps/`)
- **home** (port 5000) — Main entry hub. Login page that routes users to the right app based on their role. **This is the primary app exposed in Replit.**
- **admin** — Super-admin dashboard for managing organizations, members, and sports.
- **operator** — Match management: scores, timers, public display control.
- **display** — Public scoreboard display (TV/LED screens).

### Shared Packages (in `packages/`)
- **types** — Shared TypeScript types
- **logic** — Shared business logic
- **supa** — Shared Supabase client utilities

## Package Manager
**pnpm** (workspace). Each app has its own `package.json`. Root `pnpm-workspace.yaml` links everything.

## Running the App
The main workflow runs the `home` app:
```
cd apps/home && npm run dev
```
Port: **5000** (webview)

## Environment Variables
- `VITE_SUPABASE_URL` — Supabase project URL (set in shared env)
- `VITE_SUPABASE_ANON_KEY` — Supabase public anon key (set in shared env)

## Replit Migration Notes
- All vite configs updated with `host: "0.0.0.0"` and `allowedHosts: true` for Replit proxy compatibility
- Home app runs on port 5000 (required for Replit webview)
- Other apps (admin, operator, display) use port 5173 when run independently
- Supabase credentials stored as shared environment variables

## Key Files
- `apps/home/src/App.tsx` — Home hub entry point (login + org selection)
- `apps/admin/src/App.tsx` — Admin panel routes
- `apps/operator/src/App.tsx` — Operator panel
- `apps/display/src/App.tsx` — Display screen
- `.env.example` — Template for environment variables
