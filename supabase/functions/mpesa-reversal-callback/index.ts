// Handles the Safaricom Daraja Reversal API async result callback.
// On success: marks reversal as completed and updates the source record.
// On failure: marks reversal as failed with error details.
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
    const reversalId = url.searchParams.get("reversal_id");
    const isTimeout = url.searchParams.get("timeout") === "1";
    const payload = await req.json().catch(() => ({}));

    console.log("[mpesa-reversal-callback] Received:", JSON.stringify({ reversalId, isTimeout, payload }));

    if (!reversalId) {
      console.error("[mpesa-reversal-callback] Missing reversal_id");
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Load reversal record
    const { data: reversal } = await admin
      .from("mpesa_reversals")
      .select("*")
      .eq("id", reversalId)
      .maybeSingle();

    if (!reversal) {
      console.error("[mpesa-reversal-callback] Reversal not found:", reversalId);
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    if (reversal.status === "completed") {
      console.log("[mpesa-reversal-callback] Already completed, ignoring");
      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    const result = payload?.Result ?? {};
    const resultCode = Number(result.ResultCode ?? -1);
    const transactionId = result.TransactionID ?? null;
    const conversationId = result.ConversationID ?? result.OriginatorConversationID ?? null;
    const resultDesc = result.ResultDesc ?? (isTimeout ? "M-Pesa reversal queue timeout" : "M-Pesa reversal failed");

    if (isTimeout || resultCode !== 0) {
      // Reversal failed or timed out
      console.log(`[mpesa-reversal-callback] Reversal failed: code=${resultCode}, desc=${resultDesc}`);
      await admin.from("mpesa_reversals").update({
        status: "failed",
        error_message: String(resultDesc).slice(0, 500),
        conversation_id: conversationId ?? reversal.conversation_id,
      }).eq("id", reversalId).neq("status", "completed");

      return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
    }

    // Reversal succeeded — update reversal record
    console.log(`[mpesa-reversal-callback] Reversal succeeded for ${reversal.payment_type} ref=${reversal.reference_id}`);

    await admin.from("mpesa_reversals").update({
      status: "completed",
      reversal_transaction_id: transactionId,
      conversation_id: conversationId ?? reversal.conversation_id,
      completed_at: new Date().toISOString(),
      error_message: null,
    }).eq("id", reversalId);

    // Update the source record based on payment type
    await updateSourceRecord(admin, reversal);

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders });
  } catch (err) {
    console.error("[mpesa-reversal-callback]", err);
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
  }
});

async function updateSourceRecord(admin: ReturnType<typeof createClient>, reversal: Record<string, unknown>) {
  const paymentType = reversal.payment_type as string;
  const referenceId = reversal.reference_id as string;

  try {
    switch (paymentType) {
      case "primary": {
        // Mark the payment attempt as failed (money returned to customer)
        await admin.from("payment_attempts").update({
          status: "failed",
          failure_code: "reversed",
          failure_reason_safe: "Payment was reversed — money returned to your M-Pesa",
        }).eq("id", referenceId);

        // Also mark the checkout session as failed
        const { data: attempt } = await admin
          .from("payment_attempts")
          .select("checkout_session_id")
          .eq("id", referenceId)
          .maybeSingle();

        if (attempt?.checkout_session_id) {
          await admin.from("checkout_sessions").update({
            status: "failed",
          }).eq("id", attempt.checkout_session_id);
        }
        break;
      }

      case "lpp": {
        // Revert installment to pending and decrement plan's paid_kes
        const { data: installment } = await admin
          .from("payment_plan_installments")
          .select("plan_id, amount_kes, status")
          .eq("id", referenceId)
          .maybeSingle();

        if (installment) {
          await admin.from("payment_plan_installments").update({
            status: "pending",
            paid_at: null,
            provider_receipt: null,
          }).eq("id", referenceId);

          // Recalculate plan totals
          const { data: plan } = await admin
            .from("payment_plans")
            .select("id, paid_kes, total_kes")
            .eq("id", installment.plan_id)
            .maybeSingle();

          if (plan && installment.status === "paid") {
            const newPaid = Math.max(0, plan.paid_kes - installment.amount_kes);
            const newBalance = Math.max(0, plan.total_kes - newPaid);
            await admin.from("payment_plans").update({
              paid_kes: newPaid,
              balance_kes: newBalance,
              status: newPaid === 0 ? "pending" : "reserved",
              completed_at: null,
            }).eq("id", plan.id);
          }
        }
        break;
      }

      case "resale": {
        // Set listing to refunded, clear buyer reservation
        await admin.from("ticket_resale_listings").update({
          status: "refunded",
          buyer_user_id: null,
          payment_expires_at: null,
          payment_ref: null,
        }).eq("id", referenceId).in("status", ["pending_payment", "pending_approval"]);
        break;
      }
    }

    console.log(`[mpesa-reversal-callback] Source record updated for ${paymentType} ref=${referenceId}`);
  } catch (err) {
    console.error(`[mpesa-reversal-callback] Failed to update source record for ${paymentType} ref=${referenceId}:`, err);
  }
}
