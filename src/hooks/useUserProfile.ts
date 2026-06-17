import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { queryKeys } from "@/lib/queryClient";
import { fetchUserProfile } from "@/lib/userProfile";

export function useUserProfile() {
  const { user } = useAuth();
  return useQuery({
    queryKey: queryKeys.profile.user(user?.id ?? ""),
    queryFn: () => fetchUserProfile(user!.id),
    enabled: !!user?.id,
  });
}
