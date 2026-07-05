// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUYER_FEE_RATE = 0.035;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function generateRefNo() {
  // Format FZXXXXXXXX — friendly, uppercase, no ambiguous chars
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const seg = (n: number) =>
    Array.from({ length: n }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
  return `FZ${seg(4)}${seg(4)}`;
}

function normalizeKenyanPhone(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  throw new Error("Enter a valid Kenyan phone number");
}

async function initiateStkPush({
  accountReference,
  amountKes,
  phone,
  callbackUrl,
  description,
}: {
  accountReference: string;
  amountKes: number;
  phone: string;
  callbackUrl: string;
  description: string;
}) {
  const env = Deno.env.get("MPESA_ENV") ?? "sandbox";
  const baseUrl = env === "live" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
  const shortCode = Deno.env.get("MPESA_SHORTCODE")!;
  const passkey = Deno.env.get("MPESA_PASSKEY")!;
  const consumerKey = Deno.env.get("MPESA_CONSUMER_KEY")!;
  const consumerSecret = Deno.env.get("MPESA_CONSUMER_SECRET")!;

  const tokenRes = await fetch(`${baseUrl}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${btoa(`${consumerKey}:${consumerSecret}`)}` },
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) throw new Error("M-Pesa auth failed");

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const password = btoa(`${shortCode}${passkey}${timestamp}`);

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.max(1, Math.round(amountKes)),
    PartyA: phone,
    PartyB: Number(shortCode),
    PhoneNumber: phone,
    CallBackURL: callbackUrl,
    AccountReference: accountReference,
    TransactionDesc: description.slice(0, 60),
  };

  const stkRes = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const stkData = await stkRes.json();
  if (!stkRes.ok) throw new Error(stkData?.errorMessage ?? "STK push failed");
  return stkData;
}

