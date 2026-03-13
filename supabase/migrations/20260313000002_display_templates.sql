-- Migration B : Bibliothèque de templates d'affichage par sport
-- display_templates  : définitions centrales des templates (insérées par l'admin / seed)
-- team_display_settings : association équipe → template sélectionné par l'opérateur

-- ─── Table display_templates ────────────────────────────────────────────────

create table if not exists public.display_templates (
  id          uuid primary key default gen_random_uuid(),
  code        text not null unique,          -- identifiant machine : rugby_stade, rugby_expert, basket_arena…
  name        text not null,                 -- libellé affiché dans l'UI
  sport       text,                          -- sport cible (null = tous sports)
  layout_mode text not null,                 -- valeur injectée dans ScoreboardContext.layout_mode
  config_json jsonb not null default '{}',   -- options booléennes complémentaires (show_*, theme, etc.)
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now()
);

alter table public.display_templates enable row level security;

-- Lecture publique des templates (utile pour le display app et l'operator)
create policy "display_templates: lecture publique"
  on public.display_templates for select
  using (true);

-- ─── Table team_display_settings ────────────────────────────────────────────

create table if not exists public.team_display_settings (
  id          uuid primary key default gen_random_uuid(),
  team_id     uuid not null references public.teams(id) on delete cascade,
  template_id uuid references public.display_templates(id) on delete set null,
  layout_mode text,                          -- surcharge directe si pas de template
  theme       text not null default 'dark',
  config_json jsonb not null default '{}',
  updated_at  timestamptz not null default now(),
  unique (team_id)
);

alter table public.team_display_settings enable row level security;

-- Lecture par les membres authentifiés
create policy "team_display_settings: lecture membres"
  on public.team_display_settings for select
  to authenticated
  using (true);

-- Écriture réservée aux membres de l'org propriétaire de l'équipe
create policy "team_display_settings: ecriture operateur"
  on public.team_display_settings for all
  to authenticated
  using (
    exists (
      select 1 from public.teams t
      join public.org_members om on om.org_id = t.org_id
      where t.id = team_display_settings.team_id
        and om.user_id = auth.uid()
        and om.role in ('admin', 'operator', 'owner')
    )
  );

-- ─── Seed : templates prédéfinis ────────────────────────────────────────────

insert into public.display_templates (code, name, sport, layout_mode, config_json, sort_order)
values
  (
    'rugby_stade',
    'Rugby LED Stade',
    'rugby',
    'rugby_stade',
    '{"theme":"dark","show_score":true,"show_clock":true,"show_period":true,"show_status":true,"show_lower_third":true,"show_logos":true,"show_sponsors":true,"show_cards":true}',
    10
  ),
  (
    'rugby_expert',
    'Rugby Expert',
    'rugby',
    'rugby_expert',
    '{"theme":"dark","show_score":true,"show_clock":true,"show_period":true,"show_status":true,"show_lower_third":true,"show_logos":true,"show_sponsors":true,"show_cards":true}',
    20
  ),
  (
    'basket_arena',
    'Basket Arena',
    'basket',
    'arena',
    '{"theme":"dark","show_score":true,"show_clock":true,"show_period":true,"show_status":true,"show_lower_third":true,"show_logos":true,"show_sponsors":true,"show_team_fouls":true,"show_timeouts":true,"show_bonus":true,"show_shot_clock":true}',
    30
  ),
  (
    'football_stade',
    'Football Stade',
    'football',
    'stadium',
    '{"theme":"dark","show_score":true,"show_clock":true,"show_period":true,"show_status":true,"show_lower_third":true,"show_logos":true,"show_sponsors":true,"show_cards":true}',
    40
  ),
  (
    'handball_classic',
    'Handball Classique',
    'handball',
    'arena',
    '{"theme":"dark","show_score":true,"show_clock":true,"show_period":true,"show_status":true,"show_lower_third":true,"show_logos":true,"show_sponsors":true,"show_team_fouls":true,"show_timeouts":true,"show_cards":true}',
    50
  ),
  (
    'volley_sets',
    'Volley Sets',
    'volleyball',
    'volley',
    '{"theme":"dark","show_score":true,"show_clock":false,"show_period":true,"show_status":true,"show_lower_third":true,"show_logos":true,"show_sponsors":true,"show_sets":true}',
    60
  )
on conflict (code) do update set
  name        = excluded.name,
  layout_mode = excluded.layout_mode,
  config_json = excluded.config_json,
  sort_order  = excluded.sort_order;
