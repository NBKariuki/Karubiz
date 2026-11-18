-- KARU_SALE_FLOW_V2.sql
-- Makes void, instalment payment and exchange all-or-nothing (one database call each), with the
-- permission and 24-hour rules enforced on the server. Safe to run more than once.
-- Run after KARU_RLS_LOCKDOWN.sql. Deploy v68 after this.

begin;

-- ---- internal helpers (not callable by the app) ----
create or replace function karu__stock_take(p_name text, p_qty numeric, out cost_total numeric, out short numeric)
language plpgsql set search_path = public as $$
declare r record; remaining numeric := p_qty; t numeric; avgc numeric;
begin
  cost_total := 0;
  for r in select id, (qty_in - qty_sold - coalesce(qty_adjusted,0)) as avail, coalesce(unit_cost,0) as uc
             from karu_stock
            where lower(name) = lower(p_name) and qty_in - qty_sold - coalesce(qty_adjusted,0) > 0
            order by date_in, id for update loop
    exit when remaining <= 0;
    t := least(remaining, r.avail);
    update karu_stock set qty_sold = qty_sold + t where id = r.id;
    cost_total := cost_total + t * r.uc;
    remaining := remaining - t;
  end loop;
  short := greatest(remaining, 0);
  if short > 0 then
    select coalesce(avg(unit_cost),0) into avgc from karu_stock where lower(name) = lower(p_name);
    cost_total := cost_total + short * avgc;
  end if;
end $$;

create or replace function karu__stock_return(p_name text, p_qty numeric) returns void
language plpgsql set search_path = public as $$
declare r record; remaining numeric := p_qty; t numeric;
begin
  for r in select id, qty_sold from karu_stock where lower(name) = lower(p_name) and qty_sold > 0
            order by date_in desc, id desc for update loop
    exit when remaining <= 0;
    t := least(remaining, r.qty_sold);
    update karu_stock set qty_sold = qty_sold - t where id = r.id;
    remaining := remaining - t;
  end loop;
end $$;

