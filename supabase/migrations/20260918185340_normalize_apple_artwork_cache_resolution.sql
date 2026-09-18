create or replace function private.normalize_apple_artwork_cache_url()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $function$
begin
  if new.artwork_url ~* '^https://[^/]*mzstatic\.com/' then
    new.artwork_url := regexp_replace(
      new.artwork_url,
      '/[0-9]+x[0-9]+bb\.',
      '/1200x1200bb.',
      'i'
    );
  end if;
  return new;
end;
$function$;

revoke all on function private.normalize_apple_artwork_cache_url() from public,anon,authenticated;

drop trigger if exists normalize_apple_artwork_cache_url_trigger
  on public.apple_artwork_cache;

create trigger normalize_apple_artwork_cache_url_trigger
before insert or update of artwork_url
on public.apple_artwork_cache
for each row
execute function private.normalize_apple_artwork_cache_url();

update public.apple_artwork_cache
set artwork_url=regexp_replace(
  artwork_url,
  '/[0-9]+x[0-9]+bb\.',
  '/1200x1200bb.',
  'i'
)
where artwork_url ~* '^https://[^/]*mzstatic\.com/'
  and artwork_url ~ '/[0-9]+x[0-9]+bb\.';
