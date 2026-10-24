create table public.site_keys (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null,
    key_hash text not null unique,
    key_hint text not null,
    last_used_on date,
    created_at timestamptz not null default now()
);

create index site_keys_project_id_idx on public.site_keys (project_id);

alter table public.site_keys enable row level security;

revoke all on public.site_keys from anon, authenticated;

grant select (id, project_id, name, key_hint, last_used_on, created_at)
    on public.site_keys to authenticated;

grant insert (project_id, name, key_hash, key_hint) on public.site_keys
    to authenticated;

grant delete on public.site_keys to authenticated;

create policy "owner reads own keys" on public.site_keys
    for select to authenticated
    using (public.is_project_owner(project_id));

create policy "owner adds keys to own projects" on public.site_keys
    for insert to authenticated
    with check (public.is_project_owner(project_id));

create policy "owner deletes own keys" on public.site_keys
    for delete to authenticated
    using (public.is_project_owner(project_id));

create function public.guard_site_key_limit() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform 1 from public.projects where id = new.project_id for no key update;

    if (select count(*) from public.site_keys where project_id = new.project_id) >= 10 then
        raise exception 'The project has 10 keys.';
    end if;

    return new;
end;
$$;

revoke execute on function public.guard_site_key_limit from public, anon, authenticated;

create trigger site_keys_guard_limit
    before insert on public.site_keys
    for each row execute function public.guard_site_key_limit();

create index pages_live_idx on public.pages (project_id, published_at desc, id desc)
    where status = 'published';

create index pages_unpublished_idx
    on public.pages (project_id, unpublished_at desc, id desc)
    where status = 'unpublished';

create view public.api_versions with (security_invoker = true) as
select
    page.id,
    page.project_id,
    page.status,
    page.published_at,
    page.unpublished_at,
    page.redirect_to,
    kind.name as kind,
    kind.url_prefix as kind_url_prefix,
    version.locale,
    home.base_url as locale_base_url,
    version.slug,
    version.path,
    version.url,
    substring(lower(version.url) from '^https?://([^/:?#]+)') as host,
    version.title,
    version.meta_title,
    version.meta_description,
    version.excerpt,
    version.body_md,
    version.body_html,
    version.toc,
    version.word_count,
    version.reading_minutes,
    version.faq,
    version.sources,
    version.tags,
    author.name as author_name,
    author.title as author_title,
    author.url as author_url,
    author.same_as as author_same_as,
    version.modified_at,
    version.updated_at,
    (
        select coalesce(jsonb_agg(jsonb_build_object(
            'locale', sibling.locale,
            'url', sibling.url,
            'is_default', coalesce(sibling_home.is_default, false)
        ) order by sibling.locale), '[]'::jsonb)
        from public.published_pages as sibling
            join public.pages as sibling_page on sibling_page.id = sibling.page_id
            left join public.project_locales as sibling_home
                on sibling_home.project_id = sibling.project_id
                and sibling_home.locale = sibling.locale
        where sibling.project_id = version.project_id
            and sibling.translation_group_id = version.translation_group_id
            and sibling_page.status = 'published'
    ) as alternates
from public.published_pages as version
    join public.pages as page
        on page.id = version.page_id and page.project_id = version.project_id
    left join public.page_kinds as kind on kind.id = version.kind_id
    left join public.authors as author on author.id = version.author_id
    left join public.project_locales as home
        on home.project_id = version.project_id and home.locale = version.locale;

revoke all on public.api_versions from anon, authenticated;

-- A SQL function resolves a bare name to a column before a parameter, so no
-- parameter below shares a column's name.
create function public.api_key_project(secret_hash text)
returns table (project_id uuid, site_id text)
language sql
set search_path = ''
as $$
    update public.site_keys set last_used_on = (now() at time zone 'utc')::date
    where site_keys.key_hash = secret_hash
        and site_keys.last_used_on is distinct from (now() at time zone 'utc')::date;

    select keys.project_id, projects.site_id
    from public.site_keys as keys
        join public.projects on projects.id = keys.project_id
    where keys.key_hash = secret_hash;
$$;

create function public.api_project(secret_hash text, site text) returns uuid
language sql stable
set search_path = ''
as $$
    select keys.project_id
    from public.site_keys as keys
        join public.projects on projects.id = keys.project_id
    where keys.key_hash = secret_hash and projects.site_id = site;
$$;

create function public.api_site(secret_hash text, site text)
returns table (
    project_name text,
    organization_name text,
    organization_url text,
    organization_logo_url text,
    organization_logo_width integer,
    organization_logo_height integer,
    organization_same_as text[],
    locales jsonb
)
language sql stable
set search_path = ''
as $$
    select
        projects.name,
        projects.organization_name,
        projects.organization_url,
        projects.organization_logo_url,
        projects.organization_logo_width,
        projects.organization_logo_height,
        projects.organization_same_as,
        (
            select coalesce(jsonb_agg(jsonb_build_object(
                'locale', locales.locale,
                'base_url', locales.base_url,
                'is_default', locales.is_default
            ) order by locales.locale), '[]'::jsonb)
            from public.project_locales as locales
            where locales.project_id = projects.id
        )
    from public.projects
    where projects.id = (select public.api_project(secret_hash, site));