-- ---- VOID (owner only, within 24 hours) ----
create or replace function karu_void_sale(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s karu_sales%rowtype; it jsonb; paid numeric; cashp numeric; mpesap numeric; ratio numeric;
        cb numeric; mb numeric; who text := coalesce(p->>'by',''); why text := btrim(coalesce(p->>'reason',''));
begin
  if karu_role() is distinct from 'owner' then raise exception 'Only the owner can void a sale.'; end if;
  if why = '' then raise exception 'Reason required.'; end if;
  select * into s from karu_sales where id::text = p->>'id' for update;
  if not found then raise exception 'Sale not found.'; end if;
  if coalesce(s.voided,false) then raise exception 'This sale is already voided.'; end if;
  if s.created_at is not null and now() - s.created_at > interval '24 hours' then
    raise exception 'Locked: a sale can only be voided within 24 hours.'; end if;

  update karu_sales set voided = true, void_reason = why, voided_by = who, voided_at = now() where id = s.id;

  for it in select * from jsonb_array_elements(coalesce(s.items::jsonb,'[]'::jsonb)) loop
    perform karu__stock_return(it->>'name', coalesce((it->>'qty')::numeric,1));
  end loop;

  paid := coalesce(s.amount_paid, s.total);
  cashp := coalesce(s.cash_part,0); mpesap := coalesce(s.mpesa_part,0);
  if s.payment_method = 'Split' and (cashp + mpesap) > 0 then
    ratio := paid / greatest(coalesce(s.total,1),1);
    cb := round(cashp * ratio); mb := round(mpesap * ratio);
    if cb > 0 then insert into karu_money(account,amount,type,ref,description,date,recorded_by)
      values ('cash', -cb, 'void', s.receipt_no, 'Voided '||s.receipt_no||' · '||s.customer_name||' (cash)', current_date, who); end if;
    if mb > 0 then insert into karu_money(account,amount,type,ref,description,date,recorded_by)
      values ('sacco', -mb, 'void', s.receipt_no, 'Voided '||s.receipt_no||' · '||s.customer_name||' (mpesa)', current_date, who); end if;
  elsif paid > 0 then
    insert into karu_money(account,amount,type,ref,description,date,recorded_by)
    values (case when s.payment_method = 'M-Pesa' then 'sacco' else 'cash' end, -paid, 'void', s.receipt_no,
            'Voided '||s.receipt_no||' · '||s.customer_name, current_date, who);
  end if;

  if coalesce(s.credit_applied,0) > 0 and btrim(coalesce(s.customer_phone,'')) <> '' then
    insert into karu_credit(customer_name,customer_phone,amount,reason,ref_receipt,recorded_by,date)
    values (s.customer_name, s.customer_phone, s.credit_applied, 'Reinstated — voided '||s.receipt_no, s.receipt_no, who, current_date);
  end if;
  if coalesce(s.store_credit_note,0) > 0 and btrim(coalesce(s.customer_phone,'')) <> '' then
    insert into karu_credit(customer_name,customer_phone,amount,reason,ref_receipt,recorded_by,date)
    values (s.customer_name, s.customer_phone, -s.store_credit_note, 'Cancelled — voided '||s.receipt_no, s.receipt_no, who, current_date);
  end if;

  insert into karu_audit(trip_no,record_id,action,field_changed,old_value,new_value,reason,changed_by)
  values (null, s.id, 'void_sale', s.receipt_no, s.total::text, '0', why, who);
  return jsonb_build_object('ok', true, 'receipt_no', s.receipt_no);
end $$;

-- ---- INSTALMENT PAYMENT (any signed-in user; price adjustment owner/manager only) ----
create or replace function karu_add_payment(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s karu_sales%rowtype; amt numeric := (p->>'amount')::numeric; adj numeric := coalesce((p->>'adj')::numeric,0);
        method text := coalesce(p->>'method','cash'); code text := upper(btrim(coalesce(p->>'code','')));
        who text := coalesce(p->>'by',''); newtotal numeric; balnow numeric; newpaid numeric; newbal numeric;
begin
  if karu_role() is null then raise exception 'Not allowed.'; end if;
  if amt is null or amt <= 0 then raise exception 'Enter a valid amount.'; end if;
  if adj <> 0 and karu_role() not in ('owner','manager') then raise exception 'Only the owner or a manager can adjust a price.'; end if;
  if method = 'mpesa' and code = '' then raise exception 'M-Pesa code required.'; end if;
  select * into s from karu_sales where id::text = p->>'id' for update;
  if not found then raise exception 'Sale not found.'; end if;
  if coalesce(s.voided,false) then raise exception 'This sale was voided.'; end if;
  newtotal := s.total + adj;
  balnow := greatest(0, newtotal - coalesce(s.amount_paid,0));
  if amt > balnow + 0.5 then raise exception 'That is more than the balance owed (KSh %).', round(balnow); end if;
  newpaid := coalesce(s.amount_paid,0) + amt;
  newbal := greatest(0, newtotal - newpaid);

  insert into karu_payments(sale_id,receipt_no,customer_name,amount,payment_method,mpesa_code,date,recorded_by,notes)
  values (s.id, s.receipt_no, s.customer_name, amt, case when method='mpesa' then 'M-Pesa' else 'Cash' end, code, current_date, who,
          coalesce(nullif(p->>'notes',''),'Instalment payment'));
  update karu_sales set amount_paid = newpaid, balance_due = newbal,
         payment_type = case when newbal <= 0.5 then 'full' else 'instalment' end,
         total = newtotal, price_adjustment = coalesce(price_adjustment,0) + adj
   where id = s.id;
  insert into karu_money(account,amount,type,ref,description,date,recorded_by)
  values (case when method='mpesa' then 'sacco' else 'cash' end, amt, 'sale', s.receipt_no,
          'Instalment '||s.receipt_no||' · '||s.customer_name, current_date, who);
  if adj <> 0 then
    insert into karu_audit(trip_no,record_id,action,field_changed,old_value,new_value,reason,changed_by)
    values (null, s.id, 'price_adjustment', s.receipt_no, s.total::text, newtotal::text,
            'Price adjustment '||case when adj>0 then '+' else '' end||adj::text||' on settlement', who);
  end if;
  return jsonb_build_object('ok', true, 'balance', newbal, 'cleared', newbal <= 0.5);
end $$;

-- ---- EXCHANGE / EDIT (owner only; open instalments any time, closed sales within 24 hours) ----
create or replace function karu_exchange_sale(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s karu_sales%rowtype; it jsonb; newitems jsonb := '[]'::jsonb; oldtxt text; newtxt text; paid numeric; newtotal numeric := 0;
        newbal numeric := 0; credit numeric := 0; c record; unitcost numeric; q numeric; shorts jsonb := '[]'::jsonb;
        who text := coalesce(p->>'by',''); why text := btrim(coalesce(p->>'reason',''));
begin
  if karu_role() is distinct from 'owner' then raise exception 'Only the owner can change a sale.'; end if;
  if why = '' then raise exception 'Reason for the change is required.'; end if;
  if jsonb_typeof(p->'items') is distinct from 'array' or jsonb_array_length(p->'items') = 0 then raise exception 'Add at least one item.'; end if;
  select * into s from karu_sales where id::text = p->>'id' for update;
  if not found then raise exception 'Sale not found.'; end if;
  if coalesce(s.voided,false) then raise exception 'This sale was voided.'; end if;
  if coalesce(s.balance_due,0) <= 0 and s.created_at is not null and now() - s.created_at > interval '24 hours' then
    raise exception 'Locked: a closed sale can only be changed within 24 hours.'; end if;
  paid := coalesce(s.amount_paid, s.total);

  select string_agg((x->>'name')||' x'||coalesce(x->>'qty','1'), ', ') into oldtxt from jsonb_array_elements(coalesce(s.items::jsonb,'[]'::jsonb)) x;
  for it in select * from jsonb_array_elements(coalesce(s.items::jsonb,'[]'::jsonb)) loop
    perform karu__stock_return(it->>'name', coalesce((it->>'qty')::numeric,1));
  end loop;

  for it in select * from jsonb_array_elements(p->'items') loop
    if btrim(coalesce(it->>'name','')) = '' or coalesce((it->>'price')::numeric,0) <= 0 then raise exception 'Every item needs a name and a price.'; end if;
    q := coalesce((it->>'qty')::numeric,1);
    select * into c from karu__stock_take(it->>'name', q);
    if c.short > 0 then shorts := shorts || jsonb_build_array(jsonb_build_object('name', it->>'name', 'missing', c.short)); end if;
    unitcost := round(c.cost_total / nullif(q,0), 4);
    newitems := newitems || jsonb_build_array(case when coalesce(unitcost,0) > 0 then it || jsonb_build_object('cost', unitcost) else it end);
    newtotal := newtotal + q * (it->>'price')::numeric;
  end loop;
  select string_agg((x->>'name')||' x'||coalesce(x->>'qty','1'), ', ') into newtxt from jsonb_array_elements(newitems) x;

  if paid >= newtotal then credit := paid - newtotal; newbal := 0; else newbal := newtotal - paid; end if;
  if credit > 0 then
    if btrim(coalesce(s.customer_phone,'')) = '' then
      raise exception 'This change creates store credit, but the sale has no customer phone. Add a phone to the customer first.'; end if;
    insert into karu_credit(customer_name,customer_phone,amount,reason,ref_receipt,recorded_by,date)
    values (s.customer_name, s.customer_phone, credit, 'Overpayment after exchange on '||s.receipt_no, s.receipt_no, who, current_date);
  end if;

  update karu_sales set items = newitems, total = newtotal, amount_paid = least(paid, newtotal), balance_due = newbal,
         payment_type = case when newbal > 0 then 'instalment' else 'full' end, store_credit_note = credit, exchanged_from = oldtxt
   where id = s.id;
  insert into karu_audit(trip_no,record_id,action,field_changed,old_value,new_value,reason,changed_by)
  values (null, s.id, 'exchange', s.receipt_no, oldtxt, newtxt, why, who);
  return jsonb_build_object('ok', true, 'credit', credit, 'balance', newbal, 'short', shorts);
end $$;

revoke all on function karu__stock_take(text,numeric), karu__stock_return(text,numeric) from public, anon, authenticated;
revoke all on function karu_void_sale(jsonb), karu_add_payment(jsonb), karu_exchange_sale(jsonb) from public, anon;
grant execute on function karu_void_sale(jsonb), karu_add_payment(jsonb), karu_exchange_sale(jsonb) to authenticated;

commit;
