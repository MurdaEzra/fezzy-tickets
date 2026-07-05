// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

async function sendReminderEmail({
  plan,
  installment,
  eventTitle,
}: { plan: any; installment: any; eventTitle: string }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return;

  const dueDate = new Date(installment.due_at).toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b0d;color:#f6f2ea;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#141418;border:1px solid #2a2a2f;padding:32px">
      <p style="letter-spacing:.1em;text-transform:uppercase;font-size:11px;color:#ff6b3d;margin:0">Reminder</p>
      <h1 style="font-size:28px;margin:8px 0 4px">Your LPP installment is due</h1>
      <p style="color:#a3a3a8;margin:0 0 24px">Don't forget to pay your installment for ${eventTitle}.</p>

      <div style="background:#0b0b0d;border:1px dashed #ff6b3d;padding:20px;margin-bottom:24px">
        <p style="margin:0 0 8px;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#a3a3a8">Reference Number</p>
        <p style="margin:0;font-family:monospace;font-size:24px;color:#ff6b3d;letter-spacing:.05em">${plan.ref_no}</p>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:24px;background:#0b0b0d">
        <tr>
          <td style="text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a3a3a8;border-bottom:1px solid #2a2a2f">Installment</td>
          <td style="text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a3a3a8;border-bottom:1px solid #2a2a2f">Due Date</td>
          <td style="text-align:right;padding:10px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a3a3a8;border-bottom:1px solid #2a2a2f">Amount</td>
        </tr>
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #2a2a2f;font-family:monospace;font-size:12px">
            ${installment.kind === "deposit" ? "Deposit" : `Installment ${installment.sequence}`}
          </td>
          <td style="padding:10px 12px;border-bottom:1px solid #2a2a2f">${dueDate}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #2a2a2f;text-align:right">KES ${installment.amount_kes.toLocaleString()}</td>
        </tr>
      </table>

      <p style="margin:0 0 16px;font-size:13px;color:#a3a3a8;line-height:1.6">
        Pay at <b style="color:#f6f2ea">fezzytickets.com/lpp</b> using your ref no. <b style="color:#ff6b3d">${plan.ref_no}</b>.
        Remember, your ticket will only be issued once the full amount is cleared.
      </p>

      <div style="border-top:1px solid #2a2a2f;padding-top:16px;margin-top:16px">
        <p style="margin:4px 0;font-size:12px;color:#a3a3a8">Along Karen Rd, Langata P.O. BOX 00502-00502, Karen Nairobi, Kenya</p>
        <p style="margin:4px 0;font-size:12px;color:#a3a3a8">Phone: +254728135200</p>
      </div>
    </div>
  </div>`;

  await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", "api-key": apiKey },
    body: JSON.stringify({
      sender: { name: "Fezzy Lipa Pole Pole", email: "tickets@fezzy.app" },
      to: [{ email: plan.guest_email, name: plan.guest_name }],
      subject: `Reminder: Your LPP installment is due — ${plan.ref_no}`,
      htmlContent: html,
    }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Get all active payment plans
    const { data: plans, error: plansError } = await admin
      .from("payment_plans")
      .select(`
        *,
        event: events ( title ),
        installments: payment_plan_installments ( *, order: sequence )
      `)
      .in("status", ["pending", "active"])
      .order("created_at", { ascending: false });

    if (plansError) {
      return json({ error: plansError.message }, 500);
    }

    const results: any[] = [];

    for (const plan of plans) {
      if (!plan.installments || plan.installments.length === 0) continue;

      // Sort installments by sequence
      const sortedInstallments = [...plan.installments].sort((a, b) => a.sequence - b.sequence);

      // Find the next pending installment
      const nextPendingInstallment = sortedInstallments.find(i => i.status === "pending");
      if (!nextPendingInstallment) continue;

      const dueDate = new Date(nextPendingInstallment.due_at);
      const now = new Date();
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Check if we should send a reminder:
      // - If it's within 2 days of due date
      // OR if it's already overdue
      if (daysUntilDue <= 2 && daysUntilDue >= 0) {
        // Check if we already sent a reminder in the last 2 days
        const { data: existingReminders } = await admin
          .from("lpp_reminders")
          .select("*")
          .eq("plan_id", plan.id)
          .eq("installment_id", nextPendingInstallment.id)
          .order("sent_at", { ascending: false })
          .limit(1);

        const lastReminder = existingReminders?.[0];
        let shouldSend = true;
        if (lastReminder) {
          const lastSent = new Date(lastReminder.sent_at);
          const daysSinceLast = (now.getTime() - lastSent.getTime()) / (1000 * 60 * 60 * 24);
          // Only send if last reminder was more than 2 days ago
          if (daysSinceLast < 2) shouldSend = false;
        }

        if (shouldSend) {
          await sendReminderEmail({
            plan,
            installment: nextPendingInstallment,
            eventTitle: plan.event?.title ?? "your event",
          });

          // Log that we sent the reminder
          await admin.from("lpp_reminders").insert({
            plan_id: plan.id,
            installment_id: nextPendingInstallment.id,
            sent_at: now.toISOString(),
          });

          results.push({
            plan_id: plan.id,
            ref_no: plan.ref_no,
            installment_id: nextPendingInstallment.id,
            sent: true,
          });
        }
      }
    }

    return json({
      message: "Reminders processed",
      results,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
