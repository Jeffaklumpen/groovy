-- Remove SELECT policies that are redundant with broader read policies.
drop policy if exists "Users can read own collection" on public.collections;
drop policy if exists "Users can read own album ratings" on public.album_ratings;
drop policy if exists "Authenticated users can view profiles" on public.profiles;

-- Cache auth.uid() once per statement rather than re-evaluating it for every row.
alter policy "Users can remove from own collection" on public.collections
  using ((select auth.uid()) = user_id);
alter policy "Users can add to own collection" on public.collections
  with check ((select auth.uid()) = user_id);
alter policy "Authenticated users can update own collections" on public.collections
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete own album ratings" on public.album_ratings
  using ((select auth.uid()) = user_id);
alter policy "Users can add own album ratings" on public.album_ratings
  with check ((select auth.uid()) = user_id);
alter policy "Users can update own album ratings" on public.album_ratings
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete own profile" on public.profiles
  using ((select auth.uid()) = id);
alter policy "Users can insert own profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "Users can update own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "Users can remove from their own wishlist" on public.wishlists
  using ((select auth.uid()) = user_id);
alter policy "Users can add to their own wishlist" on public.wishlists
  with check ((select auth.uid()) = user_id);
alter policy "Users can reorder their own wishlist" on public.wishlists
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can delete own shelves" on public.shelves
  using ((select auth.uid()) = user_id);
alter policy "Users can create own shelves" on public.shelves
  with check ((select auth.uid()) = user_id);
alter policy "Users can update own shelves" on public.shelves
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Users can unfollow from their own account" on public.user_follows
  using ((select auth.uid()) = follower_id);
alter policy "Users can follow from their own account" on public.user_follows
  with check (((select auth.uid()) = follower_id) and (follower_id <> followed_id));
alter policy "Users can read relevant follows" on public.user_follows
  using (((select auth.uid()) = follower_id) or ((select auth.uid()) = followed_id));

alter policy "Users can clear their notifications" on public.notifications
  using ((select auth.uid()) = recipient_id);
alter policy "Users can read their notifications" on public.notifications
  using ((select auth.uid()) = recipient_id);
alter policy "Users can mark their notifications read" on public.notifications
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);
