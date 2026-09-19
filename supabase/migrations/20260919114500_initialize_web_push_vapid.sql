-- One-time/lazy VAPID initialization. Only service-role server code may call this.
create or replace function public.initialize_web_push_vapid(
  p_public_key text,
  p_private_key text,
  p_subject text default 'https://groovyshelves.com/'
)
returns text
language plpgsql
security definer
set search_path = public, vault, pg_temp
as $function$
declare
  existing_public text := '';
  existing_private text := '';
  existing_subject text := '';
  public_id uuid;
  private_id uuid;
  subject_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('groovy_web_push_vapid'));

  select
    coalesce(max(decrypted_secret) filter (where name='web_push_vapid_public_key'),''),
    coalesce(max(decrypted_secret) filter (where name='web_push_vapid_private_key'),''),
    coalesce(max(decrypted_secret) filter (where name='web_push_vapid_subject'),'')
  into existing_public,existing_private,existing_subject
  from vault.decrypted_secrets
  where name in (
    'web_push_vapid_public_key',
    'web_push_vapid_private_key',
    'web_push_vapid_subject'
  );

  if existing_public<>'' and existing_private<>'' and existing_subject<>'' then
    return existing_public;
  end if;

  if coalesce(p_public_key,'') !~ '^[A-Za-z0-9_-]{80,120}$' then
    raise exception 'Invalid VAPID public key';
  end if;
  if coalesce(p_private_key,'') !~ '^[A-Za-z0-9_-]{40,60}$' then
    raise exception 'Invalid VAPID private key';
  end if;
  if coalesce(p_subject,'') !~ '^(https://|mailto:)' then
    raise exception 'Invalid VAPID subject';
  end if;

  select id into public_id from vault.secrets where name='web_push_vapid_public_key' limit 1;
  select id into private_id from vault.secrets where name='web_push_vapid_private_key' limit 1;
  select id into subject_id from vault.secrets where name='web_push_vapid_subject' limit 1;

  if public_id is null then
    perform vault.create_secret(p_public_key,'web_push_vapid_public_key','Groovy Web Push VAPID public key',null);
  else
    perform vault.update_secret(public_id,p_public_key,'web_push_vapid_public_key','Groovy Web Push VAPID public key',null);
  end if;

  if private_id is null then
    perform vault.create_secret(p_private_key,'web_push_vapid_private_key','Groovy Web Push VAPID private key',null);
  else
    perform vault.update_secret(private_id,p_private_key,'web_push_vapid_private_key','Groovy Web Push VAPID private key',null);
  end if;

  if subject_id is null then
    perform vault.create_secret(p_subject,'web_push_vapid_subject','Groovy Web Push VAPID subject',null);
  else
    perform vault.update_secret(subject_id,p_subject,'web_push_vapid_subject','Groovy Web Push VAPID subject',null);
  end if;

  return p_public_key;
end;
$function$;

revoke execute on function public.initialize_web_push_vapid(text,text,text)
  from public, anon, authenticated;
grant execute on function public.initialize_web_push_vapid(text,text,text)
  to service_role;
