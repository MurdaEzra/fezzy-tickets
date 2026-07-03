// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const url = new URL(req.url);
    const refNo = url.searchParams.get("ref");
    const seq = Number(url.searchParams.get("seq") ?? "0");
    const payload = await req.json().catch(() => ({}));

    const cb = payload?.Body?.stkCallback;
    const resultCode = Number(cb?.ResultCode ?? -1);
    const items = cb?.CallbackMetadata?.Item ?? [];
    const meta: Record<string, any> = {};
    for (const it of items) meta[it.Name] = it.Value;
    const receipt = meta.MpesaReceiptNumber ?? null;
    const paidAmount = Number(meta.Amount ?? 0);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!refNo) return new Response(JSON.stringify({ ok: true }), { headers: cors });

    const { data: plan } = await admin.from("payment_plans").select("*").eq("ref_no", refNo).maybeSingle();
    if (!plan) return new Response(JSON.stringify({ ok: true }), { headers: cors });

    if (resultCode !== 0) {
      // Log failure but keep pending so buyer can retry
      await admin.from("payment_plan_installments").update({ status: "pending" }).eq("plan_id", plan.id).eq("sequence", seq);
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

    // Mark installment paid
    const { data: inst } = await admin
      .from("payment_plan_installments")
      .update({ status: "paid", paid_at: new Date().toISOString(), provider_receipt: receipt })
      .eq("plan_id", plan.id)
      .eq("sequence", seq)
      .select()
      .single();

    if (!inst) return new Response(JSON.stringify({ ok: true }), { headers: cors });

    const newPaid = plan.paid_kes + inst.amount_kes;
    const newBalance = Math.max(0, plan.total_kes - newPaid);
    const isDeposit = seq === 0;
    let newStatus = plan.status;
    if (isDeposit && plan.status === "pending") newStatus = "reserved";
    if (newBalance === 0) newStatus = "completed";

    await admin.from("payment_plans").update({
      paid_kes: newPaid,
      balance_kes: newBalance,
      status: newStatus,
      reserved_at: isDeposit && !plan.reserved_at ? new Date().toISOString() : plan.reserved_at,
      completed_at: newBalance === 0 ? new Date().toISOString() : null,
    }).eq("id", plan.id);

    // When fully paid → issue tickets
    if (newBalance === 0) {
      // Create order and tickets so the standard delivery pipeline can email them
      const holders = (plan.ticket_holders as any[]) ?? [];
      const { data: order } = await admin.from("orders").insert({
        event_id: plan.event_id,
        user_id: plan.user_id,
        guest_name: plan.guest_name,
        guest_email: plan.guest_email,
        guest_phone: plan.guest_phone,
        subtotal_kes: plan.subtotal_kes,
        total_kes: plan.total_kes,
        payment_method: "mpesa",
        status: "paid",
      }).select().single();

      if (order) {
        const rows = Array.from({ length: plan.quantity }).map((_, i) => ({
          order_id: order.id,
          event_id: plan.event_id,
          tier_id: plan.tier_id,
          holder_name: holders[i]?.name ?? plan.guest_name,
          holder_email: holders[i]?.email ?? plan.guest_email,
        }));
        await admin.from("tickets").insert(rows);
        // Fire ticket email (fire-and-forget)
        admin.functions.invoke("send-ticket-email", { body: { orderId: order.id } }).catch(() => {});
      }
    }

    return new Response(JSON.stringify({ ok: true }), { headers: cors });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: (err as Error).message }), { status: 200, headers: cors });
  }
});
