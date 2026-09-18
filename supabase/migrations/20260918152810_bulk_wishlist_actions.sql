create or replace function public.delete_wishlist_records(p_wishlist_ids jsonb)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_requested integer := 0;
  v_found integer := 0;
  v_deleted integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_wishlist_ids is null or jsonb_typeof(p_wishlist_ids) <> 'array' then
    raise exception 'Wishlist record ids must be a JSON array';
  end if;

  select count(*) into v_requested
  from (
    select distinct value as id
    from jsonb_array_elements_text(p_wishlist_ids)
    where btrim(value) <> ''
  ) requested;

  if v_requested = 0 then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext('groovy-library:' || v_user_id::text || ':wishlist'));

  select count(*) into v_found
  from public.wishlists w
  join (
    select distinct value as id
    from jsonb_array_elements_text(p_wishlist_ids)
    where btrim(value) <> ''
  ) requested on w.id::text = requested.id
  where w.user_id = v_user_id;

  if v_found <> v_requested then
    raise exception 'One or more wishlist records were not found';
  end if;

  delete from public.wishlists w
  using (
    select distinct value as id
    from jsonb_array_elements_text(p_wishlist_ids)
    where btrim(value) <> ''
  ) requested
  where w.id::text = requested.id
    and w.user_id = v_user_id;

  get diagnostics v_deleted = row_count;

  with ranked as (
    select
      w.id,
      row_number() over (
        order by w.sort_order nulls last, w.added_at, w.id
      ) as new_order
    from public.wishlists w
    where w.user_id = v_user_id
  )
  update public.wishlists w
  set sort_order = ranked.new_order::integer
  from ranked
  where w.id = ranked.id;

  return v_deleted;
end;
$function$;

create or replace function public.move_wishlist_records_to_collection(p_wishlist_ids jsonb)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_requested integer := 0;
  v_found integer := 0;
  v_base_order integer := 0;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_wishlist_ids is null or jsonb_typeof(p_wishlist_ids) <> 'array' then
    raise exception 'Wishlist record ids must be a JSON array';
  end if;

  select count(*) into v_requested
  from (
    select distinct value as id
    from jsonb_array_elements_text(p_wishlist_ids)
    where btrim(value) <> ''
  ) requested;

  if v_requested = 0 then
    return 0;
  end if;

  perform pg_advisory_xact_lock(hashtext('groovy-library:' || v_user_id::text || ':collection'));
  perform pg_advisory_xact_lock(hashtext('groovy-library:' || v_user_id::text || ':wishlist'));

  select count(*) into v_found
  from public.wishlists w
  join (
    select distinct value as id
    from jsonb_array_elements_text(p_wishlist_ids)
    where btrim(value) <> ''
  ) requested on w.id::text = requested.id
  where w.user_id = v_user_id;

  if v_found <> v_requested then
    raise exception 'One or more wishlist records were not found';
  end if;

  select coalesce(max(c.sort_order),0)
  into v_base_order
  from public.collections c
  where c.user_id = v_user_id;

  with requested as (
    select distinct value as id
    from jsonb_array_elements_text(p_wishlist_ids)
    where btrim(value) <> ''
  ),
  source_rows as (
    select
      w.id,
      w.album_id,
      w.cover_url,
      w.discogs_style,
      row_number() over (
        order by w.sort_order nulls last, w.added_at, w.id
      ) as source_order
    from public.wishlists w
    join requested r on w.id::text = r.id
    where w.user_id = v_user_id
  ),
  missing_rows as (
    select
      s.*,
      row_number() over (order by s.source_order) as insert_order
    from source_rows s
    where not exists (
      select 1
      from public.collections c
      where c.user_id = v_user_id
        and c.album_id = s.album_id
    )
  )
  insert into public.collections(
    user_id, album_id, cover_url, discogs_style, sort_order
  )
  select
    v_user_id,
    m.album_id,
    m.cover_url,
    m.discogs_style,
    v_base_order + m.insert_order
  from missing_rows m
  order by m.insert_order;

  delete from public.wishlists w
  using (
    select distinct value as id
    from jsonb_array_elements_text(p_wishlist_ids)
    where btrim(value) <> ''
  ) requested
  where w.id::text = requested.id
    and w.user_id = v_user_id;

  with ranked as (
    select
      w.id,
      row_number() over (
        order by w.sort_order nulls last, w.added_at, w.id
      ) as new_order
    from public.wishlists w
    where w.user_id = v_user_id
  )
  update public.wishlists w
  set sort_order = ranked.new_order::integer
  from ranked
  where w.id = ranked.id;

  return v_requested;
end;
$function$;

revoke execute on function public.delete_wishlist_records(jsonb) from public, anon, authenticated;
revoke execute on function public.move_wishlist_records_to_collection(jsonb) from public, anon, authenticated;

grant execute on function public.delete_wishlist_records(jsonb) to authenticated;
grant execute on function public.move_wishlist_records_to_collection(jsonb) to authenticated;
