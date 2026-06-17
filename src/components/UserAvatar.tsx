import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { resolveAvatarUrl, resolveDisplayName, resolveInitials } from "@/lib/userProfile";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export function UserAvatar({ className, imageClassName, fallbackClassName }: Props) {
  const { user } = useAuth();
  const { data: profile } = useUserProfile();
  const avatarUrl = resolveAvatarUrl(user, profile);
  const name = resolveDisplayName(user, profile);
  const initials = resolveInitials(name);

  return (
    <Avatar className={cn("h-10 w-10", className)}>
      {avatarUrl && <AvatarImage src={avatarUrl} alt={name} className={imageClassName} />}
      <AvatarFallback className={cn("bg-gradient-acacia text-sm font-bold text-primary-foreground", fallbackClassName)}>
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
