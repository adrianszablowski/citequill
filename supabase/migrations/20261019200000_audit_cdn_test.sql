alter table public.audits
    add column cdn_test text
        check (cdn_test in ('passed', 'browser-refused', 'bot-refused'));
