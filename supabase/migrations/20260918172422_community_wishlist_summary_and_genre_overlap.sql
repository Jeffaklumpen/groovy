drop function if exists private.community_connection_count();

CREATE OR REPLACE FUNCTION public.get_community_overview(p_limit integer DEFAULT 5, p_activity_limit integer DEFAULT 8)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_user_id uuid := auth.uid();
  v_limit integer := greatest(1,least(coalesce(p_limit,5),10));
  v_activity_limit integer := greatest(1,least(coalesce(p_activity_limit,8),20));
  v_summary jsonb;
  v_similar jsonb;
  v_activity jsonb;
  v_top_collectors jsonb;
  v_top_rated jsonb;
  v_most_collected jsonb;
  v_most_collected_artists jsonb;
  v_most_wishlisted jsonb;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select jsonb_build_object(
    'collectors',(select count(*)::bigint from public.profiles),
    'records',(select count(*)::bigint from public.collections),
    'wishlisted_records',(select count(*)::bigint from public.wishlists)
  )
  into v_summary;

  with mine as (
    select c.album_id
    from public.collections c
    where c.user_id=v_user_id
  ),
  mine_count as (
    select count(*)::bigint as count from mine
  ),
  candidates as (
    select
      p.id as user_id,
      p.username,
      p.avatar_url,
      count(distinct c.album_id)::bigint as collection_count,
      count(distinct c.album_id) filter (where m.album_id is not null)::bigint as common_count,
      mc.count as mine_count
    from public.profiles p
    join public.collections c on c.user_id=p.id
    left join mine m on m.album_id=c.album_id
    cross join mine_count mc
    where p.id<>v_user_id
    group by p.id,p.username,p.avatar_url,mc.count
  ),
  relevant_users as (
    select v_user_id as user_id
    union
    select c.user_id
    from candidates c
  ),
  genre_tokens as (
    select
      c.user_id,
      lower(btrim(token.genre_token)) as genre_token,
      count(*)::numeric as genre_count
    from public.collections c
    left join public.albums a on a.id=c.album_id
    join relevant_users ru on ru.user_id=c.user_id
    cross join lateral regexp_split_to_table(
      coalesce(nullif(btrim(c.discogs_style),''),nullif(btrim(a.genre),''),''),
      E'\\s*[·,]\\s*'
    ) as token(genre_token)
    where btrim(token.genre_token)<>''
    group by c.user_id,lower(btrim(token.genre_token))
  ),
  genre_totals as (
    select user_id,sum(genre_count)::numeric as genre_total
    from genre_tokens
    group by user_id
  ),
  taste as (
    select
      c.user_id,
      case
        when coalesce(own_total.genre_total,0)=0 or coalesce(their_total.genre_total,0)=0 then 0::numeric
        else round(
          coalesce(sum(least(
            own_genre.genre_count/own_total.genre_total,
            coalesce(their_genre.genre_count/their_total.genre_total,0)
          )),0)*100,
          1
        )
      end as taste_similarity
    from candidates c
    left join genre_totals own_total on own_total.user_id=v_user_id
    left join genre_totals their_total on their_total.user_id=c.user_id
    left join genre_tokens own_genre on own_genre.user_id=v_user_id
    left join genre_tokens their_genre
      on their_genre.user_id=c.user_id
     and their_genre.genre_token=own_genre.genre_token
    group by c.user_id,own_total.genre_total,their_total.genre_total
  ),
  ranked as (
    select
      c.*,
      coalesce(t.taste_similarity,0)::numeric as taste_similarity,
      exists(
        select 1
        from public.user_follows uf
        where uf.follower_id=v_user_id
          and uf.followed_id=c.user_id
      ) as is_following
    from candidates c
    left join taste t on t.user_id=c.user_id
    where c.common_count>0
    order by c.common_count desc,taste_similarity desc,c.collection_count desc,c.username
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',r.user_id,
        'username',r.username,
        'avatar_url',r.avatar_url,
        'collection_count',r.collection_count,
        'common_count',r.common_count,
        'taste_similarity',r.taste_similarity,
        'is_following',r.is_following
      )
      order by r.common_count desc,r.taste_similarity desc,r.collection_count desc,r.username
    ),
    '[]'::jsonb
  )
  into v_similar
  from ranked r;

  with recent as (
    select
      ca.id,
      ca.activity_type,
      ca.rating,
      ca.created_at,
      p.id as user_id,
      p.username,
      p.avatar_url,
      a.id as album_id,
      a.title as album_title,
      a.cover_url,
      a.discogs_master_id,
      ar.name as artist_name
    from public.community_activity ca
    join public.profiles p on p.id=ca.actor_id
    join public.albums a on a.id=ca.album_id
    left join public.artists ar on ar.id=a.artist_id
    order by ca.created_at desc,ca.id desc
    limit v_activity_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id',r.id,
        'activity_type',r.activity_type,
        'rating',r.rating,
        'created_at',r.created_at,
        'user_id',r.user_id,
        'username',r.username,
        'avatar_url',r.avatar_url,
        'album_id',r.album_id,
        'album_title',r.album_title,
        'cover_url',r.cover_url,
        'discogs_master_id',r.discogs_master_id,
        'artist_name',r.artist_name
      )
      order by r.created_at desc,r.id desc
    ),
    '[]'::jsonb
  )
  into v_activity
  from recent r;

  with ranked as (
    select
      p.id as user_id,
      p.username,
      p.avatar_url,
      count(c.id)::bigint as record_count
    from public.profiles p
    join public.collections c on c.user_id=p.id
    group by p.id,p.username,p.avatar_url
    order by record_count desc,p.username
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id',r.user_id,
        'username',r.username,
        'avatar_url',r.avatar_url,
        'record_count',r.record_count
      )
      order by r.record_count desc,r.username
    ),
    '[]'::jsonb
  )
  into v_top_collectors
  from ranked r;

  with ranked as (
    select
      a.id as album_id,
      a.title,
      a.cover_url,
      a.discogs_master_id,
      ar.name as artist_name,
      round(avg(r.rating)::numeric,1) as average_rating,
      count(r.id)::bigint as rating_count
    from public.album_ratings r
    join public.albums a on a.id=r.album_id
    left join public.artists ar on ar.id=a.artist_id
    where r.rating between 1 and 5
    group by a.id,a.title,a.cover_url,a.discogs_master_id,ar.name
    order by average_rating desc,rating_count desc,a.title
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'album_id',r.album_id,
        'title',r.title,
        'cover_url',r.cover_url,
        'discogs_master_id',r.discogs_master_id,
        'artist_name',r.artist_name,
        'average_rating',r.average_rating,
        'rating_count',r.rating_count
      )
      order by r.average_rating desc,r.rating_count desc,r.title
    ),
    '[]'::jsonb
  )
  into v_top_rated
  from ranked r;

  with ranked as (
    select
      a.id as album_id,
      a.title,
      a.cover_url,
      a.discogs_master_id,
      ar.name as artist_name,
      count(c.id)::bigint as collection_count
    from public.collections c
    join public.albums a on a.id=c.album_id
    left join public.artists ar on ar.id=a.artist_id
    group by a.id,a.title,a.cover_url,a.discogs_master_id,ar.name
    order by collection_count desc,a.title
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'album_id',r.album_id,
        'title',r.title,
        'cover_url',r.cover_url,
        'discogs_master_id',r.discogs_master_id,
        'artist_name',r.artist_name,
        'collection_count',r.collection_count
      )
      order by r.collection_count desc,r.title
    ),
    '[]'::jsonb
  )
  into v_most_collected
  from ranked r;

  with ranked as (
    select
      ar.id as artist_id,
      ar.name as artist_name,
      count(c.id)::bigint as collection_count
    from public.collections c
    join public.albums a on a.id=c.album_id
    join public.artists ar on ar.id=a.artist_id
    group by ar.id,ar.name
    order by collection_count desc,ar.name
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'artist_id',r.artist_id,
        'artist_name',r.artist_name,
        'collection_count',r.collection_count
      )
      order by r.collection_count desc,r.artist_name
    ),
    '[]'::jsonb
  )
  into v_most_collected_artists
  from ranked r;

  with ranked as (
    select
      a.id as album_id,
      a.title,
      a.cover_url,
      a.discogs_master_id,
      ar.name as artist_name,
      count(w.id)::bigint as wishlist_count
    from public.wishlists w
    join public.albums a on a.id=w.album_id
    left join public.artists ar on ar.id=a.artist_id
    group by a.id,a.title,a.cover_url,a.discogs_master_id,ar.name
    order by wishlist_count desc,a.title
    limit v_limit
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'album_id',r.album_id,
        'title',r.title,
        'cover_url',r.cover_url,
        'discogs_master_id',r.discogs_master_id,
        'artist_name',r.artist_name,
        'wishlist_count',r.wishlist_count
      )
      order by r.wishlist_count desc,r.title
    ),
    '[]'::jsonb
  )
  into v_most_wishlisted
  from ranked r;

  return jsonb_build_object(
    'summary',coalesce(v_summary,'{}'::jsonb),
    'similar_collectors',coalesce(v_similar,'[]'::jsonb),
    'activity',coalesce(v_activity,'[]'::jsonb),
    'top_collectors',coalesce(v_top_collectors,'[]'::jsonb),
    'top_rated_albums',coalesce(v_top_rated,'[]'::jsonb),
    'most_collected_albums',coalesce(v_most_collected,'[]'::jsonb),
    'most_collected_artists',coalesce(v_most_collected_artists,'[]'::jsonb),
    'most_wishlisted_albums',coalesce(v_most_wishlisted,'[]'::jsonb)
  );
end;
$function$

revoke execute on function public.get_community_overview(integer,integer) from public, anon;
grant execute on function public.get_community_overview(integer,integer) to authenticated, service_role;
