alter table public.site_pages
    add column description text,
    add column image_count integer not null default 0;
