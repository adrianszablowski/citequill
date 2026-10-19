alter table public.audits drop constraint audits_cdn_test_check;

alter table public.audits
    add constraint audits_cdn_test_check
        check (
            cdn_test in ('passed', 'browser-refused', 'bot-refused', 'spoof-refused')
        );
