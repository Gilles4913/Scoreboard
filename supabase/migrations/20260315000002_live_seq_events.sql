-- CONTRAT LIVE GLOBAL : alignement des séquences dominantes
-- match_events.seq existe déjà ; on sécurise l'index si absent.
-- match_substitutions.seq : nouvelle colonne pour corréler overlay ↔ seq dominant.

begin;

-- match_events : index de recherche sur (match_id, seq)
create index if not exists idx_match_events_match_id_seq
  on public.match_events (match_id, seq);

-- match_substitutions : colonne seq pour traçabilité overlay
alter table public.match_substitutions
  add column if not exists seq bigint null;

create index if not exists idx_match_substitutions_match_id_seq
  on public.match_substitutions (match_id, seq);

commit;
