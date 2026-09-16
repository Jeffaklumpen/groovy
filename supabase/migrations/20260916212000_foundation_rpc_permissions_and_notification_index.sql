create index if not exists notifications_actor_id_idx
  on public.notifications (actor_id);

-- SECURITY DEFINER functions should never inherit PostgreSQL's default PUBLIC
-- EXECUTE privilege. Start from no API access, then explicitly grant only the
-- RPCs that the signed-in frontend is meant to call.
revoke execute on function public.delete_collection_record(text) from public, anon, authenticated;
revoke execute on function public.delete_shelf_and_unshelve(uuid) from public, anon, authenticated;
revoke execute on function public.enforce_shelf_limit() from public, anon, authenticated;
revoke execute on function public.get_following_overview() from public, anon, authenticated;
revoke execute on function public.get_following_statistics() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.move_collection_to_shelf(text, uuid) from public, anon, authenticated;
revoke execute on function public.notify_followers_collection_activity() from public, anon, authenticated;
revoke execute on function public.notify_followers_wishlist_match() from public, anon, authenticated;
revoke execute on function public.notify_new_follower() from public, anon, authenticated;
revoke execute on function public.profile_public_counts(uuid) from public, anon, authenticated;
revoke execute on function public.set_collection_display_order(uuid, jsonb) from public, anon, authenticated;
revoke execute on function public.set_wishlist_display_order(jsonb) from public, anon, authenticated;
revoke execute on function public.upsert_apple_artwork_cache(jsonb) from public, anon, authenticated;
revoke execute on function public.validate_collection_shelf_owner() from public, anon, authenticated;

grant execute on function public.delete_collection_record(text) to authenticated;
grant execute on function public.delete_shelf_and_unshelve(uuid) to authenticated;
grant execute on function public.get_following_overview() to authenticated;
grant execute on function public.get_following_statistics() to authenticated;
grant execute on function public.move_collection_to_shelf(text, uuid) to authenticated;
grant execute on function public.profile_public_counts(uuid) to authenticated;
grant execute on function public.set_collection_display_order(uuid, jsonb) to authenticated;
grant execute on function public.set_wishlist_display_order(jsonb) to authenticated;
grant execute on function public.upsert_apple_artwork_cache(jsonb) to authenticated;
