-- KARU_RLS_ROLLBACK.sql  (emergency: puts access back the way it was before the lockdown)
-- Gives everyone, including people who are not signed in, full access to every karu_ table again.
-- Use if the lockdown blocks real work, then tell me what failed and I will fix the policies.

begin;
do $$
declare t text; p text;
begin
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'karu\_%' loop
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to anon, authenticated', t);
    execute format('create policy karu_legacy_open on public.%I for all to anon, authenticated using (true) with check (true)', t);
  end loop;
end $$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in ('karu_create_sale','karu_create_loan','karu_loan_payment') loop
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;
end $$;
commit;
