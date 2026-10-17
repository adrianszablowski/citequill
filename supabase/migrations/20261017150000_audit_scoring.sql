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
    results jsonb
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
        questions = score_audit.questions
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
