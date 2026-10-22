-- The pages_stamp trigger overwrites it on every insert; the default only
-- keeps the column optional in the generated Insert type.
alter table public.pages alter column content_hash set default '';
