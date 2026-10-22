create function public.guard_author_delete() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
    perform 1 from public.projects where id = old.project_id for no key update;

    -- A project's delete cascades here after its row is gone, and takes
    -- every author with it, the last one too.
    if not found then
        return old;
    end if;

    if exists (
        select 1 from public.published_pages as live
            join public.pages as page on page.id = live.page_id
        where live.author_id = old.id and page.status = 'published'
    ) then
        raise exception 'A live page names the author.';
    end if;

    if exists (select 1 from public.page_kinds where author_id = old.id) then
        raise exception 'A page kind names the author.';
    end if;

    if not exists (
        select 1 from public.authors
        where project_id = old.project_id and id <> old.id
    ) then
        raise exception 'The author is the project''s last.';
    end if;

    return old;
end;
$$;

revoke execute on function public.guard_author_delete from public, anon, authenticated;

create trigger authors_guard_delete
    before delete on public.authors
    for each row execute function public.guard_author_delete();

revoke update on public.page_kinds from authenticated;

grant update (author_id) on public.page_kinds to authenticated;

create policy "owner updates own kinds" on public.page_kinds
    for update to authenticated
    using (public.is_project_owner(project_id))
    with check (public.is_project_owner(project_id));
