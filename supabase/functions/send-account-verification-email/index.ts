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

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      email,
      password,
      fullName,
      country,
      marketingOptIn,
      orgName,
      applicationDetails,
    } = await req.json();

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: "Email and password are required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!orgName?.trim()) {
      return new Response(
        JSON.stringify({ error: "Organizer signup requires an organization name. Start at /start-selling." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const safeApplicationDetails =
      applicationDetails && typeof applicationDetails === "object" && !Array.isArray(applicationDetails)
        ? applicationDetails
        : {};

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName ?? "",
        country: country ?? "",
        marketing_opt_in: Boolean(marketingOptIn),
        org_name: orgName.trim(),
        organizer_application: safeApplicationDetails,
      },
    });

    if (createError) {
      if (createError.message?.toLowerCase().includes("already registered")) {
        return new Response(
          JSON.stringify({ error: "An account with this email already exists" }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      throw createError;
    }

    const userId = createdUser?.user?.id;
    if (!userId) {
      throw new Error("User could not be created");
    }

    const { error: requestError } = await admin.from("organizer_approval_requests").insert({
      user_id: userId,
      org_name: orgName.trim(),
      full_name: fullName ?? "",
      email,
      country: country ?? "Kenya",
      marketing_opt_in: Boolean(marketingOptIn),
      application_details: safeApplicationDetails,
      status: "pending",
    });

    if (requestError) {
      await admin.auth.admin.deleteUser(userId);
      throw requestError;
    }

    let reviewEmailSent = false;
    try {
      await sendBrevoEmail({
        recipientEmail: email,
        subject: "We received your Fezzy Tickets organizer application",
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
                  <tr><td style="width:56px; height:5px; background-color:#1BC46B; border-radius:3px; font-size:0; line-height:0;">&nbsp;</td></tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 40px 0 40px; font-family: Arial, 'Helvetica Neue', sans-serif;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background-color:#0a0a0a; border-radius:100px; padding:8px 18px;">
                      <span style="color:#1BC46B; font-size:11px; font-weight:bold; letter-spacing:2px; text-transform:uppercase;">&#9679;&nbsp; Under Review</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td align="center" style="padding:22px 32px 0 32px; font-family: Arial, 'Helvetica Neue', sans-serif;">
                <h1 style="margin:0; color:#0a0a0a; font-size:28px; font-weight:900; letter-spacing:0.5px; text-transform:uppercase; line-height:1.25;">
                  Application Received
                </h1>
              </td>
            </tr>

            <tr>
              <td style="padding:20px 44px 0 44px; font-family: Arial, 'Helvetica Neue', sans-serif; color:#3c4046; font-size:15px; line-height:1.7;">
                <p style="margin:0 0 16px 0;">Hi ${escapeHtml(fullName || "there")},</p>
                <p style="margin:0 0 16px 0;">
                  Thanks for applying to sell tickets on <strong style="color:#0a0a0a;">Fezzy Tickets</strong> for
                  <strong style="color:#0a0a0a;">${escapeHtml(orgName.trim())}</strong>. Your organizer details have landed with our
                  team and review is officially underway.
                </p>
                <p style="margin:0 0 16px 0;">
                  We'll email you again the moment a decision is made — or sooner, if we need anything else from you.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:14px 32px 0 32px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0a; border-radius:14px;">
                  <tr>
                    <td style="padding:24px 26px 18px 26px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="font-family: Arial, 'Helvetica Neue', sans-serif; color:#1BC46B; font-size:11px; font-weight:bold; letter-spacing:2px; text-transform:uppercase;">
                            What happens next
                          </td>
                          <td align="right" style="font-family: Arial, 'Helvetica Neue', sans-serif; color:#5c615f; font-size:11px; font-weight:bold; letter-spacing:1.5px; text-transform:uppercase;">
                            Fezzy&nbsp;&bull;&nbsp;Ticket
                          </td>
                        </tr>
                      </table>

                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;">
                        <tr>
                          <td width="30" valign="top" style="padding-bottom:14px;">
                            <span style="display:inline-block; width:20px; height:20px; background-color:#1BC46B; border-radius:50%; color:#0a0a0a; font-family:Arial, sans-serif; font-size:11px; font-weight:900; text-align:center; line-height:20px;">1</span>
                          </td>
                          <td valign="top" style="padding-bottom:14px; font-family:Arial, 'Helvetica Neue', sans-serif; color:#eef0ee; font-size:14px; line-height:1.5;">
                            Our team reviews your organizer details
                          </td>
                        </tr>
                        <tr>
                          <td width="30" valign="top" style="padding-bottom:14px;">
                            <span style="display:inline-block; width:20px; height:20px; background-color:#1BC46B; border-radius:50%; color:#0a0a0a; font-family:Arial, sans-serif; font-size:11px; font-weight:900; text-align:center; line-height:20px;">2</span>
                          </td>
                          <td valign="top" style="padding-bottom:14px; font-family:Arial, 'Helvetica Neue', sans-serif; color:#eef0ee; font-size:14px; line-height:1.5;">
                            We reach out if anything else is needed
                          </td>
                        </tr>
                        <tr>
                          <td width="30" valign="top">
                            <span style="display:inline-block; width:20px; height:20px; background-color:#ffffff; border-radius:50%; color:#0a0a0a; font-family:Arial, sans-serif; font-size:11px; font-weight:900; text-align:center; line-height:20px;">3</span>
                          </td>
                          <td valign="top" style="font-family:Arial, 'Helvetica Neue', sans-serif; color:#eef0ee; font-size:14px; line-height:1.5;">
                            You're notified the moment your account is approved
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
                      No action needed — please don't resubmit the form while this review is in progress.
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
      reviewEmailSent = true;
    } catch (emailError) {
      console.error("[ORGANIZER REVIEW EMAIL ERROR]", email, emailError);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        userId,
        pendingApproval: true,
        reviewEmailSent,
        message: "Application submitted for review",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Signup could not be completed",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
