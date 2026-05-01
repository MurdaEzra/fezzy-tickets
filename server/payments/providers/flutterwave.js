import { constantTimeHexEqual, signWithHmacSha256 } from "../../security/signing.js";

function getPaymentOptions(method) {
  switch (method) {
    case "apple_pay":
      return "applepay";
    case "google_pay":
      return "googlepay";
    default:
      return "card";
  }
}

export function isValidFlutterwaveSignature({ rawBody, signature, secretHash }) {
  if (!signature || !secretHash) {
    return false;
  }

  const expectedSignature = signWithHmacSha256({
    payload: rawBody,
    secret: secretHash,
  });

  return constantTimeHexEqual(signature, expectedSignature);
}

export function buildFlutterwaveCheckoutPayload({
  amountKes,
  checkoutToken,
  customer,
  method,
  publicKey,
  redirectUrl,
  txRef,
}) {
  return {
    amount: amountKes,
    currency: "KES",
    customer: {
      email: customer.email,
      name: customer.name,
      phonenumber: customer.phone,
    },
    customizations: {
      title: "Fezzy Tickets",
      description: `Checkout ${checkoutToken}`,
    },
    meta: {
      checkout_token: checkoutToken,
      method,
    },
    payment_options: getPaymentOptions(method),
    public_key: publicKey,
    redirect_url: redirectUrl,
    tx_ref: txRef,
  };
}

export function createFlutterwaveClient(config) {
  return {
    async createHostedCheckout(payload) {
      const response = await fetch(`${config.baseUrl}/payments`, {
        body: JSON.stringify(payload),
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      const json = await response.json();
      if (!response.ok || !json?.data?.link) {
        throw new Error("Unable to create Flutterwave checkout");
      }

      return {
        checkoutUrl: json.data.link,
        providerReference: json.data.id ?? null,
        raw: json,
      };
    },

    async verifyTransaction(transactionId) {
      const response = await fetch(`${config.baseUrl}/transactions/${transactionId}/verify`, {
        headers: {
          Authorization: `Bearer ${config.secretKey}`,
        },
      });

      const json = await response.json();
      if (!response.ok || !json?.data) {
        throw new Error("Unable to verify Flutterwave transaction");
      }

      return {
        amountKes: Number(json.data.amount ?? 0),
        currency: json.data.currency,
        raw: json,
        status: json.data.status,
        txRef: json.data.tx_ref,
      };
    },
  };
}
