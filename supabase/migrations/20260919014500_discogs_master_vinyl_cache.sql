create table if not exists public.discogs_master_vinyl_cache (
  discogs_master_id bigint primary key,
  has_vinyl boolean not null,
  vinyl_release_id bigint,
  checked_at timestamptz not null default now(),
  constraint discogs_master_vinyl_cache_master_positive check (discogs_master_id > 0),
  constraint discogs_master_vinyl_cache_release_positive check (vinyl_release_id is null or vinyl_release_id > 0)
);

alter table public.discogs_master_vinyl_cache enable row level security;

revoke all on table public.discogs_master_vinyl_cache from public,anon,authenticated;
grant select,insert,update,delete on table public.discogs_master_vinyl_cache to service_role;

create index if not exists discogs_master_vinyl_cache_checked_at_idx
  on public.discogs_master_vinyl_cache (checked_at);
