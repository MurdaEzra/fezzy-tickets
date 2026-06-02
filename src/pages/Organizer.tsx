import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

// "For Organizers" is now a quick redirect:
// - Signed in  -> /dashboard
// - Signed out -> /auth?mode=signup&redirect=/dashboard
const Organizer = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (user) {
      // Logged-in users: if they already have an organizer profile we'll let
      // the dashboard handle the routing; otherwise send them through the
      // become-organizer flow (org name → pricing → dashboard).
      navigate("/become-organizer", { replace: true });
    } else {
      navigate("/become-organizer", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
};

export default Organizer;
