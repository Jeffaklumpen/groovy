-- The project uses explicit sequence privileges. album_reviews.id is an
-- identity column, so authenticated inserts (including save_album_review,
-- which is SECURITY INVOKER) need access to its generated sequence.
revoke all on sequence public.album_reviews_id_seq from public,anon,authenticated,service_role;
grant usage,select on sequence public.album_reviews_id_seq to authenticated,service_role;