async function sendScheduleEmail({ plan, installments }: { plan: any; installments: any[] }) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) return;
  const rows = installments.map((i, idx) => {
    const due = new Date(i.due_at).toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" });
    const label = i.kind === "deposit" ? "Deposit" : `Installment ${idx}`;
    return `<tr>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:12px">${label}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee">${due}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;text-align:right">KES ${i.amount_kes.toLocaleString()}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #eee;font-family:monospace;font-size:11px;color:#666">${i.id.slice(0, 8)}</td>
    </tr>`;
  }).join("");

  const html = `<div style="font-family:system-ui,-apple-system,sans-serif;background:#0b0b0d;color:#f6f2ea;padding:24px">
    <div style="max-width:600px;margin:0 auto;background:#141418;border:1px solid #2a2a2f;padding:32px">
      <p style="letter-spacing:.1em;text-transform:uppercase;font-size:11px;color:#ff6b3d;margin:0">Lipa Pole Pole</p>
      <h1 style="font-size:28px;margin:8px 0 4px">Your payment plan is live</h1>
      <p style="color:#a3a3a8;margin:0 0 24px">Reference number below. Keep it safe — you'll use it for every installment.</p>
      <div style="background:#0b0b0d;border:1px dashed #ff6b3d;padding:20px;text-align:center;margin-bottom:24px">
        <p style="margin:0;font-size:11px;letter-spacing:.15em;text-transform:uppercase;color:#a3a3a8">Your Ref No.</p>
        <p style="margin:6px 0 0;font-family:monospace;font-size:24px;color:#ff6b3d;letter-spacing:.05em">${plan.ref_no}</p>
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#a3a3a8">Plan: <b style="color:#f6f2ea">${plan.plan_label}</b> — total KES ${plan.total_kes.toLocaleString()}</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;background:#0b0b0d">
        <thead><tr>
          <th style="text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a3a3a8;border-bottom:1px solid #2a2a2f">Payment</th>
          <th style="text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a3a3a8;border-bottom:1px solid #2a2a2f">Due</th>
          <th style="text-align:right;padding:10px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a3a3a8;border-bottom:1px solid #2a2a2f">Amount</th>
          <th style="text-align:left;padding:10px 12px;font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:#a3a3a8;border-bottom:1px solid #2a2a2f">ID</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:24px;font-size:13px;color:#a3a3a8;line-height:1.6">
        Pay every installment at <b style="color:#f6f2ea">fezzytickets.com/lpp</b> using your ref no. <b style="color:#ff6b3d">${plan.ref_no}</b>.
        Your ticket will be issued and emailed to you only after the full amount is cleared.
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
      subject: `Your LPP payment plan — ${plan.ref_no}`,
      htmlContent: html,
    }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const body = await req.json();
    const { eventId, tierId, quantity, planKey, name, email, phone, holders } = body;
    if (!eventId || !tierId || !quantity || !planKey || !name || !email || !phone) {
      return json({ error: "Missing required fields" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const [{ data: event }, { data: tier }] = await Promise.all([
      admin.from("events").select("id, title, status, starts_at, lpp_enabled, lpp_config").eq("id", eventId).maybeSingle(),
      admin.from("ticket_tiers").select("id, event_id, price_kes, quantity, sold, name").eq("id", tierId).maybeSingle(),
    ]);

    if (!event || event.status !== "published") return json({ error: "Event is not available" }, 400);
    if (!event.lpp_enabled) return json({ error: "Lipa Pole Pole is not available for this event" }, 400);
    if (!tier || tier.event_id !== event.id) return json({ error: "Invalid ticket tier" }, 400);
    if (new Date(event.starts_at).getTime() <= Date.now()) return json({ error: "Event has already started" }, 409);

    const q = Number(quantity);
    if (!Number.isInteger(q) || q < 1 || tier.sold + q > tier.quantity) {
      return json({ error: "Not enough tickets remaining" }, 400);
    }

    const plans = (event.lpp_config?.plans ?? []) as any[];
    const plan = plans.find((p) => p.id === planKey);
    if (!plan) return json({ error: "Selected plan is not available" }, 400);

    // Compute totals
    const subtotal = tier.price_kes * q;
    const buyerFee = Math.round(subtotal * BUYER_FEE_RATE);
    const total = subtotal + buyerFee;
    const depositPct = Number(plan.deposit_pct);
    const deposit = Math.round(total * (depositPct / 100));
    const remaining = total - deposit;
    const installmentsCount = Number(plan.installments);
    const perInstallment = Math.floor(remaining / installmentsCount);
    const lastInstallment = remaining - perInstallment * (installmentsCount - 1);

    // Build schedule
    const startsAt = new Date(event.starts_at);
    const intervalDays = Number(plan.interval_days);
    const now = new Date();

    // Final due date: 24h before event
    const finalDueLimit = new Date(startsAt.getTime() - 24 * 60 * 60 * 1000);

    let refNo = generateRefNo();
    // Ensure uniqueness (retry a couple times)
    for (let i = 0; i < 3; i++) {
      const { data: existing } = await admin.from("payment_plans").select("id").eq("ref_no", refNo).maybeSingle();
      if (!existing) break;
      refNo = generateRefNo();
    }

    const normalizedPhone = normalizeKenyanPhone(phone);

    let userId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data } = await userClient.auth.getUser();
      userId = data?.user?.id ?? null;
    }

    const holdersArr = Array.isArray(holders) && holders.length === q
      ? holders
      : Array.from({ length: q }).map(() => ({ name, email, phone }));

    const { data: created, error: createErr } = await admin
      .from("payment_plans")
      .insert({
        ref_no: refNo,
        event_id: event.id,
        tier_id: tier.id,
        quantity: q,
        user_id: userId,
        guest_name: name,
        guest_email: email,
        guest_phone: normalizedPhone,
        plan_key: planKey,
        plan_label: plan.label,
        deposit_pct: depositPct,
        installments_count: installmentsCount,
        interval_days: intervalDays,
        subtotal_kes: subtotal,
        buyer_fee_kes: buyerFee,
        total_kes: total,
        deposit_kes: deposit,
        balance_kes: total,
        ticket_holders: holdersArr,
        event_starts_at: event.starts_at,
        final_due_at: finalDueLimit.toISOString(),
        status: "pending",
      })
      .select()
      .single();
    if (createErr || !created) return json({ error: createErr?.message ?? "Failed to create plan" }, 500);

    // Build installment rows (deposit + N installments)
    const installmentsRows: any[] = [
      { plan_id: created.id, sequence: 0, kind: "deposit", amount_kes: deposit, due_at: now.toISOString(), status: "pending" },
    ];
    for (let i = 0; i < installmentsCount; i++) {
      const dueDate = new Date(now.getTime() + intervalDays * (i + 1) * 24 * 60 * 60 * 1000);
      const capped = dueDate > finalDueLimit ? finalDueLimit : dueDate;
      installmentsRows.push({
        plan_id: created.id,
        sequence: i + 1,
        kind: "installment",
        amount_kes: i === installmentsCount - 1 ? lastInstallment : perInstallment,
        due_at: capped.toISOString(),
        status: "pending",
      });
    }
    const { data: instRows, error: instErr } = await admin.from("payment_plan_installments").insert(installmentsRows).select();
    if (instErr) return json({ error: instErr.message }, 500);

    // Fire STK push for deposit
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const projectRef = supabaseUrl.match(/https:\/\/([^.]+)\./)?.[1];
    const callbackUrl = `${supabaseUrl}/functions/v1/lpp-mpesa-callback?ref=${encodeURIComponent(refNo)}&seq=0`;

    let stkResult: any = null;
    try {
      stkResult = await initiateStkPush({
        accountReference: refNo,
        amountKes: deposit,
        phone: normalizedPhone,
        callbackUrl,
        description: `LPP deposit ${refNo}`,
      });
    } catch (err) {
      // Plan still exists; user can retry from portal
      return json({
        ref_no: refNo,
        plan: created,
        installments: instRows,
        deposit_stk: null,
        error_stk: err instanceof Error ? err.message : String(err),
      });
    }

    // Send schedule email (non-blocking)
    sendScheduleEmail({ plan: created, installments: instRows ?? installmentsRows });

    return json({
      ref_no: refNo,
      plan: created,
      installments: instRows,
      deposit_stk: {
        checkoutRequestId: stkResult.CheckoutRequestID ?? null,
        customerMessage: stkResult.CustomerMessage ?? "Check your phone to authorize the M-Pesa payment.",
      },
      project_ref: projectRef,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
