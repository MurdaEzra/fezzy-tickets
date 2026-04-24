# Secure Payments Foundation and First Live Checkout Slice

Date: 2026-04-24
Project: FEZZY
Status: Approved design draft for planning

## Summary

Build a secure payment foundation with a single backend trust boundary on Render, backed by Supabase for data and auth, and ship one real end-to-end checkout slice for a live event. The first slice covers:

- Direct M-Pesa STK push through Safaricom Daraja
- Hosted Flutterwave checkout for Visa, Mastercard, Apple Pay, and Google Pay
- Feature-gated exposure of Apple Pay and Google Pay based on environment and merchant enablement
- Checkout pages that show success only after backend-verified payment state
- Strict redirect validation, webhook verification, CORS allowlists, token-bucket rate limiting, reset-request rate limiting, and frontend-safe error messaging

This design replaces the current insecure path where the frontend can write `paid` orders and create tickets directly from [`src/pages/Checkout.tsx`](/home/murda/fezzy-tickets/src/pages/Checkout.tsx:1).

## Goals

- Remove payment trust from the browser
- Make Render the only service that can initiate provider payments and confirm final payment success
- Persist payment and checkout state in Supabase with auditable records
- Support guest and signed-in checkout
- Prevent raw provider or backend errors from reaching the frontend
- Lock down redirect handling, webhook handling, and browser CORS
- Rate-limit payment initiation, status polling, and password-reset requests
- Deliver one production-shaped live checkout flow for a real published event and real ticket tiers

## Non-Goals

- Full site-wide removal of all mock event data in this milestone
- Full organizer payouts or settlement automation
- Full refund workflow automation
- Multi-currency settlement or cross-border acquiring
- Offline ticket scanning redesign
- Rebuilding every page that currently imports `src/data/events.ts`

The broader mock-data migration remains the next sub-project after this payment slice is complete.

## Chosen Stack

- Database and auth: Supabase
- Payment backend: Render
- Mobile money: Safaricom Daraja STK push
- Card and wallet gateway: Flutterwave hosted checkout
- Browser behavior: direct M-Pesa flow on-site; hosted redirect flow for card and wallets
- Merchant geography: Kenya-based business

## Why This Architecture

Three architecture patterns were considered:

1. Frontend-heavy payment flow
2. Split orchestration between Render and Supabase Edge Functions
3. Render-centered payment domain

Option 3 is chosen because it keeps provider secrets, webhook verification, redirect validation, CORS policy, and rate limiting in one backend trust boundary. This is the cleanest way to replace the current frontend-paid behavior with a verifiable payment lifecycle.

## Existing Risks in the Current Repo

- [`src/pages/Checkout.tsx`](/home/murda/fezzy-tickets/src/pages/Checkout.tsx:1) can insert `orders` and `tickets` directly and marks orders as `paid` in the browser
- Public pages still fall back to mock data from [`src/data/events.ts`](/home/murda/fezzy-tickets/src/data/events.ts:1)
- [`supabase/functions/send-ticket-email/index.ts`](/home/murda/fezzy-tickets/supabase/functions/send-ticket-email/index.ts:1) uses wildcard CORS and returns raw error details
- Current flow allows user-visible success before independent payment verification

## Scope of the First Live Slice

This milestone covers only the purchase-critical path:

- Live event detail for one published event from Supabase
- Live checkout from Supabase event and tier data
- Render-managed payment initiation
- Verified payment completion before order and ticket issuance
- Ticket delivery only after verified payment success

The initial UI surface in scope is:

- [`src/pages/EventDetail.tsx`](/home/murda/fezzy-tickets/src/pages/EventDetail.tsx:1)
- [`src/pages/Checkout.tsx`](/home/murda/fezzy-tickets/src/pages/Checkout.tsx:1)

These pages must stop using fallback events from `src/data/events.ts` for the secure slice.

## System Boundaries

### Browser

- Collect attendee info and method selection
- Call Render APIs only
- Poll checkout status from Render
- Show pending, confirmed, failed, or unavailable states
- Never call Daraja or Flutterwave directly with secret material
- Never write `orders`, `tickets`, or payment confirmation state directly

