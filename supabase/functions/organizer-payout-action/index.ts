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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const { organizerId, amount } = await req.json();
    if (!organizerId || !amount) return json({ error: "organizerId and amount required" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userRes, error: userErr } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));
    if (userErr || !userRes.user) return json({ error: "Invalid session" }, 401);
    
    // Check if super admin
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", userRes.user.id);
    const hasAdmin = roles?.some(r => r.role === "super_admin" || r.role === "admin");
    
    if (!hasAdmin) return json({ error: "Forbidden: Super Admin only" }, 403);

    // Fetch organizer profile
    const { data: organizer, error: orgError } = await admin
      .from("organizer_profiles")
      .select("*")
      .eq("id", organizerId)
      .single();
      
    if (orgError || !organizer) return json({ error: "Organizer not found" }, 404);

    const method = organizer.payout_method || 'mpesa';
    const targetInfo = method === 'till' ? organizer.mpesa_till : organizer.contact_phone;

    if (!targetInfo) {
      return json({ error: `Organizer missing configuration for ${method}` }, 400);
    }

    if (method === 'till') {
      console.log(`Initiating M-Pesa B2B payout of KES ${amount} to Till ${targetInfo}`);
    } else {
      console.log(`Initiating M-Pesa B2C payout of KES ${amount} to Phone ${targetInfo}`);
    }

    try {
      await initiateMpesaPayout(amount, method, targetInfo, `Payout to ${organizer.org_name}`);
    } catch (err: any) {
      console.error("Payout Error:", err);
      return json({ error: err.message || "M-Pesa payout failed" }, 502);
    }

    // Log the payout
    await admin.from("platform_logs").insert({
      level: "info",
      action: "organizer_payout",
      message: `Processed ${method} payout of KES ${amount} to ${organizer.org_name}`,
      metadata: { organizerId, amount, method, targetInfo },
      user_id: userRes.user.id
    });

    return json({ success: true, message: "Payout initiated" });

  } catch (err) {
    console.error("[organizer-payout-action]", err);
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

async function initiateMpesaPayout(amountKes: number, method: string, targetStr: string, remarks: string) {
  const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
  const baseUrl = env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;
  const shortCode = Deno.env.get("MPESA_SHORTCODE")!;
  const initiatorName = Deno.env.get("MPESA_INITIATOR_NAME")!;
  const securityCredential = Deno.env.get("MPESA_SECURITY_CREDENTIAL")!;

  if (!initiatorName || !securityCredential) {
    throw new Error("M-Pesa API credentials (initiator name or security credential) missing");
  }

  // Get OAuth token
  const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) throw new Error("M-Pesa auth failed");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

  if (method === 'till') {
    // B2B Payout
    const payload = {
      Initiator: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "BusinessBuyGoods", // standard till payment
      SenderIdentifierType: "4",
      RecipientIdentifierType: "4",
      Amount: Math.max(1, Math.round(amountKes)),
      PartyA: shortCode,
      PartyB: targetStr,
      AccountReference: "FezzyPayout",
      Remarks: remarks.slice(0, 100),
      QueueTimeOutURL: `${supabaseUrl}/functions/v1/organizer-mpesa-callback`,
      ResultURL: `${supabaseUrl}/functions/v1/organizer-mpesa-callback`,
    };

    const res = await fetch(`${baseUrl}/mpesa/b2b/v1/paymentrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    if (!res.ok || (data.ResponseCode && data.ResponseCode !== "0")) {
      throw new Error(data?.errorMessage ?? data?.ResponseDescription ?? "B2B request failed");
    }
    return data;
  } else {
    // B2C Payout (Phone)
    const digits = String(targetStr ?? "").replace(/\D/g, "");
    let normalizedPhone = digits;
    if (digits.startsWith("0") && digits.length === 10) normalizedPhone = `254${digits.slice(1)}`;
    else if (digits.startsWith("7") && digits.length === 9) normalizedPhone = `254${digits}`;
    else if (!(digits.startsWith("254") && digits.length === 12)) throw new Error("Invalid Kenyan phone number for M-Pesa");

    const payload = {
      InitiatorName: initiatorName,
      SecurityCredential: securityCredential,
      CommandID: "BusinessPayment",
      Amount: Math.max(1, Math.round(amountKes)),
      PartyA: shortCode,
      PartyB: normalizedPhone,
      Remarks: remarks.slice(0, 100),
      QueueTimeOutURL: `${supabaseUrl}/functions/v1/organizer-mpesa-callback`,
      ResultURL: `${supabaseUrl}/functions/v1/organizer-mpesa-callback`,
      Occasion: "Organizer Payout"
    };

    const res = await fetch(`${baseUrl}/mpesa/b2c/v1/paymentrequest`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    
    const data = await res.json();
    if (!res.ok || (data.ResponseCode && data.ResponseCode !== "0")) {
      throw new Error(data?.errorMessage ?? data?.ResponseDescription ?? "B2C request failed");
    }
    return data;
  }
}
