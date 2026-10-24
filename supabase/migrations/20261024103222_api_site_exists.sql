create function public.api_site_exists(site text) returns boolean
language sql stable
set search_path = ''
as $$
    select exists (select 1 from public.projects where projects.site_id = site);
$$;

revoke execute on function public.api_site_exists from public, anon, authenticated;

grant execute on function public.api_site_exists to service_role;