### Render Backend

- Validate origin, payloads, and route-specific rate limits
- Create checkout sessions and payment attempts
- Initiate Daraja STK push
- Create Flutterwave hosted checkout sessions
- Receive and verify provider callbacks and webhooks
- Reconcile provider responses against expected amount, currency, and merchant references
- Create final paid orders and tickets in Supabase after successful verification
- Trigger ticket delivery after verified order creation

### Supabase

- Source of truth for events, tiers, checkout records, payment attempts, orders, tickets, and auth users
- RLS still applies to app data, but payment lifecycle writes are performed by Render using privileged server credentials
- No public client should be allowed to mark payment state or create paid orders

## Data Model Changes

Add the following tables:

### `checkout_sessions`

Purpose: user-facing purchase intent that expires if unpaid.

Fields:

- `id` uuid primary key
- `public_token` text unique, opaque, non-sequential
- `event_id` uuid not null
- `tier_id` uuid not null
- `quantity` integer not null
- `guest_name` text not null
- `guest_email` text not null
- `guest_phone` text not null
- `user_id` uuid nullable
- `amount_kes` integer not null
- `currency` text not null default `KES`
- `status` text not null in `created | payment_pending | verifying | paid | failed | expired | cancelled`
- `allowed_methods` jsonb not null
- `expires_at` timestamptz not null
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### `payment_attempts`

Purpose: every provider attempt tied to a checkout session.

Fields:

- `id` uuid primary key
- `checkout_session_id` uuid not null
- `provider` text not null in `mpesa_daraja | flutterwave`
- `method` text not null in `mpesa | card | apple_pay | google_pay`
- `status` text not null in `created | pending_user_action | processing | succeeded | failed | expired | cancelled`
- `amount_kes` integer not null
- `currency` text not null default `KES`
- `idempotency_key` text not null unique
- `merchant_reference` text not null unique
- `provider_reference` text nullable
- `provider_transaction_id` text nullable
- `redirect_state` text nullable
- `redirect_nonce` text nullable
- `failure_code` text nullable
- `failure_reason_safe` text nullable
- `provider_payload_last` jsonb nullable
- `created_at` timestamptz not null default now()
- `updated_at` timestamptz not null default now()

### `payment_webhook_events`

Purpose: audit log, replay defense, and reconciliation history.

Fields:

- `id` uuid primary key
- `provider` text not null
- `provider_event_id` text nullable
- `delivery_id` text nullable
- `signature_valid` boolean not null
- `dedupe_key` text not null unique
- `event_type` text nullable
- `payload` jsonb not null
- `processed` boolean not null default false
- `processed_at` timestamptz nullable
- `processing_error_safe` text nullable
- `created_at` timestamptz not null default now()

### Existing Table Adjustments

`orders`

- Creation path moves to Render only after verified payment success
- Add `checkout_session_id` uuid nullable unique for traceability
- Add `payment_attempt_id` uuid nullable unique for traceability
- Keep `status` aligned to verified lifecycle only

`tickets`

- Insert only after `orders.status = paid`
- No browser or guest insert path remains

## Payment State Rules

1. A browser creates a checkout session through Render.
2. Render validates event, tier, quantity, availability, and enabled payment methods.
3. Render creates one `payment_attempts` row for each initiation.
4. Provider redirect or callback can move UI into `verifying`, but not to `paid`.
5. Only backend verification may mark an attempt `succeeded`.
6. Only after `payment_attempts.status = succeeded` may Render create a paid order and tickets.
7. Ticket email or QR generation happens after the paid order and tickets exist.

## Provider Flows

### M-Pesa Daraja

- Frontend submits phone number to Render
- Render normalizes and validates the phone number
- Render creates a payment attempt and initiates STK push against Daraja
- Frontend shows a pending state and polls Render for status
- Daraja callback lands on Render webhook endpoint
- Render reconciles the callback to the payment attempt using merchant references and expected amount
- If the callback is incomplete or not final, the attempt remains in verifying state until provider-supported reconciliation confirms the final outcome
- Success page appears only after backend reconciliation completes and the order is created

### Flutterwave Hosted Checkout

