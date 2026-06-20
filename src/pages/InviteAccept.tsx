import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { toast } from "sonner";
import { acceptOrganizerAdminInvite } from "@/lib/organizerInvites";

const InviteAccept = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [status, setStatus] = useState<"checking" | "success" | "error">("checking");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(`/auth?mode=signin&redirect=/invite/${token ?? ""}`, { replace: true });
      return;
    }

    const acceptInvite = async () => {
      if (!token) {
        setStatus("error");
        return;
      }

      const { data: invite, error } = await supabase
        .from("organizer_admin_invites")
        .select("id, organizer_id, created_by_user_id, expires_at, accepted_by_user_id")
        .eq("token", token)
        .maybeSingle();

      if (error || !invite) {
        setStatus("error");
        return;
      }

      if (invite.accepted_by_user_id || new Date(invite.expires_at) < new Date()) {
        setStatus("error");
        return;
      }

      const { error: addErr } = await acceptOrganizerAdminInvite(
        supabase,
        invite.organizer_id,
        user.id,
        invite.created_by_user_id,
      );

      if (addErr) {
        setStatus("error");
        toast.error("Could not join the organizer team", { description: addErr.message });
        return;
      }

      await supabase
        .from("organizer_admin_invites")
        .update({ accepted_by_user_id: user.id, accepted_at: new Date().toISOString() })
        .eq("id", invite.id);

      setStatus("success");
      toast.success("You’re now an organizer admin");
    };

    acceptInvite();
  }, [loading, navigate, token, user]);

  return (
    <div className="tm-page min-h-screen bg-background">
      <Navbar />
      <main className="container-px mx-auto flex min-h-[70vh] max-w-2xl items-center py-16">
        <section className="w-full rounded-[32px] border border-border bg-card p-8 text-center shadow-soft md:p-10">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="display mt-4 text-3xl text-foreground">Organizer admin invite</h1>
          <p className="mt-3 text-muted-foreground">Accepting this link adds you as an admin for the organizer dashboard.</p>

          {status === "checking" && (
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying your invite…
            </div>
          )}

          {status === "success" && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-foreground">Invite accepted. You can now manage events, payouts, and shares from the organizer dashboard.</p>
              <Button asChild variant="acacia">
                <Link to="/dashboard">Open dashboard</Link>
              </Button>
            </div>
          )}

          {status === "error" && (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-destructive">This invite is invalid, expired, or already accepted.</p>
              <Button asChild variant="outline">
                <Link to="/help">Go to help</Link>
              </Button>
            </div>
          )}
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default InviteAccept;

