import { supabase } from "@/integrations/supabase/client";

export type OrganizerAccessStatus =
  | "approved"
  | "pending"
  | "rejected"
  | "none";

export async function getOrganizerAccessStatus(userId: string): Promise<OrganizerAccessStatus> {
  const { data: profile } = await supabase
    .from("organizer_profiles")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  if (profile) return "approved";

  const { data: request } = await supabase
    .from("organizer_approval_requests")
    .select("status")
    .eq("user_id", userId)
    .maybeSingle();

  if (request?.status === "pending") return "pending";
  if (request?.status === "rejected") return "rejected";
  return "none";
}
