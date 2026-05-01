import { PublicHttpError } from "../http/errors.js";

function throwIfError(error, message) {
  if (error) {
    throw new Error(message);
  }
}

export function createPaymentStore(admin, { ticketDeliverySecret }) {
  return {
    async createCheckoutSession(record) {
      const { data, error } = await admin
        .from("checkout_sessions")
        .insert(record)
        .select("*, events(*), ticket_tiers(*)")
        .single();

      throwIfError(error, "Unable to create checkout session");
      return data;
    },

    async createPaymentAttempt(record) {
      const { data, error } = await admin
        .from("payment_attempts")
        .insert(record)
        .select("*")
        .single();

      throwIfError(error, "Unable to create payment attempt");
      return data;
    },

    async completeVerifiedCheckout(checkoutSessionId, paymentAttemptId) {
      const { data, error } = await admin.rpc("complete_verified_checkout", {
        _checkout_session_id: checkoutSessionId,
        _payment_attempt_id: paymentAttemptId,
      });

      throwIfError(error, "Unable to create paid order");
      return data;
    },

    async findAttemptByMerchantReference(merchantReference) {
      const { data, error } = await admin
        .from("payment_attempts")
        .select("*")
        .eq("merchant_reference", merchantReference)
        .maybeSingle();

      throwIfError(error, "Unable to load payment attempt");
      return data;
    },

    async findAttemptByProviderRefs({ checkoutRequestId, merchantRequestId }) {
      const filters = [
        checkoutRequestId ? `provider_reference.eq.${checkoutRequestId}` : null,
        merchantRequestId ? `provider_transaction_id.eq.${merchantRequestId}` : null,
      ].filter(Boolean);

      if (filters.length === 0) {
        return null;
      }

      const { data, error } = await admin
        .from("payment_attempts")
        .select("*")
        .or(filters.join(","))
        .maybeSingle();

      throwIfError(error, "Unable to load payment attempt");
      return data;
    },

    async findPayoutRequestByExternalReference(externalReference) {
      const { data, error } = await admin
        .from("payout_requests")
        .select("*")
        .eq("external_reference", externalReference)
        .maybeSingle();

      throwIfError(error, "Unable to load payout request");
      return data;
    },

    async getCheckoutSessionByToken(publicToken) {
      const { data, error } = await admin
        .from("checkout_sessions")
        .select("*, events(*), ticket_tiers(*)")
        .eq("public_token", publicToken)
        .maybeSingle();

      throwIfError(error, "Unable to load checkout session");
      return data;
    },

    async getCheckoutSessionById(id) {
      const { data, error } = await admin
        .from("checkout_sessions")
        .select("*, events(*), ticket_tiers(*)")
        .eq("id", id)
        .maybeSingle();

      throwIfError(error, "Unable to load checkout session");
      return data;
    },

    async getEventAndTierBySlug({ slug, tierId }) {
      const { data: event, error: eventError } = await admin
        .from("events")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();

      throwIfError(eventError, "Unable to load event");
      if (!event) {
        throw new PublicHttpError(404, "event_not_found", "This event is not available.");
      }

      const tierQuery = admin
        .from("ticket_tiers")
        .select("*")
        .eq("event_id", event.id);

      const { data: tier, error: tierError } = tierId
        ? await tierQuery.eq("id", tierId).maybeSingle()
        : await tierQuery.order("sort_order", { ascending: true }).limit(1).maybeSingle();

      throwIfError(tierError, "Unable to load ticket tier");
      if (!tier) {
        throw new PublicHttpError(404, "tier_not_found", "This ticket tier is not available.");
      }

      return { event, tier };
    },

    async getOrganizerProfileByUserId(userId) {
      const { data, error } = await admin
        .from("organizer_profiles")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      throwIfError(error, "Unable to load organizer profile");
      return data;
    },

    async getLatestPaymentAttempt(checkoutSessionId) {
      const { data, error } = await admin
        .from("payment_attempts")
        .select("*")
        .eq("checkout_session_id", checkoutSessionId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      throwIfError(error, "Unable to load latest payment attempt");
      return data;
    },

    async listPaidOrdersForOrganizer(organizerProfileId) {
      const { data: events, error: eventError } = await admin
        .from("events")
        .select("id")
        .eq("organizer_id", organizerProfileId);

      throwIfError(eventError, "Unable to load organizer events");
      const eventIds = (events ?? []).map((event) => event.id);
      if (eventIds.length === 0) {
        return [];
      }

      const { data, error } = await admin
        .from("orders")
        .select("id, total_kes, organizer_fee_kes, status")
        .in("event_id", eventIds)
        .eq("status", "paid");

      throwIfError(error, "Unable to load organizer paid orders");
      return data ?? [];
    },

    async listPayoutRequestsForOrganizer(organizerProfileId) {
      const { data, error } = await admin
        .from("payout_requests")
        .select("*")
        .eq("organizer_profile_id", organizerProfileId)
        .order("created_at", { ascending: false });

      throwIfError(error, "Unable to load payout requests");
      return data ?? [];
    },

    async getOrderByCheckoutSessionId(checkoutSessionId) {
      const { data, error } = await admin
        .from("orders")
        .select("*")
        .eq("checkout_session_id", checkoutSessionId)
        .maybeSingle();

      throwIfError(error, "Unable to load order");
      return data;
    },

    async getPaymentAttemptById(id) {
      const { data, error } = await admin
        .from("payment_attempts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      throwIfError(error, "Unable to load payment attempt");
      return data;
    },

    async recordWebhookEvent(record) {
      const { data, error } = await admin
        .from("payment_webhook_events")
        .insert(record)
        .select("*")
        .maybeSingle();

      if (error?.code === "23505") {
        return { duplicate: true, record: null };
      }

      throwIfError(error, "Unable to record webhook event");
      return { duplicate: false, record: data };
    },

    async createPayoutRequest(record) {
      const { data, error } = await admin
        .from("payout_requests")
        .insert(record)
        .select("*")
        .single();

      throwIfError(error, "Unable to create payout request");
      return data;
    },

    async requestPasswordReset(email, redirectTo) {
      await admin.auth.resetPasswordForEmail(email, { redirectTo });
    },

    async sendTicketDelivery(orderId) {
      const { error } = await admin.functions.invoke("send-ticket-email", {
        body: { orderId },
        headers: {
          "x-internal-ticket-secret": ticketDeliverySecret,
        },
      });

      if (error) {
        throw new Error("Unable to trigger ticket delivery");
      }
    },

    async updateCheckoutSession(id, updates) {
      const { data, error } = await admin
        .from("checkout_sessions")
        .update(updates)
        .eq("id", id)
        .select("*, events(*), ticket_tiers(*)")
        .single();

      throwIfError(error, "Unable to update checkout session");
      return data;
    },

    async updatePaymentAttempt(id, updates) {
      const { data, error } = await admin
        .from("payment_attempts")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      throwIfError(error, "Unable to update payment attempt");
      return data;
    },

    async updatePayoutRequest(id, updates) {
      const { data, error } = await admin
        .from("payout_requests")
        .update(updates)
        .eq("id", id)
        .select("*")
        .single();

      throwIfError(error, "Unable to update payout request");
      return data;
    },
  };
}
