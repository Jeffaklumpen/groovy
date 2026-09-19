-- Store the current lowest listing target for each marketplace snapshot.
alter table public.marketplace_alert_market_state
  add column if not exists lowest_listing_url text;

alter table public.marketplace_alert_market_state
  drop constraint if exists marketplace_alert_market_state_lowest_url_check;

alter table public.marketplace_alert_market_state
  add constraint marketplace_alert_market_state_lowest_url_check
  check (
    lowest_listing_url is null
    or lowest_listing_url ~ '^https?://'
  );
