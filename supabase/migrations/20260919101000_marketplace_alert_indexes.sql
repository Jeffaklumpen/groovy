-- Follow-up for marketplace alerts: keep owner reads efficient and index the album foreign key.

create index if not exists marketplace_alerts_album_id_idx
  on public.marketplace_alerts (album_id);

drop policy if exists marketplace_alerts_select_own on public.marketplace_alerts;
create policy marketplace_alerts_select_own
on public.marketplace_alerts
for select
to authenticated
using (user_id = (select auth.uid()));