- Frontend asks Render to create a hosted checkout session for `card`, `apple_pay`, or `google_pay`
- Render creates a payment attempt and requests a Flutterwave hosted checkout session
- Render returns only the hosted URL or redirect metadata required by the browser
- Browser redirects to Flutterwave
- Flutterwave redirects back to a Render return endpoint first
- Render validates the return parameters and then redirects the browser to the FEZZY verifying route for the same checkout session
- Redirect response is treated as untrusted until server verification completes
- Render verifies webhook signature, then verifies the transaction server-side against expected amount, currency, and merchant reference
- Only then does Render mark the attempt successful and create the order and tickets

Apple Pay and Google Pay remain hidden unless enabled in environment configuration and confirmed live for the merchant account.

## Backend API Surface on Render

### Browser-facing routes

- `POST /checkout/sessions`
- `POST /checkout/sessions/:publicToken/pay/mpesa`
- `POST /checkout/sessions/:publicToken/pay/flutterwave`
- `GET /checkout/sessions/:publicToken/status`
- `GET /payments/return/flutterwave`

### Provider-facing routes

- `POST /webhooks/mpesa`
- `POST /webhooks/flutterwave`

### Shared security route

- `POST /auth/password-reset/request`

All browser-facing routes return only safe, user-consumable error messages and stable error codes.

Password reset request hardening is in scope for this milestone even if the existing FEZZY UI does not yet expose a full reset flow, because the project requirement is to rate-limit reset initiation and keep account-existence responses generic.

## Redirect Validation

Redirect handling is server-owned.

- The browser must not send arbitrary success or failure URLs
- Render chooses redirect destinations from a strict internal allowlist
- Each hosted payment attempt gets a signed state token or nonce bound to the attempt ID
- Return handling validates:
  - route allowlist
  - state token
  - payment attempt identity
  - merchant reference
  - expected session status
- Any failed validation shows a neutral `We are verifying your payment` or `We could not confirm this payment yet` state, not success

## Webhook Verification

### Flutterwave

- Require the configured signature header
- Verify signature using the configured secret hash
- Store the raw event in `payment_webhook_events`
- Deduplicate by provider event identity and payload-derived dedupe key
- Re-query Flutterwave transaction verification API before providing value
- Confirm status, amount, currency, and merchant reference match the expected attempt

### M-Pesa Daraja

- Accept callbacks only on the dedicated Render endpoint
- Validate that callback structure maps to a known pending attempt
- Compare received merchant references, phone, and amount to expected values
- Record every callback delivery
- Mark success only after reconciliation logic passes

## CORS Policy

- No wildcard browser CORS on payment routes
- Exact origin allowlist per environment, for example:
  - local development origin
  - production web origin
- Disallow credentials and methods not required by the route
- Webhook endpoints do not need browser CORS and should not advertise permissive CORS headers
- Existing wildcard CORS in the Supabase email function must be removed if that function remains reachable

## Rate Limiting

Use token-bucket rate limiting in Render with distinct buckets per endpoint category.

### Checkout creation

- Keyed by IP and email
- Protects against session spam and cart abuse

### Payment initiation

- Keyed by IP, phone, email, and checkout session token
- Prevents STK spam and repeated hosted-session creation

### Status polling

- Keyed by IP and checkout session token
- Allows short-interval polling with a strict upper bound

### Webhooks

- No public bucket response body details
- Use replay detection and body-size limits
- Log duplicates safely without reprocessing

### Password reset requests

- Keyed by IP and normalized email
- Tight bucket limits and cooldowns
- Always return a generic success message whether the account exists or not

## Error Handling and Safe Messaging

Frontend must never surface raw provider payloads, database errors, or server stack traces.

User-safe messages include:

- `We could not start payment right now. Please try again.`
- `We are still confirming your payment. Do not pay again yet.`
- `This checkout session has expired. Please start again.`
- `This payment method is not available right now.`

Server logs and audit tables may retain diagnostic information, but HTTP responses to the browser stay sanitized.

## Frontend Changes

### `src/pages/EventDetail.tsx`

