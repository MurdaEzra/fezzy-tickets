# LPP Deposit Gating And Role Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate LPP plan creation behind a successful deposit STK callback, issue tickets only after full payment, and normalize platform roles to `attendee`, `organizer`, and `admin`.

**Architecture:** Keep LPP initiation as a stateless deposit STK starter, use the M-Pesa callback as the authoritative state transition point, and link completed LPP plans to issued orders for idempotency. Replace `super_admin` application checks with `admin` and add a migration to clean existing role rows.

**Tech Stack:** React/Vite, Supabase Edge Functions, Supabase Postgres migrations, Vitest source guard tests.

---

### Task 1: Workflow Guard Tests

**Files:**
- Create: `src/test/lpp-workflow-source.test.ts`
- Modify: `src/test/resale-workflow-source.test.ts`

- [ ] Add tests asserting LPP checkout sends `depositPhone`, `lpp-init-plan` returns no plan before deposit success, `lpp-pay-installment` requires an existing plan, `lpp-mpesa-callback` links `order_id`, and source no longer uses `super_admin`.
- [ ] Run `npx vitest run src/test/lpp-workflow-source.test.ts src/test/resale-workflow-source.test.ts` and verify the new tests fail before implementation.

### Task 2: LPP Checkout Deposit Phone

**Files:**
- Modify: `src/pages/Checkout.tsx`
- Modify: `src/lib/lpp.ts`

- [ ] Add `lppDepositPhone` state in checkout.
- [ ] Render an explicit M-Pesa deposit phone input in the LPP block.
- [ ] Send `depositPhone` to `lppInitPlan`; keep holder phones as holder contact data.
- [ ] Update `lppInitPlan` client type to include `depositPhone`.

### Task 3: Edge Function LPP State

**Files:**
- Modify: `supabase/functions/lpp-init-plan/index.ts`
- Modify: `supabase/functions/lpp-mpesa-callback/index.ts`
- Modify: `supabase/functions/lpp-pay-installment/index.ts`

- [ ] Accept and normalize `depositPhone` in `lpp-init-plan`; use it for the deposit STK payload and callback state.
- [ ] Keep `lpp-init-plan` planless before callback success.
- [ ] In the callback, create the plan only for successful `seq=0` callbacks with valid state.
- [ ] In installment callbacks, keep installment updates ordered by sequence and update totals from the paid installment.
- [ ] Before issuing tickets, check `plan.order_id`; after creating an order, write the order id back to the plan.

### Task 4: Database Migration And Types

**Files:**
- Create: `supabase/migrations/20260720110000_lpp_order_id_and_admin_role_cleanup.sql`
- Modify: `src/integrations/supabase/types.ts`

- [ ] Add `payment_plans.order_id uuid REFERENCES public.orders(id)`.
- [ ] Add an index on `payment_plans(order_id)`.
- [ ] Update existing `super_admin` role rows to `admin` before enum cleanup.
- [ ] Update local generated types so `app_role` is `admin | organizer | attendee`.

### Task 5: Replace Role Usage

**Files:**
- Modify: `src/components/Navbar.tsx`
- Modify: `src/pages/SuperAdminDashboard.tsx`
- Modify: `supabase/functions/resale-admin-action/index.ts`
- Modify: `supabase/functions/organizer-payout-action/index.ts`
- Modify: `supabase/functions/approve-organizer-request/index.ts`
- Modify: migrations and tests that currently assert `super_admin`.

- [ ] Replace role checks from `super_admin || admin` or `super_admin` with `admin`.
- [ ] Replace visible “Super admin” labels with “Admin”.
- [ ] Update resale approval migration/test strings to validate `admin`.

### Task 6: Verification

**Files:**
- All touched files.

- [ ] Run `npx vitest run src/test/lpp-workflow-source.test.ts src/test/resale-workflow-source.test.ts src/lib/__tests__/lppPlanState.test.ts`.
- [ ] Run `npm run build`.
- [ ] Run `git diff --check`.
- [ ] Report unavailable tooling such as `deno` or `supabase` CLI if still absent.

