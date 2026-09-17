-- Normalize Discogs master IDs first so whitespace variants cannot bypass uniqueness.
update public.albums
set discogs_master_id = nullif(btrim(discogs_master_id),'')
where discogs_master_id is distinct from nullif(btrim(discogs_master_id),'');

-- Build a temporary map from duplicate album rows to the canonical row that
-- should survive. Prefer the richest tracklist, then metadata completeness,
-- then the amount of user data already pointing at the row.
create temporary table _album_dedupe_map on commit drop as
with stats as (
  select
    a.id,
    a.discogs_master_id,
    a.created_at,
    (select count(*) from public.tracks t where t.album_id=a.id) as track_count,
    (select count(*) from public.collections c where c.album_id=a.id) as collection_count,
    (select count(*) from public.wishlists w where w.album_id=a.id) as wishlist_count,
    (select count(*) from public.album_ratings r where r.album_id=a.id) as rating_count,
    ((a.artist_id is not null)::int
      + (a.release_year is not null)::int
      + (nullif(btrim(a.genre),'') is not null)::int
      + (nullif(btrim(a.cover_url),'') is not null)::int
      + (nullif(btrim(a.apple_collection_url),'') is not null)::int) as completeness
  from public.albums a
  where a.discogs_master_id is not null
), ranked as (
  select
    s.*,
    row_number() over (
      partition by s.discogs_master_id
      order by
        s.track_count desc,
        s.completeness desc,
        (s.collection_count+s.wishlist_count+s.rating_count) desc,
        s.created_at asc nulls last,
        s.id asc
    ) as rn
  from stats s
), canonical as (
  select discogs_master_id,id as canonical_id
  from ranked
  where rn=1
)
select r.id as duplicate_id,c.canonical_id,r.discogs_master_id
from ranked r
join canonical c using (discogs_master_id)
where r.id<>c.canonical_id;

create index on _album_dedupe_map(duplicate_id);
create index on _album_dedupe_map(canonical_id);

-- Fill any missing canonical album metadata from a duplicate before removing it.
update public.albums c
set
  artist_id = coalesce(c.artist_id, (
    select a.artist_id from _album_dedupe_map m
    join public.albums a on a.id=m.duplicate_id
    where m.canonical_id=c.id and a.artist_id is not null
    order by a.id limit 1
  )),
  release_year = coalesce(c.release_year, (
    select a.release_year from _album_dedupe_map m
    join public.albums a on a.id=m.duplicate_id
    where m.canonical_id=c.id and a.release_year is not null
    order by a.id limit 1
  )),
  genre = coalesce(nullif(btrim(c.genre),''), (
    select a.genre from _album_dedupe_map m
    join public.albums a on a.id=m.duplicate_id
    where m.canonical_id=c.id and nullif(btrim(a.genre),'') is not null
    order by a.id limit 1
  )),
  cover_url = coalesce(nullif(btrim(c.cover_url),''), (
    select a.cover_url from _album_dedupe_map m
    join public.albums a on a.id=m.duplicate_id
    where m.canonical_id=c.id and nullif(btrim(a.cover_url),'') is not null
    order by a.id limit 1
  )),
  apple_collection_url = coalesce(nullif(btrim(c.apple_collection_url),''), (
    select a.apple_collection_url from _album_dedupe_map m
    join public.albums a on a.id=m.duplicate_id
    where m.canonical_id=c.id and nullif(btrim(a.apple_collection_url),'') is not null
    order by a.id limit 1
  ))
where exists (select 1 from _album_dedupe_map m where m.canonical_id=c.id);

-- If a user somehow has multiple collection rows that collapse to the same
-- canonical album, keep the row with the most pressing metadata and then the
-- oldest row. There were no such conflicts before this migration, but this
-- keeps the operation safe and repeatable.
with candidates as (
  select
    c.id,
    coalesce(m.canonical_id,c.album_id) as target_album_id,
    row_number() over (
      partition by c.user_id,coalesce(m.canonical_id,c.album_id)
      order by
        ((c.discogs_release_id is not null)::int
         +(nullif(btrim(c.catalog_number),'') is not null)::int
         +(nullif(btrim(c.pressing_country),'') is not null)::int
         +(c.pressing_year is not null)::int
         +(nullif(btrim(c.matrix_runout_a),'') is not null)::int
         +(nullif(btrim(c.matrix_runout_b),'') is not null)::int) desc,
        c.added_at asc nulls last,
        c.id asc
    ) as rn
  from public.collections c
  left join _album_dedupe_map m on m.duplicate_id=c.album_id
  where m.duplicate_id is not null
     or exists (select 1 from _album_dedupe_map x where x.canonical_id=c.album_id)
)
delete from public.collections c
using candidates x
where c.id=x.id and x.rn>1;

update public.collections c
set album_id=m.canonical_id
from _album_dedupe_map m
where c.album_id=m.duplicate_id;

-- Wishlist rows are simpler: keep the earliest row for any duplicate collision.
with candidates as (
  select
    w.id,
    row_number() over (
      partition by w.user_id,coalesce(m.canonical_id,w.album_id)
      order by w.added_at asc nulls last,w.id asc
    ) as rn
  from public.wishlists w
  left join _album_dedupe_map m on m.duplicate_id=w.album_id
  where m.duplicate_id is not null
     or exists (select 1 from _album_dedupe_map x where x.canonical_id=w.album_id)
)
delete from public.wishlists w
using candidates x
where w.id=x.id and x.rn>1;

update public.wishlists w
set album_id=m.canonical_id
from _album_dedupe_map m
where w.album_id=m.duplicate_id;

-- For duplicate ratings from the same user, preserve the most recently created
-- rating before collapsing the album IDs. Five such conflicts existed.
with candidates as (
  select
    r.id,
    row_number() over (
      partition by r.user_id,coalesce(m.canonical_id,r.album_id)
      order by r.created_at desc nulls last,r.id desc
    ) as rn
  from public.album_ratings r
  left join _album_dedupe_map m on m.duplicate_id=r.album_id
  where m.duplicate_id is not null
     or exists (select 1 from _album_dedupe_map x where x.canonical_id=r.album_id)
)
delete from public.album_ratings r
using candidates x
where r.id=x.id and x.rn>1;

update public.album_ratings r
set album_id=m.canonical_id
from _album_dedupe_map m
where r.album_id=m.duplicate_id;

-- The canonical album was deliberately chosen to have the richest tracklist,
-- so discard duplicate tracklists rather than merging identical songs twice.
delete from public.tracks t
using _album_dedupe_map m
where t.album_id=m.duplicate_id;

-- All dependent data now points at canonical album IDs.
delete from public.albums a
using _album_dedupe_map m
where a.id=m.duplicate_id;

-- The old non-unique helper index is now redundant. Replace it with a unique
-- partial index so the same Discogs master cannot be inserted twice again.
drop index if exists public.albums_discogs_master_id_idx;
create unique index albums_discogs_master_id_uidx
  on public.albums (discogs_master_id)
  where discogs_master_id is not null;
