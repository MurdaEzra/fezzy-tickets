import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, Loader2, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";
import { supabase } from "@/integrations/supabase/client";

const ApplicationPending = () => {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const justSubmitted = params.get("submitted") === "1";
  const [status, setStatus] = useState<"loading" | "pending" | "rejected" | "approved">("loading");
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user && !justSubmitted) {
      navigate("/start-selling", { replace: true });
      return;
    }
    if (!user) {
      setStatus("pending");
      return;
    }
    (async () => {
      const access = await getOrganizerAccessStatus(user.id);
      if (access === "approved") {
        navigate("/dashboard", { replace: true });
        return;
      }
      const { data } = await supabase
        .from("organizer_approval_requests")
        .select("org_name, status")
        .eq("user_id", user.id)
        .maybeSingle();
      setOrgName(data?.org_name ?? (user.user_metadata?.org_name as string) ?? "");
      setStatus(access === "rejected" ? "rejected" : "pending");
    })();
  }, [user, authLoading, navigate, justSubmitted]);

  if (authLoading || status === "loading") {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="tm-page min-h-screen bg-background">
      <Navbar />
      <main className="bg-mesh">
        <section className="container-px mx-auto grid min-h-[calc(100vh-4rem)] max-w-xl place-items-center py-12">
          <div className="w-full rounded-3xl border border-border bg-card p-8 text-center shadow-soft md:p-10">
            {status === "rejected" ? (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-destructive/15 text-destructive">
                  <XCircle className="h-7 w-7" />
                </div>
                <h1 className="display mt-6 text-3xl text-foreground">Application not approved</h1>
                <p className="mt-3 text-muted-foreground">
                  Your organizer application{orgName ? ` for ${orgName}` : ""} was not approved at this time.
                  Contact support if you have questions.
                </p>
                <Button variant="outline" className="mt-8" onClick={() => signOut().then(() => navigate("/"))}>
                  Back to home
                </Button>
              </>
            ) : (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-primary/15 text-primary">
                  <Clock className="h-7 w-7" />
                </div>
                <h1 className="display mt-6 text-3xl text-foreground">
                  {justSubmitted ? "Application submitted" : "Awaiting approval"}
                </h1>
                <p className="mt-3 text-muted-foreground">
                  {justSubmitted
                    ? "Thanks! Your organizer application is with our team for review."
                    : "Your organizer application is still pending review."}
                  {orgName ? ` We'll notify you at your email once ${orgName} is approved.` : " We'll email you once you're approved."}
                </p>
                <p className="mt-4 text-sm text-muted-foreground">
                  After approval, you'll receive an email with a link to access your organizer dashboard.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Button variant="outline" asChild>
                    <Link to="/"><ArrowLeft className="mr-2 h-4 w-4" /> Back to home</Link>
                  </Button>
                  {user && (
                    <Button variant="ghost" onClick={() => signOut().then(() => navigate("/"))}>
                      Sign out
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default ApplicationPending;

