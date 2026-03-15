begin;

alter table public.org_display_settings
  add column if not exists show_live_badge boolean not null default false;

alter table public.org_display_sport_profiles
  add column if not exists show_live_badge boolean null;

update public.org_display_sport_profiles
set show_live_badge = false
where sport in ('rugby', 'football')
  and show_live_badge is null;

commit;
