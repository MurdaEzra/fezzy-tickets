export const CHECKOUT_STATUSES = {
  CREATED: "created",
  PAYMENT_PENDING: "payment_pending",
  VERIFYING: "verifying",
  PAID: "paid",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

export const PAYMENT_ATTEMPT_STATUSES = {
  CREATED: "created",
  PENDING_USER_ACTION: "pending_user_action",
  PROCESSING: "processing",
  SUCCEEDED: "succeeded",
  FAILED: "failed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

export const PAYMENT_METHODS = {
  MPESA: "mpesa",
  CARD: "card",
  APPLE_PAY: "apple_pay",
  GOOGLE_PAY: "google_pay",
};

export const PAYMENT_PROVIDERS = {
  MPESA_DARAJA: "mpesa_daraja",
  FLUTTERWAVE: "flutterwave",
};

export function providerForMethod(method) {
  if (method === PAYMENT_METHODS.MPESA) {
    return PAYMENT_PROVIDERS.MPESA_DARAJA;
  }

  return PAYMENT_PROVIDERS.FLUTTERWAVE;
}
