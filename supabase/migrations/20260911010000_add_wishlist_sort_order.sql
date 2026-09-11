alter table public.wishlists
  add column if not exists sort_order integer;

with ranked as (
  select
    id,
    row_number() over (
      partition by user_id
      order by added_at asc, id asc
    ) as position
  from public.wishlists
  where sort_order is null
)
update public.wishlists as wishlist
set sort_order = ranked.position
from ranked
where wishlist.id = ranked.id;

drop policy if exists "Users can reorder their own wishlist" on public.wishlists;
create policy "Users can reorder their own wishlist"
  on public.wishlists
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant update on table public.wishlists to authenticated;
