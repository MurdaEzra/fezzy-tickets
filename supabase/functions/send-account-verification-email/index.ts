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
          <div style="font-family: Arial, sans-serif; color: #14213d; line-height: 1.5;">
            <h2 style="margin-bottom: 8px;">Your organizer details are under review</h2>
            <p>Hi ${escapeHtml(fullName || "there")},</p>
            <p>Thanks for applying to sell tickets on Fezzy Tickets for <strong>${escapeHtml(orgName.trim())}</strong>.</p>
            <p>Our team is reviewing your organizer details. We'll email you again once your account is approved or if we need more information.</p>
            <p style="margin-top: 20px;">You don't need to resubmit the form while this review is pending.</p>
            <p style="margin-top: 24px; font-size: 12px; color: #60708a;">Fezzy Tickets</p>
          </div>
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
