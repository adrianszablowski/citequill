alter table public.crawled_pages add column signals jsonb;

create policy "owner updates own runs" on public.runs
    for update to authenticated
    using (public.is_project_owner(project_id))
    with check (public.is_project_owner(project_id));

create function public.add_run_usage(
    run uuid,
    input integer,
    output integer,
    cost numeric
) returns void
language sql
set search_path = ''
as $$
    update public.runs
    set input_tokens = input_tokens + input,
        output_tokens = output_tokens + output,
        cost_usd = cost_usd + cost
    where id = run;
$$;

revoke execute on function public.add_run_usage from public, anon, authenticated;

grant execute on function public.add_run_usage to service_role;
