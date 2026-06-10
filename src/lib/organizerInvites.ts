import type { SupabaseClient } from "@supabase/supabase-js";

export async function createOrganizerAdminInvite(
  supabase: Pick<SupabaseClient, "rpc">,
  organizerId: string,
  invitedEmail: string,
) {
  return supabase.rpc("create_organizer_admin_invite", {
    _organizer_id: organizerId,
    _invited_email: invitedEmail.trim(),
    _expires_in_hours: 168,
  });
}
