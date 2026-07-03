import { PublicHttpError, isPublicHttpError } from "./http/errors.js";
import { readJsonBody, getBearerToken, getClientIp, getRequestOrigin } from "./http/request.js";
import { sendEmpty, sendJson } from "./http/response.js";
import { createRouter } from "./http/router.js";
import { loadConfig } from "./config.js";
import { createBrowserCorsHeaders, assertAllowedBrowserOrigin } from "./security/cors.js";
import { createTokenBucketStore } from "./security/rate-limit.js";
import { createAdminClient, getUserFromAccessToken } from "./supabase/admin.js";
import { createPaymentStore } from "./payments/store.js";
import { createMpesaClient, normalizeKenyaPhoneNumber, parseMpesaCallback } from "./payments/providers/mpesa.js";
import { SAFE_PUBLIC_MESSAGES } from "./payments/messages.js";
import { CHECKOUT_STATUSES, PAYMENT_ATTEMPT_STATUSES, PAYMENT_METHODS, PAYMENT_PROVIDERS } from "./payments/constants.js";
import { createCheckoutSessionRecord, createPaymentAttemptRecord } from "./payments/service.js";

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



export function createApp(deps = {}) {
  const config = deps.config ?? loadConfig();
  const admin = deps.admin ?? createAdminClient(config);
  const store = deps.store ?? createPaymentStore(admin, {
    ticketDeliverySecret: config.ticketDeliverySecret,
  });
  const mpesa = deps.mpesa ?? createMpesaClient(config.mpesa);
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

  router.post("/api/webhooks/mpesa", async ({ req, res }) => {
    const { json } = await readJsonBody(req);
    const payload = json;
    const callback = parseMpesaCallback(payload);

    await store.recordWebhookEvent({
      dedupe_key: `mpesa:${callback.checkoutRequestId ?? callback.merchantRequestId ?? Date.now()}:${callback.resultCode}`,
      delivery_id: callback.checkoutRequestId,
      event_type: "stk_callback",
      payload,
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
