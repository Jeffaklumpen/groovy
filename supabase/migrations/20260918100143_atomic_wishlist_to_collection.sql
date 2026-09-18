create or replace function public.move_wishlist_to_collection(p_wishlist_id text)
returns jsonb
language plpgsql
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_album_id bigint;
  v_cover_url text;
  v_discogs_style text;
  v_collection_id bigint;
  v_next_order integer;
  v_inserted boolean := false;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if nullif(btrim(coalesce(p_wishlist_id,'')),'') is null then
    raise exception 'Wishlist record is required';
  end if;

  perform pg_advisory_xact_lock(
    hashtext('groovy-library:' || v_user_id::text || ':collection')
  );
  perform pg_advisory_xact_lock(
    hashtext('groovy-library:' || v_user_id::text || ':wishlist')
  );

  select w.album_id,w.cover_url,w.discogs_style
  into v_album_id,v_cover_url,v_discogs_style
  from public.wishlists w
  where w.id::text = p_wishlist_id
    and w.user_id = v_user_id
  for update;

  if not found then
    raise exception 'Wishlist record not found';
  end if;

  select c.id
  into v_collection_id
  from public.collections c
  where c.user_id = v_user_id
    and c.album_id = v_album_id
  limit 1;

  if v_collection_id is null then
    select coalesce(max(c.sort_order),0)+1
    into v_next_order
    from public.collections c
    where c.user_id = v_user_id;

    insert into public.collections(
      user_id,album_id,cover_url,discogs_style,sort_order
    )
    values(
      v_user_id,v_album_id,v_cover_url,v_discogs_style,v_next_order
    )
    returning id into v_collection_id;

    v_inserted := true;
  end if;

  delete from public.wishlists
  where id::text = p_wishlist_id
    and user_id = v_user_id;

  with ranked as (
    select
      w.id,
      row_number() over (
        order by w.sort_order nulls last,w.added_at,w.id
      ) as new_order
    from public.wishlists w
    where w.user_id = v_user_id
  )
  update public.wishlists w
  set sort_order = ranked.new_order::integer
  from ranked
  where w.id = ranked.id;

  return jsonb_build_object(
    'status','collection',
    'album_id',v_album_id,
    'entry_id',v_collection_id,
    'inserted',v_inserted
  );
end;
$function$;

revoke all on function public.move_wishlist_to_collection(text) from public, anon;
grant execute on function public.move_wishlist_to_collection(text) to authenticated, service_role;
