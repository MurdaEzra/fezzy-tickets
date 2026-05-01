import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  buildFlutterwaveCheckoutPayload,
  isValidFlutterwaveSignature,
} from "./flutterwave.js";

describe("flutterwave helpers", () => {
  it("verifies the webhook signature against the raw body", async () => {
    const rawBody = JSON.stringify({ event: "charge.completed", data: { id: 12 } });
    const signature = createHmac("sha256", "secret-hash").update(rawBody).digest("hex");

    expect(
      isValidFlutterwaveSignature({
        rawBody,
        signature,
        secretHash: "secret-hash",
      }),
    ).toBe(true);
  });

  it("builds a hosted checkout payload with a backend-owned redirect", () => {
    const payload = buildFlutterwaveCheckoutPayload({
      amountKes: 4500,
      checkoutToken: "checkout-token",
      customer: { email: "buyer@example.com", name: "A Buyer", phone: "254700000000" },
      method: "card",
      publicKey: "FLWPUBK_TEST",
      redirectUrl: "https://api.fezzy.test/api/payments/return/flutterwave",
      txRef: "fz-attempt-1",
    });

    expect(payload.redirect_url).toBe("https://api.fezzy.test/api/payments/return/flutterwave");
    expect(payload.tx_ref).toBe("fz-attempt-1");
    expect(payload.currency).toBe("KES");
    expect(payload.payment_options).toBe("card");
  });
});
