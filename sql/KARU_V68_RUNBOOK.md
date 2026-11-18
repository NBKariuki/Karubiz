# v68 runbook: all-or-nothing void, payment and exchange

Order matters.

1. **Run `KARU_SALE_FLOW_V2.sql`** in the Supabase SQL editor. It adds three functions and changes nothing else. Safe to run more than once. Your current app keeps working.
2. **Deploy v68.**
3. **Test as owner:**
   - Make a small test sale, then void it. Check Stock came back and the Ledger shows the reversal.
   - Make an instalment sale, add a payment, and check the balance.
   - Exchange an open instalment sale.
4. **Test as an attendant on their phone:** make a sale, then add an instalment payment. The price adjustment link is now hidden for attendants.
5. **Only after step 4 works, run `KARU_ATTENDANT_TIGHTEN.sql`.** Attendants can then no longer write sales, payments, credit, money or audit rows directly. Undo by running `KARU_RLS_LOCKDOWN.sql` again.

New server rules (the app already matched these in its buttons, now the database enforces them):
- Void: owner only, within 24 hours, once only.
- Exchange or edit: owner only; open instalments any time, closed sales within 24 hours.
- Price adjustment at settlement: owner or manager only.
- A payment can't exceed the balance, and an M-Pesa payment needs a code.
- An exchange that would create store credit for a sale with no customer phone now stops before changing anything.
