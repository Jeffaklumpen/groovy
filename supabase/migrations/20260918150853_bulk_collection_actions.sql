create or replace function public.delete_collection_records(p_collection_ids jsonb)
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
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_collection_ids is null or jsonb_typeof(p_collection_ids) <> 'array' then
    raise exception 'Collection record ids must be a JSON array';
  end if;

  select count(*) into v_requested
  from (select distinct value as id from jsonb_array_elements_text(p_collection_ids) where btrim(value) <> '') requested;
  if v_requested = 0 then return 0; end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  select count(*) into v_found
  from public.collections c
  join (select distinct value as id from jsonb_array_elements_text(p_collection_ids) where btrim(value) <> '') requested
    on c.id::text = requested.id
  where c.user_id = v_user_id;

  if v_found <> v_requested then raise exception 'One or more collection records were not found'; end if;

  delete from public.collections c
  using (select distinct value as id from jsonb_array_elements_text(p_collection_ids) where btrim(value) <> '') requested
  where c.id::text = requested.id and c.user_id = v_user_id;

  get diagnostics v_deleted = row_count;

  with ranked as (
    select c.id,row_number() over (order by c.sort_order nulls last,c.id) as new_order
    from public.collections c where c.user_id = v_user_id
  )
  update public.collections c set sort_order = ranked.new_order::integer
  from ranked where c.id = ranked.id;

  with ranked as (
    select c.id,row_number() over (
      partition by c.shelf_id
      order by c.shelf_sort_order nulls last,c.sort_order nulls last,c.id
    ) as new_order
    from public.collections c
    where c.user_id = v_user_id and c.shelf_id is not null
  )
  update public.collections c set shelf_sort_order = ranked.new_order::integer
  from ranked where c.id = ranked.id;

  return v_deleted;
end;
$function$;

create or replace function public.move_collection_records_to_shelf(p_collection_ids jsonb,p_shelf_id uuid)
returns integer
language plpgsql
set search_path to 'public'
as $function$
declare
  v_user_id uuid := auth.uid();
  v_requested integer := 0;
  v_found integer := 0;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_collection_ids is null or jsonb_typeof(p_collection_ids) <> 'array' then
    raise exception 'Collection record ids must be a JSON array';
  end if;

  select count(*) into v_requested
  from (select distinct value as id from jsonb_array_elements_text(p_collection_ids) where btrim(value) <> '') requested;
  if v_requested = 0 then return 0; end if;

  perform pg_advisory_xact_lock(hashtext(v_user_id::text));

  if p_shelf_id is not null and not exists (
    select 1 from public.shelves s where s.id = p_shelf_id and s.user_id = v_user_id
  ) then raise exception 'Shelf not found'; end if;

  select count(*) into v_found
  from public.collections c
  join (select distinct value as id from jsonb_array_elements_text(p_collection_ids) where btrim(value) <> '') requested
    on c.id::text = requested.id
  where c.user_id = v_user_id;

  if v_found <> v_requested then raise exception 'One or more collection records were not found'; end if;

  if p_shelf_id is null then
    update public.collections c set shelf_id = null,shelf_sort_order = null
    from (select distinct value as id from jsonb_array_elements_text(p_collection_ids) where btrim(value) <> '') requested
    where c.id::text = requested.id and c.user_id = v_user_id;
  else
    with requested as (
      select distinct value as id from jsonb_array_elements_text(p_collection_ids) where btrim(value) <> ''
    ),
    ordered as (
      select c.id,row_number() over (order by c.sort_order nulls last,c.id) as offset_order
      from public.collections c join requested r on c.id::text = r.id
      where c.user_id = v_user_id
    ),
    destination as (
      select coalesce(max(c.shelf_sort_order),0) as base_order
      from public.collections c
      where c.user_id = v_user_id and c.shelf_id = p_shelf_id
        and not exists (select 1 from requested r where c.id::text = r.id)
    )
    update public.collections c
    set shelf_id = p_shelf_id,shelf_sort_order = destination.base_order + ordered.offset_order
    from ordered cross join destination
    where c.id = ordered.id and c.user_id = v_user_id;
  end if;

  with ranked as (
    select c.id,row_number() over (
      partition by c.shelf_id
      order by c.shelf_sort_order nulls last,c.sort_order nulls last,c.id
    ) as new_order
    from public.collections c
    where c.user_id = v_user_id and c.shelf_id is not null
  )
  update public.collections c set shelf_sort_order = ranked.new_order::integer
  from ranked where c.id = ranked.id;

  return v_requested;
end;
$function$;

revoke execute on function public.delete_collection_records(jsonb) from public, anon, authenticated;
revoke execute on function public.move_collection_records_to_shelf(jsonb,uuid) from public, anon, authenticated;
grant execute on function public.delete_collection_records(jsonb) to authenticated;
grant execute on function public.move_collection_records_to_shelf(jsonb,uuid) to authenticated;
