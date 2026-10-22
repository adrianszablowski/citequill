create function public.random_site_id() returns text
language plpgsql volatile
set search_path = ''
as $$
declare
    alphabet constant text :=
        '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
    bytes bytea := extensions.gen_random_bytes(16);
    n numeric := 0;
    id text := '';
begin
    for i in 0..15 loop
        n := n * 256 + get_byte(bytes, i);
    end loop;

    -- 22 characters hold 128 bits, so every id has the same length.
    for i in 1..22 loop
        id := substr(alphabet, (n % 62)::integer + 1, 1) || id;
        n := div(n, 62);
    end loop;

    return id;
end;
$$;

alter table public.projects
    add column site_id text not null unique default public.random_site_id(),
    add column organization_name text,
    add column organization_url text,
    add column organization_logo_url text,
    add column organization_logo_width integer,
    add column organization_logo_height integer,
    add column organization_same_as text[] not null default '{}';

revoke insert, update on public.projects from authenticated;

grant insert (name, domain) on public.projects to authenticated;

grant update (bot_secret, organization_name, organization_url, organization_same_as)
    on public.projects to authenticated;

alter table public.authors
    add column same_as text[] not null default '{}';

revoke insert, update on public.authors from authenticated;

grant insert (project_id, name, title, url, same_as) on public.authors
    to authenticated;

grant update (name, title, url, same_as) on public.authors to authenticated;

create policy "owner adds authors to own projects" on public.authors
    for insert to authenticated
    with check (public.is_project_owner(project_id));

create policy "owner updates own authors" on public.authors
    for update to authenticated
    using (public.is_project_owner(project_id))
    with check (public.is_project_owner(project_id));

create policy "owner deletes own authors" on public.authors
    for delete to authenticated
    using (public.is_project_owner(project_id));

alter table public.page_kinds
    add constraint page_kinds_project_id_name_key unique (project_id, name);

create function public.canonical_locale(locale text) returns text
language sql immutable
set search_path = ''
as $$
    select case
        when split_part(locale, '-', 2) ~* '^[a-z]{2}$'
            then lower(split_part(locale, '-', 1)) || '-'
                || upper(split_part(locale, '-', 2))
        else lower(split_part(locale, '-', 1))
    end;
$$;

update public.project_locales
    set locale = public.canonical_locale(locale)
    where locale <> public.canonical_locale(locale);

update public.pages
    set locale = public.canonical_locale(locale)
    where locale <> public.canonical_locale(locale);

update public.runs
    set locale = public.canonical_locale(locale)
    where locale <> public.canonical_locale(locale);

update public.crawled_pages
    set locale = public.canonical_locale(locale)
    where locale <> public.canonical_locale(locale);

update public.site_pages
    set locale = public.canonical_locale(locale)
    where locale <> public.canonical_locale(locale);

-- The crawl and Settings canonicalize in the code from now on; a second copy
-- of the rule here would drift from it.
drop function public.canonical_locale;

alter table public.pages
    drop column body_html,
    drop column reading_minutes,
    add column content_hash text;

create function public.page_content_hash(page public.pages) returns text
language sql immutable
set search_path = ''
as $$
    select encode(extensions.digest(jsonb_build_array(
        page.title, page.slug, page.meta_title, page.meta_description,
        page.excerpt, page.body_md, page.faq, page.sources, page.tags,
        page.author_id
    )::text, 'sha256'), 'hex');
$$;

update public.pages set content_hash = public.page_content_hash(pages);

alter table public.pages alter column content_hash set not null;

create function public.stamp_page() returns trigger
language plpgsql
set search_path = ''
as $$
begin
    if tg_op = 'UPDATE' and old.published_at is not null
        and new.slug <> old.slug then
        raise exception 'A published page keeps its slug.';
    end if;

    new.updated_at := now();
    new.content_hash := public.page_content_hash(new);

    return new;
end;
$$;

create trigger pages_stamp
    before insert or update on public.pages
    for each row execute function public.stamp_page();

revoke update on public.pages from authenticated;

grant update (
    slug, title, meta_title, meta_description, excerpt, body_md, faq, sources,
    tags, author_id
) on public.pages to authenticated;