- Remove fallback to mock event data for the secure slice
- Load event and ticket tiers from Supabase only
- If the event is unavailable, unpublished, or sold out, render a controlled unavailable state
- Purchase CTA routes to a checkout session creation flow, not a mock checkout path

### `src/pages/Checkout.tsx`

Replace the current mock or direct-write logic with a state machine:

- `details`
- `method-selection`
- `pending-verification`
- `confirmed`
- `failed`
- `expired`

Required behavior:

- No direct Supabase insert of paid `orders`
- No direct insert of `tickets`
- No optimistic success based on timeout or redirect
- M-Pesa uses pending polling after STK push
- Card and wallet methods redirect out and return to a verifying screen
- Available methods are driven by backend configuration, not hardcoded promises

### Error UX

- Use controlled toast and inline states with safe messages only
- Avoid `console.error`-driven user messaging
- Avoid displaying provider text directly to the buyer

## Email and Ticket Delivery

The current ticket email path must no longer be directly invokable from the browser for payment success flow. One of these must happen in the implementation:

1. Render triggers ticket delivery internally after verified payment success
2. Supabase function remains internal-only and is called from Render with locked-down access

Either way:

- No wildcard CORS
- No raw error body returned to the browser
- No ticket delivery before paid order and ticket creation

## Security Requirements

- Browser cannot create or update paid state
- Orders are paid only after verified provider success
- Hosted redirect return is never treated as final truth
- Payment method exposure is environment-driven
- CORS is allowlist-only for browser routes
- Provider webhooks are signature-checked or reconciliation-checked before value is granted
- Idempotency is enforced for initiation and webhook handling
- Password reset and payment initiation are rate-limited
- User-facing errors are sanitized

## Operational Configuration

Render environment configuration should include:

- Supabase URL
- Supabase service role key
- Daraja consumer key
- Daraja consumer secret
- Daraja short code and passkey
- Daraja callback base URL
- Flutterwave secret key
- Flutterwave public key if needed for config generation only
- Flutterwave secret hash for webhook verification
- Allowed browser origins
- Enabled payment methods per environment
- Rate-limit bucket settings
- Ticket email delivery configuration

## Verification Requirements

Implementation is not complete unless the following are verified:

- Backend tests for checkout session creation rules
- Backend tests for rate-limit enforcement
- Backend tests for idempotent payment initiation
- Backend tests for Flutterwave webhook signature verification
- Backend tests for redirect state validation
- Backend tests for successful transaction reconciliation before order creation
- Backend tests for duplicate webhook delivery behavior
- Frontend tests for checkout state transitions
- Frontend tests for safe error mapping and absence of raw provider messages
- Manual sandbox verification for Daraja STK flow
- Manual sandbox verification for Flutterwave hosted card flow

## Milestone Done Definition

This milestone is done when:

- One published event and real tiers in Supabase can be purchased through the secure flow
- The browser cannot write paid orders or tickets
- Render is the only service that can confirm payment success
- M-Pesa Daraja flow works end to end in sandbox
- Flutterwave hosted card flow works end to end in sandbox
- Wallet methods are hidden unless confirmed enabled
- Redirects and CORS are locked down
- Webhooks are stored, deduplicated, and verified
- Password reset requests and checkout initiation are rate-limited
- Frontend shows safe, controlled payment states only

## Deferred Follow-up Project

After this milestone, the next project is the broader live-data migration:

- Home page and hero content
- Event listings
- Hero slideshow
- Account history views that still depend on `src/data/events.ts`

That second project removes remaining mock data across the site once the secure purchase path is stable.

## External References

- Safaricom Daraja developer portal: https://developer.safaricom.co.ke/
- Flutterwave webhooks: https://developer.flutterwave.com/docs/webhooks
- Flutterwave card flows: https://developer.flutterwave.com/docs/card
- Flutterwave hosted redirect guidance: https://developer.flutterwave.com/v3.0/docs/inline
- Flutterwave Apple Pay: https://developer.flutterwave.com/v4.0.0/docs/apple-pay
- Flutterwave Kenya payment channels: https://www.flutterwave.com/ke/support/payment-methods/payment-channels
- Flutterwave Kenya pricing: https://flutterwave.com/ke/support/pricing/pricing-for-receiving-payment
