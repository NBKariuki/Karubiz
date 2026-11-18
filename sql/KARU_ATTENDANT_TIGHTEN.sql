-- KARU_ATTENDANT_TIGHTEN.sql
-- Run AFTER v68 is deployed and an attendant has made a successful test sale and instalment payment.
-- Attendants then keep read access and can add products, but can no longer write sales, payments,
-- credit, money or audit rows directly. All of that goes through the database functions.
-- To undo: run KARU_RLS_LOCKDOWN.sql again (it rebuilds every policy).

begin;
drop policy if exists karu_insert_attendant on karu_sales;
drop policy if exists karu_update_attendant on karu_sales;
drop policy if exists karu_insert_attendant on karu_payments;
drop policy if exists karu_insert_attendant on karu_credit;
drop policy if exists karu_update_attendant on karu_stock;
drop policy if exists karu_insert_owner_manager_attendant on karu_money;
drop policy if exists karu_insert_owner_manager_attendant on karu_audit;
-- owners and managers keep full access through their own policies
do $$ begin
  if to_regclass('public.karu_audit') is not null and not exists (select 1 from pg_policies where tablename='karu_audit' and policyname='karu_insert_owner_manager') then
    create policy karu_insert_owner_manager on karu_audit for insert to authenticated with check (karu_role() in ('owner','manager'));
  end if;
  if to_regclass('public.karu_money') is not null and not exists (select 1 from pg_policies where tablename='karu_money' and policyname='karu_insert_owner_manager') then
    create policy karu_insert_owner_manager on karu_money for insert to authenticated with check (karu_role() in ('owner','manager'));
  end if;
end $$;
commit;
