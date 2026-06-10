import type { SupabaseClient } from "@supabase/supabase-js";

export async function acceptOrganizerAdminInvite(
  supabase: Pick<SupabaseClient, "from">,
  organizerId: string,
  userId: string,
  invitedByUserId: string,
) {
  return supabase.from("organizer_team_members").upsert(
    {
      organizer_id: organizerId,
      user_id: userId,
      role: "admin",
      invited_by_user_id: invitedByUserId,
    },
    { onConflict: "organizer_id,user_id" },
  );
}

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
