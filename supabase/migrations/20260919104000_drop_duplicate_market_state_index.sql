-- The composite primary key on (alert_id, marketplace) already covers alert_id.
drop index if exists public.marketplace_alert_market_state_alert_idx;
