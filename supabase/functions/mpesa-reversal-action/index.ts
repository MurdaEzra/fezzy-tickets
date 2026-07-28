// Admin-triggered M-Pesa transaction reversal for failed/stuck payments.
// Covers primary purchases, LPP installments, and resale purchases.
// Uses the Safaricom Daraja Reversal API.
import { createClient } from "npm:@supabase/supabase-js@2";

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

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { paymentType, referenceId, mpesaReceipt, amountKes, guestPhone, guestEmail, guestName, eventTitle } = await req.json();

    if (!paymentType || !referenceId || !mpesaReceipt || !amountKes) {
      return json({ error: "paymentType, referenceId, mpesaReceipt, and amountKes are required" }, 400);
    }

    if (!["primary", "lpp", "resale"].includes(paymentType)) {
      return json({ error: "paymentType must be primary, lpp, or resale" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify admin
    const { data: userRes, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);

    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id);
    if (!roles?.some((r) => r.role === "admin")) return json({ error: "Forbidden: Admin only" }, 403);

    // Check no existing processing/completed reversal
    const { data: existing } = await admin
      .from("mpesa_reversals")
      .select("id, status")
      .eq("payment_type", paymentType)
      .eq("reference_id", referenceId)
      .in("status", ["processing", "completed"])
      .maybeSingle();

    if (existing) {
      if (existing.status === "completed") {
        return json({ error: "This transaction has already been reversed" }, 409);
      }
      return json({ error: "A reversal is already in progress for this transaction" }, 409);
    }

    // Get M-Pesa credentials
    const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
    const baseUrl = env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
    const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
    const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
    const shortCode = Deno.env.get("MPESA_SHORTCODE")!;
    const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME")!;
    const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

    if (!consumerKey || !consumerSecret || !shortCode || !initiatorName || !securityCredential) {
      return json({ error: "M-Pesa reversal credentials are not fully configured" }, 500);
    }

    // Get OAuth token
    const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
    });
    const tokenData = await parseResponseBody(tokenRes);
    const token = tokenData && typeof tokenData === "object"
      ? stringValue((tokenData as Record<string, unknown>).access_token)
      : null;
    if (!tokenRes.ok || !token) {
      return json({ error: `M-Pesa auth failed: ${getMpesaErrorMessage(tokenData, "Unable to authenticate")}` }, 502);
    }

    // Create reversal record first
    const { data: reversal, error: insertErr } = await admin
      .from("mpesa_reversals")
      .insert({
        payment_type: paymentType,
        reference_id: referenceId,
        mpesa_receipt: mpesaReceipt,
        amount_kes: amountKes,
        status: "processing",
        guest_phone: guestPhone ?? null,
        guest_email: guestEmail ?? null,
        guest_name: guestName ?? null,
        event_title: eventTitle ?? null,
        initiated_by: userRes.user.id,
        initiated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr || !reversal) {
      console.error("[mpesa-reversal-action] Failed to create reversal record:", insertErr);
      return json({ error: "Failed to create reversal record" }, 500);
    }

    // Build callback URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/mpesa-reversal-callback?reversal_id=${encodeURIComponent(reversal.id)}`;

    // Call Daraja Reversal API
    const reversalPayload = {
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "TransactionReversal",
      TransactionID: mpesaReceipt,
      Amount: Math.max(1, Math.round(amountKes)),
      ReceiverParty: shortCode,
      ReceiverIdentifierType: "11",
      Remarks: `Fezzy ${paymentType} refund ${referenceId.slice(0, 8)}`.slice(0, 100),
      QueueTimeOutURL: `${callbackUrl}&timeout=1`,
      ResultURL: callbackUrl,
      Occasion: `Fezzy ${paymentType} reversal`,
    };

    console.log("[mpesa-reversal-action] Sending reversal request:", JSON.stringify(reversalPayload));

    const reversalRes = await fetch(`${baseUrl}/mpesa/reversal/v1/request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reversalPayload),
    });

    const reversalData = await parseResponseBody(reversalRes);
    const reversalBody = reversalData && typeof reversalData === "object"
      ? reversalData as Record<string, unknown>
      : {};

    const responseCode = stringValue(reversalBody.ResponseCode);

    if (!reversalRes.ok || (responseCode && responseCode !== "0")) {
      const errorMsg = getMpesaErrorMessage(reversalData, "Reversal request failed");
      console.error("[mpesa-reversal-action] Reversal API error:", errorMsg);

      // Update reversal record as failed
      await admin.from("mpesa_reversals").update({
        status: "failed",
        error_message: errorMsg,
      }).eq("id", reversal.id);

      return json({ error: errorMsg }, 502);
    }

    // Update with conversation ID
    const conversationId = stringValue(reversalBody.ConversationID) ??
      stringValue(reversalBody.OriginatorConversationID);

    if (conversationId) {
      await admin.from("mpesa_reversals").update({
        conversation_id: conversationId,
      }).eq("id", reversal.id);
    }

    console.log("[mpesa-reversal-action] Reversal request accepted:", JSON.stringify(reversalBody));

    return json({
      success: true,
      message: "Reversal request sent to M-Pesa for processing",
      reversal_id: reversal.id,
    });

  } catch (err) {
    console.error("[mpesa-reversal-action]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
