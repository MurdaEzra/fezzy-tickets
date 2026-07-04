// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendInstallmentReceiptEmail({ plan, installment, event, receipt, isDeposit, isFinal }: { plan: any; installment: any; event: any; receipt: string | null; isDeposit: boolean; isFinal: boolean }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return;

  const title = isDeposit ? "Deposit received!" : isFinal ? "Final installment received!" : "Installment received!";
  const subject = isDeposit ? `Deposit received — ${plan.ref_no}` : isFinal ? `Final installment received — ${plan.ref_no}` : `Installment received — ${plan.ref_no}`;
  const subtitle = isDeposit ? "Your tickets are now reserved." : isFinal ? "Your ticket is now unlocked!" : "Thank you for your payment.";
  const callout = isDeposit ? "Your tickets are reserved. Complete the remaining installments at fezzytickets.com/lpp to receive your tickets." : isFinal ? "Your ticket has been issued! Check your email for the QR code and ticket details." : "Continue making installments at fezzytickets.com/lpp until your ticket is unlocked.";

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b0d;color:#f6f2ea;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#141418;border:1px solid #2a2a2f;padding:32px">
      <p style="letter-spacing:.1em;text-transform:uppercase;font-size:11px;color:#ff6b3d;margin:0">Lipa Pole Pole</p>
      <h1 style="font-size:28px;margin:8px 0 4px">${title}</h1>
      <p style="color:#a3a3a8;margin:0 0 24px">${subtitle}</p>
      
      <div style="background:#0b0b0d;border:1px dashed #ff6b3d;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#a3a3a8">Your Ref No.</p>
        <p style="margin:0;font-family:monospace;font-size:24px;color:#ff6b3d;letter-spacing:.05em">${plan.ref_no}</p>
      </div>
      
      <div style="background:#0b0b0d;padding:20px;border-radius:8px;margin-bottom:24px">
        <p style="margin:0 0 12px;font-size:13px;color:#a3a3a8">Payment details</p>
        <p style="margin:0 0 4px;color:#f6f2ea"><b>Event:</b> ${event?.title ?? "Your event"}</p>
        <p style="margin:0 0 4px;color:#f6f2ea"><b>Installment:</b> #${installment.sequence + 1}</p>
        <p style="margin:0 0 4px;color:#f6f2ea"><b>Amount paid:</b> KES ${installment.amount_kes.toLocaleString()}</p>
        <p style="margin:0 0 4px;color:#f6f2ea"><b>Total paid so far:</b> KES ${(plan.paid_kes + installment.amount_kes).toLocaleString()}</p>
        ${receipt ? `<p style="margin:0;color:#f6f2ea"><b>M-Pesa receipt:</b> ${receipt}</p>` : ""}
      </div>

      <p style="margin:0 0 8px;font-size:13px;color:#a3a3a8;line-height:1.6">
        ${callout}
      </p>
    </div>
  </div>`;

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "Fezzy Lipa Pole Pole", email: "tickets@fezzy.app" },
      to: [{ email: plan.guest_email, name: plan.guest_name }],
      subject,
      htmlContent: html,
    }),
  }).catch(() => {});
}

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

    // Get event details for email
    const { data: event } = await admin.from("events").select("title").eq("id", plan.event_id).maybeSingle();
    const isFinal = newBalance === 0;

    // Send receipt email for EVERY installment!
    sendInstallmentReceiptEmail({ 
      plan, 
      installment: inst, 
      event, 
      receipt, 
      isDeposit, 
      isFinal 
    });

    // When fully paid → issue tickets
    if (isFinal) {
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
