-- KARU_RLS_LOCKDOWN.sql  (stage 2: turns the database off for everyone who is not signed in)
-- Run ONLY after: KARU_AUTH_SETUP.sql ran, every person has an Auth user, v67 is deployed,
-- and every person has signed in successfully at least once. Keep KARU_RLS_ROLLBACK.sql ready.
-- Runs as one transaction: if anything fails, nothing changes.

begin;

-- 1. Wipe old policies on every karu_ table, switch RLS on, take anon's table access away.
do $$
declare t text; p text;
begin
  for t in select tablename from pg_tables where schemaname='public' and tablename like 'karu\_%' loop
    execute format('alter table public.%I enable row level security', t);
    for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
      execute format('drop policy %I on public.%I', p, t);
    end loop;
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

grant usage, select on all sequences in schema public to authenticated;

-- 2. Helper that adds one policy per table and role set. Skips tables that do not exist.
create or replace function karu__pol(tbl text, cmd text, roles text[]) returns void language plpgsql as $$
declare r text := (select string_agg(quote_literal(x), ',') from unnest(roles) x);
        nm text := 'karu_' || cmd || '_' || array_to_string(roles, '_');
begin
  if to_regclass('public.' || tbl) is null then raise notice 'skipping missing table %', tbl; return; end if;
  if cmd = 'insert' then
    execute format('create policy %I on public.%I for insert to authenticated with check (karu_role() in (%s))', nm, tbl, r);
  elsif cmd in ('select','delete') then
    execute format('create policy %I on public.%I for %s to authenticated using (karu_role() in (%s))', nm, tbl, cmd, r);
  else  -- update, all
    execute format('create policy %I on public.%I for %s to authenticated using (karu_role() in (%s)) with check (karu_role() in (%s))', nm, tbl, cmd, r, r);
  end if;
end $$;

-- 3. Owners and managers: full access to day-to-day tables.
select karu__pol(t, 'all', array['owner','manager'])
  from unnest(array['karu_stock','karu_sales','karu_expenses','karu_orders','karu_credit','karu_losses',
                    'karu_trips','karu_suppliers','karu_products','karu_payments','karu_closes',
                    'karu_adjustments','karu_stocktakes']) t;

-- 4. Money log: managers read and add; owners do everything. Attendants can only add (sales record cash in).
select karu__pol('karu_money', 'select', array['owner','manager']);
select karu__pol('karu_money', 'insert', array['owner','manager','attendant']);
select karu__pol('karu_money', 'all',    array['owner']);

-- 5. Loans and team: owners only.
select karu__pol(t, 'all', array['owner']) from unnest(array['karu_loans','karu_loan_payments','karu_users']) t;

-- 6. Settings: everyone signed in reads, owners change.
select karu__pol('karu_settings', 'select', array['owner','manager','attendant']);
select karu__pol('karu_settings', 'all',    array['owner']);

-- 7. Audit log: everyone adds, owners and managers read.
select karu__pol('karu_audit', 'insert', array['owner','manager','attendant']);
select karu__pol('karu_audit', 'select', array['owner','manager']);

-- 8. Attendants: only what the Sale tab needs.
select karu__pol('karu_products', 'select', array['attendant']);
select karu__pol('karu_products', 'insert', array['attendant']);
select karu__pol('karu_stock',    'select', array['attendant']);
select karu__pol('karu_stock',    'update', array['attendant']);
select karu__pol('karu_sales',    'select', array['attendant']);
select karu__pol('karu_sales',    'insert', array['attendant']);
select karu__pol('karu_sales',    'update', array['attendant']);
select karu__pol('karu_payments', 'select', array['attendant']);
select karu__pol('karu_payments', 'insert', array['attendant']);
select karu__pol('karu_credit',   'select', array['attendant']);
select karu__pol('karu_credit',   'insert', array['attendant']);

drop function karu__pol(text, text, text[]);

-- 9. Database functions: signed-in users only. The sale function runs with owner rights so attendants can save sales.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig, p.proname from pg_proc p
           where p.pronamespace = 'public'::regnamespace and p.proname in ('karu_create_sale','karu_create_loan','karu_loan_payment') loop
    execute format('revoke all on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
    if r.proname = 'karu_create_sale' then
      execute format('alter function %s security definer set search_path = public', r.sig);
    end if;
  end loop;
end $$;

commit;
