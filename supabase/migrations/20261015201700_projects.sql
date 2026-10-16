create table public.projects (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
    name text not null,
    domain text not null,
    created_at timestamptz not null default now()
);

alter table public.projects enable row level security;

create policy "owner reads own projects" on public.projects
    for select to authenticated
    using ((select auth.uid()) = user_id);

create policy "owner creates own projects" on public.projects
    for insert to authenticated
    with check ((select auth.uid()) = user_id);