create index pages_translation_group_id_idx
    on public.pages (translation_group_id);

create table public.published_pages (
    page_id uuid primary key references public.pages (id) on delete cascade,
    project_id uuid not null references public.projects (id) on delete cascade,
    kind_id uuid references public.page_kinds (id) on delete set null,
    locale text not null,
    slug text not null,
    translation_group_id uuid not null,
    path text not null,
    url text not null,
    title text not null,
    meta_title text not null,
    meta_description text not null,
    excerpt text not null,
    body_md text not null,
    body_html text not null,
    toc jsonb not null,
    word_count integer not null,
    body_hash text not null,
    text_hash text not null,
    faq jsonb not null,
    sources jsonb not null,
    tags text[] not null,
    author_id uuid references public.authors (id) on delete set null,
    reading_minutes integer not null,
    content_hash text not null,
    modified_at timestamptz not null,
    updated_at timestamptz not null,
    unique (project_id, url)
);

create index published_pages_project_id_updated_at_idx
    on public.published_pages (project_id, updated_at, page_id);

create index published_pages_kind_id_idx on public.published_pages (kind_id);

create index published_pages_author_id_idx
    on public.published_pages (author_id);

create index published_pages_translation_group_id_idx
    on public.published_pages (translation_group_id);

alter table public.published_pages enable row level security;

revoke insert, update, delete on public.published_pages from anon, authenticated;

create policy "owner reads own published pages" on public.published_pages
    for select to authenticated
    using (public.is_project_owner(project_id));

-- A version is { page_id, content_hash, path, url, body_html, toc, word_count,
-- body_hash, reading_minutes }, rendered by the publishing module from the
-- working copy whose content_hash it names.
create function public.publish_pages(project uuid, versions jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    version jsonb;
    page public.pages;
    previous public.published_pages;
    author uuid;
    new_text_hash text;
    published jsonb := '[]'::jsonb;
    updated jsonb;
    groups uuid[] := '{}';
    page_ids uuid[] := array(
        select (item ->> 'page_id')::uuid
        from jsonb_array_elements(versions) as item
    );
begin
    for version in select * from jsonb_array_elements(versions) loop
        select * into page from public.pages
            where id = (version ->> 'page_id')::uuid and project_id = project
            for update;

        if not found then
            raise exception 'The page is not in this project.';
        end if;

        if page.content_hash <> version ->> 'content_hash' then
            raise exception 'The page changed since it was rendered.';
        end if;

        select coalesce(page.author_id, kinds.author_id) into author
            from (select 1) as one
            left join public.page_kinds as kinds on kinds.id = page.kind_id;

        if author is null then
            raise exception 'The page has no author.';
        end if;

        select * into previous from public.published_pages
            where page_id = page.id;

        if found and previous.path <> version ->> 'path' then
            raise exception 'The page''s path moved since it was published.';
        end if;

        new_text_hash := encode(extensions.digest(
            jsonb_build_array(page.title, page.body_md, page.faq)::text,
            'sha256'
        ), 'hex');

        insert into public.published_pages (
            page_id, project_id, kind_id, locale, slug, translation_group_id,
            path, url, title, meta_title, meta_description, excerpt, body_md,
            body_html, toc, word_count, body_hash, text_hash, faq, sources,
            tags, author_id, reading_minutes, content_hash, modified_at,
            updated_at
        ) values (
            page.id, project, page.kind_id, page.locale, page.slug,
            page.translation_group_id, version ->> 'path', version ->> 'url',
            page.title, page.meta_title, page.meta_description, page.excerpt,
            page.body_md, version ->> 'body_html', version -> 'toc',
            (version ->> 'word_count')::integer, version ->> 'body_hash',
            new_text_hash, page.faq, page.sources, page.tags, author,
            (version ->> 'reading_minutes')::integer, page.content_hash,
            case
                when previous.page_id is null or previous.text_hash <> new_text_hash
                    then now()
                else previous.modified_at
            end,
            now()
        )
        on conflict (page_id) do update set
            kind_id = excluded.kind_id,
            title = excluded.title,
            meta_title = excluded.meta_title,
            meta_description = excluded.meta_description,
            excerpt = excluded.excerpt,
            body_md = excluded.body_md,
            body_html = excluded.body_html,
            toc = excluded.toc,
            word_count = excluded.word_count,
            body_hash = excluded.body_hash,
            text_hash = excluded.text_hash,
            faq = excluded.faq,
            sources = excluded.sources,
            tags = excluded.tags,
            author_id = excluded.author_id,
            reading_minutes = excluded.reading_minutes,
            content_hash = excluded.content_hash,
            modified_at = excluded.modified_at,
            updated_at = excluded.updated_at;

        update public.pages set
            status = 'published',
            published_at = coalesce(published_at, now()),
            unpublished_at = null,
            redirect_to = null
        where id = page.id;

        published := published || jsonb_build_object(
            'id', page.id,
            'locale', page.locale,
            'slug', page.slug,
            'path', version ->> 'path',
            'url', version ->> 'url',
            'was_live', page.status = 'published',
            'body_changed', previous.page_id is null
                or previous.body_hash <> version ->> 'body_hash'
        );

        if page.status <> 'published' then
            groups := groups || page.translation_group_id;
        end if;
    end loop;

    with touched as (
        update public.published_pages as versions_live set updated_at = now()
        from public.pages as siblings
        where siblings.id = versions_live.page_id
            and siblings.translation_group_id = any (groups)
            and siblings.status = 'published'
            and siblings.id <> all (page_ids)
        returning versions_live.page_id, versions_live.locale,
            versions_live.slug, versions_live.path, versions_live.url
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', page_id, 'locale', locale, 'slug', slug, 'path', path,
        'url', url
    )), '[]'::jsonb) into updated from touched;

    return jsonb_build_object('pages', published, 'updated', updated);
