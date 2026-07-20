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
    if (!roleList.includes("admin")) {
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
    <!DOCTYPE html>
    <html>
    <body style="margin:0; padding:0; background-color:#f4f5f7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f5f7; padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px; width:100%; background-color:#ffffff; border-radius:18px; overflow:hidden; box-shadow:0 10px 34px rgba(10,10,10,0.08);">

            <tr>
              <td align="center" style="padding:38px 40px 20px 40px; background-color:#ffffff;">
                <img src="https://res.cloudinary.com/dgfmhyebp/image/upload/v1777102601/Untitled_design_8_-Photoroom_jkvjqm.png" width="180" alt="Fezzy Tickets" style="display:block; width:180px; height:auto;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:18px;">
                  <tr><td style="width:56px; height:5px; background-color:#0a0a0a; border-radius:3px; font-size:0; line-height:0;">&nbsp;</td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 40px 0 40px; font-family: Arial, 'Helvetica Neue', sans-serif;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#f1f2f0; border:1px solid #e0e2df; border-radius:100px; padding:8px 18px;">
                      <span style="color:#4a4e4a; font-size:11px; font-weight:bold; letter-spacing:2px; text-transform:uppercase;">&#9679;&nbsp; Application Update</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 32px 0 32px; font-family: Arial, 'Helvetica Neue', sans-serif;">
                <h1 style="margin:0; color:#0a0a0a; font-size:26px; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; line-height:1.3;">
                  Not Approved At This Time
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 44px 0 44px; font-family: Arial, 'Helvetica Neue', sans-serif; color:#3c4046; font-size:15px; line-height:1.7;">
                <p style="margin:0 0 16px 0;">Hi ${escapeHtml(request.full_name || "there")},</p>
                <p style="margin:0 0 16px 0;">
                  Thanks for applying to sell tickets on <strong style="color:#0a0a0a;">Fezzy Tickets</strong> for
                  <strong style="color:#0a0a0a;">${escapeHtml(request.org_name)}</strong>. After reviewing your organizer details, we're
                  not able to approve this application at this time.
                </p>
                <p style="margin:0 0 16px 0;">
                  This isn't necessarily final — if you think this decision was made in error, or your circumstances
                  change, you're welcome to reach back out.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; border-radius:14px;">
                  <tr>
                    <td style="padding:24px 26px 20px 26px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="font-family: Arial, 'Helvetica Neue', sans-serif; color:#1BC46B; font-size:11px; font-weight:bold; letter-spacing:2px; text-transform:uppercase;">
                            Think this is a mistake?
                          </td>
                          <td align="right" style="font-family: Arial, 'Helvetica Neue', sans-serif; color:#5c615f; font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">
                            Fezzy&nbsp;&bull;&nbsp;Ticket
                          </td>
                        </tr>
                      </table>

                      <p style="margin:16px 0 20px 0; font-family:Arial, 'Helvetica Neue', sans-serif; color:#eef0ee; font-size:14px; line-height:1.6;">
                        Reply directly to this email or reach out to our support team, and we'll take another look at
                        your application.
                      </p>

                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="background-color:#1BC46B; border-radius:100px;">
                            <a href="mailto:support@fezzytickets.com" style="display:inline-block; padding:12px 24px; font-family:Arial, 'Helvetica Neue', sans-serif; color:#0a0a0a; font-size:13px; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; text-decoration:none;">Contact Support</a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:0 26px;">
                      <div style="border-top:2px dashed #33372f; line-height:0; font-size:0;">&nbsp;</div>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:14px 26px 20px 26px; font-family:Arial, 'Helvetica Neue', sans-serif; color:#8b918c; font-size:11.5px; letter-spacing:0.5px;">
                      No further action is required if you don't wish to appeal this decision.
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
            <td style="padding:30px 44px 40px 44px;font-family: Arial, 'Helvetica Neue', sans-serif;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr><td style="border-top:1px solid #eceeec;line-height:0;font-size:0;">&nbsp;</td></tr>
              </table>
              <p style="margin:22px 0 4px 0;color:#0a0a0a;font-size:13px;font-weight:900;letter-spacing:0.5px;text-transform:uppercase;">Fezzy Tickets</p>
              <p style="margin:0 0 12px 0;color:#9aa0a6;font-size:12px;line-height:1.6;">This is an automated message regarding your organizer application. If you didn't request this, you can safely ignore it.</p>
              <p style="margin:4px 0;color:#9aa0a6;font-size:12px;line-height:1.6;">Along Karen Rd, Langata P.O. BOX 00502-00502, Karen Nairobi, Kenya</p>
              <p style="margin:4px 0;color:#9aa0a6;font-size:12px;line-height:1.6;">Phone: +254728135200</p>
            </td>
          </tr>

          </table>
        </td>
      </tr>
    </table>
    </body>
    </html>
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
          <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #eee;">
            <p style="margin: 4px 0; font-size: 12px; color: #60708a;">Fezzy Tickets</p>
            <p style="margin: 4px 0; font-size: 12px; color: #60708a;">Along Karen Rd, Langata P.O. BOX 00502-00502, Karen Nairobi, Kenya</p>
            <p style="margin: 4px 0; font-size: 12px; color: #60708a;">Phone: +254728135200</p>
          </div>
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
