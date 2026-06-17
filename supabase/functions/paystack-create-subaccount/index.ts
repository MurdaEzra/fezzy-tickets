// Create (or update) a Paystack subaccount for an organizer so payment
// splits land in their bank automatically on every successful charge.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
const DEFAULT_PLATFORM_FEE_PCT = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack not configured" }, 500);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user?.id) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userId = userData.user.id;

    const { businessName, settlementBank, accountNumber } = await req.json();
    if (!businessName || !settlementBank || !accountNumber) {
      return json({ error: "Missing fields" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: organizer } = await admin
      .from("organizer_profiles")
      .select("id, paystack_subaccount_code, fee_locked_pct")
      .eq("user_id", userId)
      .maybeSingle();
    if (!organizer) return json({ error: "Organizer profile not found" }, 404);

    const percentage_charge = organizer.fee_locked_pct ?? DEFAULT_PLATFORM_FEE_PCT;

    const body = {
      business_name: businessName,
      settlement_bank: settlementBank,
      account_number: accountNumber,
      percentage_charge,
    };

    let url = "https://api.paystack.co/subaccount";
    let method = "POST";
    if (organizer.paystack_subaccount_code) {
      url = `https://api.paystack.co/subaccount/${organizer.paystack_subaccount_code}`;
      method = "PUT";
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const paystackData = await res.json();
    if (!res.ok || paystackData?.status === false) {
      return json(
        { error: paystackData?.message ?? JSON.stringify(paystackData) },
        res.status >= 400 ? res.status : 502,
      );
    }

    const { error: updateError } = await admin
      .from("organizer_profiles")
      .update({
        paystack_subaccount_code: paystackData.data.subaccount_code,
        paystack_bank_code: settlementBank,
        paystack_account_number: accountNumber,
        paystack_account_name: paystackData.data.account_name ?? businessName,
      })
      .eq("id", organizer.id);

    if (updateError) {
      return json({ error: updateError.message }, 500);
    }

    return json({
      subaccount_code: paystackData.data.subaccount_code,
      account_name: paystackData.data.account_name,
      percentage_charge,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
