-- Remove runtime objects that only existed for the retired artist page.
-- Earlier artist migrations remain as immutable history so fresh databases can
-- replay the same sequence and end in this cleaned-up state.

drop function if exists public.get_artist_overview(text);

drop trigger if exists normalize_apple_artwork_cache_url_trigger
  on public.apple_artwork_cache;
drop function if exists private.normalize_apple_artwork_cache_url();

drop table if exists public.artist_discography_cache;
drop table if exists public.artist_profile_cache;
drop table if exists public.discogs_master_vinyl_cache;

drop index if exists public.musicbrainz_catalog_artist_name_normalized_idx;
drop index if exists public.artists_discogs_artist_id_uidx;

alter table public.artists
  drop column if exists discogs_artist_id;
