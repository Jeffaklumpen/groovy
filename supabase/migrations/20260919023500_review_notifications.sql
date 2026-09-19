-- Review notifications are database-owned so every client path behaves the same.
-- A new review notifies the author's followers. A helpful vote notifies the
-- review owner. Edits, deletes and removed likes do not create notifications.

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check
  check (notification_type in (
    'new_follower',
    'collection_activity',
    'wishlist_match',
    'album_review',
    'review_like'
  ));

create or replace function public.notify_followers_album_review()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  follower record;
  album_title text := '';
  album_artist text := '';
  album_cover text := '';
begin
  select
    coalesce(a.title,''),
    coalesce(ar.name,''),
    coalesce(a.cover_url,'')
  into album_title, album_artist, album_cover
  from public.albums a
  left join public.artists ar on ar.id = a.artist_id
  where a.id = new.album_id;

  for follower in
    select uf.follower_id
    from public.user_follows uf
    where uf.followed_id = new.user_id
  loop
    insert into public.notifications (
      recipient_id,
      actor_id,
      notification_type,
      item_count,
      payload,
      created_at,
      updated_at
    ) values (
      follower.follower_id,
      new.user_id,
      'album_review',
      1,
      jsonb_build_object(
        'review_id', new.id,
        'album_id', new.album_id,
        'album_title', album_title,
        'album_artist', album_artist,
        'cover_url', album_cover
      ),
      now(),
      now()
    );
  end loop;

  return new;
end;
$function$;

revoke execute on function public.notify_followers_album_review()
  from public, anon, authenticated;
grant execute on function public.notify_followers_album_review()
  to service_role;

drop trigger if exists album_reviews_notify_followers_after_insert
  on public.album_reviews;
create trigger album_reviews_notify_followers_after_insert
after insert on public.album_reviews
for each row execute function public.notify_followers_album_review();

create or replace function public.notify_review_owner_like()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  review_owner uuid;
  review_album_id bigint;
  existing_notification_id bigint;
  album_title text := '';
  album_artist text := '';
  album_cover text := '';
begin
  select r.user_id, r.album_id
  into review_owner, review_album_id
  from public.album_reviews r
  where r.id = new.review_id;

  if review_owner is null or review_owner = new.user_id then
    return new;
  end if;

  select
    coalesce(a.title,''),
    coalesce(ar.name,''),
    coalesce(a.cover_url,'')
  into album_title, album_artist, album_cover
  from public.albums a
  left join public.artists ar on ar.id = a.artist_id
  where a.id = review_album_id;

  existing_notification_id := null;

  update public.notifications n
  set
    payload = jsonb_build_object(
      'review_id', new.review_id,
      'album_id', review_album_id,
      'album_title', album_title,
      'album_artist', album_artist,
      'cover_url', album_cover
    ),
    updated_at = now()
  where n.recipient_id = review_owner
    and n.actor_id = new.user_id
    and n.notification_type = 'review_like'
    and n.read_at is null
    and n.payload->>'review_id' = new.review_id::text
  returning n.id into existing_notification_id;

  if existing_notification_id is null then
    insert into public.notifications (
      recipient_id,
      actor_id,
      notification_type,
      item_count,
      payload,
      created_at,
      updated_at
    ) values (
      review_owner,
      new.user_id,
      'review_like',
      1,
      jsonb_build_object(
        'review_id', new.review_id,
        'album_id', review_album_id,
        'album_title', album_title,
        'album_artist', album_artist,
        'cover_url', album_cover
      ),
      now(),
      now()
    );
  end if;

  return new;
end;
$function$;

revoke execute on function public.notify_review_owner_like()
  from public, anon, authenticated;
grant execute on function public.notify_review_owner_like()
  to service_role;

drop trigger if exists album_review_likes_notify_owner_after_insert
  on public.album_review_likes;
create trigger album_review_likes_notify_owner_after_insert
after insert on public.album_review_likes
for each row execute function public.notify_review_owner_like();
