// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { decodeLppInitPayload } from "../_shared/lppPlanState.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUYER_FEE_RATE = 0.035;

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

      <p style="margin:0 0 8px;font-size:13px;color:#a3a3a8;line-height:1.6;">
        ${callout}
      </p>
      <div style="border-top:1px solid #2a2a2f;padding-top:16px;margin-top:16px;">
        <p style="margin:4px 0;font-size:12px;color:#a3a3a8;">Along Karen Rd, Langata P.O. BOX 00502-00502, Karen Nairobi, Kenya</p>
        <p style="margin:4px 0;font-size:12px;color:#a3a3a8;">Phone: +254728135200</p>
      </div>
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
    const initPayload = decodeLppInitPayload(url.searchParams.get("state"));
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
    if (!plan) {
      if (resultCode !== 0 || seq !== 0 || !initPayload) {
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      }

      const [{ data: event }, { data: tier }] = await Promise.all([
        admin.from("events").select("id, title, status, starts_at, lpp_enabled, lpp_config").eq("id", initPayload.eventId).maybeSingle(),
        admin.from("ticket_tiers").select("id, event_id, price_kes, quantity, sold, name").eq("id", initPayload.tierId).maybeSingle(),
      ]);

      if (!event || event.status !== "published" || !event.lpp_enabled || !tier || tier.event_id !== event.id) {
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      }

      const plans = (event.lpp_config?.plans ?? []) as any[];
      const selectedPlan = plans.find((p) => p.id === initPayload.planKey);
      if (!selectedPlan) return new Response(JSON.stringify({ ok: true }), { headers: cors });

      const q = Number(initPayload.quantity);
      if (!Number.isInteger(q) || q < 1 || tier.sold + q > tier.quantity) {
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      }

      const subtotal = tier.price_kes * q;
      const buyerFee = Math.round(subtotal * BUYER_FEE_RATE);
      const total = subtotal + buyerFee;
      const depositPct = Number(selectedPlan.deposit_pct);
      const deposit = Math.round(total * (depositPct / 100));
      const remaining = total - deposit;
      const installmentsCount = Number(selectedPlan.installments);
      const perInstallment = Math.floor(remaining / installmentsCount);
      const lastInstallment = remaining - perInstallment * (installmentsCount - 1);
      const intervalDays = Number(selectedPlan.interval_days);
      const startsAt = new Date(event.starts_at);
      const finalDueLimit = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);
      const now = new Date();

      const { data: createdPlan, error: createErr } = await admin.from("payment_plans").insert({
        ref_no: refNo,
        event_id: event.id,
        tier_id: tier.id,
        quantity: q,
        guest_name: initPayload.name,
        guest_email: initPayload.email,
        guest_phone: initPayload.phone,
        plan_key: initPayload.planKey,
        plan_label: selectedPlan.label,
        deposit_pct: depositPct,
        installments_count: installmentsCount,
        interval_days: intervalDays,
        subtotal_kes: subtotal,
        buyer_fee_kes: buyerFee,
        total_kes: total,
        deposit_kes: deposit,
        paid_kes: deposit,
        balance_kes: remaining,
        ticket_holders: initPayload.holders ?? [],
        event_starts_at: event.starts_at,
        final_due_at: finalDueLimit.toISOString(),
        status: "reserved",
        reserved_at: now.toISOString(),
      }).select().single();

      if (createErr || !createdPlan) {
        return new Response(JSON.stringify({ ok: true }), { headers: cors });
      }

      const installmentsRows: any[] = [
        { plan_id: createdPlan.id, sequence: 0, kind: "deposit", amount_kes: deposit, due_at: now.toISOString(), status: "paid", paid_at: now.toISOString(), provider_receipt: receipt },
      ];
      for (let i = 0; i < installmentsCount; i++) {
        const dueDate = new Date(now.getTime() + intervalDays * (i + 1) * 24 * 60 * 60 * 1000);
        const capped = dueDate > finalDueLimit ? finalDueLimit : dueDate;
        installmentsRows.push({
          plan_id: createdPlan.id,
          sequence: i + 1,
          kind: "installment",
          amount_kes: i === installmentsCount - 1 ? lastInstallment : perInstallment,
          due_at: capped.toISOString(),
          status: "pending",
        });
      }
      await admin.from("payment_plan_installments").insert(installmentsRows);

      const { data: createdInst } = await admin.from("payment_plan_installments").select("*").eq("plan_id", createdPlan.id).eq("sequence", 0).maybeSingle();
      sendInstallmentReceiptEmail({ plan: createdPlan, installment: createdInst ?? installmentsRows[0], event, receipt, isDeposit: true, isFinal: false });
      return new Response(JSON.stringify({ ok: true }), { headers: cors });
    }

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
