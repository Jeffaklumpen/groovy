-- Keep the exact artwork selected by each user. Album rows are shared, so
-- storing this only on albums lets one old row overwrite a new search result.
alter table public.collections
  add column if not exists cover_url text;

alter table public.wishlists
  add column if not exists cover_url text;

-- Preserve the current appearance for existing entries before new entries
-- start using their per-user cover URL.
update public.collections c
set cover_url = a.cover_url
from public.albums a
where c.album_id = a.id
  and c.cover_url is null;

update public.wishlists w
set cover_url = a.cover_url
from public.albums a
where w.album_id = a.id
  and w.cover_url is null;
