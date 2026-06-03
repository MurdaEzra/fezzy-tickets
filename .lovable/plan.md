## Goal
One payment provider (Paystack) handling card, Apple Pay, and M-Pesa, with money split instantly between the platform and each organizer. No more held balances, no withdrawals.

## 1. Organizer dashboard — show chosen plan
- Read `plan` from `user_metadata` (already set by `Pricing.tsx`) and render it as a badge in `OrganizerDashboard.tsx` header next to the org name.
- Fallback: if no plan in metadata, show "Starter".

## 2. Auto-lock fee to 5% after first publish
- Already have `bump_organizer_publish_count` trigger. Extend it so that when `events_published_count` goes from 0 → 1, we stamp a new column `organizer_profiles.fee_locked_pct = 5`.
- `calculate-order` edge function reads `fee_locked_pct` (falling back to plan default) when computing `organizer_fee_kes`.
- Plan label on dashboard stays the user's chosen plan; we just add a small "Fee: 5%" chip once locked.

## 3. Rip out Flutterwave + PayHero + Withdrawals
**Delete:**
- `server/payments/providers/flutterwave.js` + test
- `server/payouts/payhero.js` + test, `server/payouts/service.js`
- `supabase/functions/payhero-withdraw/`
- `src/pages/dashboard/WithdrawPanel.tsx`
- Withdraw tab/route in `OrganizerDashboardTabs.tsx`
- `withdrawals` table (migration: drop table)
- `organizer_profiles` columns: `bank_name`, `bank_account_number`, `bank_account_name`, `mpesa_phone`, `preferred_payout_channel`, `payout_method`, `mpesa_till` (replaced by Paystack subaccount fields)
- PayHero secrets stay in Supabase secrets but become inert; I'll note them for manual deletion.

## 4. Add Paystack (replaces Flutterwave + M-Pesa Daraja + PayHero)
**New schema:**
- `organizer_profiles.paystack_subaccount_code text` — the `ACCT_xxx` from Paystack after subaccount creation
- `organizer_profiles.fee_locked_pct int` (see §2)
- `payments` table: add `paystack_reference text`, keep existing columns for back-compat

**New edge functions:**
- `paystack-create-subaccount` — called when organizer first sets payout details (M-Pesa number or bank). Creates a Paystack subaccount with `percentage_charge = platform fee %` so splits happen automatically on every charge.
- `paystack-init-transaction` — replaces `mpesa-stk-push` + Flutterwave init. Body: `{ order_id }`. Returns Paystack `authorization_url` + `reference`. Sets `subaccount` = organizer's code and `bearer = subaccount` so organizer pays fees on their cut.
- `paystack-webhook` — verifies `x-paystack-signature` (HMAC-SHA512 with secret key), on `charge.success` marks order paid, creates tickets, sends ticket email. Idempotent on `reference`.
- `paystack-verify` — polled by checkout page after redirect for instant UX (fallback to webhook).

**Replace/edit:**
- `src/pages/Checkout.tsx` — single "Pay now" button → call `paystack-init-transaction` → redirect to `authorization_url`. Paystack handles card/Apple Pay/M-Pesa selection on their hosted page (cleaner than juggling methods ourselves).
- New `/payment/callback` route that calls `paystack-verify` and routes to success or retry.
- `src/pages/dashboard/PayoutSetup.tsx` (new, replaces WithdrawPanel) — collects bank/M-Pesa details → calls `paystack-create-subaccount`. Shows "Connected — your share lands instantly on every sale."

## 5. Code audit pass (dedupe + intact check)
- Sweep `src/pages/Auth.tsx`, `Pricing.tsx`, `BecomeOrganizer.tsx`, `OrganizerDashboard.tsx` for repeated metadata-write logic and consolidate into a single `useOnboarding` helper in `src/lib/`.
- Verify all routes registered in `App.tsx` exist; remove any orphans (e.g. old withdraw route).
- Grep for `flutterwave`, `payhero`, `withdraw` and confirm zero references after the purge.

## 6. Secrets (ask at the end)
After the scaffold is in, I'll prompt for:
- `PAYSTACK_SECRET_KEY` (sk_test_… and sk_live_…)
- `PAYSTACK_PUBLIC_KEY` (pk_… — used client-side only, can also go in code)
- `PAYSTACK_WEBHOOK_IGNORE_LIST` (optional)

Webhook URL to register in Paystack dashboard:
`https://jgwsotitssqbiyruxpaw.supabase.co/functions/v1/paystack-webhook`

## Technical notes
- Paystack splits: setting `subaccount = ACCT_xxx` + `bearer = subaccount` on transaction init means organizer's bank receives their share T+1 (Paystack's standard settlement). For Kenya M-Pesa, settlement is same-day. This is the closest to "instantaneous" Paystack offers without manual transfers — true real-time split-and-payout isn't possible on any standard processor.
- Platform fee is enforced server-side via the subaccount's `percentage_charge`, not trusted from client.
- Existing M-Pesa Daraja edge functions (`mpesa-stk-push`, `mpesa-callback`, `mpesa-status`) become dead code — I'll delete them too since Paystack covers M-Pesa.

## Out of scope (call out)
- Migrating any existing `withdrawals` history — table will be dropped. If you want to archive first, say so.
- Refunds UI — Paystack supports refunds via API, but I'll defer that unless you ask.

Ready to execute on your approval.