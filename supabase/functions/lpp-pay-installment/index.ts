// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
}

function normalizeKenyanPhone(raw: string): string {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("254") && digits.length === 12) return digits;
  if (digits.startsWith("0") && digits.length === 10) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length === 9) return `254${digits}`;
  throw new Error("Enter a valid Kenyan phone number");
}

async function stkPush({ accountReference, amountKes, phone, callbackUrl, description }: any) {
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
  if (!tokenRes.ok) throw new Error("M-Pesa auth failed");
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const timestamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth()+1)}${pad(now.getUTCDate())}${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}`;
  const password = btoa(`${shortCode}${passkey}${timestamp}`);
  const res = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenData.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      BusinessShortCode: Number(shortCode), Password: password, Timestamp: timestamp,
      TransactionType: "CustomerPayBillOnline", Amount: Math.max(1, Math.round(amountKes)),
      PartyA: phone, PartyB: Number(shortCode), PhoneNumber: phone, CallBackURL: callbackUrl,
      AccountReference: accountReference, TransactionDesc: description.slice(0, 60),
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.errorMessage ?? "STK push failed");
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const { refNo, phone } = await req.json();
    if (!refNo || !phone) return json({ error: "Ref no. and phone are required" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: plan } = await admin.from("payment_plans").select("*").eq("ref_no", refNo).maybeSingle();
    if (!plan) return json({ error: "No plan found for that ref no." }, 404);
    if (plan.status === "completed") return json({ error: "This plan is already fully paid" }, 400);
    if (plan.status === "cancelled" || plan.status === "expired") return json({ error: "This plan is no longer active" }, 400);

    // Find next pending installment (by sequence)
    const { data: nextInst } = await admin
      .from("payment_plan_installments")
      .select("*")
      .eq("plan_id", plan.id)
      .eq("status", "pending")
      .order("sequence", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (!nextInst) return json({ error: "No pending installments remaining" }, 400);

    const normalizedPhone = normalizeKenyanPhone(phone);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const callbackUrl = `${supabaseUrl}/functions/v1/lpp-mpesa-callback?ref=${encodeURIComponent(refNo)}&seq=${nextInst.sequence}`;

    const stk = await stkPush({
      accountReference: refNo,
      amountKes: nextInst.amount_kes,
      phone: normalizedPhone,
      callbackUrl,
      description: `LPP ${refNo} #${nextInst.sequence}`,
    });

    return json({
      installment_id: nextInst.id,
      sequence: nextInst.sequence,
      amount_kes: nextInst.amount_kes,
      customer_message: stk.CustomerMessage ?? "Check your phone to authorize the payment.",
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});
