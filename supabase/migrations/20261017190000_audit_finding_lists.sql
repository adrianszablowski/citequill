create function public.audit_check_list(audit uuid, locale text default null)
returns table (
    "check" text,
    severity text,
    severity_rank integer,
    pages_failed integer,
    pages_intended integer
)
language sql
stable
security invoker
set search_path = ''
as $$
    select per_page."check",
        per_page.severity,
        -- Follows severities in features/audit/schema.ts, or the table sorts in
        -- another order than the filter lists.
        case per_page.severity
            when '3' then 1
            when '2' then 2
            when '1' then 3
            when 'hint' then 4
            else 5
        end,
        count(*)::integer,
        (count(*) filter (where per_page.is_intended))::integer
    from (
        select findings."check",
            findings.severity,
            findings.site_page_id,
            bool_and(findings.is_intended) as is_intended
        from public.audit_findings findings
        left join public.site_pages pages on pages.id = findings.site_page_id
        where findings.audit_id = audit_check_list.audit
            and (
                audit_check_list.locale is null
                or findings.site_page_id is null
                or pages.locale = audit_check_list.locale
            )
        group by findings."check", findings.severity, findings.site_page_id
    ) per_page
    group by per_page."check", per_page.severity;
$$;

revoke execute on function public.audit_check_list from public, anon;

grant execute on function public.audit_check_list to authenticated;

create function public.audit_page_list(audit uuid)
returns table (
    id uuid,
    url text,
    locale text,
    status_code integer,
    canonical_url text,
    title text,
    page_id uuid,
    findings integer,
    severity_3 integer,
    severity_2 integer,
    severity_1 integer,
    hints integer,
    questions integer
)
language sql
stable
security invoker
set search_path = ''
as $$
    select pages.id,
        pages.url,
        pages.locale,
        pages.status_code,
        pages.canonical_url,
        pages.title,
        pages.page_id,
        (count(*) filter (where not findings.is_intended))::integer,
        (count(*) filter (
            where findings.severity = '3' and not findings.is_intended
        ))::integer,
        (count(*) filter (
            where findings.severity = '2' and not findings.is_intended
        ))::integer,
        (count(*) filter (
            where findings.severity = '1' and not findings.is_intended
        ))::integer,
        (count(*) filter (
            where findings.severity = 'hint' and not findings.is_intended
        ))::integer,
        (count(*) filter (
            where findings.severity = 'question' and not findings.is_intended
        ))::integer
    from public.audit_findings findings
    join public.site_pages pages on pages.id = findings.site_page_id
    where findings.audit_id = audit_page_list.audit
    group by pages.id;
$$;

revoke execute on function public.audit_page_list from public, anon;

grant execute on function public.audit_page_list to authenticated;
