alter table public.profiles
  drop column if exists last_seen_at;

create table if not exists public.user_presence_status (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  last_seen_at timestamp with time zone not null default now()
);

alter table public.user_presence_status enable row level security;

drop policy if exists "Authenticated users can read presence status" on public.user_presence_status;
create policy "Authenticated users can read presence status"
on public.user_presence_status
for select
to authenticated
using (true);

drop policy if exists "Users can insert own presence status" on public.user_presence_status;
create policy "Users can insert own presence status"
on public.user_presence_status
for insert
to authenticated
with check ((select auth.uid()) = user_id);

drop policy if exists "Users can update own presence status" on public.user_presence_status;
create policy "Users can update own presence status"
on public.user_presence_status
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

revoke all on table public.user_presence_status from anon, authenticated;
grant select, insert, update on table public.user_presence_status to authenticated;
