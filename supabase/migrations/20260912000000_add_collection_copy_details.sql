-- Details describe a user's physical copy, never the shared album record.
alter table public.collections
  add column if not exists discogs_release_id bigint,
  add column if not exists media_condition text,
  add column if not exists sleeve_condition text,
  add column if not exists pressing_country text,
  add column if not exists pressing_year integer,
  add column if not exists pressing_label text,
  add column if not exists catalog_number text,
  add column if not exists matrix_runout_a text,
  add column if not exists matrix_runout_b text,
  add column if not exists pressing_match_status text;

alter table public.collections
  drop constraint if exists collections_media_condition_check,
  add constraint collections_media_condition_check
    check (media_condition is null or media_condition in ('M','NM','VG+','VG','G+','G','F','P')),
  drop constraint if exists collections_sleeve_condition_check,
  add constraint collections_sleeve_condition_check
    check (sleeve_condition is null or sleeve_condition in ('M','NM','VG+','VG','G+','G','F','P','NO_COVER')),
  drop constraint if exists collections_pressing_match_status_check,
  add constraint collections_pressing_match_status_check
    check (pressing_match_status is null or pressing_match_status in ('discogs'));

create index if not exists collections_discogs_release_id_idx
  on public.collections (discogs_release_id)
  where discogs_release_id is not null;