end;
$$;

revoke execute on function public.publish_pages from public, anon, authenticated;

grant execute on function public.publish_pages to service_role;

create function public.unpublish_page(
    project uuid,
    page uuid,
    redirect text
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
    gone public.published_pages;
    updated jsonb;
begin
    update public.pages set
        status = 'unpublished',
        unpublished_at = now(),
        redirect_to = redirect
    where id = page and project_id = project and status = 'published';

    if not found then
        raise exception 'The page is not live in this project.';
    end if;

    update public.published_pages set updated_at = now()
        where page_id = page
        returning * into gone;

    with touched as (
        update public.published_pages as versions_live set updated_at = now()
        from public.pages as siblings
        where siblings.id = versions_live.page_id
            and siblings.translation_group_id = gone.translation_group_id
            and siblings.status = 'published'
        returning versions_live.page_id, versions_live.locale,
            versions_live.slug, versions_live.path, versions_live.url
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', page_id, 'locale', locale, 'slug', slug, 'path', path,
        'url', url
    )), '[]'::jsonb) into updated from touched;

    return jsonb_build_object(
        'pages', jsonb_build_array(jsonb_build_object(
            'id', gone.page_id,
            'locale', gone.locale,
            'slug', gone.slug,
            'path', gone.path,
            'url', gone.url,
            'redirect', redirect
        )),
        'updated', updated
    );
end;
$$;

revoke execute on function public.unpublish_page from public, anon, authenticated;

grant execute on function public.unpublish_page to service_role;

create function public.touch_live_pages(
    project uuid,
    author uuid default null,
    kind uuid default null,
    page_locale text default null
) returns jsonb
language sql
set search_path = ''
as $$
    with touched as (
        update public.published_pages as versions_live set updated_at = now()
        from public.pages
        where pages.id = versions_live.page_id
            and pages.status = 'published'
            and versions_live.project_id = project
            and (author is null or versions_live.author_id = author)
            and (kind is null or versions_live.kind_id = kind)
            and (page_locale is null or versions_live.locale = page_locale)
        returning versions_live.page_id, versions_live.locale,
            versions_live.slug, versions_live.path, versions_live.url
    )
    select coalesce(jsonb_agg(jsonb_build_object(
        'id', page_id, 'locale', locale, 'slug', slug, 'path', path,
        'url', url
    )), '[]'::jsonb) from touched;
$$;

revoke execute on function public.touch_live_pages from public, anon, authenticated;

grant execute on function public.touch_live_pages to service_role;
