delete from public.artist_discography_cache;

update public.artist_profile_cache
set
  wikidata_id=null,
  discography_checked_at=null,
  discography_source=null,
  discography_count=0,
  updated_at=now()
where discography_checked_at is not null
   or wikidata_id is not null
   or discography_source is not null
   or discography_count<>0;

alter table public.artist_discography_cache
  drop constraint if exists artist_discography_cache_source_check;

alter table public.artist_discography_cache
  add constraint artist_discography_cache_source_check
  check (source in ('wikipedia','wikidata','manual'));
