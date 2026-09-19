-- Current marketplace snapshot shown on the Price Alerts page.
-- One row per alert and enabled marketplace, refreshed by the hourly scanner.

create table if not exists public.marketplace_alert_market_state (
  alert_id bigint not null references public.marketplace_alerts(id) on delete cascade,
  marketplace text not null check (marketplace in ('Tradera','eBay')),
  listing_count integer not null default 0 check (listing_count >= 0),
  listing_count_capped boolean not null default false,
  lowest_price numeric(12,2),
  currency text not null,
  checked_at timestamptz not null default now(),
  primary key (alert_id, marketplace),
  constraint marketplace_alert_market_state_lowest_check
    check (lowest_price is null or lowest_price > 0)
);

create index if not exists marketplace_alert_market_state_alert_idx
  on public.marketplace_alert_market_state(alert_id);

alter table public.marketplace_alert_market_state enable row level security;

drop policy if exists marketplace_alert_market_state_select_own
  on public.marketplace_alert_market_state;

create policy marketplace_alert_market_state_select_own
on public.marketplace_alert_market_state
for select
to authenticated
using (
  exists (
    select 1
    from public.marketplace_alerts a
    where a.id = marketplace_alert_market_state.alert_id
      and a.user_id = (select auth.uid())
  )
);

revoke all on table public.marketplace_alert_market_state from anon, authenticated;
grant select on table public.marketplace_alert_market_state to authenticated;
grant all on table public.marketplace_alert_market_state to service_role;
