create function public.audit_image_list(
    audit uuid,
    check_ids text[],
    locale text default null
)
returns table (
    subject text,
    checks text[],
    alts text[],
    ancestors text[],
    selector text,
    snippet text,
    pages integer,
    pages_intended integer
)
language sql
stable
security invoker
set search_path = ''
as $$
    select scoped.subject,
        array_agg(distinct scoped."check" order by scoped."check"),
        coalesce(
            array_agg(distinct scoped.alt order by scoped.alt)
                filter (where scoped.alt is not null),
            '{}'
        ),
        coalesce(
            array_agg(distinct scoped.ancestor order by scoped.ancestor)
                filter (where scoped.ancestor is not null),
            '{}'
        ),
        min(scoped.selector),
        min(scoped.snippet),
        count(distinct scoped.site_page_id)::integer,
        (count(distinct scoped.site_page_id) filter (
            where scoped.is_page_intended
        ))::integer
    from (
        select findings.subject,
            findings."check",
            findings.site_page_id,
            findings.selector,
            findings.snippet,
            findings.detail ->> 'alt' as alt,
            findings.detail ->> 'ancestor' as ancestor,
            bool_and(findings.is_intended) over (
                partition by findings.subject, findings.site_page_id
            ) as is_page_intended
        from public.audit_findings findings
        left join public.site_pages pages on pages.id = findings.site_page_id
        where findings.audit_id = audit_image_list.audit
            and findings.subject is not null
            and findings."check" = any(audit_image_list.check_ids)
            and (
                audit_image_list.locale is null
                or findings.site_page_id is null
                or pages.locale = audit_image_list.locale
            )
    ) scoped
    group by scoped.subject;
$$;

revoke execute on function public.audit_image_list from public, anon;

grant execute on function public.audit_image_list to authenticated;

alter table public.audits
    add column findings_fixed integer,
    add column findings_new integer;

drop function public.score_audit(
    uuid,
    integer,
    boolean,
    integer,
    integer,
    integer,
    integer,
    integer,
    integer,
    integer,
    uuid[],
    jsonb
);

create function public.score_audit(
    audit uuid,
    score integer,
    is_gated boolean,
    checks_scored integer,
    checks_total integer,
    severity_3 integer,
    severity_2 integer,
    severity_1 integer,
    hints integer,
    questions integer,
    intended uuid[],
    results jsonb,
    findings_fixed integer default null,
    findings_new integer default null
) returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    target public.audits;
begin
    select audits.* into target
    from public.audits
    join public.runs on runs.id = audits.run_id
    where audits.id = score_audit.audit
        and (
            -- Execute is revoked from anon, so a caller with no user is the
            -- Workflow's service role, scoring the audit its run is still on.
            (select auth.uid()) is null
            or (
                public.is_project_owner(audits.project_id)
                and runs.status <> 'running'
            )
        )
        and audits.id = (
            select latest.id from public.audits latest
            where latest.project_id = audits.project_id
            order by latest.created_at desc
            limit 1
        );

    if not found then
        return;
    end if;

    update public.audits
    set score = score_audit.score,
        is_gated = score_audit.is_gated,
        checks_scored = score_audit.checks_scored,
        checks_total = score_audit.checks_total,
        severity_3 = score_audit.severity_3,
        severity_2 = score_audit.severity_2,
        severity_1 = score_audit.severity_1,
        hints = score_audit.hints,
        questions = score_audit.questions,
        findings_fixed = score_audit.findings_fixed,
        findings_new = score_audit.findings_new
    where id = target.id;

    update public.audit_findings
    set is_intended = id = any(coalesce(score_audit.intended, '{}'))
    where audit_id = target.id;

    delete from public.audit_check_results where audit_id = target.id;

    insert into public.audit_check_results
        (audit_id, project_id, "check", pages_checked, pages_failed, pages_intended)
    select target.id, target.project_id, result."check",
        result.pages_checked, result.pages_failed, result.pages_intended
    from jsonb_to_recordset(score_audit.results) as result (
        "check" text,
        pages_checked integer,
        pages_failed integer,
        pages_intended integer
    );
end;
$$;

revoke execute on function public.score_audit from public, anon;

grant execute on function public.score_audit to authenticated, service_role;
