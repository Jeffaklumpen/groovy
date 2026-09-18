create or replace function public.add_existing_album_to_library(
  p_album_id bigint,
  p_destination text
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_user_id uuid := auth.uid();
  v_destination text := lower(btrim(coalesce(p_destination,'')));
  v_album public.albums%rowtype;
  v_entry_id bigint;
  v_next_order integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_destination not in ('collection','wishlist') then
    raise exception 'Invalid destination';
  end if;

  select a.* into v_album
  from public.albums a
  where a.id=p_album_id;

  if not found then
    raise exception 'Album not found';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('groovy-existing-library:'||v_user_id::text||':'||v_destination)
  );

  if v_destination='wishlist' then
    select c.id into v_entry_id
    from public.collections c
    where c.user_id=v_user_id and c.album_id=v_album.id
    limit 1;

    if v_entry_id is not null then
      return jsonb_build_object('status','collection','album_id',v_album.id,'entry_id',v_entry_id,'inserted',false);
    end if;

    select w.id into v_entry_id
    from public.wishlists w
    where w.user_id=v_user_id and w.album_id=v_album.id
    limit 1;

    if v_entry_id is not null then
      return jsonb_build_object('status','wishlist','album_id',v_album.id,'entry_id',v_entry_id,'inserted',false);
    end if;

    select coalesce(max(w.sort_order),0)+1 into v_next_order
    from public.wishlists w
    where w.user_id=v_user_id;

    insert into public.wishlists(user_id,album_id,cover_url,discogs_style,sort_order)
    values(v_user_id,v_album.id,v_album.cover_url,v_album.genre,v_next_order)
    returning id into v_entry_id;

    return jsonb_build_object('status','wishlist','album_id',v_album.id,'entry_id',v_entry_id,'inserted',true);
  end if;

  select c.id into v_entry_id
  from public.collections c
  where c.user_id=v_user_id and c.album_id=v_album.id
  limit 1;

  if v_entry_id is not null then
    return jsonb_build_object('status','collection','album_id',v_album.id,'entry_id',v_entry_id,'inserted',false);
  end if;

  if exists(
    select 1
    from public.wishlists w
    where w.user_id=v_user_id and w.album_id=v_album.id
  ) then
    return jsonb_build_object('status','wishlist','album_id',v_album.id,'entry_id',null,'inserted',false);
  end if;

  select coalesce(max(c.sort_order),0)+1 into v_next_order
  from public.collections c
  where c.user_id=v_user_id;

  insert into public.collections(user_id,album_id,cover_url,discogs_style,sort_order)
  values(v_user_id,v_album.id,v_album.cover_url,v_album.genre,v_next_order)
  returning id into v_entry_id;

  return jsonb_build_object('status','collection','album_id',v_album.id,'entry_id',v_entry_id,'inserted',true);
end;
$function$;

revoke execute on function public.add_existing_album_to_library(bigint,text) from public, anon;
grant execute on function public.add_existing_album_to_library(bigint,text) to authenticated, service_role;
