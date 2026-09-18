alter table public.artists
  add column if not exists discogs_artist_id bigint;

create unique index if not exists artists_discogs_artist_id_uidx
  on public.artists(discogs_artist_id)
  where discogs_artist_id is not null;

create index if not exists musicbrainz_catalog_artist_name_normalized_idx
  on public.musicbrainz_catalog(lower(btrim(artist_name)));

create or replace function public.get_artist_overview(p_artist_name text)
returns jsonb
language plpgsql
stable
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_requested_name text := btrim(coalesce(p_artist_name,''));
  v_artist_id bigint;
  v_artist_name text;
  v_discogs_artist_id bigint;
  v_summary jsonb;
  v_genres jsonb;
  v_discography jsonb;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if v_requested_name='' then raise exception 'Artist name is required'; end if;

  select a.id,a.name,a.discogs_artist_id
    into v_artist_id,v_artist_name,v_discogs_artist_id
  from public.artists a
  where lower(btrim(a.name))=lower(v_requested_name)
  limit 1;

  v_artist_name:=coalesce(v_artist_name,v_requested_name);

  select jsonb_build_object(
    'artist_id',v_artist_id,'name',v_artist_name,'discogs_artist_id',v_discogs_artist_id,
    'collected_records',case when v_artist_id is null then 0 else (
      select count(*)::bigint from public.collections c join public.albums a on a.id=c.album_id where a.artist_id=v_artist_id
    ) end,
    'collectors',case when v_artist_id is null then 0 else (
      select count(distinct c.user_id)::bigint from public.collections c join public.albums a on a.id=c.album_id where a.artist_id=v_artist_id
    ) end,
    'wishlisted_records',case when v_artist_id is null then 0 else (
      select count(*)::bigint from public.wishlists w join public.albums a on a.id=w.album_id where a.artist_id=v_artist_id
    ) end,
    'groovy_albums',case when v_artist_id is null then 0 else (
      select count(*)::bigint from public.albums a where a.artist_id=v_artist_id
    ) end
  ) into v_summary;

  if v_artist_id is null then
    v_genres:='[]'::jsonb;
  else
    with tokens as (
      select lower(btrim(t.genre)) as normalized_genre,btrim(t.genre) as label
      from public.albums a
      cross join lateral regexp_split_to_table(coalesce(nullif(btrim(a.genre),''),''),E'\\s*[·,]\\s*') as t(genre)
      where a.artist_id=v_artist_id and btrim(t.genre)<>''
    ),
    ranked as (
      select min(label) as label,count(*) as uses
      from tokens group by normalized_genre order by uses desc,label limit 4
    )
    select coalesce(jsonb_agg(label order by uses desc,label),'[]'::jsonb) into v_genres from ranked;
  end if;

  with source_rows as (
    select mb.mbid,mb.discogs_master_id,mb.album_title,mb.first_release_year,
      nullif(btrim(mb.secondary_types),'') as secondary_types,
      row_number() over (
        partition by coalesce(mb.discogs_master_id::text,lower(btrim(mb.album_title))||'|'||coalesce(mb.first_release_year::text,''))
        order by case when mb.match_type='direct' then 0 else 1 end,mb.mbid
      ) as rn
    from public.musicbrainz_catalog mb
    where lower(btrim(mb.artist_name))=lower(btrim(v_artist_name))
      and (nullif(btrim(mb.secondary_types),'') is null or btrim(mb.secondary_types)='Soundtrack')
      and lower(mb.album_title) not like '%film soundtrack%'
      and lower(mb.album_title) not like '%motion picture soundtrack%'
  ),
  rating_summary as (
    select r.album_id,round(avg(r.rating)::numeric,1) as average_rating,count(*)::bigint as rating_count
    from public.album_ratings r where r.rating between 1 and 5 group by r.album_id
  ),
  rows as (
    select s.mbid,s.discogs_master_id,s.album_title as title,s.first_release_year as year,s.secondary_types,
      a.id as album_id,a.cover_url,a.apple_collection_url,
      coalesce(rs.average_rating,0) as average_rating,coalesce(rs.rating_count,0) as rating_count,
      exists(select 1 from public.collections c where c.user_id=v_user_id and c.album_id=a.id) as is_collected,
      exists(select 1 from public.wishlists w where w.user_id=v_user_id and w.album_id=a.id) as is_wishlisted
    from source_rows s
    left join public.albums a on a.discogs_master_id=s.discogs_master_id::text
    left join rating_summary rs on rs.album_id=a.id
    where s.rn=1
    order by s.first_release_year nulls last,s.album_title
    limit 60
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'mbid',r.mbid,'discogs_master_id',r.discogs_master_id,'title',r.title,'year',r.year,
    'secondary_types',r.secondary_types,'album_id',r.album_id,'cover_url',r.cover_url,
    'apple_collection_url',r.apple_collection_url,'average_rating',r.average_rating,'rating_count',r.rating_count,
    'is_collected',r.is_collected,'is_wishlisted',r.is_wishlisted
  ) order by r.year nulls last,r.title),'[]'::jsonb) into v_discography from rows r;

  return jsonb_build_object('summary',coalesce(v_summary,'{}'::jsonb),'genres',coalesce(v_genres,'[]'::jsonb),'discography',coalesce(v_discography,'[]'::jsonb));
end;
$function$;

revoke execute on function public.get_artist_overview(text) from public,anon;
grant execute on function public.get_artist_overview(text) to authenticated,service_role;
