alter table public.site_pages
    add column jsonld_count integer not null default 0,
    add column has_microdata boolean not null default false;

alter type public.audit_resource_kind add value 'jsonld_image' after 'og_image';
