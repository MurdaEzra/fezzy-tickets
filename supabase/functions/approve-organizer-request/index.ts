import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sendBrevoEmail({
  recipientEmail,
  subject,
  htmlContent,
}: {
  recipientEmail: string;
  subject: string;
  htmlContent: string;
}) {
  const apiKey = Deno.env.get("BREVO_API_KEY");
  if (!apiKey) throw new Error("BREVO_API_KEY not configured");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: { name: "Fezzy Tickets", email: "tickets@fezzy.app" },
      to: [{ email: recipientEmail }],
      subject,
      htmlContent,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Brevo email failed");
  }

  return await response.json();
}

const slugifyHandle = (raw: string) =>
  raw.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "organizer";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller }, error: userError } = await userClient.auth.getUser();
    if (userError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id);

    const roleList = (roles ?? []).map((r) => r.role);
    if (!roleList.includes("super_admin") && !roleList.includes("admin")) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { requestId, action } = await req.json();
    if (!requestId || !["approve", "reject"].includes(action)) {
      return new Response(JSON.stringify({ error: "requestId and action (approve|reject) are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: request, error: fetchError } = await admin
      .from("organizer_approval_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();

    if (fetchError || !request) {
      return new Response(JSON.stringify({ error: "Approval request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.status !== "pending") {
      return new Response(JSON.stringify({ error: "Request already reviewed" }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const origin = req.headers.get("origin") || "https://fezzytickets.com";
    const dashboardUrl = `${origin}/dashboard`;

    if (action === "reject") {
      await admin
        .from("organizer_approval_requests")
        .update({
          status: "rejected",
          reviewed_by: caller.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      await sendBrevoEmail({
        recipientEmail: request.email,
        subject: "Update on your Fezzy Tickets organizer application",
        htmlContent: `
          <div style="font-family: Arial, sans-serif; color: #14213d; line-height: 1.5;">
            <h2 style="margin-bottom: 8px;">Organizer application update</h2>
            <p>Hi ${request.full_name || "there"},</p>
            <p>Thank you for applying to sell tickets on Fezzy Tickets for <strong>${request.org_name}</strong>.</p>
            <p>Unfortunately, we are unable to approve your application at this time. If you believe this is a mistake, please reply to this email or contact support.</p>
            <p style="margin-top: 24px; font-size: 12px; color: #60708a;">Fezzy Tickets</p>
          </div>
        `,
      });

      return new Response(JSON.stringify({ ok: true, status: "rejected" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Approve: confirm email, create profile, assign organizer role, notify user.
    await admin.auth.admin.updateUserById(request.user_id, {
      email_confirm: true,
    });

    const handle = `${slugifyHandle(request.org_name)}-${crypto.randomUUID().slice(0, 4)}`;

    const { data: existingProfile } = await admin
      .from("organizer_profiles")
      .select("id")
      .eq("user_id", request.user_id)
      .maybeSingle();

    if (!existingProfile) {
      const { error: profileError } = await admin.from("organizer_profiles").insert({
        user_id: request.user_id,
        org_name: request.org_name,
        handle,
        contact_email: request.email,
        marketing_opt_in: request.marketing_opt_in,
      });

      if (profileError) throw profileError;
    }

    await admin.from("user_roles").upsert(
      { user_id: request.user_id, role: "organizer" },
      { onConflict: "user_id,role" }
    );

    await admin
      .from("organizer_approval_requests")
      .update({
        status: "approved",
        reviewed_by: caller.id,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", requestId);

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: request.email,
      options: { redirectTo: dashboardUrl },
    });

    if (linkError) throw linkError;

    const actionLink =
      linkData?.properties?.action_link ||
      linkData?.properties?.actionLink ||
      linkData?.action_link;

    if (!actionLink) {
      throw new Error("Dashboard access link could not be generated");
    }

    await sendBrevoEmail({
      recipientEmail: request.email,
      subject: "Your Fezzy Tickets organizer account is approved",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #14213d; line-height: 1.5;">
          <h2 style="margin-bottom: 8px;">You're approved!</h2>
          <p>Hi ${request.full_name || "there"},</p>
          <p>Great news — your organizer application for <strong>${request.org_name}</strong> has been approved.</p>
          <p>Click below to access your organizer dashboard and start creating events.</p>
          <p style="margin: 24px 0;">
            <a href="${actionLink}" style="background:#1FAD66;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;display:inline-block;">Go to dashboard</a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #2f6fed;">${actionLink}</p>
          <p style="margin-top: 24px; font-size: 12px; color: #60708a;">Fezzy Tickets</p>
        </div>
      `,
    });

    return new Response(JSON.stringify({ ok: true, status: "approved" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Approval action failed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
