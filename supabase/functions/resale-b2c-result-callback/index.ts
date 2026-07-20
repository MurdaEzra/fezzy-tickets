import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const transferId = url.searchParams.get("transfer_id");
    const isTimeout = url.searchParams.get("timeout") === "1";
    const payload = await req.json().catch(() => ({}));

    if (!transferId) {
      console.error("[resale-b2c-result-callback] Missing transfer_id");
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const result = payload?.Result ?? {};
    const resultCode = Number(result.ResultCode ?? -1);
    const transactionId = result.TransactionID ?? null;
    const conversationId = result.ConversationID ?? result.OriginatorConversationID ?? null;
    const resultDesc = result.ResultDesc ?? (isTimeout ? "M-Pesa B2C queue timeout" : "M-Pesa B2C failed");

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (!isTimeout && resultCode === 0) {
      await admin
        .from("resale_transfers")
        .update({
          payout_status: "paid",
          payout_ref: transactionId ?? conversationId,
          payout_completed_at: new Date().toISOString(),
          payout_error: null,
        })
        .eq("id", transferId)
        .in("payout_status", ["pending", "processing", "failed"]);
    } else {
      await admin
        .from("resale_transfers")
        .update({
          payout_status: "failed",
          payout_error: String(resultDesc).slice(0, 500),
        })
        .eq("id", transferId)
        .neq("payout_status", "paid");
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    console.error("[resale-b2c-result-callback]", err);
    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  }
});
