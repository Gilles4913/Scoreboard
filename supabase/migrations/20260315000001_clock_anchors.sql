begin;

alter table public.matches
  add column if not exists clock_anchor_epoch_ms bigint null,
  add column if not exists clock_anchor_clock_ms integer null;

create index if not exists idx_matches_clock_anchor_epoch_ms
  on public.matches(clock_anchor_epoch_ms);

commit;
