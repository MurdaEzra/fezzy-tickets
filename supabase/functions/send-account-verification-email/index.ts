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

  if (!apiKey) {
    throw new Error("BREVO_API_KEY not configured");
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      sender: {
        name: "Fezzy Tickets",
        email: "tickets@fezzy.app",
      },
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
      redirectTo,
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

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName ?? "",
        country: country ?? "",
        marketing_opt_in: Boolean(marketingOptIn),
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

    const verificationRedirect = redirectTo || `${req.headers.get("origin") || "https://fezzy-tickets.vercel.app"}/account`;

    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        redirectTo: verificationRedirect,
      },
    });

    if (linkError) {
      throw linkError;
    }

    const actionLink =
      linkData?.properties?.action_link ||
      linkData?.properties?.actionLink ||
      linkData?.action_link;

    if (!actionLink) {
      throw new Error("Verification link could not be generated");
    }

    await sendBrevoEmail({
      recipientEmail: email,
      subject: "Verify your Fezzy Tickets account",
      htmlContent: `
        <div style="font-family: Arial, sans-serif; color: #14213d; line-height: 1.5;">
          <h2 style="margin-bottom: 8px;">Welcome to Fezzy Tickets</h2>
          <p>Hi ${fullName || "there"},</p>
          <p>Thanks for creating your account. Please verify your email address to finish setting up your profile.</p>
          <p style="margin: 24px 0;">
            <a href="${actionLink}" style="background:#1FAD66;color:#fff;text-decoration:none;padding:12px 18px;border-radius:999px;display:inline-block;">Verify email</a>
          </p>
          <p>If the button does not work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #2f6fed;">${actionLink}</p>
          <p style="margin-top: 24px; font-size: 12px; color: #60708a;">This verification email was sent by Fezzy Tickets via Brevo.</p>
        </div>
      `,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        userId: createdUser?.user?.id ?? null,
        message: "Verification email sent",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Verification email could not be sent",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
