// @ts-nocheck
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Clock, Loader2, XCircle } from "lucide-react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
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
      <div className="fezzy-editorial min-h-screen grid place-items-center bg-ink text-cream">
        <Loader2 className="h-6 w-6 animate-spin text-ash" />
      </div>
    );
  }

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-xl place-items-center px-5 py-12 lg:px-8">
          <div className="w-full border border-cream/10 bg-ink-card p-8 text-center md:p-10">
            {status === "rejected" ? (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center bg-ember/15 text-ember">
                  <XCircle className="h-7 w-7" />
                </div>
                <h1 className="mt-6 font-display text-3xl text-cream">Application not approved</h1>
                <p className="mt-3 text-cream-dim">
                  Your organizer application{orgName ? ` for ${orgName}` : ""} was not approved at this time.
                  Contact support if you have questions.
                </p>
                <button className="btn-outline-editorial mt-8" onClick={() => signOut().then(() => navigate("/"))}>
                  Back to home
                </button>
              </>
            ) : (
              <>
                <div className="mx-auto grid h-14 w-14 place-items-center bg-fezzy/15 text-fezzy">
                  <Clock className="h-7 w-7" />
                </div>
                <h1 className="mt-6 font-display text-3xl text-cream">
                  {justSubmitted ? "Application submitted" : "Awaiting approval"}
                </h1>
                <p className="mt-3 text-cream-dim">
                  {justSubmitted
                    ? "Thanks! Your organizer application is with our team for review."
                    : "Your organizer application is still pending review."}
                  {orgName ? ` We'll notify you at your email once ${orgName} is approved.` : " We'll email you once you're approved."}
                </p>
                <p className="mt-4 text-sm text-ash">
                  After approval, you'll receive an email with a link to access your organizer dashboard.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link to="/" className="btn-outline-editorial">
                    <ArrowLeft className="h-4 w-4" /> Back to home
                  </Link>
                  {user && (
                    <button className="font-mono-label text-cream-dim transition-colors hover:text-cream" onClick={() => signOut().then(() => navigate("/"))}>
                      Sign out
                    </button>
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
