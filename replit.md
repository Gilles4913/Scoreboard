# scoreDisplay — Replit Project

## Overview
A multi-app scoreboard platform ("scoreDisplay V2") built as a pnpm monorepo with 4 Vite/React apps, all connected to Supabase for backend data.

## Architecture

### Apps (in `apps/`)
- **home** (port 5000) — Main entry hub. Login page that routes users to the right app based on their role. **This is the primary app exposed in Replit.**
- **admin** — Super-admin dashboard for managing organizations, members, and sports.
- **operator** — Match management: scores, timers, display settings.
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
All set as shared Replit env vars:
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
- `VITE_OPERATOR_URL`, `VITE_ADMIN_URL`, `VITE_DISPLAY_URL`, `VITE_DISPLAY_APP_URL`
- `VITE_HOME_URL`, `VITE_EDGE_CONTEXT_URL`, `VITE_TV_BROADCAST_URL`

## Replit Migration Notes
- All vite configs updated with `host: "0.0.0.0"` and `allowedHosts: true` for Replit proxy
- Home app runs on port 5000 (required for Replit webview)
- Other apps (admin, operator, display) use port 5173 when run independently

## Public Display Mode
- **Stable team URL only**: `?teamSlug=...` or `?teamId=...`
- No token mode, no `public_display` field — both fully removed
- Display app reads context from Edge Function `VITE_EDGE_CONTEXT_URL`

## Display Templates (layout_mode)
Scoreboard layouts supported in `apps/display/src/components/Scoreboard.tsx`:
- `rugby_stade` — Rugby LED: giant scores, team colors, clock, period, cards/sin bin (no breakdown)
- `rugby_expert` — Rugby Expert: like stade + essais/transformations/pénalités/drops/sin bin per team
- `stadium` — Generic dark stade layout (football, handball, etc.)
- `arena` — Arena premium (basket, handball)
- `compact` — Compact for small screens
- `volley` — Volleyball sets focus
- `tv-light` — Light editorial TV

Templates configured in operator **Paramètres d'affichage** → template cards (ThemeCardDef).

## Realtime Architecture
- **Operator broadcast**: `sendTvBroadcast(matchId, patch)` → edge function `tv-broadcast` → Supabase Realtime topic `match:${matchId}`
- **Display subscription**: `supabase.channel('match:${matchId}')` — topic must match exactly (no prefix)
- **Fallback**: `postgres_changes` UPDATE on `matches` table + polling every 3s in stable team mode
- **Chrono interpolation**: client-side in Display (counts down from `clock_ms` using `Date.now()`)

## Template Hierarchy (display_settings)
Merge order (lowest to highest priority):
1. Hardcoded defaults in `get-display-context`
2. `org_display_settings` (org-level)
3. `team_display_settings` → `display_templates.config_json` + `layout_mode` (team-level override)

## Database Migrations
Migrations are in `supabase/migrations/`. Recent additions:
- `20260313000001_cleanup_legacy_token.sql` — Drops `public_display` and `display_token` columns from `matches`
- `20260313000002_display_templates.sql` — Creates `display_templates` and `team_display_settings` tables with seed data
- `20260313000003_fix_rls_public_display.sql` — Fixes RLS policies that depended on `public_display`; allows anon read on matches + teams; recreates clean `matches_v` view

## Key Files
- `apps/home/src/App.tsx` — Home hub entry point (login + org selection)
- `apps/admin/src/App.tsx` — Admin panel routes
- `apps/operator/src/App.tsx` — Operator panel
- `apps/display/src/main.tsx` — Display orchestrator (teamSlug/teamId mode, realtime, chrono)
- `apps/display/src/components/Scoreboard.tsx` — Scoreboard component with all sport layouts
- `apps/operator/src/pages/DisplaySettingsPage.tsx` — Display template + sport settings
- `apps/operator/src/pages/ControlPage.tsx` — Live match control (2900+ lines)
- `supabase/schema.sql` — Full database schema
