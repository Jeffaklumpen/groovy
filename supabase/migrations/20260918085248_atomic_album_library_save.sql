create unique index if not exists artists_name_normalized_uidx
  on public.artists (lower(btrim(name)));

create or replace function public.save_album_to_library(
  p_destination text,
  p_discogs_master_id text,
  p_artist_name text,
  p_album_title text,
  p_release_year integer default null,
  p_genre text default null,
  p_cover_url text default null,
  p_cover_source text default null,
  p_apple_collection_url text default null,
  p_tracks jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_destination text := lower(btrim(coalesce(p_destination,'')));
  v_master_id text := btrim(coalesce(p_discogs_master_id,''));
  v_artist_name text := left(btrim(coalesce(p_artist_name,'')),300);
  v_album_title text := left(btrim(coalesce(p_album_title,'')),500);
  v_genre text := nullif(left(btrim(coalesce(p_genre,'')),300),'');
  v_cover_url text := nullif(left(btrim(coalesce(p_cover_url,'')),1500),'');
  v_cover_source text := lower(btrim(coalesce(p_cover_source,'')));
  v_apple_url text := nullif(left(btrim(coalesce(p_apple_collection_url,'')),1500),'');
  v_release_year integer := p_release_year;
  v_artist_id bigint;
  v_album_id bigint;
  v_entry_id bigint;
  v_next_order integer;
  v_track jsonb;
  v_track_side text;
  v_track_number integer;
  v_track_title text;
  v_inserted boolean := false;
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if v_destination not in ('collection','wishlist') then raise exception 'Invalid destination'; end if;
  if v_master_id = '' or v_master_id !~ '^[0-9]{1,20}$' then raise exception 'Invalid Discogs master ID'; end if;
  if v_artist_name = '' or v_album_title = '' then raise exception 'Artist and album title are required'; end if;

  if v_release_year is not null and (v_release_year < 1800 or v_release_year > 2100) then v_release_year := null; end if;
  if v_cover_url is not null and v_cover_url !~* '^https://' then raise exception 'Invalid cover URL'; end if;
  if v_apple_url is not null and v_apple_url !~* '^https://(music|itunes)\.apple\.com/' then raise exception 'Invalid Apple Music URL'; end if;

  if p_tracks is null then p_tracks := '[]'::jsonb; end if;
  if jsonb_typeof(p_tracks) <> 'array' then raise exception 'Tracks must be a JSON array'; end if;
  if jsonb_array_length(p_tracks) > 500 then raise exception 'Too many tracks'; end if;

  perform pg_advisory_xact_lock(hashtext('groovy-artist:' || lower(v_artist_name)));

  select a.id into v_artist_id
  from public.artists a
  where lower(btrim(a.name)) = lower(v_artist_name)
  order by a.id
  limit 1;

  if v_artist_id is null then
    insert into public.artists(name) values (v_artist_name)
    returning id into v_artist_id;
  end if;

  perform pg_advisory_xact_lock(hashtext('groovy-album:' || v_master_id));

  insert into public.albums(
    artist_id,title,release_year,genre,cover_url,discogs_master_id,apple_collection_url
  )
  values(
    v_artist_id,v_album_title,v_release_year,v_genre,v_cover_url,v_master_id,v_apple_url
  )
  on conflict (discogs_master_id) where discogs_master_id is not null
  do update set
    genre = coalesce(excluded.genre, public.albums.genre),
    apple_collection_url = coalesce(excluded.apple_collection_url, public.albums.apple_collection_url),
    cover_url = case
      when v_cover_source = 'apple' and excluded.cover_url is not null then excluded.cover_url
      else public.albums.cover_url
    end
  returning id into v_album_id;

  for v_track in select value from jsonb_array_elements(p_tracks)
  loop
    v_track_side := upper(left(btrim(coalesce(v_track->>'disc_side','')),1));
    if v_track_side not in ('A','B','C','D','E','F','G','H') then continue; end if;

    begin
      v_track_number := nullif(v_track->>'track_number','')::integer;
    exception when others then
      v_track_number := null;
    end;

    if v_track_number is not null and (v_track_number < 1 or v_track_number > 999) then v_track_number := null; end if;

    v_track_title := left(btrim(coalesce(v_track->>'title','')),500);
    if v_track_title = '' then continue; end if;

    if not exists (
      select 1 from public.tracks t
      where t.album_id = v_album_id
        and coalesce(t.disc_side,'') = v_track_side
        and coalesce(t.track_number,-1) = coalesce(v_track_number,-1)
        and lower(btrim(t.title)) = lower(v_track_title)
    ) then
      insert into public.tracks(album_id,disc_side,track_number,title)
      values(v_album_id,v_track_side,v_track_number,v_track_title);
    end if;
  end loop;

  perform pg_advisory_xact_lock(hashtext('groovy-library:' || v_user_id::text || ':' || v_destination));

  if v_destination = 'wishlist' then
    select c.id into v_entry_id
    from public.collections c
    where c.user_id = v_user_id and c.album_id = v_album_id
    limit 1;

    if v_entry_id is not null then
      return jsonb_build_object('status','collection','album_id',v_album_id,'entry_id',v_entry_id,'inserted',false);
    end if;

    select w.id into v_entry_id
    from public.wishlists w
    where w.user_id = v_user_id and w.album_id = v_album_id
    limit 1;

    if v_entry_id is null then
      select coalesce(max(w.sort_order),0)+1 into v_next_order
      from public.wishlists w where w.user_id = v_user_id;

      insert into public.wishlists(user_id,album_id,cover_url,discogs_style,sort_order)
      values(v_user_id,v_album_id,v_cover_url,v_genre,v_next_order)
      returning id into v_entry_id;

      v_inserted := true;
    end if;

    return jsonb_build_object('status','wishlist','album_id',v_album_id,'entry_id',v_entry_id,'inserted',v_inserted);
  end if;

  select c.id into v_entry_id
  from public.collections c
  where c.user_id = v_user_id and c.album_id = v_album_id
  limit 1;

  if v_entry_id is null then
    select coalesce(max(c.sort_order),0)+1 into v_next_order
    from public.collections c where c.user_id = v_user_id;

    insert into public.collections(user_id,album_id,cover_url,discogs_style,sort_order)
    values(v_user_id,v_album_id,v_cover_url,v_genre,v_next_order)
    returning id into v_entry_id;

    v_inserted := true;
  end if;

  return jsonb_build_object('status','collection','album_id',v_album_id,'entry_id',v_entry_id,'inserted',v_inserted);
end;
$function$;

revoke execute on function public.save_album_to_library(
  text,text,text,text,integer,text,text,text,text,jsonb
) from public, anon, authenticated;

grant execute on function public.save_album_to_library(
  text,text,text,text,integer,text,text,text,text,jsonb
) to authenticated;
