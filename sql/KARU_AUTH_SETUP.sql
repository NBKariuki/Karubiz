-- KARU_AUTH_SETUP.sql  (stage 1 of Auth + RLS: additive, locks nothing)
-- Safe to run while the live app is in use. Run BEFORE deploying v67.
-- Logins are Supabase Auth users with the email  username@karu.app  (no real mail is sent).

begin;

alter table karu_users add column if not exists auth_id uuid unique;

-- Role of the signed-in user ('owner' | 'manager' | 'attendant'), or null if not an active user.
create or replace function karu_role() returns text
language sql stable security definer set search_path = public as $$
  select role from karu_users where auth_id = auth.uid() and active is not false limit 1
$$;

-- Before login: tells the login screen what to ask for. Reveals only first name, login type and setup state.
create or replace function karu_login_info(p_username text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'first_name', split_part(full_name,' ',1),
    'auth_type',  case when role = 'attendant' then 'pin' else 'password' end,
    'needs_setup', coalesce(must_set_pin,false))
  from karu_users where lower(username) = lower(p_username) and active is not false limit 1
$$;

-- The signed-in user's own profile, never including hashes. Links the Auth user to the
-- profile by email (username@karu.app) the first time they sign in.
create or replace function karu_me() returns jsonb
language plpgsql security definer set search_path = public as $$
declare v jsonb;
begin
  if auth.uid() is null then return null; end if;
  update karu_users set auth_id = auth.uid()
   where auth_id is null and active is not false
     and lower(username) || '@karu.app' = lower(coalesce(auth.jwt() ->> 'email',''));
  select to_jsonb(u) - 'pin_hash' - 'salt' into v
    from karu_users u where u.auth_id = auth.uid() and u.active is not false;
  return v;
end $$;

-- Names of active owners and managers (for the "recorded by" buttons). Any signed-in active user.
create or replace function karu_staff() returns jsonb
language sql stable security definer set search_path = public as $$
  select case when karu_role() is null then '[]'::jsonb else
    coalesce((select jsonb_agg(jsonb_build_object('full_name',full_name,'role',role) order by created_at)
              from karu_users where active is not false and role in ('owner','manager')),'[]'::jsonb) end
$$;

-- Called by the signed-in user after they choose their own password or PIN.
create or replace function karu_cred_done() returns void
language sql security definer set search_path = public as $$
  update karu_users set must_set_pin = false where auth_id = auth.uid()
$$;

revoke all on function karu_role(), karu_login_info(text), karu_me(), karu_staff(), karu_cred_done() from public, anon;
grant execute on function karu_login_info(text) to anon, authenticated;
grant execute on function karu_role(), karu_me(), karu_staff(), karu_cred_done() to authenticated;

commit;

-- AFTER running this, create one Supabase Auth user for each active person:
--   Supabase dashboard > Authentication > Users > Add user
--   Email:    <username>@karu.app      (the username exactly as in karu_users)
--   Password: owners/managers: 8+ characters with a letter and a number
--             attendants: a 6-digit PIN
--   Tick "Auto Confirm User".
-- People you give a temporary password to should choose their own at first login. Mark them:
--   update karu_users set must_set_pin = true where username in ('attendant1','attendant2');
-- Owners who chose their own password in the dashboard need no change:
--   update karu_users set must_set_pin = false where username in ('burton','martin');
