-- Adopt explicit Data API exposure for future public objects before Supabase
-- enforces the new default on existing projects on 2026-10-30.
alter default privileges for role postgres in schema public
  revoke select, insert, update, delete on tables from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
  revoke usage, select on sequences from anon, authenticated, service_role;

-- The shared catalog is now written only through controlled backend code.
drop policy if exists "Authenticated users can insert albums" on public.albums;
drop policy if exists "Authenticated users can insert artists" on public.artists;
drop policy if exists "Authenticated users can insert tracks" on public.tracks;

-- Make Data API privileges explicit instead of relying on historical broad defaults.
revoke all on table public.album_ratings from anon, authenticated;
grant select, insert, update, delete on table public.album_ratings to authenticated;

revoke all on table public.albums from anon, authenticated;
grant select on table public.albums to authenticated;

revoke all on table public.artists from anon, authenticated;
grant select on table public.artists to authenticated;

revoke all on table public.collections from anon, authenticated;
grant select, insert, update, delete on table public.collections to authenticated;

revoke all on table public.tracks from anon, authenticated;
grant select on table public.tracks to authenticated;

revoke all on table public.wishlists from anon, authenticated;
grant select, insert, update, delete on table public.wishlists to authenticated;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert, update, delete on table public.profiles to authenticated;

revoke all on table public.shelves from anon, authenticated;
grant select on table public.shelves to anon, authenticated;
grant insert, update, delete on table public.shelves to authenticated;

revoke all on table public.user_follows from anon, authenticated;
grant select, insert, delete on table public.user_follows to authenticated;

revoke all on table public.notifications from anon, authenticated;
grant select, update, delete on table public.notifications to authenticated;

revoke all on table public.musicbrainz_catalog from anon, authenticated;
grant select on table public.musicbrainz_catalog to anon, authenticated;

revoke all on table public.apple_artwork_cache from anon, authenticated;
grant select on table public.apple_artwork_cache to anon, authenticated;

revoke all on all sequences in schema public from anon, authenticated;
grant usage, select on sequence public.album_ratings_id_seq to authenticated;
grant usage, select on sequence public.collections_id_seq to authenticated;
grant usage, select on sequence public.wishlists_id_seq to authenticated;
