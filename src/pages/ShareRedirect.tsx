import { useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

/**
 * Branded organizer share link: /o/{handle}/{event-slug}
 * Currently the event slug is globally unique, so we forward to /events/{slug}.
 * The handle is preserved for future analytics and so organizers can hand out a clean
 * URL that visibly belongs to them.
 */
const ShareRedirect = () => {
  const { handle, slug } = useParams();

  useEffect(() => {
    // Lightweight click attribution — stored client-side for now.
    if (handle && slug) {
      try {
        sessionStorage.setItem("share_handle", handle);
        sessionStorage.setItem("share_slug", slug);
      } catch {
        // ignore
      }
    }
  }, [handle, slug]);

  if (!slug) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Navigate to={`/events/${slug}`} replace />;
};

export default ShareRedirect;

