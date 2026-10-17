create extension if not exists pgcrypto with schema extensions;

alter type public.run_trigger add value 'audit';

alter table public.runs
    add column workflow_run_id text,
    add column progressed_at timestamptz;

alter table public.projects
    add column obey_robots boolean not null default true,
    add column bot_secret text not null
        default encode(extensions.gen_random_bytes(32), 'hex');

create table public.audits (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    run_id uuid not null unique references public.runs (id) on delete cascade,
    score integer,
    is_gated boolean not null default false,
    is_partial boolean not null default false,
    checks_scored integer not null default 0,
    checks_total integer not null default 0,
    pages_read integer not null default 0,
    pages_indexable integer not null default 0,
    pages_rendered integer not null default 0,
    severity_3 integer not null default 0,
    severity_2 integer not null default 0,
    severity_1 integer not null default 0,
    hints integer not null default 0,
    questions integer not null default 0,
    duration_s integer,
    request_count integer not null default 0,
    host_429_count integer not null default 0,
    host_5xx_count integer not null default 0,
    sandbox_cpu_s numeric not null default 0,
    sandbox_gb_h numeric not null default 0,
    sandbox_names jsonb,
    robots_rules jsonb,
    render_token_hash text,
    render_token_expires_at timestamptz,
    created_at timestamptz not null default now()
);

create index audits_project_id_idx on public.audits (project_id);

alter table public.audits enable row level security;

create policy "owner reads own audits" on public.audits
    for select to authenticated
    using (public.is_project_owner(project_id));

create table public.site_pages (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    url text not null,
    locale text,
    status_code integer,
    final_url text,
    redirect_to text,
    is_indexable boolean not null default false,
    is_blocked boolean not null default false,
    canonical_url text,
    title text,
    body_hash text,
    in_sitemap boolean not null default false,
    hreflang jsonb,
    click_depth integer,
    inbound_links integer not null default 0,
    raw_extract jsonb,
    page_id uuid references public.pages (id) on delete set null,
    first_seen_at timestamptz not null default now(),
    last_seen_at timestamptz not null default now(),
    is_gone boolean not null default false,
    last_audit_id uuid references public.audits (id) on delete set null,
    unique (project_id, url)
);

create index site_pages_page_id_idx on public.site_pages (page_id);

create index site_pages_last_audit_id_idx on public.site_pages (last_audit_id);

alter table public.site_pages enable row level security;

create policy "owner reads own site pages" on public.site_pages
    for select to authenticated
    using (public.is_project_owner(project_id));

create type public.audit_queue_state as enum ('queued', 'read', 'blocked');

create table public.audit_queue (
    audit_id uuid not null references public.audits (id) on delete cascade,
    url text not null,
    depth integer,
    state public.audit_queue_state not null default 'queued',
    in_sitemap boolean not null default false,
    inbound_links integer not null default 0,
    primary key (audit_id, url)
);

alter table public.audit_queue enable row level security;

create policy "owner reads own audit queue" on public.audit_queue
    for select to authenticated
    using (
        exists (
            select 1 from public.audits
            where audits.id = audit_id
                and public.is_project_owner(audits.project_id)
        )
    );

create table public.audit_check_results (
    audit_id uuid not null references public.audits (id) on delete cascade,
    project_id uuid not null references public.projects (id) on delete cascade,
    "check" text not null,
    pages_checked integer not null default 0,
    pages_failed integer not null default 0,
    pages_intended integer not null default 0,
    primary key (audit_id, "check")
);

create index audit_check_results_project_id_idx
    on public.audit_check_results (project_id);

alter table public.audit_check_results enable row level security;

create policy "owner reads own check results" on public.audit_check_results
    for select to authenticated
    using (public.is_project_owner(project_id));

create table public.audit_findings (
    id uuid primary key default gen_random_uuid(),
    audit_id uuid not null references public.audits (id) on delete cascade,
    project_id uuid not null references public.projects (id) on delete cascade,
    site_page_id uuid references public.site_pages (id) on delete cascade,
    "check" text not null,
    severity text not null
        check (severity in ('3', '2', '1', 'hint', 'question')),
    subject text,
    selector text,
    snippet text,
    detail jsonb,
    fingerprint text not null,
    is_intended boolean not null default false
);

create index audit_findings_audit_id_idx on public.audit_findings (audit_id);

create index audit_findings_project_id_idx on public.audit_findings (project_id);

create index audit_findings_site_page_id_idx
    on public.audit_findings (site_page_id);

alter table public.audit_findings enable row level security;

create policy "owner reads own findings" on public.audit_findings
    for select to authenticated
    using (public.is_project_owner(project_id));

create table public.audit_renders (
    audit_id uuid not null references public.audits (id) on delete cascade,
    site_page_id uuid not null references public.site_pages (id) on delete cascade,
    result jsonb not null,
    posted_at timestamptz not null default now(),
    primary key (audit_id, site_page_id)
);

create index audit_renders_site_page_id_idx
    on public.audit_renders (site_page_id);

alter table public.audit_renders enable row level security;

create policy "owner reads own renders" on public.audit_renders
    for select to authenticated
    using (
        exists (
            select 1 from public.audits
            where audits.id = audit_id
                and public.is_project_owner(audits.project_id)
        )
    );

create table public.audit_marks (
    id uuid primary key default gen_random_uuid(),
    project_id uuid not null references public.projects (id) on delete cascade,
    "check" text not null,
    url text,
    selector text,
    note text,
    created_at timestamptz not null default now(),
    unique nulls not distinct (project_id, "check", url, selector)
);

alter table public.audit_marks enable row level security;

create policy "owner reads own marks" on public.audit_marks
    for select to authenticated
    using (public.is_project_owner(project_id));

create policy "owner marks own findings" on public.audit_marks
    for insert to authenticated
    with check (public.is_project_owner(project_id));

create policy "owner removes own marks" on public.audit_marks
    for delete to authenticated
    using (public.is_project_owner(project_id));

create function public.create_audit(run uuid) returns uuid
language sql
security definer
set search_path = ''
as $$
    insert into public.audits (project_id, run_id)
    select project_id, id from public.runs
    where id = run
        -- Compared as text: Postgres refuses the value 'audit', added at the
        -- top of this migration, until the migration's transaction commits.
        and runs.trigger::text = 'audit'
        and public.is_project_owner(project_id)
    returning id;
$$;

revoke execute on function public.create_audit from public, anon;

grant execute on function public.create_audit to authenticated;

create function public.stop_audit(audit uuid) returns void
language sql
security definer
set search_path = ''
as $$
    update public.audits
    set is_partial = true
    where id = audit
        and public.is_project_owner(project_id)
        and exists (
            select 1 from public.runs
            where runs.id = audits.run_id and runs.status = 'failed'
        );
$$;

revoke execute on function public.stop_audit from public, anon;

grant execute on function public.stop_audit to authenticated;