$$;

create function public.api_pages(
    secret_hash text,
    site text,
    page_locale text default null,
    kind_name text default null,
    after_published_at timestamptz default null,
    after_id uuid default null,
    page_limit integer default 20
) returns setof public.api_versions
language sql stable
set search_path = ''
as $$
    select versions.* from public.api_versions as versions
    where versions.project_id = (select public.api_project(secret_hash, site))
        and versions.status = 'published'
        and (page_locale is null or versions.locale = page_locale)
        and (kind_name is null or versions.kind = kind_name)
        and (after_id is null
            or (versions.published_at, versions.id) < (after_published_at, after_id))
    order by versions.published_at desc, versions.id desc
    limit least(page_limit, 1000);
$$;

create function public.api_page(
    secret_hash text,
    site text,
    page_locale text,
    page_slug text
) returns setof public.api_versions
language sql stable
set search_path = ''
as $$
    select versions.* from public.api_versions as versions
    where versions.project_id = (select public.api_project(secret_hash, site))
        and versions.locale = page_locale
        and versions.slug = page_slug;
$$;

create function public.api_redirects(
    secret_hash text,
    site text,
    after_unpublished_at timestamptz default null,
    after_id uuid default null,
    page_limit integer default 500
) returns table (
    id uuid,
    locale text,
    path text,
    url text,
    unpublished_at timestamptz,
    redirect_to text
)
language sql stable
set search_path = ''
as $$
    select versions.id, versions.locale, versions.path, versions.url,
        versions.unpublished_at, versions.redirect_to
    from public.api_versions as versions
    where versions.project_id = (select public.api_project(secret_hash, site))
        and versions.status = 'unpublished'
        and (after_id is null
            or (versions.unpublished_at, versions.id) < (after_unpublished_at, after_id))
    order by versions.unpublished_at desc, versions.id desc
    limit least(page_limit, 1000);
$$;

create function public.api_sync(
    secret_hash text,
    site text,
    since timestamptz,
    after_updated_at timestamptz default null,
    after_id uuid default null,
    page_limit integer default 20
) returns setof public.api_versions
language sql stable
set search_path = ''
as $$
    select versions.* from public.api_versions as versions
    where versions.project_id = (select public.api_project(secret_hash, site))
        and versions.updated_at >= since
        and (after_id is null
            or (versions.updated_at, versions.id) > (after_updated_at, after_id))
    order by versions.updated_at, versions.id
    limit least(page_limit, 1000);
$$;

create function public.api_sitemap(
    secret_hash text,
    site text,
    after_published_at timestamptz default null,
    after_id uuid default null,
    page_limit integer default 500
) returns table (
    id uuid,
    published_at timestamptz,
    url text,
    modified_at timestamptz,
    alternates jsonb
)
language sql stable
set search_path = ''
as $$
    select versions.id, versions.published_at, versions.url,
        versions.modified_at, versions.alternates
    from public.api_versions as versions
    where versions.project_id = (select public.api_project(secret_hash, site))
        and versions.status = 'published'
        and (after_id is null
            or (versions.published_at, versions.id) < (after_published_at, after_id))
    order by versions.published_at desc, versions.id desc
    limit least(page_limit, 1000);
$$;

create function public.api_sitemap_project(site text, sitemap_host text) returns uuid
language sql stable
set search_path = ''
as $$
    select projects.id
    from public.projects
        join public.project_locales as locales on locales.project_id = projects.id
    where projects.site_id = site
        and substring(lower(locales.base_url) from '^https?://([^/:?#]+)')
            = lower(sitemap_host)
    limit 1;
$$;

create function public.api_host_sitemap(
    site text,
    sitemap_host text,
    after_published_at timestamptz default null,
    after_id uuid default null,
    page_limit integer default 1000
) returns table (
    id uuid,
    published_at timestamptz,
    url text,
    modified_at timestamptz,
    alternates jsonb
)
language sql stable
set search_path = ''
as $$
    select versions.id, versions.published_at, versions.url,
        versions.modified_at, versions.alternates
    from public.api_versions as versions
    where versions.project_id = (select public.api_sitemap_project(site, sitemap_host))
        and versions.status = 'published'
        and versions.host = lower(sitemap_host)
        and (after_id is null
            or (versions.published_at, versions.id) < (after_published_at, after_id))
    order by versions.published_at desc, versions.id desc
    limit least(page_limit, 1000);
$$;

revoke execute on function
    public.api_key_project,
    public.api_project,
    public.api_site,
    public.api_pages,
    public.api_page,
    public.api_redirects,
    public.api_sync,
    public.api_sitemap,
    public.api_sitemap_project,
    public.api_host_sitemap
from public, anon, authenticated;

grant execute on function
    public.api_key_project,
    public.api_project,
    public.api_site,
    public.api_pages,
    public.api_page,
    public.api_redirects,
    public.api_sync,
    public.api_sitemap,
    public.api_sitemap_project,
    public.api_host_sitemap
to service_role;
