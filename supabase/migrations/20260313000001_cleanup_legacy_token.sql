-- Migration A : Suppression des colonnes legacy display_token et public_display
-- Ces champs ne sont plus utilisés depuis la suppression du mode public par token.
-- Le mode public repose désormais uniquement sur les URLs stables d'équipe (?teamSlug= / ?teamId=).

alter table public.matches
  drop column if exists public_display,
  drop column if exists display_token;

-- Nettoyer l'index éventuel sur display_token
drop index if exists public.matches_display_token_idx;
