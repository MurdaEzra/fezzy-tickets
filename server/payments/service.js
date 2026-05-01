import { randomBytes } from "node:crypto";
import { signRedirectState } from "./redirect-state.js";

function randomHex(size = 16) {
  return randomBytes(size).toString("hex");
}

function addMinutes(iso, minutes) {
  const at = new Date(iso);
  at.setMinutes(at.getMinutes() + minutes);
  return at.toISOString();
}

function ensurePublishedEvent(event) {
  if (!event || event.status !== "published") {
    throw new Error("Checkout requires a published event");
  }
}

function ensureSellableTier(event, tier, quantity) {
  if (!tier || tier.event_id !== event.id) {
    throw new Error("Selected ticket tier does not belong to this event");
  }

  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error("Quantity must be at least 1");
  }

  const remaining = Math.max(0, tier.quantity - tier.sold);
  if (quantity > remaining) {
    throw new Error("Not enough tickets remaining");
  }
}

export function createCheckoutSessionRecord({
  allowedMethods,
  event,
  guest,
  nowIso,
  quantity,
  tier,
}) {
  ensurePublishedEvent(event);
  ensureSellableTier(event, tier, quantity);

  return {
    allowed_methods: allowedMethods,
    amount_kes: tier.price_kes * quantity,
    currency: "KES",
    event_id: event.id,
    expires_at: addMinutes(nowIso, 15),
    guest_email: guest.email,
    guest_name: guest.name,
    guest_phone: guest.phone,
    public_token: randomHex(16),
    quantity,
    status: "created",
    tier_id: tier.id,
    user_id: guest.userId ?? null,
  };
}

export function createPaymentAttemptRecord({
  checkoutSession,
  method,
  nowIso,
  provider,
  redirectSecret,
}) {
  const id = randomHex(16);
  const redirect_state = provider === "flutterwave"
    ? signRedirectState({
      attemptId: id,
      checkoutToken: checkoutSession.public_token,
      secret: redirectSecret,
    })
    : null;

  return {
    amount_kes: checkoutSession.amount_kes,
    checkout_session_id: checkoutSession.id,
    created_at: nowIso,
    currency: checkoutSession.currency,
    id,
    idempotency_key: randomHex(12),
    merchant_reference: `fz_${randomHex(8)}`,
    method,
    provider,
    redirect_nonce: provider === "flutterwave" ? randomHex(8) : null,
    redirect_state,
    status: "created",
    updated_at: nowIso,
  };
}

export function applyVerifiedPaymentResult({
  checkoutSession,
  event,
  paymentAttempt,
  tier,
}) {
  if (!paymentAttempt || paymentAttempt.status !== "succeeded") {
    throw new Error("A verified payment is required before order creation");
  }

  const organizerFee = event.fee_waived ? 0 : Math.round(checkoutSession.amount_kes * 0.05);

  return {
    orderInsert: {
      checkout_session_id: checkoutSession.id,
      event_id: checkoutSession.event_id,
      fee_waived: event.fee_waived,
      guest_email: checkoutSession.guest_email,
      guest_name: checkoutSession.guest_name,
      guest_phone: checkoutSession.guest_phone,
      organizer_fee_kes: organizerFee,
      payment_attempt_id: paymentAttempt.id,
      payment_method: paymentAttempt.method,
      payment_ref: paymentAttempt.merchant_reference,
      status: "paid",
      subtotal_kes: checkoutSession.amount_kes,
      total_kes: checkoutSession.amount_kes,
      user_id: checkoutSession.user_id,
    },
    ticketInserts: Array.from({ length: checkoutSession.quantity }).map(() => ({
      event_id: checkoutSession.event_id,
      holder_email: checkoutSession.guest_email,
      holder_name: checkoutSession.guest_name,
      tier_id: tier.id,
    })),
  };
}
