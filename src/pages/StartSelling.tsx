import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { getOrganizerAccessStatus } from "@/lib/organizerAccess";
import { toast } from "sonner";

const StartSelling = () => {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [orgName, setOrgName] = useState("");

  useEffect(() => {
    if (user) {
      getOrganizerAccessStatus(user.id).then((access) => {
        if (access === "approved") navigate("/dashboard", { replace: true });
        else if (access === "pending" || access === "rejected") navigate("/application-pending", { replace: true });
      });
    }
  }, [user, navigate]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = orgName.trim();
    if (!name) return;
    
    // Verify Turnstile token
    const turnstileToken = document.querySelector<HTMLInputElement>('[name="cf-turnstile-response"]')?.value;
    if (!turnstileToken) {
      toast.error("Please complete the security check");
      return;
    }

    const verifyResponse = await fetch(import.meta.env.VITE_TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: turnstileToken }),
    });
    const verifyResult = await verifyResponse.json();

    if (!verifyResult.success) {
      toast.error("Security check failed, please try again");
      return;
    }

    sessionStorage.setItem("pendingOrgName", name);
    navigate(`/auth?mode=signup&redirect=/dashboard&org=${encodeURIComponent(name)}`);
  };

  return (
    <div className="fezzy-editorial min-h-screen bg-ink text-cream">
      <Navbar />
      <main>
        <section className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-1440 place-items-center px-5 py-12 lg:px-8">
          <div className="w-full max-w-xl border border-cream/10 bg-ink-card p-7 md:p-10">
            <span className="inline-flex items-center gap-1.5 border border-cream/20 px-3 py-1 font-mono-label text-fezzy">
              Organizer setup
            </span>
            <h1 className="mt-4 font-display text-4xl text-cream sm:text-5xl">
              Submit your organization
            </h1>
            <p className="mt-3 text-cream-dim">
              Start by giving us your organization name. Next, you'll create your account and submit the details for admin review before dashboard access is approved.
            </p>
            <form onSubmit={submit} className="mt-7 space-y-4">
              <div>
                <label className="mb-1.5 block font-mono-label text-cream-dim">Organization name</label>
                <input
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  placeholder="e.g. Solstice Collective"
                  required
                  className="w-full border border-cream/15 bg-ink-soft px-4 py-3 text-sm text-cream outline-none transition-colors focus:border-fezzy placeholder:text-ash"
                />
              </div>
              <div 
                className="cf-turnstile" 
                data-sitekey="0x4AAAAAADsx12kgle0EfSNw"
                data-action="turnstile-spin-v1"
              ></div>
              <button type="submit" className="btn-ember w-full justify-center" disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                Continue to account
              </button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default StartSelling;
