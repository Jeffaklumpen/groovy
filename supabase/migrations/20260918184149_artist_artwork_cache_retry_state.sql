alter table public.artist_profile_cache
  add column if not exists artwork_checked_at timestamptz,
  add column if not exists artwork_eligible_count integer not null default 0,
  add column if not exists artwork_cached_count integer not null default 0;
