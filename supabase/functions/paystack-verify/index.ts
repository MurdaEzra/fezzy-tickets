import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAYSTACK_SECRET_KEY = Deno.env.get("PAYSTACK_SECRET_KEY");
type AdminClient = any;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!PAYSTACK_SECRET_KEY) return json({ error: "Paystack not configured" }, 500);

    const { reference } = await req.json();
    if (!reference) return json({ error: "Missing reference" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const res = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` } },
    );
    const data = await res.json();
    if (!res.ok || !data?.status) return json({ error: data?.message ?? "Verify failed" }, 502);

    const tx = data.data;
    const status: string = tx.status;

    // Note: Resale purchases now use M-Pesa STK push via resale-mpesa-callback.
    // This function only handles regular order payments.

    const orderId = tx.metadata?.order_id as string | undefined;
    if (!orderId) return json({ error: "Order id missing in metadata" }, 400);

    await finalizeOrder(admin, orderId, reference, status, tx);

    return json({
      paymentStatus: status === "success" ? "success" : status === "abandoned" ? "pending" : "failed",
      orderId,
      reference,
    });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
  }
});

async function finalizeOrder(
  admin: AdminClient,
  orderId: string,
  reference: string,
  status: string,
  tx: { metadata?: { tier_id?: string; quantity?: number; event_id?: string } },
) {
  await admin
    .from("payments")
    .update({
      status: status === "success" ? "success" : "failed",
      result_desc: status,
      raw_callback: tx as unknown as Record<string, unknown>,
    })
    .eq("paystack_reference", reference);

  if (status !== "success") {
    await admin.from("orders").update({ status: "cancelled" }).eq("id", orderId).eq("status", "pending");
    return;
  }

  const { data: order } = await admin
    .from("orders")
    .select("id, status, event_id, guest_name, guest_email, guest_phone, ticket_holders, promo_code_id")
    .eq("id", orderId)
    .maybeSingle();
  if (!order || order.status === "paid") return;

  await admin
    .from("orders")
    .update({ status: "paid", payment_ref: reference })
    .eq("id", orderId);

  if (order.promo_code_id) {
    const { data: promo } = await admin
      .from("promo_codes")
      .select("used_count")
      .eq("id", order.promo_code_id)
      .maybeSingle();

    if (promo) {
      await admin
        .from("promo_codes")
        .update({ used_count: (promo.used_count ?? 0) + 1 })
        .eq("id", order.promo_code_id);
    }
  }

  const tierId = tx.metadata?.tier_id;
  const quantity = Number(tx.metadata?.quantity ?? 1);
  const eventId = tx.metadata?.event_id ?? order.event_id;

  if (tierId && quantity > 0) {
    const holders = (order.ticket_holders as { name: string; email: string; phone?: string }[] | null) ?? [];
    const rows = Array.from({ length: quantity }).map((_, i) => {
      const holder = holders[i];
      return {
        event_id: eventId,
        tier_id: tierId,
        order_id: orderId,
        holder_name: holder?.name ?? order.guest_name,
        holder_email: holder?.email ?? order.guest_email,
        holder_phone: holder?.phone ?? order.guest_phone ?? null,
      };
    });
    await admin.from("tickets").insert(rows);

    const { data: tier } = await admin
      .from("ticket_tiers")
      .select("sold")
      .eq("id", tierId)
      .maybeSingle();

    if (tier) {
      await admin
        .from("ticket_tiers")
        .update({ sold: (tier.sold ?? 0) + quantity })
        .eq("id", tierId);
    }

    try {
      await sendTicketDelivery(admin, orderId);
    } catch (deliveryError) {
      console.error("[ticket-delivery]", deliveryError);
    }
  }
}


function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sendTicketDelivery(admin: AdminClient, orderId: string) {
  const headers: Record<string, string> = {};
  const secret = Deno.env.get("INTERNAL_TICKET_DELIVERY_SECRET");
  if (secret) headers["x-internal-ticket-secret"] = secret;

  const { error } = await admin.functions.invoke("send-ticket-email", {
    body: { orderId },
    headers,
  });

  if (error) {
    throw new Error(error.message ?? "Ticket delivery failed");
  }
}
