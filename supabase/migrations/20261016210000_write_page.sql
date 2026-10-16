create type public.page_status as enum ('draft', 'published', 'unpublished');

create table public.pages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    kind_id uuid references public.page_kinds (id) on delete set null,
    locale text not null,
    slug text not null,
    translation_group_id uuid not null default gen_random_uuid(),
    status public.page_status not null default 'draft',
    title text not null,
    meta_title text not null default '',
    meta_description text not null default '',
    excerpt text not null default '',
    body_md text not null,
    body_html text,
    faq jsonb not null default '[]'::jsonb,
    sources jsonb not null default '[]'::jsonb,
    tags text[] not null default '{}',
    author_id uuid references public.authors (id) on delete set null,
    reading_minutes integer not null default 1,
    check_note text,
    redirect_to text,
    run_id uuid references public.runs (id) on delete set null,
    published_at timestamptz,
    updated_at timestamptz not null default now(),
    unpublished_at timestamptz,
    created_at timestamptz not null default now(),
    unique (project_id, locale, slug)
);

create index pages_kind_id_idx on public.pages (kind_id);

create index pages_author_id_idx on public.pages (author_id);

create index pages_run_id_idx on public.pages (run_id);

alter table public.pages enable row level security;

create policy "owner reads own pages" on public.pages
    for select to authenticated
    using (public.is_project_owner(project_id));

create policy "owner updates own pages" on public.pages
    for update to authenticated
    using (public.is_project_owner(project_id))
    with check (public.is_project_owner(project_id));

alter table public.runs add column locale text;
