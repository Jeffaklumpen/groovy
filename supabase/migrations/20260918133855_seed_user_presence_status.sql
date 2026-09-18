insert into public.user_presence_status (user_id,last_seen_at)
select
  p.id,
  coalesce(u.last_sign_in_at,u.created_at,p.created_at,now())
from public.profiles p
join auth.users u on u.id=p.id
on conflict (user_id) do nothing;
