-- Foundation cleanup: add indexes for the access patterns used by GroovyShelves.
-- These are intentionally non-unique because existing shared catalogue data may
-- contain duplicate Discogs master IDs and should be cleaned separately.

create index if not exists musicbrainz_catalog_discogs_master_id_idx
  on public.musicbrainz_catalog (discogs_master_id)
  where discogs_master_id is not null;

create index if not exists albums_discogs_master_id_idx
  on public.albums (discogs_master_id)
  where discogs_master_id is not null and btrim(discogs_master_id) <> '';

create index if not exists albums_artist_id_idx
  on public.albums (artist_id);

create index if not exists tracks_album_id_idx
  on public.tracks (album_id);

create index if not exists album_ratings_album_id_idx
  on public.album_ratings (album_id);

create index if not exists collections_album_id_idx
  on public.collections (album_id);

create index if not exists collections_shelf_id_idx
  on public.collections (shelf_id)
  where shelf_id is not null;

create index if not exists collections_user_sort_order_idx
  on public.collections (user_id, sort_order);

create index if not exists wishlists_user_sort_order_idx
  on public.wishlists (user_id, sort_order);
