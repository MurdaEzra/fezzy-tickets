// Paystack webhook — verifies signature, finalizes orders on charge.success.
import { createClient } from "npm:@supabase/supabase-js@2";
import { createHmac } from "node:crypto";

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY") ?? "";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const raw = await req.text();
  const sig = req.headers.get("x-paystack-signature") ?? "";
  const expected = createHmac("sha512", PAYSTACK_SECRET_KEY).update(raw).digest("hex");
  if (sig !== expected) return new Response("Invalid signature", { status: 401 });

  let event: { event: string; data: { reference: string; status: string; metadata?: Record<string, unknown> } };
  try {
    event = JSON.parse(raw);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  if (event.event !== "charge.success") {
    return new Response("ignored", { status: 200 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tx = event.data;

  // Note: Resale purchases now use M-Pesa STK push via resale-mpesa-callback.
  // This webhook only handles regular order payments.

  const orderId = tx.metadata?.order_id as string | undefined;
  if (!orderId) return new Response("missing order id", { status: 400 });

  // Update payment row
  await admin
    .from("payments")
    .update({
      status: "success",
      result_desc: tx.status,
      raw_callback: tx as unknown as Record<string, unknown>,
    })
    .eq("paystack_reference", tx.reference);

  // Finalize order if still pending
  const { data: order } = await admin
    .from("orders")
    .select("id, status, event_id, guest_name, guest_email")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "paid") return new Response("ok", { status: 200 });

  await admin
    .from("orders")
    .update({ status: "paid", payment_ref: tx.reference })
    .eq("id", orderId);

  const tierId = tx.metadata?.tier_id as string | undefined;
  const quantity = Number(tx.metadata?.quantity ?? 1);
  if (tierId && quantity > 0) {
    const rows = Array.from({ length: quantity }).map(() => ({
      event_id: order.event_id,
      tier_id: tierId,
      order_id: orderId,
      holder_name: order.guest_name,
      holder_email: order.guest_email,
    }));
    await admin.from("tickets").insert(rows);
    const { data: tier } = await admin
      .from("ticket_tiers").select("sold").eq("id", tierId).maybeSingle();
    if (tier) {
      await admin.from("ticket_tiers").update({ sold: tier.sold + quantity }).eq("id", tierId);
    }
  }

  return new Response("ok", { status: 200 });
});
