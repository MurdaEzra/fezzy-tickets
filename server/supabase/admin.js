import { createClient } from "@supabase/supabase-js";

export function createAdminClient(config) {
  return createClient(config.supabase.url, config.supabase.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function getUserFromAccessToken(admin, accessToken) {
  if (!accessToken) {
    return null;
  }

  const { data, error } = await admin.auth.getUser(accessToken);
  if (error || !data.user) {
    return null;
  }

  return data.user;
}
