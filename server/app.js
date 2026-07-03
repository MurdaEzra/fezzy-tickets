import { PublicHttpError, isPublicHttpError } from "./http/errors.js";
import { readJsonBody, readRawBody, getBearerToken, getClientIp, getRequestOrigin } from "./http/request.js";
import { sendEmpty, sendJson, sendRedirect } from "./http/response.js";
import { createRouter } from "./http/router.js";
import { loadConfig } from "./config.js";
import { createBrowserCorsHeaders, assertAllowedBrowserOrigin } from "./security/cors.js";
import { createTokenBucketStore } from "./security/rate-limit.js";
import { createAdminClient, getUserFromAccessToken } from "./supabase/admin.js";
import { createPaymentStore } from "./payments/store.js";
import { createFlutterwaveClient, buildFlutterwaveCheckoutPayload, isValidFlutterwaveSignature } from "./payments/providers/flutterwave.js";
import { createMpesaClient, normalizeKenyaPhoneNumber, parseMpesaCallback } from "./payments/providers/mpesa.js";
import { SAFE_PUBLIC_MESSAGES } from "./payments/messages.js";
import { CHECKOUT_STATUSES, PAYMENT_ATTEMPT_STATUSES, PAYMENT_METHODS, PAYMENT_PROVIDERS, providerForMethod } from "./payments/constants.js";
import { createCheckoutSessionRecord, createPaymentAttemptRecord } from "./payments/service.js";
import { verifyRedirectState } from "./payments/redirect-state.js";
import { constantTimeHexEqual } from "./security/signing.js";
import { createPayheroClient } from "./payouts/payhero.js";
import {
  calculateAvailablePayoutAmount,
  createPayoutRequestRecord,
  parsePayheroWithdrawalCallback,
} from "./payouts/service.js";

function requireString(value, code, message) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new PublicHttpError(400, code, message);
  }

  return value.trim();
}

function safeBrowserErrorHeaders(req, config, extraHeaders = undefined) {
  const origin = getRequestOrigin(req);
  const browserHeaders =
    origin && config.allowedBrowserOrigins.includes(origin)
      ? createBrowserCorsHeaders(origin)
      : {};

  return {
    ...browserHeaders,
    ...(extraHeaders ?? {}),
  };
}

function ensureMethodAllowed(session, method) {
  const allowedMethods = Array.isArray(session.allowed_methods) ? session.allowed_methods : [];
  if (!allowedMethods.includes(method)) {
    throw new PublicHttpError(409, "payment_method_unavailable", SAFE_PUBLIC_MESSAGES.paymentMethodUnavailable);
  }
}

function createRateLimiters(config) {
  return {
    checkoutCreate: createTokenBucketStore(config.rateLimits.checkoutCreate),
    checkoutPoll: createTokenBucketStore(config.rateLimits.checkoutPoll),
    passwordReset: createTokenBucketStore(config.rateLimits.passwordReset),
    paymentStart: createTokenBucketStore(config.rateLimits.paymentStart),
    payoutRequest: createTokenBucketStore(config.rateLimits.payoutRequest),
  };
}

function enforceRateLimit(limiter, key) {
  const result = limiter.take(key);
  if (!result.allowed) {
    throw new PublicHttpError(
      429,
      "rate_limited",
      "Please wait before trying again.",
      { "Retry-After": String(result.retryAfterSeconds || 1) },
    );
  }
}

function getBrowserHeaders(req, config) {
  const origin = assertAllowedBrowserOrigin(getRequestOrigin(req), config.allowedBrowserOrigins);
  return createBrowserCorsHeaders(origin);
}

async function finalizeSuccessfulPayment({ attempt, store }) {
  const orderId = await store.completeVerifiedCheckout(attempt.checkout_session_id, attempt.id);
  try {
    await store.sendTicketDelivery(orderId);
  } catch (error) {
    console.error("[ticket-delivery]", error);
  }
  return orderId;
}

async function requireAuthenticatedUser(admin, req) {
  const accessToken = getBearerToken(req);
  const user = await getUserFromAccessToken(admin, accessToken);
  if (!user) {
    throw new PublicHttpError(401, "not_authenticated", "Sign in to continue.");
  }

  return user;
}

