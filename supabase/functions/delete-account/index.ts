import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: organizerProfiles } = await adminClient
      .from("organizer_profiles")
      .select("id")
      .eq("user_id", user.id);
    const organizerIds = (organizerProfiles ?? []).map((profile) => profile.id);

    if (organizerIds.length > 0) {
      const { data: organizerEvents } = await adminClient
        .from("events")
        .select("id")
        .in("organizer_id", organizerIds);
      const eventIds = (organizerEvents ?? []).map((event) => event.id);

      if (eventIds.length > 0) {
        await adminClient.from("tickets").delete().in("event_id", eventIds);
        await adminClient.from("orders").delete().in("event_id", eventIds);
        await adminClient.from("ticket_tiers").delete().in("event_id", eventIds);
        await adminClient.from("events").delete().in("id", eventIds);
      }
    }

    await adminClient.from("orders").delete().eq("user_id", user.id);
    await adminClient.from("organizer_profiles").delete().eq("user_id", user.id);
    await adminClient.from("user_roles").delete().eq("user_id", user.id);
    await adminClient.from("profiles").delete().eq("id", user.id);

    const { error } = await adminClient.auth.admin.deleteUser(user.id);
    if (error) throw error;

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Delete failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
