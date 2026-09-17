-- These RPCs only operate on rows already permitted by their RLS policies, so
-- they do not need to bypass RLS. Run them with the caller's normal privileges.
alter function public.delete_collection_record(text) security invoker;
alter function public.delete_shelf_and_unshelve(uuid) security invoker;
alter function public.get_following_overview() security invoker;
alter function public.get_following_statistics() security invoker;
alter function public.move_collection_to_shelf(text, uuid) security invoker;
alter function public.profile_public_counts(uuid) security invoker;
alter function public.set_collection_display_order(uuid, jsonb) security invoker;
alter function public.set_wishlist_display_order(jsonb) security invoker;

-- upsert_apple_artwork_cache(jsonb) intentionally remains SECURITY DEFINER:
-- authenticated clients only have SELECT on the shared cache table, while the
-- function validates and performs the controlled write on their behalf.
