alter table public.site_pages
    add column hreflang_count integer not null default 0;

alter table public.audit_queue
    add column alternates jsonb;
