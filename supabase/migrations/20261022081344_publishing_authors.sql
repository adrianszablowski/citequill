alter table public.authors
    add constraint authors_id_project_id_key unique (id, project_id);

alter table public.pages
    drop constraint pages_author_id_fkey,
    add constraint pages_author_id_fkey foreign key (author_id, project_id)
        references public.authors (id, project_id) on delete set null (author_id);

alter table public.page_kinds
    drop constraint page_kinds_author_id_fkey,
    add constraint page_kinds_author_id_fkey foreign key (author_id, project_id)
        references public.authors (id, project_id) on delete set null (author_id);

alter table public.published_pages
    drop constraint published_pages_author_id_fkey,
    add constraint published_pages_author_id_fkey foreign key (author_id, project_id)
        references public.authors (id, project_id) on delete set null (author_id);

-- Publish writes the resolved author into the working copy before it copies
-- content_hash, so Discard restores the published fields with one update.
create or replace function public.publish_pages(project uuid, versions jsonb)
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

        if page.author_id is null then
            update public.pages set author_id = author where id = page.id
                returning * into page;
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

drop function public.unpublish_page;

create function public.unpublish_page(
    project uuid,
    page uuid,
    redirect text default null
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
