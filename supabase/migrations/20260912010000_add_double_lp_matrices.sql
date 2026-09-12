-- A double LP has four sides. These fields remain null for single-disc albums.
alter table public.collections
  add column if not exists matrix_runout_c text,
  add column if not exists matrix_runout_d text,
  add column if not exists discogs_style text;

alter table public.wishlists
  add column if not exists discogs_style text;
