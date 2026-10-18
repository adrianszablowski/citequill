alter table public.audit_queue
    add column linked_from text[] not null default '{}';

alter table public.site_pages
    add column external_link_count integer not null default 0;

create type public.audit_resource_kind as enum (
    'image',
    'og_image',
    'asset',
    'external'
);

create type public.audit_resource_state as enum ('queued', 'checked');

create table public.audit_resources (
    audit_id uuid not null references public.audits (id) on delete cascade,
    url text not null,
    kind public.audit_resource_kind not null,
    linked_from text[] not null default '{}',
    link_count integer not null default 0,
    state public.audit_resource_state not null default 'queued',
    status_code integer,
    content_length integer,
    error text,
    primary key (audit_id, url)
);

alter table public.audit_resources enable row level security;

create policy "owner reads own audit resources" on public.audit_resources
    for select to authenticated
    using (
        exists (
            select 1 from public.audits
            where audits.id = audit_id
                and public.is_project_owner(audits.project_id)
        )
    );
