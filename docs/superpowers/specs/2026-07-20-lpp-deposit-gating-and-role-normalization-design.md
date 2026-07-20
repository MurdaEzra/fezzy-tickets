# LPP Deposit Gating And Role Normalization Design

## Goal

Make Lipa Pole Pole explicit and safe: the buyer chooses a plan, enters an M-Pesa number for the deposit STK push, and no payment plan exists until the deposit callback succeeds. After that, installments are paid in order, and tickets are issued only after the full balance is cleared. Normalize application roles to only `attendee`, `organizer`, and `admin`.

## LPP Workflow

Checkout shows an explicit LPP deposit phone input when a plan is selected. The selected event, tier, holders, plan id, and normalized deposit phone are sent to `lpp-init-plan`. That function validates availability and sends an STK push for the deposit amount. It returns a reference number immediately, but it does not create a `payment_plans` row.

`lpp-mpesa-callback` is the only place that creates the plan. If the callback is for the deposit (`seq=0`) and succeeds, it creates the plan with the deposit installment already marked `paid`, inserts the remaining installments as `pending`, and sends the deposit receipt. If the callback fails, no plan is created and `lpp-get-plan` continues to report a pending deposit state for the reference.

`lpp-pay-installment` only accepts existing, active plans. It finds the next pending installment by sequence and sends an STK push for that amount. Successful installment callbacks update paid/balance totals. When balance reaches zero, the callback marks the plan completed and issues the order/tickets exactly once.

## Ticket Issuance

Ticket issuance must be idempotent because M-Pesa callbacks can repeat. The final callback should check whether an order has already been linked to the completed LPP plan before inserting a new order or tickets. A new migration adds an `order_id` column to `payment_plans` for that link. If `order_id` already exists, the callback returns success without creating duplicates.

## Roles

The app should treat `admin` as the only platform admin role. Existing `super_admin` checks in React pages, Edge Functions, tests, migrations, and generated local types should be replaced with `admin`. A migration maps any rows with `role='super_admin'` to `role='admin'` where possible, then removes `super_admin` from the exposed role type assumptions for future code.

## Verification

Add source-level tests for the LPP guard rails and role normalization:

- checkout passes a dedicated deposit STK phone to LPP initiation;
- the deposit callback creates the plan only after successful deposit payment;
- installment payment requires an existing plan;
- final LPP ticket issuance is idempotent through `payment_plans.order_id`;
- code no longer checks for or labels `super_admin`.

