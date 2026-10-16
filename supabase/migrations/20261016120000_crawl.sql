create function public.is_project_owner(project uuid) returns boolean
language sql stable
set search_path = ''
as $$
    select exists (
        select 1 from public.projects
        where id = project and user_id = (select auth.uid())
    );
$$;

create policy "owner updates own projects" on public.projects
    for update to authenticated
    using ((select auth.uid()) = user_id)
    with check ((select auth.uid()) = user_id);

create table public.project_locales (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    locale text not null,
    base_url text not null,
    is_default boolean not null default false,
    unique (project_id, locale)
);

alter table public.project_locales enable row level security;

create policy "owner reads own locales" on public.project_locales
    for select to authenticated
    using (public.is_project_owner(project_id));

create table public.authors (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null,
    title text,
    url text
);

alter table public.authors enable row level security;

create policy "owner reads own authors" on public.authors
    for select to authenticated
    using (public.is_project_owner(project_id));

create table public.skills (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null,
    description text not null default '',
    body text not null default '',
    is_product boolean not null default false,
    updated_at timestamptz not null default now()
);

create unique index skills_one_product_per_project
    on public.skills (project_id) where is_product;

alter table public.skills enable row level security;

create policy "owner reads own skills" on public.skills
    for select to authenticated
    using (public.is_project_owner(project_id));

create policy "owner updates own skills" on public.skills
    for update to authenticated
    using (public.is_project_owner(project_id))
    with check (public.is_project_owner(project_id));

create table public.page_kinds (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    name text not null,
    url_prefix text not null default '',
    skill_id uuid not null references public.skills (id),
    author_id uuid references public.authors (id) on delete set null
);

alter table public.page_kinds enable row level security;

create policy "owner reads own kinds" on public.page_kinds
    for select to authenticated
    using (public.is_project_owner(project_id));

create table public.crawled_pages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    url text not null,
    locale text,
    title text,
    body text,
    error text,
    crawled_at timestamptz not null default now(),
    unique (project_id, url)
);

alter table public.crawled_pages enable row level security;

create policy "owner reads own crawled pages" on public.crawled_pages
    for select to authenticated
    using (public.is_project_owner(project_id));

create type public.run_trigger as enum ('crawl', 'weekly', 'manual');

create type public.run_status as enum ('running', 'finished', 'failed');

create table public.runs (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    trigger public.run_trigger not null,
    topic text,
    kind_id uuid references public.page_kinds (id) on delete set null,
    status public.run_status not null default 'running',
    plan jsonb,
    input_tokens integer not null default 0,
    output_tokens integer not null default 0,
    cost_usd numeric(10, 6) not null default 0,
    error text,
    started_at timestamptz not null default now(),
    finished_at timestamptz
);

alter table public.runs enable row level security;

create policy "owner reads own runs" on public.runs
    for select to authenticated
    using (public.is_project_owner(project_id));

create policy "owner starts runs of own projects" on public.runs
    for insert to authenticated
    with check (public.is_project_owner(project_id));
