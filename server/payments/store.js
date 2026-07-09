import { PublicHttpError } from "../http/errors.js";

function throwIfError(error, message) {
  if (error) {
    console.error("[Supabase Error]", error);
    throw new Error(`${message}: ${error.message || JSON.stringify(error)}`);
  }
}

export function createPaymentStore(admin, { brevoApiKey, ticketDeliverySecret }) {
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
      // Attempt 1: Supabase Edge Function
      try {
        const { error } = await admin.functions.invoke("send-ticket-email", {
          body: { orderId },
          headers: {
            "x-internal-ticket-secret": ticketDeliverySecret,
          },
        });

        if (!error) {
          console.log("[ticket-delivery] Sent via edge function");
          return;
        }

        console.warn("[ticket-delivery] Edge function returned error, falling back to direct Brevo:", error);
      } catch (edgeFnError) {
        console.warn("[ticket-delivery] Edge function threw, falling back to direct Brevo:", edgeFnError);
      }

      // Attempt 2: Direct Brevo email
      if (!brevoApiKey) {
        console.error("[ticket-delivery-fallback] No BREVO_API_KEY configured, cannot send ticket email");
        return;
      }

      const { data: order, error: orderError } = await admin
        .from("orders")
        .select("*, events(*), tickets(*, ticket_tiers(*))")
        .eq("id", orderId)
        .single();

      if (orderError || !order) {
        console.error("[ticket-delivery-fallback] Could not load order:", orderError);
        return;
      }

      const event = order.events;
      const dateStr = new Date(event.starts_at).toLocaleString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });

      const ref = order.ref || `FZ-${orderId.slice(0, 8).toUpperCase()}`;

      // Group tickets by holder email
      const ticketsByEmail = new Map();
      for (const ticket of order.tickets) {
        const list = ticketsByEmail.get(ticket.holder_email) ?? [];
        list.push(ticket);
        ticketsByEmail.set(ticket.holder_email, list);
      }

      let sentCount = 0;
      for (const [recipientEmail, tickets] of ticketsByEmail.entries()) {
        const ticketRows = tickets.map((t) =>
          `<tr>
            <td style="padding:8px;border-bottom:1px solid #eee">${t.holder_name}</td>
            <td style="padding:8px;border-bottom:1px solid #eee">${t.ticket_tiers?.name ?? "General"}</td>
            <td style="padding:8px;border-bottom:1px solid #eee"><code>${t.qr_token}</code></td>
          </tr>`
        ).join("");

        const htmlContent = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Your Fezzy Tickets</title></head>
<body style="background:#FFF8EE;padding:24px;font-family:Arial,sans-serif">
<div style="max-width:700px;margin:auto">
  <div style="background:linear-gradient(135deg,#1FAD66,#2bd083);padding:28px;color:white;border-radius:12px 12px 0 0">
    <p style="margin:0;font-size:11px;text-transform:uppercase">Admit One</p>
    <h1 style="margin:8px 0">${event.title}</h1>
    <p style="margin:0">${dateStr} · ${event.venue_name ?? "TBA"}, ${event.city ?? ""}</p>
  </div>
  <div style="background:#fff;padding:24px;border-radius:0 0 12px 12px;border:1px solid #ebe2cf;border-top:0">
    <p>Booking Reference: <strong>${ref}</strong></p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <thead><tr style="text-align:left">
        <th style="padding:8px;border-bottom:2px solid #ddd">Holder</th>
        <th style="padding:8px;border-bottom:2px solid #ddd">Tier</th>
        <th style="padding:8px;border-bottom:2px solid #ddd">QR Token</th>
      </tr></thead>
      <tbody>${ticketRows}</tbody>
    </table>
    <p style="color:#777;text-align:center;margin-top:24px">Show your QR code at the gate. Screenshots are accepted.</p>
  </div>
  <div style="border-top:1px solid #ddd;padding-top:24px;margin-top:24px;text-align:center;font-size:12px;color:#777">
    <p style="margin:4px 0">Along Karen Rd, Langata P.O. BOX 00502-00502, Karen Nairobi, Kenya</p>
    <p style="margin:4px 0">Phone: +254728135200</p>
  </div>
</div>
</body></html>`;

        try {
          const res = await fetch("https://api.brevo.com/v3/smtp/email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": brevoApiKey,
            },
            body: JSON.stringify({
              sender: { name: "Fezzy Tickets", email: "hello@fezzytickets.com" },
              to: [{ email: recipientEmail }],
              subject: `Your Ticket${tickets.length > 1 ? "s" : ""} - ${event.title}`,
              htmlContent,
            }),
          });

          if (!res.ok) {
            const errText = await res.text();
            console.error("[ticket-delivery-fallback] Brevo error for", recipientEmail, errText);
          } else {
            sentCount++;
          }
        } catch (fetchErr) {
          console.error("[ticket-delivery-fallback] Brevo fetch failed for", recipientEmail, fetchErr);
        }
      }

      console.log(`[ticket-delivery-fallback] Sent ${sentCount}/${ticketsByEmail.size} emails via Brevo`);
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