function requirePositiveAmount(value, code, message) {
  const amount = Number(value);
  if (!Number.isInteger(amount) || amount < 1) {
    throw new PublicHttpError(400, code, message);
  }

  return amount;
}

export function createApp(deps = {}) {
  const config = deps.config ?? loadConfig();
  const admin = deps.admin ?? createAdminClient(config);
  const store = deps.store ?? createPaymentStore(admin, {
    ticketDeliverySecret: config.ticketDeliverySecret,
  });
  const mpesa = deps.mpesa ?? createMpesaClient(config.mpesa);
  const flutterwave = deps.flutterwave ?? createFlutterwaveClient(config.flutterwave);
  const payhero = deps.payhero ?? createPayheroClient(config.payhero);
  const logger = deps.logger ?? console;
  const rateLimiters = deps.rateLimiters ?? createRateLimiters(config);

  const router = createRouter();

  router.post("/api/checkout/sessions", async ({ req, res, url }) => {
    const corsHeaders = getBrowserHeaders(req, config);
    const { json } = await readJsonBody(req);
    const slug = requireString(json.slug, "slug_required", "This event is not available.");
    const tierId = requireString(json.tierId, "tier_required", "This ticket tier is not available.");
    const email = requireString(json.email, "email_required", "Enter your email.");
    const name = requireString(json.name, "name_required", "Enter your full name.");
    const rawPhone = requireString(json.phone, "phone_required", "Enter your phone number.");
    const quantity = Number(json.quantity ?? 1);
    const ip = getClientIp(req);
    let phone;

    try {
      phone = normalizeKenyaPhoneNumber(rawPhone);
    } catch {
      throw new PublicHttpError(400, "phone_invalid", "Enter a valid Kenyan phone number.");
    }

    enforceRateLimit(rateLimiters.checkoutCreate, `checkout:${ip}:${email.toLowerCase()}`);

    const accessToken = getBearerToken(req);
    const authenticatedUser = await getUserFromAccessToken(admin, accessToken);
    const { event, tier } = await store.getEventAndTierBySlug({ slug, tierId });

    let sessionRecord;
    try {
      sessionRecord = createCheckoutSessionRecord({
        allowedMethods: config.enabledPaymentMethods,
        event,
        guest: {
          email,
          name,
          phone,
          userId: authenticatedUser?.id ?? null,
        },
        nowIso: new Date().toISOString(),
        quantity,
        tier,
      });
    } catch {
      throw new PublicHttpError(409, "checkout_unavailable", "This event is not available for checkout.");
    }

    const session = await store.createCheckoutSession(sessionRecord);
    
    // Create a payment attempt immediately to get a merchant reference
    const attempt = await store.createPaymentAttempt(createPaymentAttemptRecord({
      checkoutSession: session,
      method: PAYMENT_METHODS.MPESA, // Default to M-Pesa since we need a ref number
      nowIso: new Date().toISOString(),
      provider: PAYMENT_PROVIDERS.MPESA_DARAJA,
      redirectSecret: config.redirectStateSecret,
    }));
    
    // Update checkout session status to payment pending
    await store.updateCheckoutSession(session.id, {
      status: CHECKOUT_STATUSES.PAYMENT_PENDING,
    });

    sendJson(res, 201, {
      allowedMethods: session.allowed_methods,
      amountKes: session.amount_kes,
      expiresAt: session.expires_at,
      publicToken: session.public_token,
      status: session.status,
      merchantReference: attempt.merchant_reference,
    }, corsHeaders);
  });

  router.post("/api/checkout/sessions/:token/pay/mpesa", async ({ params, req, res }) => {
    const corsHeaders = getBrowserHeaders(req, config);
    const { json } = await readJsonBody(req);
    const ip = getClientIp(req);
    let phone;

    try {
      phone = normalizeKenyaPhoneNumber(requireString(json.phone, "phone_required", "Enter your phone number."));
    } catch {
      throw new PublicHttpError(400, "phone_invalid", "Enter a valid Kenyan phone number.");
    }

    enforceRateLimit(rateLimiters.paymentStart, `payment:${ip}:${phone}:${params.token}`);

    const session = await store.getCheckoutSessionByToken(params.token);
    if (!session) {
      throw new PublicHttpError(404, "checkout_not_found", "This checkout session is not available.");
    }

    ensureMethodAllowed(session, PAYMENT_METHODS.MPESA);

    // Get existing payment attempt (we created one in checkout session endpoint)
    let attempt = await store.getLatestPaymentAttempt(session.id);

    // If no attempt exists, create one (fallback)
    if (!attempt) {
      attempt = await store.createPaymentAttempt(createPaymentAttemptRecord({
        checkoutSession: session,
        method: PAYMENT_METHODS.MPESA,
        nowIso: new Date().toISOString(),
        provider: PAYMENT_PROVIDERS.MPESA_DARAJA,
        redirectSecret: config.redirectStateSecret,
      }));
    }

    let started;
    try {
      started = await mpesa.initiateStkPush({
        accountReference: attempt.merchant_reference,
        amountKes: session.amount_kes,
        callbackUrl: config.mpesa.callbackUrl,
        phone,
        transactionDesc: `${session.events?.title ?? "Fezzy Tickets"} checkout`,
      });
    } catch {
      throw new PublicHttpError(502, "payment_start_failed", SAFE_PUBLIC_MESSAGES.paymentStartFailed);
    }

    await store.updatePaymentAttempt(attempt.id, {
      provider_payload_last: started.raw,
      provider_reference: started.checkoutRequestId,
      provider_transaction_id: started.merchantRequestId,
      status: PAYMENT_ATTEMPT_STATUSES.PENDING_USER_ACTION,
    });
    await store.updateCheckoutSession(session.id, {
      status: CHECKOUT_STATUSES.PAYMENT_PENDING,
    });

    sendJson(res, 202, {
      checkoutToken: session.public_token,
      customerMessage: started.customerMessage,
      merchantReference: attempt.merchant_reference,
      status: CHECKOUT_STATUSES.PAYMENT_PENDING,
    }, corsHeaders);
  });

  router.post("/api/checkout/sessions/:token/pay/flutterwave", async ({ params, req, res }) => {
    const corsHeaders = getBrowserHeaders(req, config);
    const { json } = await readJsonBody(req);
    const method = requireString(json.method, "method_required", SAFE_PUBLIC_MESSAGES.paymentMethodUnavailable);
    const ip = getClientIp(req);

    enforceRateLimit(rateLimiters.paymentStart, `payment:${ip}:${method}:${params.token}`);

    const session = await store.getCheckoutSessionByToken(params.token);
    if (!session) {
      throw new PublicHttpError(404, "checkout_not_found", "This checkout session is not available.");
    }

    ensureMethodAllowed(session, method);

    const attempt = await store.createPaymentAttempt(createPaymentAttemptRecord({
      checkoutSession: session,
      method,
      nowIso: new Date().toISOString(),
      provider: PAYMENT_PROVIDERS.FLUTTERWAVE,
      redirectSecret: config.redirectStateSecret,
    }));

    const redirectUrl = new URL("/api/payments/return/flutterwave", config.renderApiBaseUrl);
    redirectUrl.searchParams.set("state", attempt.redirect_state);

    const hostedPayload = buildFlutterwaveCheckoutPayload({
      amountKes: session.amount_kes,
      checkoutToken: session.public_token,
      customer: {
        email: session.guest_email,
        name: session.guest_name,
        phone: session.guest_phone,
      },
      method,
      publicKey: config.flutterwave.publicKey,
      redirectUrl: redirectUrl.toString(),
      txRef: attempt.merchant_reference,
    });

    let started;
    try {
      started = await flutterwave.createHostedCheckout(hostedPayload);
    } catch {
      throw new PublicHttpError(502, "payment_start_failed", SAFE_PUBLIC_MESSAGES.paymentStartFailed);
    }

    await store.updatePaymentAttempt(attempt.id, {
      provider_payload_last: started.raw,
      provider_reference: started.providerReference,
      status: PAYMENT_ATTEMPT_STATUSES.PENDING_USER_ACTION,
    });
    await store.updateCheckoutSession(session.id, {
      status: CHECKOUT_STATUSES.PAYMENT_PENDING,
    });

    sendJson(res, 200, {
      checkoutToken: session.public_token,
      checkoutUrl: started.checkoutUrl,
    }, corsHeaders);
  });

  router.get("/api/checkout/sessions/:token/status", async ({ params, req, res }) => {
    const corsHeaders = getBrowserHeaders(req, config);
    const ip = getClientIp(req);
    enforceRateLimit(rateLimiters.checkoutPoll, `poll:${ip}:${params.token}`);

    const session = await store.getCheckoutSessionByToken(params.token);
    if (!session) {
      throw new PublicHttpError(404, "checkout_not_found", "This checkout session is not available.");
    }

    const [attempt, order] = await Promise.all([
      store.getLatestPaymentAttempt(session.id),
      store.getOrderByCheckoutSessionId(session.id),
    ]);

    sendJson(res, 200, {
      allowedMethods: session.allowed_methods,
      orderReference: order?.payment_ref ?? null,
      paymentErrorCode: attempt?.failure_code ?? null,
      paymentErrorMessage: attempt?.failure_reason_safe ?? null,
      paymentStatus: attempt?.status ?? null,
      status: session.status,
    }, corsHeaders);
  });

  router.post("/api/auth/password-reset/request", async ({ req, res }) => {
    const corsHeaders = getBrowserHeaders(req, config);
    const { json } = await readJsonBody(req);
    const email = requireString(json.email, "email_required", "Enter your email.");
    const ip = getClientIp(req);

    enforceRateLimit(rateLimiters.passwordReset, `reset:${ip}:${email.toLowerCase()}`);

    try {
      await store.requestPasswordReset(email, config.passwordResetRedirectUrl);
    } catch (error) {
      logger.error("[password-reset]", error);
    }

    sendJson(res, 202, { message: SAFE_PUBLIC_MESSAGES.resetRequested }, corsHeaders);
  });

  router.get("/api/payouts/payhero/options", async ({ req, res }) => {
    const corsHeaders = getBrowserHeaders(req, config);
    sendJson(res, 200, {
      banks: payhero.getBankOptions(),
      bankWithdrawalsEnabled: payhero.isConfiguredFor("bank"),
      mobileWithdrawalsEnabled: payhero.isConfiguredFor("mpesa"),
    }, corsHeaders);
  });

  router.post("/api/payouts/request", async ({ req, res }) => {
    const corsHeaders = getBrowserHeaders(req, config);
    const { json } = await readJsonBody(req);
    const user = await requireAuthenticatedUser(admin, req);
    const amountKes = requirePositiveAmount(json.amountKes, "amount_invalid", "Enter a valid payout amount.");
    const ip = getClientIp(req);

    enforceRateLimit(rateLimiters.payoutRequest, `payout:${ip}:${user.id}`);

    const organizerProfile = await store.getOrganizerProfileByUserId(user.id);
    if (!organizerProfile) {
      throw new PublicHttpError(404, "organizer_not_found", "Organizer profile not found.");
    }

    const payoutMethod = organizerProfile.payout_method === "bank" ? "bank" : "mpesa";
    if (!payhero.isConfiguredFor(payoutMethod)) {
      throw new PublicHttpError(503, "payouts_unavailable", SAFE_PUBLIC_MESSAGES.payoutsUnavailable);
    }

    const [paidOrders, existingPayoutRequests] = await Promise.all([
      store.listPaidOrdersForOrganizer(organizerProfile.id),
      store.listPayoutRequestsForOrganizer(organizerProfile.id),
    ]);
    const availableAmount = calculateAvailablePayoutAmount({
      orders: paidOrders,
      payoutRequests: existingPayoutRequests,
    });

    if (amountKes > availableAmount) {
      throw new PublicHttpError(409, "payout_amount_exceeds_available", SAFE_PUBLIC_MESSAGES.payoutAmountTooHigh);
    }

    let payoutRecord;
    try {
      payoutRecord = createPayoutRequestRecord({
        amountKes,
        method: payoutMethod,
        organizerProfile,
        requestedByUserId: user.id,
      });
    } catch {
      throw new PublicHttpError(409, "payout_destination_incomplete", SAFE_PUBLIC_MESSAGES.payoutDestinationIncomplete);
    }

    const createdRequest = await store.createPayoutRequest(payoutRecord);

    try {
      const started = await payhero.createWithdrawal({
        amountKes,
        bankAccountName: createdRequest.destination_bank_account_name,
        bankAccountNumber: createdRequest.destination_bank_account_number,
        bankCode: createdRequest.destination_bank_network_code,
        externalReference: createdRequest.external_reference,
        method: payoutMethod,
        phoneNumber: createdRequest.destination_phone,
      });

      const queued = await store.updatePayoutRequest(createdRequest.id, {
        provider_checkout_request_id: started.checkoutRequestId,
        provider_payload_last: started.raw,
        provider_reference: started.merchantReference ?? started.conversationId,
        status: started.status === "QUEUED" ? "queued" : "processing",
      });

      sendJson(res, 202, {
        availableAmountKes: Math.max(0, availableAmount - amountKes),
        payoutRequest: queued,
      }, corsHeaders);
      return;
    } catch (error) {
      logger.error("[payhero:payout-request]", error);
      await store.updatePayoutRequest(createdRequest.id, {
        failure_reason_safe: SAFE_PUBLIC_MESSAGES.payoutRequestFailed,
        provider_payload_last: { error: "request_failed" },
        status: "failed",
      });
      throw new PublicHttpError(502, "payout_request_failed", SAFE_PUBLIC_MESSAGES.payoutRequestFailed);
    }
  });

  router.get("/api/payments/return/flutterwave", async ({ req, res, url }) => {
    const state = requireString(url.searchParams.get("state"), "state_required", SAFE_PUBLIC_MESSAGES.paymentVerificationFailed);
    const txRef = requireString(url.searchParams.get("tx_ref"), "tx_ref_required", SAFE_PUBLIC_MESSAGES.paymentVerificationFailed);
    const transactionId = url.searchParams.get("transaction_id");
    const status = url.searchParams.get("status");
    const signedState = verifyRedirectState({
      secret: config.redirectStateSecret,
      token: state,
    });

    const [attempt, session] = await Promise.all([
      store.getPaymentAttemptById(signedState.attemptId),
      store.getCheckoutSessionByToken(signedState.checkoutToken),
    ]);

    if (!attempt || !session || attempt.checkout_session_id !== session.id || attempt.merchant_reference !== txRef) {
      throw new PublicHttpError(400, "invalid_return", SAFE_PUBLIC_MESSAGES.paymentVerificationFailed);
    }

    await store.updatePaymentAttempt(attempt.id, {
      failure_code: status && status !== "successful" ? `flutterwave_${status}` : null,
      failure_reason_safe: status && status !== "successful" ? SAFE_PUBLIC_MESSAGES.paymentVerificationFailed : null,
      provider_transaction_id: transactionId ?? attempt.provider_transaction_id,
      status: status === "successful" ? PAYMENT_ATTEMPT_STATUSES.PROCESSING : PAYMENT_ATTEMPT_STATUSES.FAILED,
    });
    await store.updateCheckoutSession(session.id, {
      status: status === "successful" ? CHECKOUT_STATUSES.VERIFYING : CHECKOUT_STATUSES.FAILED,
    });

    const redirectUrl = new URL(`/events/${session.events.slug}/checkout`, config.publicWebBaseUrl);
    redirectUrl.searchParams.set("session", session.public_token);
    redirectUrl.searchParams.set("verify", "1");
    sendRedirect(res, redirectUrl.toString());
  });

  router.post("/api/webhooks/flutterwave", async ({ req, res }) => {
    const rawBody = await readRawBody(req);
    const signature = req.headers["flutterwave-signature"] ?? req.headers["verif-hash"];
    const signatureValue = Array.isArray(signature) ? signature[0] : signature;
    const validSignature =
      isValidFlutterwaveSignature({
        rawBody,
        signature: signatureValue,
        secretHash: config.flutterwave.secretHash,
      }) ||
      constantTimeHexEqual(signatureValue ?? "", config.flutterwave.secretHash);
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const txRef = payload?.data?.tx_ref ?? null;
    const transactionId = payload?.data?.id ?? null;

    await store.recordWebhookEvent({
      dedupe_key: `flutterwave:${payload?.id ?? payload?.data?.id ?? txRef ?? Date.now()}`,
      delivery_id: payload?.webhook_id ?? null,
      event_type: payload?.event ?? payload?.type ?? null,
      payload,
      processed: false,
      provider: PAYMENT_PROVIDERS.FLUTTERWAVE,
      provider_event_id: payload?.id ?? String(transactionId ?? ""),
      signature_valid: validSignature,
    });

    if (!validSignature) {
      sendJson(res, 401, { error: "invalid_signature" });
      return;
    }

    if (!txRef || !transactionId) {
      sendJson(res, 200, { received: true });
      return;
    }

    const attempt = await store.findAttemptByMerchantReference(txRef);
    if (!attempt) {
      sendJson(res, 200, { received: true });
      return;
    }

    const verified = await flutterwave.verifyTransaction(transactionId);
    const success =
      verified.status === "successful" &&
      verified.amountKes === attempt.amount_kes &&
      verified.currency === attempt.currency &&
      verified.txRef === attempt.merchant_reference;

    await store.updatePaymentAttempt(attempt.id, {
      failure_code: success ? null : "flutterwave_verification_failed",
      failure_reason_safe: success ? null : SAFE_PUBLIC_MESSAGES.paymentVerificationFailed,
      provider_payload_last: verified.raw,
      provider_transaction_id: String(transactionId),
      status: success ? PAYMENT_ATTEMPT_STATUSES.SUCCEEDED : PAYMENT_ATTEMPT_STATUSES.FAILED,
    });
    await store.updateCheckoutSession(attempt.checkout_session_id, {
      status: success ? CHECKOUT_STATUSES.VERIFYING : CHECKOUT_STATUSES.FAILED,
    });

    if (success) {
      await finalizeSuccessfulPayment({ attempt, store });
    }

    sendJson(res, 200, { received: true });
  });

  router.post("/api/webhooks/payhero", async ({ req, res }) => {
    const { rawBody, json } = await readJsonBody(req);
    const payload = json;
    const callback = parsePayheroWithdrawalCallback(payload);

    await store.recordWebhookEvent({
      dedupe_key: `payhero:${callback.externalReference ?? callback.merchantRequestId ?? Date.now()}:${callback.resultCode}`,
      delivery_id: callback.checkoutRequestId ?? callback.merchantRequestId,
      event_type: "withdrawal_callback",
      payload: rawBody ? JSON.parse(rawBody) : payload,
      processed: false,
      provider: "payhero",
      provider_event_id: callback.transactionId ?? callback.externalReference ?? "",
      signature_valid: true,
    });

    if (!callback.externalReference) {
      sendJson(res, 200, { received: true });
      return;
    }

    const payoutRequest = await store.findPayoutRequestByExternalReference(callback.externalReference);
    if (!payoutRequest) {
      sendJson(res, 200, { received: true });
      return;
    }

    let verifiedStatus = null;
    try {
      const verified = await payhero.getTransactionStatus(payoutRequest.external_reference);
      verifiedStatus = verified.success ? "paid" : verified.status === "FAILED" ? "failed" : "processing";
      await store.updatePayoutRequest(payoutRequest.id, {
        failure_reason_safe: verified.success ? null : verifiedStatus === "failed" ? SAFE_PUBLIC_MESSAGES.payoutRequestFailed : null,
        processed_at: verified.success || verifiedStatus === "failed" ? new Date().toISOString() : null,
        provider_payload_last: verified.raw,
        provider_transaction_id: callback.transactionId ?? payoutRequest.provider_transaction_id,
        status: verifiedStatus,
      });
    } catch (error) {
      logger.error("[payhero:status-check]", error);
      await store.updatePayoutRequest(payoutRequest.id, {
        failure_reason_safe: callback.resultCode === 0 ? null : SAFE_PUBLIC_MESSAGES.payoutRequestFailed,
        provider_payload_last: payload,
        provider_transaction_id: callback.transactionId ?? payoutRequest.provider_transaction_id,
        status: callback.resultCode === 0 ? "processing" : "failed",
      });
    }

    sendJson(res, 200, { received: true });
  });

  router.post("/api/webhooks/mpesa", async ({ req, res }) => {
    const { rawBody, json } = await readJsonBody(req);
    const payload = json;
    const callback = parseMpesaCallback(payload);

    await store.recordWebhookEvent({
      dedupe_key: `mpesa:${callback.checkoutRequestId ?? callback.merchantRequestId ?? Date.now()}:${callback.resultCode}`,
      delivery_id: callback.checkoutRequestId,
      event_type: "stk_callback",
      payload: rawBody ? JSON.parse(rawBody) : payload,
      processed: false,
      provider: PAYMENT_PROVIDERS.MPESA_DARAJA,
      provider_event_id: callback.checkoutRequestId,
      signature_valid: true,
    });

    const attempt = await store.findAttemptByProviderRefs({
      checkoutRequestId: callback.checkoutRequestId,
      merchantRequestId: callback.merchantRequestId,
    });

    if (!attempt) {
      sendJson(res, 200, { received: true });
      return;
    }

    const session = await store.getCheckoutSessionById(attempt.checkout_session_id);
    const success =
      callback.resultCode === 0 &&
      callback.amountKes === attempt.amount_kes &&
      callback.phoneNumber === session?.guest_phone;

    await store.updatePaymentAttempt(attempt.id, {
      failure_code: success ? null : callback.resultCode === 0 ? "mpesa_verification_failed" : `mpesa_${callback.resultCode}`,
      failure_reason_safe: success ? null : SAFE_PUBLIC_MESSAGES.paymentVerificationFailed,
      provider_payload_last: payload,
      provider_reference: callback.checkoutRequestId ?? attempt.provider_reference,
      provider_transaction_id: callback.mpesaReceiptNumber ?? callback.merchantRequestId ?? attempt.provider_transaction_id,
      status: success ? PAYMENT_ATTEMPT_STATUSES.SUCCEEDED : PAYMENT_ATTEMPT_STATUSES.FAILED,
    });
    await store.updateCheckoutSession(attempt.checkout_session_id, {
      status: success ? CHECKOUT_STATUSES.VERIFYING : CHECKOUT_STATUSES.FAILED,
    });

    if (success) {
      await finalizeSuccessfulPayment({ attempt, store });
    }

    sendJson(res, 200, { received: true });
  });

  return async function app(req, res) {
    const url = new URL(req.url, config.renderApiBaseUrl);

    try {
      if (req.method === "OPTIONS" && url.pathname.startsWith("/api/") && !url.pathname.startsWith("/api/webhooks/")) {
        const headers = createBrowserCorsHeaders(assertAllowedBrowserOrigin(getRequestOrigin(req), config.allowedBrowserOrigins));
        sendEmpty(res, 204, headers);
        return;
      }

      const matched = await router.handle({
        context: {},
        req,
        res,
        url,
      });

      if (!matched) {
        sendJson(res, 404, {
          error: {
            code: "not_found",
            message: "Route not found.",
          },
        }, safeBrowserErrorHeaders(req, config));
      }
    } catch (error) {
      logger.error("[server]", error);

      if (isPublicHttpError(error)) {
        sendJson(res, error.status, {
          error: {
            code: error.code,
            message: error.message,
          },
        }, safeBrowserErrorHeaders(req, config, error.headers));
        return;
      }

      sendJson(res, 500, {
        error: {
          code: "internal_error",
          message: SAFE_PUBLIC_MESSAGES.paymentStartFailed,
        },
      }, safeBrowserErrorHeaders(req, config));
    }
  };
}
