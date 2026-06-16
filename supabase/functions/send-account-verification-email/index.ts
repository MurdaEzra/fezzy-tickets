import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: {
        full_name: fullName ?? "",
        country: country ?? "",
        marketing_opt_in: Boolean(marketingOptIn),
        org_name: orgName.trim(),
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
      status: "pending",
    });

    if (requestError) {
      await admin.auth.admin.deleteUser(userId);
      throw requestError;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        userId,
        pendingApproval: true,
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
