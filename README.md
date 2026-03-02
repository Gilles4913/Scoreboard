# ⚽ Scoreboard Pro — Multi-Sports Scoreboard Application

**Version**: 3.0.0
**Architecture**: Organisation → Teams → Matches
**Supported Sports**: Football, Basketball, Volleyball, Handball, Rugby

---

## 🎯 Overview

Scoreboard Pro is a professional real-time scoreboard application designed for sports organizations. It provides a complete solution for managing matches and displaying live scores with customizable settings.

### Key Features

- **🏢 Multi-Organization**: Isolated workspaces for different sports organizations
- **🏀 5 Professional Sports**: Native support for Football, Basketball, Volleyball, Handball, Rugby
- **👥 Team Management**: Centralized team database with logos, colors, and custom display settings
- **⚙️ Granular Display Settings**: Organization-level defaults with team-level overrides
- **🔴 Real-Time Updates**: WebSocket-based live score updates (Supabase Realtime)
- **🔒 Enterprise Security**: Row Level Security (RLS) for data isolation
- **📺 Public Display**: Secure token-based public viewing

---

## 📚 Documentation

**START HERE** 👉 [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) — Official functional reference (source of truth)

**Other docs**:
- [`PROMPT_BOLT_OFFICIEL.md`](./PROMPT_BOLT_OFFICIEL.md) — Official Bolt context prompt
- [`MIGRATION_MULTI_SPORTS.md`](./MIGRATION_MULTI_SPORTS.md) — Technical migration details
- [`GUIDE_MISE_A_JOUR.md`](./GUIDE_MISE_A_JOUR.md) — User migration guide

---

## 🏗️ Architecture

### Applications

```
apps/
├── operator/    # Match management interface (authenticated)
│               # - Create/edit matches
│               # - Live match control (score, clock)
│               # - Team management
│
└── display/     # Public display interface (anonymous + token)
                # - Real-time score display
                # - Customizable themes
                # - Auto-connect to active matches
```

### Shared Packages

```
packages/
├── types/      # Shared TypeScript types
├── logic/      # Business logic (state management, ticks, defaults)
└── supa/       # Supabase client wrapper
```

### Database

```
supabase/
└── migrations/ # Versioned SQL migrations
```

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Supabase account (or local Supabase setup)

### Installation

```bash
# Clone repository
git clone <repository-url>
cd scoreboard-pro

# Install dependencies
npm install

# Install app-specific dependencies
cd apps/operator && npm install
cd ../display && npm install
```

### Configuration

1. Create `.env` file in project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

2. Apply database migrations (already done if using hosted Supabase)

### Development

```bash
# Run operator app
npm run dev

# Or run display app
cd apps/display && npm run dev
```

### Build

```bash
# Build all apps
npm run build

# Build specific app
cd apps/operator && npm run build
```

---

## 🏀 Supported Sports

| Sport | Code | Duration | Features |
|-------|------|----------|----------|
| ⚽ Football | `football` | 2 × 45 min | Cards, substitutions, extra time, penalty shootout |
| 🏀 Basketball | `basket` | 4 × 10 min | Shot clock, fouls, timeouts, quarters |
| 🏐 Volleyball | `volleyball` | 5 sets | Sets, serve indicator, rotations |
| 🤾 Handball | `handball` | 2 × 30 min | 2-minute suspensions, timeouts |
| 🏉 Rugby | `rugby` | 2 × 40 min | Sin bin, detailed score breakdown, tries |

---

## 🔑 Key Concepts

### 1 Organization = 1 Sport

Each organization manages a single sport. This ensures consistency and simplifies team/match management.

### Team-Based Architecture

Matches reference teams (with logos, colors, display settings) rather than free-text names.

### Display Settings Inheritance

```
Organization Display Defaults (complete)
         ↓
   deepMerge with
         ↓
Team Display Overrides (partial)
         ↓
   Final Display Settings
```

Teams can override specific settings while inheriting the rest from their organization.

---

## 🛠️ Tech Stack

### Frontend
- **React 18** — UI framework
- **TypeScript** — Type safety
- **Vite 5** — Build tool & dev server
- **React Router** — Client-side routing

