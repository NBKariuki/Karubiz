# KARU Auth and RLS runbook (v67)

Do these in order. Do not skip step 1.

1. **Backup.** Supabase dashboard, Database, Backups (or export each karu_ table to CSV). If you can, first try steps 2 to 6 on a free test Supabase project.
2. **Run `KARU_AUTH_SETUP.sql`** in the SQL editor. It locks nothing and the current app (v66) keeps working.
3. **Create a login for every active person.** Authentication, Users, Add user.
   - Email: `username@karu.app` (username exactly as in karu_users)
   - Owners and managers: password with 8+ characters, a letter and a number
   - Attendants: a 6-digit PIN as the password
   - Tick Auto Confirm User
4. **Set first-login flags** (SQL editor):
   - `update karu_users set must_set_pin = true where username in ('attendant-usernames');`  (they choose their own PIN)
   - `update karu_users set must_set_pin = false where username in ('burton','martin');`  (owners who chose their own password)
5. **Deploy v67**, then have every person sign in once on their own phone. Check Sale, a test sale, Stock, Expenses, Ledger, Reports, Loans (owner), Manage team.
6. **Run `KARU_RLS_LOCKDOWN.sql`.** Check again as owner, as a manager if you have one, and as an attendant.
7. **If anything is blocked and you need to trade, run `KARU_RLS_ROLLBACK.sql`** (puts access back as before). Tell me what failed.

Stage 3 (later): once all is stable, drop the `pin_hash` and `salt` columns from karu_users and change the old anon key if you want a clean slate.

Known limits after step 6:
- Attendants can still change or void sales through the API (the app only hides it). Voids need a database function to fix properly.
- Reset password: mark the person in Manage team, then set a new temporary password for them in Supabase.
- Two people with the same first name share an owed account (same as before).
