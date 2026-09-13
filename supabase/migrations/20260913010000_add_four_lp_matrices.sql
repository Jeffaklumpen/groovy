-- Four-LP editions have eight playable sides. Single and double LP rows keep
-- these optional fields null.
alter table public.collections
  add column if not exists matrix_runout_e text,
  add column if not exists matrix_runout_f text,
  add column if not exists matrix_runout_g text,
  add column if not exists matrix_runout_h text;
