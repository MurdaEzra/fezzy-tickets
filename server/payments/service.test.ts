import { describe, expect, it } from "vitest";
import {
  applyVerifiedPaymentResult,
  createCheckoutSessionRecord,
  createPaymentAttemptRecord,
} from "./service.js";

describe("payment service", () => {
  it("rejects unpublished events for checkout creation", () => {
    expect(() =>
      createCheckoutSessionRecord({
        allowedMethods: ["mpesa", "card"],
        event: { id: "event-1", slug: "test", status: "draft" },
        guest: {
          email: "buyer@example.com",
          name: "Buyer",
          phone: "+254700000000",
        },
        nowIso: "2026-04-24T15:00:00.000Z",
        quantity: 2,
        tier: { event_id: "event-1", id: "tier-1", price_kes: 2000, quantity: 10, sold: 2 },
      }),
    ).toThrow(/published/i);
  });

  it("creates a checkout session record for a published event", () => {
    const session = createCheckoutSessionRecord({
      allowedMethods: ["mpesa", "card"],
      event: { id: "event-1", slug: "test", status: "published" },
      guest: {
        email: "buyer@example.com",
        name: "Buyer",
        phone: "+254700000000",
      },
      nowIso: "2026-04-24T15:00:00.000Z",
      quantity: 2,
      tier: { event_id: "event-1", id: "tier-1", price_kes: 2000, quantity: 10, sold: 2 },
    });

    expect(session.amount_kes).toBe(4000);
    expect(session.status).toBe("created");
    expect(session.allowed_methods).toEqual(["mpesa", "card"]);
    expect(session.public_token).toMatch(/^[a-f0-9]{32}$/);
  });

  it("creates a provider attempt with a merchant reference", () => {
    const attempt = createPaymentAttemptRecord({
      checkoutSession: { id: "session-1", public_token: "public-token", amount_kes: 4000, currency: "KES" },
      method: "mpesa",
      nowIso: "2026-04-24T15:00:00.000Z",
      provider: "mpesa_daraja",
      redirectSecret: "redirect-secret",
    });

    expect(attempt.provider).toBe("mpesa_daraja");
    expect(attempt.method).toBe("mpesa");
    expect(attempt.merchant_reference).toMatch(/^fz_/);
    expect(attempt.status).toBe("created");
  });

  it("only produces paid order data from succeeded attempts", () => {
    expect(() =>
      applyVerifiedPaymentResult({
        checkoutSession: {
          amount_kes: 4000,
          event_id: "event-1",
          guest_email: "buyer@example.com",
          guest_name: "Buyer",
          guest_phone: "254700000000",
          id: "session-1",
          quantity: 2,
          user_id: null,
        },
        event: { fee_waived: false },
        paymentAttempt: {
          id: "attempt-1",
          method: "mpesa",
          merchant_reference: "fz_attempt_1",
          status: "processing",
        },
        tier: { id: "tier-1" },
      }),
    ).toThrow(/verified payment/i);
  });

  it("returns order and ticket inputs for succeeded attempts", () => {
    const result = applyVerifiedPaymentResult({
      checkoutSession: {
        amount_kes: 4000,
        event_id: "event-1",
        guest_email: "buyer@example.com",
        guest_name: "Buyer",
        guest_phone: "254700000000",
        id: "session-1",
        quantity: 2,
        user_id: "user-1",
      },
      event: { fee_waived: false },
      paymentAttempt: {
        id: "attempt-1",
        method: "mpesa",
        merchant_reference: "fz_attempt_1",
        status: "succeeded",
      },
      tier: { id: "tier-1" },
    });

    expect(result.orderInsert.status).toBe("paid");
    expect(result.orderInsert.checkout_session_id).toBe("session-1");
    expect(result.orderInsert.payment_attempt_id).toBe("attempt-1");
    expect(result.ticketInserts).toHaveLength(2);
  });
});
