import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseAdmin = ReturnType<typeof createClient>;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string
  ));
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getMpesaErrorMessage(payload: unknown, fallback: string): string {
  if (typeof payload === "string" && payload.trim()) return payload;
  if (payload && typeof payload === "object") {
    const body = payload as Record<string, unknown>;
    return (
      stringValue(body.errorMessage) ??
      stringValue(body.error_description) ??
      stringValue(body.error) ??
      stringValue(body.message) ??
      stringValue(body.ResponseDescription) ??
      fallback
    );
  }
  return fallback;
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { listingId, action } = await req.json();
    if (!listingId || !action) return json({ error: "listingId and action required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    
    // Check if super admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id);
    const hasAdmin = roles?.some((r) => r.role === "admin");
    
    if (!hasAdmin) return json({ error: "Forbidden: Admin only" }, 403);

    if (action === "approve") {
      // 1) Generate a fresh strong qr_token
      const rand = new Uint8Array(32);
      crypto.getRandomValues(rand);
      const newQrToken = Array.from(rand, (b) => b.toString(16).padStart(2, "0")).join("");

      // 2) Call approve_resale_transfer
      const { error } = await admin.rpc("approve_resale_transfer", {
        _admin_user_id: userRes.user.id,
        _listing_id: listingId,
        _new_qr_token: newQrToken,
      });

      if (error) {
        return json({ error: error.message }, 400);
      }

      // 3) Email buyer
      await notifyResaleBuyer(admin, listingId);
      
      return json({ success: true, message: "Ticket approved and buyer notified" });
    } 
    else if (action === "payout") {
      // Verify the event has started, and check payout_status
      const { data: transfer, error: transferError } = await admin
        .from("resale_transfers")
        .select("*, ticket_resale_listings(event_id)")
        .eq("listing_id", listingId)
        .single();
        
      if (transferError || !transfer) return json({ error: "Transfer not found" }, 404);
      if (transfer.payout_status === "paid") return json({ error: "Payout already processed" }, 400);
      if (transfer.payout_status === "processing") return json({ error: "Payout is already processing" }, 409);
      if (!transfer.seller_payout_phone) return json({ error: "Seller has not provided a payout phone number" }, 400);
      
      const { data: eventInfo } = await admin.from("events").select("starts_at").eq("id", transfer.ticket_resale_listings.event_id).single();
      
      if (eventInfo?.starts_at && new Date(eventInfo.starts_at) > new Date()) {
         return json({ error: "Cannot payout before the event has started" }, 400);
      }

      console.log(`Initiating B2C payout for KES ${transfer.sale_price_kes} to seller phone ${transfer.seller_payout_phone}`);
      
      try {
        const payout = await initiateB2CPayout(
          transfer.sale_price_kes,
          transfer.seller_payout_phone,
          transfer.id,
          `Fezzy Resale Payout for listing ${listingId}`
        );
        const { error: payoutUpdateError } = await admin
          .from("resale_transfers")
          .update({
            payout_status: "processing",
            payout_ref: payout.originatorConversationId ?? payout.conversationId ?? null,
            payout_started_at: new Date().toISOString(),
            payout_error: null,
          })
          .eq("id", transfer.id)
          .neq("payout_status", "paid");
        if (payoutUpdateError) throw payoutUpdateError;
      } catch (payoutErr: unknown) {
        console.error("B2C Payout Error:", payoutErr);
        return json({ error: payoutErr instanceof Error ? payoutErr.message : "M-Pesa B2C payout failed" }, 502);
      }

      return json({ success: true, message: "Seller payout sent to M-Pesa for processing" });
    }

    return json({ error: "Invalid action" }, 400);

  } catch (err) {
    console.error("[resale-admin-action]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

async function initiateB2CPayout(amountKes: number, phone: string, transferId: string, remarks: string) {
  const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
  const baseUrl = env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
  const shortCode = Deno.env.get("MPESA_SHORTCODE")!;
  const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME")!;
  const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

  if (!consumerKey || !consumerSecret || !shortCode || !initiatorName || !securityCredential) {
    throw new Error("M-Pesa B2C credentials are not fully configured");
  }

  // Get OAuth token
  const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
  });
  const tokenData = await parseResponseBody(tokenRes);
  const token = tokenData && typeof tokenData === "object" ? stringValue((tokenData as Record<string, unknown>).access_token) : null;
  if (!tokenRes.ok || !token) {
    throw new Error(`M-Pesa auth failed: ${getMpesaErrorMessage(tokenData, "Unable to authenticate")}`);
  }

  function normalizeKenyanPhone(raw: string): string {
    const digits = String(raw ?? "").replace(/\D/g, "");
    if (digits.startsWith("254") && digits.length === 12) return digits;
    if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
    if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
    throw new Error("Enter a valid Kenyan phone number");
  }

  const normalizedPhone = normalizeKenyanPhone(phone);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const callbackUrl = `${supabaseUrl}/functions/v1/resale-b2c-result-callback?transfer_id=${encodeURIComponent(transferId)}`;

  const payload = {
    InitiatorName: initiatorName,
    SecurityCredential: securityCredential,
    CommandID: "BusinessPayment",
    Amount: Math.max(1, Math.round(amountKes)),
    PartyA: shortCode,
    PartyB: normalizedPhone,
    Remarks: remarks.slice(0, 100),
    QueueTimeOutURL: `${callbackUrl}&timeout=1`,
    ResultURL: callbackUrl,
    Occasion: "Resale Payout"
  };

  const b2cRes = await fetch(`${baseUrl}/mpesa/b2c/v1/paymentrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  
  const b2cData = await parseResponseBody(b2cRes);
  const b2cBody = b2cData && typeof b2cData === "object" ? b2cData as Record<string, unknown> : {};
  const responseCode = stringValue(b2cBody.ResponseCode);
  if (!b2cRes.ok || (responseCode && responseCode !== "0")) {
    throw new Error(getMpesaErrorMessage(b2cData, "B2C request failed"));
  }
  return {
    originatorConversationId: stringValue(b2cBody.OriginatorConversationID),
    conversationId: stringValue(b2cBody.ConversationID),
  };
}

async function notifyResaleBuyer(admin: SupabaseAdmin, listingId: string) {
  const { data: listing } = await admin
    .from("ticket_resale_listings_public")
    .select("event_title, event_starts_at, event_venue_name, event_city, tier_name, resale_price_kes")
    .eq("listing_id", listingId)
    .maybeSingle();
  if (!listing) return;

  const { data: raw } = await admin
    .from("ticket_resale_listings")
    .select("buyer_user_id")
    .eq("id", listingId)
    .maybeSingle();
  const buyerId = raw?.buyer_user_id;
  if (!buyerId) return;
  const { data: userRes } = await admin.auth.admin.getUserById(buyerId);
  const email = userRes.user?.email;
  if (!email) return;

  const dateStr = listing.event_starts_at
    ? new Date(listing.event_starts_at).toLocaleString("en-GB", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      })
    : "TBA";

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#0b0b0f;font-family:Georgia,'Times New Roman',serif;color:#f5efe1;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">
  <div style="border:1px solid #2b241a;background:linear-gradient(135deg,#151009 0%,#0b0b0f 100%);border-radius:24px;padding:40px 32px;">
    <p style="letter-spacing:.28em;font-size:11px;color:#c8a664;margin:0 0 12px;text-transform:uppercase;">Resale · Approved</p>
    <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:34px;line-height:1.1;margin:0 0 20px;color:#f5efe1;">Your ticket is approved and ready.</h1>
    <p style="color:#c9c1b2;font-size:15px;line-height:1.6;margin:0 0 24px;">Your resale purchase for <strong style="color:#f5efe1;">${escapeHtml(listing.event_title ?? "")}</strong> has passed fraud checks! Sign in to Fezzy Tickets and open the Tickets tab to reveal your QR code.</p>
    <div style="border:1px solid #2b241a;border-radius:16px;padding:20px 24px;background:rgba(200,166,100,0.06);margin:0 0 28px;">
      <p style="margin:0 0 8px;color:#c8a664;font-size:11px;letter-spacing:.24em;text-transform:uppercase;">${escapeHtml(listing.tier_name ?? "")}</p>
      <p style="margin:0;color:#f5efe1;font-size:17px;">${escapeHtml(listing.event_title ?? "")}</p>
      <p style="margin:6px 0 0;color:#c9c1b2;font-size:13px;">${escapeHtml(dateStr)}</p>
      <p style="margin:6px 0 0;color:#c9c1b2;font-size:13px;">${escapeHtml(listing.event_venue_name ?? "Venue TBA")}, ${escapeHtml(listing.event_city ?? "")}</p>
      <p style="margin:14px 0 0;color:#f5efe1;font-size:15px;">Paid: KES ${Number(listing.resale_price_kes ?? 0).toLocaleString()}</p>
    </div>
    <a href="https://fezzytickets.com/account" style="display:inline-block;background:#c8a664;color:#0b0b0f;padding:14px 28px;border-radius:999px;text-decoration:none;font-weight:600;letter-spacing:.06em;">Open my tickets</a>
    <p style="margin:32px 0 0;color:#7c7566;font-size:11px;line-height:1.6;">Along Karen Rd, Langata · Nairobi, Kenya · +254 728 135 200</p>
  </div>
</div></body></html>`;

  await sendBrevoEmail({
    recipientEmail: email,
    subject: `Your resale ticket for ${listing.event_title} is ready`,
    htmlContent: html,
  });
}

async function sendBrevoEmail({
  recipientEmail,
  subject,
  htmlContent,
}: {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "Fezzy Tickets", email: "admin@fezzytickets.com" },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent,
    }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}