### Backend
- **Supabase** — Backend-as-a-Service
  - PostgreSQL database
  - Realtime (WebSocket)
  - Authentication
  - Row Level Security (RLS)

### State Management
- **Realtime Broadcast** — Ephemeral live state
- **React Hooks** — Local component state

---

## 🔒 Security

### Row Level Security (RLS)

All tables have RLS enabled with strict policies:

- **Organizations**: Members can only access their assigned organizations
- **Teams**: Org members manage their teams; public read for teams in public matches
- **Matches**: Org members manage their matches; public read for `public_display = true`

### Roles

- **Super Admin**: Global access across all organizations
- **Admin**: Manage organization and members
- **Operator**: Manage matches within assigned organizations

### Public Access

Display app accesses matches via:
- `public_display = true` flag
- Valid `display_token`
- Anonymous (no authentication required)

---

## 📂 Project Structure

```
scoreboard-pro/
├── apps/
│   ├── operator/              # Management interface
│   │   ├── src/
│   │   │   ├── pages/         # Route pages
│   │   │   ├── components/    # React components
│   │   │   └── supabase.ts    # Supabase client
│   │   └── vite.config.ts
│   │
│   └── display/               # Public display
│       ├── src/
│       │   ├── components/    # Scoreboard components
│       │   ├── themes.ts      # Display themes
│       │   └── main.tsx
│       └── vite.config.ts
│
├── packages/
│   ├── types/                 # Shared types
│   │   └── src/index.ts       # Sport, Org, Team, Match, DisplaySettings
│   │
│   ├── logic/                 # Business logic
│   │   └── src/
│   │       ├── index.ts       # initState, applyTick, defaults
│   │       └── displaySettings.ts  # deepMerge
│   │
│   └── supa/                  # Supabase client
│       └── src/index.ts
│
├── supabase/
│   └── migrations/            # SQL migrations
│       └── 20260226_org_sport_teams_display.sql
│
├── BIBLE_SCOREBOARD.md        # 📖 Official functional reference
├── PROMPT_BOLT_OFFICIEL.md    # 🤖 Bolt context prompt
├── MIGRATION_MULTI_SPORTS.md  # 🔧 Technical migration doc
├── GUIDE_MISE_A_JOUR.md       # 📝 User migration guide
└── package.json
```

---

## 🧪 Database Schema

### Core Tables

- **`profiles`** — User profiles (synced with auth.users)
- **`orgs`** — Organizations (1 sport each)
- **`org_members`** — User-organization memberships with roles
- **`teams`** — Teams belonging to organizations
- **`matches`** — Matches between teams

### Views

- **`org_members_with_org`** — Enriched members with org details
- **`matches_v`** — Enriched matches with org, teams, display settings

### Functions

- `set_updated_at()` — Auto-update `updated_at` timestamp
- `rand_token()` — Generate secure random tokens
- `handle_new_user()` — Auto-create profile on signup

---

## 🎨 Display Settings

### Common Settings (All Sports)

- Show team logos
- Show team colors
- Show player names/numbers
- Show events feed
- Show animations
- Show sponsor overlay

### Sport-Specific Examples

**Football**: Cards, substitutions, goal scorers, extra time, penalty shootout
**Basketball**: Quarter, shot clock, team fouls, timeouts, possession arrow
**Volleyball**: Sets, serve indicator, set/match point

See [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) for complete list.

---

## 🤝 Contributing

### Before Modifying

1. Read [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) — Understand invariants and ADRs
2. Check compatibility with existing architecture
3. Follow checklists (DB migration, display settings, sport addition)

### Pull Request Checklist

- [ ] Changes respect architectural invariants
- [ ] Database migration includes IF EXISTS/IF NOT EXISTS
- [ ] TypeScript types updated
- [ ] RLS policies updated (if new table)
- [ ] Tests pass
- [ ] Documentation updated

---

## 📄 License

MIT

---

## 🙏 Acknowledgments

Built with [Supabase](https://supabase.com), [Vite](https://vitejs.dev), and [React](https://react.dev).

---

**Questions?** Consult [`BIBLE_SCOREBOARD.md`](./BIBLE_SCOREBOARD.md) first — it's the source of truth!
